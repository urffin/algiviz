import type { GridBox, GridCellBox, GridGeometry } from "./grid-layout.js";
import { finite } from "./grid-layout.js";

export interface GridText { text: string; font: number; x: number; y: number; box: GridBox; cellIndex: number; caption: boolean }
interface Metrics { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number; font: number; text: string }
function line(value: string): string { return value.replace(/[\r\n\u2028\u2029]+/g, " "); }
function metrics(ctx: CanvasRenderingContext2D, value: string, font: number): Metrics {
    ctx.font = `${font}px sans-serif`;
    const m = ctx.measureText(value);
    if (!m || typeof m !== "object") throw new RangeError("Invalid grid text metrics");
    const width: unknown = m.width;
    if (typeof width !== "number" || !Number.isFinite(width) || width < 0) throw new RangeError("Invalid grid text advance");
    const ink = [m.actualBoundingBoxLeft, m.actualBoundingBoxRight, m.actualBoundingBoxAscent, m.actualBoundingBoxDescent];
    for (const n of ink) if (n !== undefined && (typeof n !== "number" || !Number.isFinite(n))) throw new RangeError("Invalid grid ink metrics");
    const minX = Math.min(-width / 2, -(ink[0] ?? width / 2)), maxX = Math.max(width / 2, ink[1] ?? width / 2);
    const minY = Math.min(-0.8 * font, -(ink[2] ?? 0.8 * font)), maxY = Math.max(0.2 * font, ink[3] ?? 0.2 * font);
    return { minX, maxX, minY, maxY, width: finite(maxX - minX), height: finite(maxY - minY), font, text: value };
}
export function gridText(ctx: CanvasRenderingContext2D, geometry: GridGeometry,
    labels: readonly (string | undefined)[], captions: readonly (string | null)[]): readonly GridText[] {
    const output: GridText[] = [];
    for (let i = 0; i < geometry.cells.length; i++) {
        const cell = geometry.cells[i]!, inner = geometry.side - 4;
        if (inner <= 0) continue;
        const label = line(labels[i] ?? ""), caption = line(captions[i] ?? "");
        const primary = new Map<number, Metrics>(), secondary = new Map<number, Metrics>();
        const get = (value: string, font: number, cache: Map<number, Metrics>) => {
            let measured = cache.get(font);
            if (!measured) { measured = metrics(ctx, value, font); cache.set(font, measured); }
            return measured;
        };
        function place(m: Metrics, y: number, isCaption: boolean): GridText | null {
            const x = finite(cell.x - (m.minX + m.maxX) / 2), baseline = finite(y - m.minY);
            const box = { left: finite(x + m.minX), right: finite(x + m.maxX), top: finite(baseline + m.minY), bottom: finite(baseline + m.maxY) };
            if (!inside(box, cell)) return null;
            return { text: m.text, font: m.font, x, y: baseline, box, cellIndex: i, caption: isCaption };
        }
        let chosen: GridText[] | undefined;
        if (label && caption) {
            for (let a = 14; a >= 8 && !chosen; a--) {
                const first = get(label, a, primary);
                if (first.width > inner) continue;
                for (let b = 11; b >= 8; b--) {
                    const second = get(caption, b, secondary), height = first.height + 2 + second.height;
                    if (second.width > inner || height > inner) continue;
                    const top = finite(cell.y - height / 2), p = place(first, top, false), c = place(second, top + first.height + 2, true);
                    if (p && c) { chosen = [p, c]; break; }
                }
            }
        }
        if (!chosen) for (const [value, maximum, cache, isCaption] of [[label, 14, primary, false], [caption, 11, secondary, true]] as const) {
            if (!value) continue;
            for (let font = maximum; font >= 8; font--) {
                const m = get(value, font, cache);
                if (m.width > inner || m.height > inner) continue;
                const item = place(m, cell.y - m.height / 2, isCaption);
                if (item) { chosen = [item]; break; }
            }
            if (chosen) break;
        }
        if (chosen) output.push(...chosen);
    }
    return output;
}
function inside(box: GridBox, cell: GridCellBox): boolean {
    return box.left >= cell.left + 2 && box.right <= cell.right - 2 && box.top >= cell.top + 2 && box.bottom <= cell.bottom - 2;
}
