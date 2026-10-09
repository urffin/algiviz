// Two rows use positional cell IDs because copy-back temporarily duplicates item IDs.
import { createSceneRenderer } from "@grundyjs/algiviz/scene";
export function mergeScene(state) {
    return {
        objects: [state.main, state.buffer].flatMap((items, row) => items.map((item, index) => ({
            id: `${row === 0 ? "main" : "buffer"}:${index}`,
            type: "cell",
            data: {
                index,
                row: row,
                item: row === 1 && (!state.range || index < state.range.start || index >= state.range.end) ?
                    null
                    : item
            }
        })))
    };
}
export function mergeSceneSteps(steps) {
    return steps.map(step => ({ ...step, state: mergeScene(step.state) }));
}
export function mergeItemLabel(item, original) {
    if (!item)
        return "·";
    const equals = original.filter(other => other.value === item.value);
    return `${item.value}${equals.length > 1 ? String.fromCharCode(97 + equals.findIndex(other => other.id === item.id)) : ""}`;
}
export function createMergeRenderer(en, original) {
    const scale = Math.max(1, ...original.map(value => Math.abs(value.value)));
    function layout(ctx) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const count = Math.max(1, original.length);
        return { width, height, pitch: (width - 32) / count, top: [70, height / 2 + 40], rowHeight: height / 2 - 125 };
    }
    function cell(ctx, item, index, row, color, opacity = 1) {
        const { pitch, top, rowHeight } = layout(ctx);
        const x = 16 + index * pitch;
        const baseline = top[row] + rowHeight * 0.65;
        const barHeight = item ? (item.value / scale) * rowHeight * (item.value < 0 ? 0.25 : 0.6) : 0;
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = color;
        const gap = Math.min(2, pitch * 0.15);
        ctx.fillRect(x + gap, baseline - Math.max(0, barHeight), pitch - 2 * gap, Math.max(2, Math.abs(barHeight)));
        ctx.fillStyle = "#f9fafb";
        ctx.font = `${Math.min(17, Math.max(9, pitch * 0.45))}px Arial`;
        ctx.textAlign = "center";
        if (pitch >= 24)
            ctx.fillText(mergeItemLabel(item, original), x + pitch / 2, top[row] + rowHeight + 13);
        ctx.fillStyle = "#9ca3af";
        ctx.font = "10px Arial";
        if (pitch >= 24) ctx.fillText(String(index), x + pitch / 2, top[row] + rowHeight + 28);
        ctx.restore();
    }
    const renderer = createSceneRenderer({
        cell(ctx, object, scene) {
            const data = object.current?.data ?? object.previous?.data;
            if (!data)
                return;
            const moving = scene.event.type === "buffer-write" ? data.row === 1 && data.index === scene.event.to
                : scene.event.type === "main-write" ? data.row === 0 && data.index === scene.event.index
                    : false;
            const highlighted = scene.event.type === "compare" &&
                data.row === 0 &&
                (data.index === scene.event.left || data.index === scene.event.right);
            const item = moving && scene.progress < 1 ? (object.previous?.data.item ?? null) : data.item;
            cell(ctx, item, data.index, data.row, scene.event.type === "done" && data.row === 0 ? "#34d399"
                : highlighted ? "#fbbf24"
                    : data.row === 0 ? "#818cf8"
                        : "#c084fc");
        }
    });
    return {
        render(ctx, frame) {
            const { width, height, pitch, top, rowHeight } = layout(ctx);
            ctx.fillStyle = "#111827";
            ctx.fillRect(0, 0, width, height);
            ctx.font = "16px Arial";
            ctx.textAlign = "left";
            ctx.fillStyle = "#f9fafb";
            ctx.fillText(en ? "Main array" : "Основной массив", 16, 26);
            ctx.fillText(en ? "Buffer (copies)" : "Буфер (копии)", 16, height / 2 + 8);
            const state = frame.current;
            if (state.range) {
                const { start, middle, end } = state.range;
                for (const [from, to, color] of [
                    [start, middle, "#818cf8"],
                    [middle, end, "#22d3ee"]
                ]) {
                    if (from === to)
                        continue;
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 3;
                    ctx.strokeRect(16 + from * pitch + 1, 45, (to - from) * pitch - 2, rowHeight + 70);
                }
                ctx.font = "12px Arial";
                ctx.fillStyle = "#d1d5db";
                ctx.fillText(`[${start}, ${middle}) | [${middle}, ${end})`, 16, 42);
            }
            renderer.render(ctx, { ...frame, previous: mergeScene(frame.previous), current: mergeScene(state) });
            const event = frame.event;
            if (frame.progress < 1 && (event.type === "buffer-write" || event.type === "main-write")) {
                const from = event.type === "buffer-write" ? event.from : event.index;
                const to = event.type === "buffer-write" ? event.to : event.index;
                const sourceRow = event.type === "buffer-write" ? 0 : 1;
                const targetRow = 1 - sourceRow;
                const item = event.type === "buffer-write" ? state.buffer[to] : state.main[to];
                ctx.save();
                ctx.translate((to - from) * pitch * frame.progress, (top[targetRow] - top[sourceRow]) * frame.progress);
                cell(ctx, item, from, sourceRow, "#fbbf24");
                ctx.restore();
            }
            ctx.font = "12px Arial";
            ctx.fillStyle = "#fbbf24";
            ctx.textAlign = "center";
            for (const [position, row, label] of [
                [state.left, 0, "i"],
                [state.right, 0, "j"],
                [state.output, event.type === "main-write" ? 0 : 1, "k"]
            ]) {
                const limit = label === "i" ? state.range?.middle : state.range?.end;
                if (position !== null && limit !== undefined && position < limit)
                    ctx.fillText(`↓ ${label}`, 16 + (position + 0.5) * pitch, top[row] - 5);
            }
        }
    };
}
