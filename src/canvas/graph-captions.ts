import type { GraphNodePaint, GraphEdgePaint } from "./graph-geometry.js";

type Point = Readonly<{ x: number; y: number }>;
type Curve = readonly [Point, Point, Point, Point];
type Box = { left: number; top: number; right: number; bottom: number };
interface Cell extends Box { width: number; height: number }
export interface CaptionPaint extends Box { text: string; x: number; y: number; presence: number }

function finite(value: number): number {
    if (!Number.isFinite(value)) throw new RangeError("Graph caption geometry is not representable");
    return value;
}
function box(left: number, top: number, right: number, bottom: number): Box {
    return { left: finite(left), top: finite(top), right: finite(right), bottom: finite(bottom) };
}
function expand(b: Box, gap: number): Box { return box(b.left - gap, b.top - gap, b.right + gap, b.bottom + gap); }
function overlaps(a: Box, b: Box): boolean {
    return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}
function bounds(points: readonly Point[]): Box {
    return box(Math.min(...points.map(p => p.x)), Math.min(...points.map(p => p.y)),
        Math.max(...points.map(p => p.x)), Math.max(...points.map(p => p.y)));
}
function cell(ctx: CanvasRenderingContext2D, text: string): Cell | undefined {
    const m = ctx.measureText(text);
    if (!m || typeof m.width !== "number") return undefined;
    const width = finite(m.width);
    if (width < 0) throw new RangeError("Graph text width must be nonnegative");
    const ink = [m.actualBoundingBoxLeft, m.actualBoundingBoxRight, m.actualBoundingBoxAscent, m.actualBoundingBoxDescent];
    for (const value of ink) if (typeof value === "number") finite(value);
    if (!ink.every(value => typeof value === "number")) return undefined;
    const area = box(Math.min(-width / 2, -m.actualBoundingBoxLeft), Math.min(-8, -m.actualBoundingBoxAscent),
        Math.max(width / 2, m.actualBoundingBoxRight), Math.max(8, m.actualBoundingBoxDescent));
    return { ...area, width: finite(area.right - area.left), height: finite(area.bottom - area.top) };
}
const middle = (a: Point, b: Point): Point => ({ x: a.x / 2 + b.x / 2, y: a.y / 2 + b.y / 2 });
/** Convex-hull bounds cover every curve interval; unresolved intervals reject conservatively. */
function curveHits(area: Box, curve: Curve, depth = 0): boolean {
    const hull = bounds(curve);
    if (!overlaps(area, hull)) return false;
    if (depth === 12 || Math.max(hull.right - hull.left, hull.bottom - hull.top) <= .25) return true;
    if (curve.every(p => p.x >= area.left && p.x <= area.right && p.y >= area.top && p.y <= area.bottom)) return true;
    const [a, b, c, d] = curve, ab = middle(a, b), bc = middle(b, c), cd = middle(c, d);
    const abc = middle(ab, bc), bcd = middle(bc, cd), center = middle(abc, bcd);
    return curveHits(area, [a, ab, abc, center], depth + 1) || curveHits(area, [center, bcd, cd, d], depth + 1);
}

/** A pure per-frame placement plan apart from host text measurement. No retained winners. */
export function graphCaptions(ctx: CanvasRenderingContext2D,
    nodes: readonly (GraphNodePaint & { text: string })[], edges: readonly (GraphEdgePaint & { text: string })[],
    radius: number, width: number, height: number): readonly CaptionPaint[] {
    const requested = nodes.filter(n => n.presence > 0 && n.view.caption !== undefined)
        .map(node => ({ node, text: node.view.caption!.replace(/[\t\r\n\u2028\u2029]+/g, " ") }))
        .filter(item => item.text.trim().length > 0);
    if (!requested.length) return [];
    const rectangles: Box[] = [], circles = nodes.filter(n => n.presence > 0);
    // Unscaled primary text bounds are conservative even when fillText uses maxWidth.
    for (const node of circles) if (node.text) {
        const c = cell(ctx, node.text); if (!c) return [];
        rectangles.push(box(node.point.x + c.left, node.point.y + c.top, node.point.x + c.right, node.point.y + c.bottom));
    }
    const strokes = edges.filter(e => e.presence > 0);
    for (const edge of strokes) {
        if (edge.arrow.length) rectangles.push(bounds(edge.arrow));
        if (edge.text) {
            const c = cell(ctx, edge.text); if (!c) return [];
            rectangles.push(box(edge.label.x + c.left, edge.label.y + c.top, edge.label.x + c.right, edge.label.y + c.bottom));
        }
    }
    const output: CaptionPaint[] = [];
    for (const { node, text } of requested) {
        const c = cell(ctx, text); if (!c) continue;
        const w = finite(c.width + 8), h = finite(c.height + 4);
        if (w > 120 || w > width - 8 || h > height - 8) continue;
        const { x, y } = node.point, side = radius + 4 + w / 2, vertical = radius + 4 + h / 2;
        const candidates = [[x, y + vertical], [x, y - vertical], [x + side, y], [x - side, y],
            [x + side, y + radius], [x - side, y + radius], [x + side, y - radius], [x - side, y - radius]];
        for (const [cx, cy] of candidates) {
            const b = box(cx! - w / 2, cy! - h / 2, cx! + w / 2, cy! + h / 2);
            if (b.left < 4 || b.top < 4 || b.right > width - 4 || b.bottom > height - 4) continue;
            const safe = expand(b, 2);
            if (circles.some(n => Math.hypot(Math.max(b.left - n.point.x, 0, n.point.x - b.right),
                Math.max(b.top - n.point.y, 0, n.point.y - b.bottom)) <= radius + 2)) continue;
            if (rectangles.some(r => overlaps(safe, r))) continue;
            if (strokes.some(e => curveHits(expand(b, 2 + (e.view.result || e.view.role === "active" ? 3 : 1.5) / 2), e.curve))) continue;
            output.push({ ...b, text, x: finite(b.left + 4 - c.left), y: finite(b.top + 2 - c.top), presence: node.presence });
            rectangles.push(b); break;
        }
    }
    return output;
}
