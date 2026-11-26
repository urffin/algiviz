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

type TextEdge = GraphEdgePaint & { text: string };
type TextNode = GraphNodePaint & { text: string };

function tangentAt([a, b, c, d]: Curve, t: number) {
    const mix = (left: Point, right: Point): Point => ({
        x: (1 - t) * left.x + t * right.x,
        y: (1 - t) * left.y + t * right.y
    });
    const ab = mix(a, b), bc = mix(b, c), cd = mix(c, d);
    const start = mix(ab, bc), end = mix(bc, cd);
    const x = end.x - start.x, y = end.y - start.y;
    const length = Math.hypot(x, y);
    return length > 0 ? { point: mix(start, end), nx: y / length, ny: -x / length } : undefined;
}

/** Place horizontal labels against the actual visible curves in logical pixels. */
export function graphEdgeLabels(ctx: CanvasRenderingContext2D, nodes: readonly TextNode[], edges: readonly TextEdge[],
    radius: number, width: number, height: number, preferredSide: "left" | "right"): ReadonlyMap<TextEdge, CaptionPaint> {
    const placed = new Map<TextEdge, CaptionPaint>();
    const strokes = edges.filter(edge => edge.presence > 0);
    if (!strokes.some(edge => edge.text)) return placed;
    const visibleNodes = nodes.filter(node => node.presence > 0);
    const occupied = strokes.filter(edge => edge.arrow.length).map(edge => bounds(edge.arrow));
    const measures = new Map<string, Cell | undefined>();
    function measure(text: string): Cell | undefined {
        if (!measures.has(text)) measures.set(text, cell(ctx, text));
        return measures.get(text);
    }
    for (const { point, text } of visibleNodes) {
        if (!text) continue;
        const ink = measure(text);
        if (!ink) return placed;
        occupied.push(box(point.x + ink.left, point.y + ink.top, point.x + ink.right, point.y + ink.bottom));
    }
    const preferred = preferredSide === "left" ? 1 : -1;
    for (const edge of strokes) {
        if (!edge.text) continue;
        const ink = measure(edge.text);
        if (!ink) continue;
        const halfWidth = ink.width / 2, halfHeight = ink.height / 2;
        const { left: inkLeft, top: inkTop } = ink;
        if (ink.width + 8 > width || ink.height + 8 > height) continue;

        function tryPlace(): CaptionPaint | undefined {
            for (const t of [.5, .4, .6, .3, .7, .2, .8]) {
                const along = tangentAt(edge.curve, t);
                if (!along) continue;
                const { point, nx, ny } = along;
                const normalExtent = Math.abs(nx) * halfWidth + Math.abs(ny) * halfHeight;
                for (const gap of [4, 9]) for (const side of [preferred, -preferred]) {
                    const distance = side * (normalExtent + gap);
                    const x = point.x + nx * distance, y = point.y + ny * distance;
                    const b = box(x - halfWidth, y - halfHeight, x + halfWidth, y + halfHeight);
                    if (b.left < 4 || b.top < 4 || b.right > width - 4 || b.bottom > height - 4) continue;
                    if (visibleNodes.some(node => Math.hypot(Math.max(b.left - node.point.x, 0, node.point.x - b.right),
                        Math.max(b.top - node.point.y, 0, node.point.y - b.bottom)) <= radius + 2)) continue;
                    const clearance = expand(b, 2);
                    if (occupied.some(other => overlaps(clearance, other))) continue;
                    // Reserve the maximum stroke width so role changes do not move a label.
                    const safe = expand(b, 3.5);
                    if (strokes.some(stroke => curveHits(safe, stroke.curve))) continue;
                    return { ...b, x: b.left - inkLeft, y: b.top - inkTop,
                        text: edge.text, presence: edge.presence };
                }
            }
        }
        const label = tryPlace();
        if (label) {
            placed.set(edge, label);
            occupied.push(label);
        }
    }
    return placed;
}

/** A pure per-frame placement plan apart from host text measurement. No retained winners. */
export function graphCaptions(ctx: CanvasRenderingContext2D,
    nodes: readonly TextNode[], edges: readonly TextEdge[],
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
