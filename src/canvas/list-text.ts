import { finite } from "./list-geometry.js";
import type { Box } from "./list-geometry.js";

interface Metrics { left: number; top: number; right: number; bottom: number; width: number; height: number }
interface Line { text: string; font: number; color: string; metrics: Metrics }
export interface TextItem { text: string; font: number; color: string; x: number; y: number; box: Box; alpha: number }
export interface TextLabel { text: string; max: number; color: string }

function measure(ctx: CanvasRenderingContext2D, text: string, font: number): Metrics {
    ctx.font = `${font}px sans-serif`;
    const metrics = ctx.measureText(text);
    if (!metrics || typeof metrics !== "object") throw new RangeError("Invalid list text metrics");
    const width: unknown = metrics.width;
    if (typeof width !== "number" || !Number.isFinite(width) || width < 0) throw new RangeError("Invalid list text advance");
    const ink = [metrics.actualBoundingBoxLeft, metrics.actualBoundingBoxRight,
        metrics.actualBoundingBoxAscent, metrics.actualBoundingBoxDescent];
    if (ink.some(n => n !== undefined && (typeof n !== "number" || !Number.isFinite(n)))) throw new RangeError("Invalid list ink metrics");
    const left = Math.min(-width / 2, -(ink[0] ?? width / 2));
    const right = Math.max(width / 2, ink[1] ?? width / 2);
    const top = Math.min(-0.8 * font, -(ink[2] ?? 0.8 * font));
    const bottom = Math.max(0.2 * font, ink[3] ?? 0.2 * font);
    return { left, right, top, bottom, width: finite(right - left), height: finite(bottom - top) };
}
function overlaps(a: Box, b: Box, gap: number): boolean {
    return a.left < b.right + gap && a.right + gap > b.left && a.top < b.bottom + gap && a.bottom + gap > b.top;
}
export function listText(ctx: CanvasRenderingContext2D, obstacles: readonly Box[]) {
    const items: TextItem[] = [];
    function add(area: Box, body: Box, alpha: number, label: TextLabel, caption?: TextLabel): void {
        const width = area.right - area.left - 4, height = area.bottom - area.top - 4;
        if (alpha <= 0 || width <= 0 || height < 8) return;
        const centerX = area.left / 2 + area.right / 2, centerY = area.top / 2 + area.bottom / 2;
        function candidates(label: TextLabel): Line[] {
            const text = label.text.replace(/[\t\r\n\u2028\u2029]+/g, " ");
            if (!text.trim()) return [];
            const lines: Line[] = [];
            for (let font = label.max; font >= 8; font--) {
                const metrics = measure(ctx, text, font);
                if (metrics.width <= width && metrics.height <= height) lines.push({ text, font, color: label.color, metrics });
            }
            return lines;
        }
        function tryLines(lines: readonly Line[]): boolean {
            const total = lines.reduce((sum, line) => sum + line.metrics.height, (lines.length - 1) * 2);
            if (total > height) return false;
            let top = finite(centerY - total / 2);
            const planned: TextItem[] = [];
            for (const { metrics: m, text, font, color } of lines) {
                const x = finite(centerX - (m.left / 2 + m.right / 2)), y = finite(top - m.top);
                const box = { left: finite(x + m.left), right: finite(x + m.right), top: finite(y + m.top), bottom: finite(y + m.bottom) };
                if (box.left < area.left + 2 || box.right > area.right - 2 || box.top < area.top + 2 || box.bottom > area.bottom - 2 ||
                    obstacles.some(other => other !== body && overlaps(box, other, 2)) ||
                    items.some(other => overlaps(box, other.box, 2))) return false;
                planned.push({ text, font, color, x, y, box, alpha });
                top = finite(top + m.height + 2);
            }
            items.push(...planned);
            return true;
        }
        const primary = candidates(label), secondary = caption ? candidates(caption) : [];
        for (const a of primary) for (const b of secondary) if (tryLines([a, b])) return;
        for (const line of [...primary, ...secondary]) if (tryLines([line])) return;
    }
    return { items, add };
}
