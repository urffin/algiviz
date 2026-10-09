import type { Item, SortSnapshot } from "../core/types.js";
import type { SortFrame } from "../core/timeline.js";

const palettes = {
    dark: { background: "#101827", text: "#f1f5f9", bar: "#94a3b8", sorted: "#34d399", active: "#fbbf24", held: "#c4b5fd" },
    light: { background: "#f8fafc", text: "#0f172a", bar: "#475569", sorted: "#047857", active: "#b45309", held: "#7c3aed" }
};

export { createSortRenderer as createArrayRenderer };

function positions(state: SortSnapshot): Map<string, { item: Item; index: number; held: boolean }> {
    const result = new Map<string, { item: Item; index: number; held: boolean }>();
    state.slots.forEach((item, index) => { if (item) result.set(item.id, { item, index, held: false }); });
    if (state.held) result.set(state.held.id, { item: state.held,
        index: state.slots.indexOf(null), held: true });
    return result;
}

/** Stateless full-frame renderer. Bitmap dimensions determine layout and video size. */
export function createSortRenderer(options: { theme: "light" | "dark" }) {
    const colors = palettes[options.theme];
    return Object.freeze({
        render(ctx: CanvasRenderingContext2D, frame: SortFrame): void {
            const { width, height } = ctx.canvas;
            if (width <= 0 || height <= 0) return;
            const before = positions(frame.previous);
            const after = positions(frame.current);
            const items = [...after.values()];
            const count = frame.current.slots.length;
            const margin = Math.min(32, width * 0.05);
            const cell = (width - 2 * margin) / Math.max(count, 1);
            const barWidth = cell * 0.7;
            const available = height * 0.48;
            const maxMagnitude = Math.max(1, ...items.map(({ item }) => Math.abs(item.value)));
            const baseline = height * 0.69;
            const fontSize = Math.max(9, Math.min(20, cell * 0.45, width * 0.035));
            const progress = frame.progress;
            const p = progress * progress * (3 - 2 * progress);
            const event = frame.event;
            ctx.save();
            try {
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.globalAlpha = 1;
                ctx.fillStyle = colors.background;
                ctx.fillRect(0, 0, width, height);
                ctx.font = `${Math.max(12, Math.min(24, width * 0.045))}px sans-serif`;
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                ctx.fillStyle = colors.text;
                ctx.fillText(`AlgiViz · ${event.type} · ${frame.stepIndex}`, margin, height * 0.07);
                if (!count) ctx.fillText("Empty array", margin, baseline);
                for (const [id, next] of after) {
                    const old = before.get(id) ?? next;
                    const x = margin + ((old.index + (next.index - old.index) * p) + 0.5) * cell;
                    const size = Math.max(4, Math.abs(next.item.value) / maxMagnitude * available);
                    const active = event.type === "highlight" ? event.itemIds.includes(id) :
                        event.type === "compare" || event.type === "swap" ? id === event.leftId || id === event.rightId :
                        "itemId" in event && event.itemId === id;
                    ctx.fillStyle = next.held ? colors.held : active ? colors.active :
                        next.index < frame.current.sortedPrefixLength ||
                        next.index >= count - (frame.current.sortedSuffixLength ?? 0) ? colors.sorted : colors.bar;
                    ctx.fillRect(x - barWidth / 2, baseline - size, barWidth, size);
                    if (cell < 24) continue;
                    ctx.fillStyle = colors.text;
                    ctx.font = `${fontSize}px sans-serif`;
                    ctx.textAlign = "center";
                    ctx.fillText(String(next.item.value), x, baseline - size - fontSize, cell * 0.95);
                    ctx.fillText(String(next.index), margin + (next.index + 0.5) * cell, baseline + height * 0.06);
                }
                ctx.textAlign = "left";
                ctx.font = `${Math.max(11, Math.min(18, width * 0.03))}px sans-serif`;
                ctx.fillStyle = colors.text;
                ctx.fillText(`Comparisons: ${frame.current.comparisons} · Writes: ${frame.current.writes}`,
                    margin, height * 0.9, width - margin * 2);
            } finally { ctx.restore(); }
        }
    });
}
