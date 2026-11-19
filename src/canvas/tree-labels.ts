import { finite } from "./tree-layout.js";
import { mix, point, type Point, type Curve, type NodePaint, type LinkPaint, type SlotPaint } from "./tree-geometry.js";

interface Box { left: number; top: number; right: number; bottom: number }
interface Cell extends Box { width: number; height: number }
export interface TextPaint extends Box { text: string; x: number; y: number; presence: number }
export const lineText = (text: string): string => text.replace(/[\t\r\n\u2028\u2029]+/g, " ");
function box(left: number, top: number, right: number, bottom: number): Box {
    return { left: finite(left), top: finite(top), right: finite(right), bottom: finite(bottom) };
}
function expand(b: Box, n: number): Box { return box(b.left - n, b.top - n, b.right + n, b.bottom + n); }
function overlaps(a: Box, b: Box): boolean { return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top; }
function bounds(curve: Curve): Box {
    return box(Math.min(...curve.map(p => p.x)), Math.min(...curve.map(p => p.y)),
        Math.max(...curve.map(p => p.x)), Math.max(...curve.map(p => p.y)));
}
function halves(c: Curve): readonly [Curve, Curve] {
    const ab = mix(c[0], c[1], .5), bc = mix(c[1], c[2], .5), cd = mix(c[2], c[3], .5);
    const abc = mix(ab, bc, .5), bcd = mix(bc, cd, .5), mid = mix(abc, bcd, .5);
    return [[c[0], ab, abc, mid], [mid, bcd, cd, c[3]]];
}
/** Convex hull subdivision covers every interval, unlike sparse curve sampling. */
function curveHits(area: Box, curve: Curve, depth = 0): boolean {
    const hull = bounds(curve);
    if (!overlaps(area, hull)) return false;
    if (depth === 12 || Math.max(hull.right - hull.left, hull.bottom - hull.top) <= .25) return true;
    const [a, b] = halves(curve);
    return curveHits(area, a, depth + 1) || curveHits(area, b, depth + 1);
}
function curvesHit(a: Curve, b: Curve, gap: number, depth = 0): boolean {
    const ba = bounds(a), bb = bounds(b);
    if (!overlaps(expand(ba, gap), bb)) return false;
    if (depth === 16 || Math.max(ba.right - ba.left, ba.bottom - ba.top, bb.right - bb.left, bb.bottom - bb.top) <= .25) return true;
    const splitA = Math.max(ba.right - ba.left, ba.bottom - ba.top) >= Math.max(bb.right - bb.left, bb.bottom - bb.top);
    const [first, second] = halves(splitA ? a : b);
    return splitA ? curvesHit(first, b, gap, depth + 1) || curvesHit(second, b, gap, depth + 1)
        : curvesHit(a, first, gap, depth + 1) || curvesHit(a, second, gap, depth + 1);
}
function circleHits(b: Box, center: Point, radius: number): boolean {
    return Math.hypot(Math.max(b.left - center.x, 0, center.x - b.right), Math.max(b.top - center.y, 0, center.y - b.bottom)) <= radius;
}
function lineCircle(a: Point, b: Point, center: Point, radius: number): boolean {
    const dx = finite(b.x - a.x), dy = finite(b.y - a.y), length = finite(dx * dx + dy * dy);
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, finite((center.x - a.x) * dx + (center.y - a.y) * dy) / length));
    return Math.hypot(center.x - (a.x + t * dx), center.y - (a.y + t * dy)) <= radius;
}
function cell(ctx: CanvasRenderingContext2D, text: string): Cell | undefined {
    const metrics = ctx.measureText(text);
    if (metrics === null || metrics === undefined) return undefined;
    const values = [metrics.width, metrics.actualBoundingBoxLeft, metrics.actualBoundingBoxRight,
        metrics.actualBoundingBoxAscent, metrics.actualBoundingBoxDescent];
    // Validate *all* supplied numbers before deciding that another field is missing.
    for (const value of values) if (typeof value === "number") finite(value);
    if (typeof values[0] === "number" && values[0] < 0) throw new RangeError("Tree text width must be nonnegative");
    if (!values.every(value => typeof value === "number")) return undefined;
    const [advance, left, right, ascent, descent] = values as [number, number, number, number, number];
    const b = box(Math.min(-advance / 2, -left), Math.min(-8, -ascent), Math.max(advance / 2, right), Math.max(8, descent));
    return { ...b, width: finite(b.right - b.left), height: finite(b.bottom - b.top) };
}

/** Per-call reservations. Host measurement completes before any pixel mutation. */
export function treeLabels(ctx: CanvasRenderingContext2D, nodes: readonly NodePaint[], links: readonly LinkPaint[],
    slots: readonly SlotPaint[], radius: number, width: number, height: number, captions: boolean, showSlots: boolean) {
    const circles = nodes.filter(n => n.presence > 0), strokes = links.filter(l => l.presence > 0);
    const rectangles: Box[] = [], labels: TextPaint[] = [], captionPaint: TextPaint[] = [], slotPaint: SlotPaint[] = [];
    let reliable = true;
    for (const node of circles) {
        const text = lineText(node.view.node.label ?? node.view.node.id);
        if (!text.trim()) continue;
        const c = cell(ctx, text);
        if (!c) reliable = false;
        else rectangles.push(box(node.point.x + c.left, node.point.y + c.top, node.point.x + c.right, node.point.y + c.bottom));
    }
    function inside(b: Box): boolean { return b.left >= 4 && b.top >= 4 && b.right <= width - 4 && b.bottom <= height - 4; }
    function safe(b: Box): boolean {
        return reliable && inside(b) && !circles.some(n => circleHits(b, n.point, radius + 2))
            && !rectangles.some(r => overlaps(expand(b, 2), r))
            && !strokes.some(l => curveHits(expand(b, 2 + (l.view.result || l.view.role === "active" ? 1.5 : .75)), l.curve));
    }
    function measured(text: string): Cell | undefined {
        if (!text.trim()) return undefined;
        const c = cell(ctx, text);
        if (!c) return undefined;
        const w = finite(c.width + 8), h = finite(c.height + 4);
        return w > 120 || w > width - 8 || h > height - 8 ? undefined : c;
    }
    function accept(text: string, c: Cell, x: number, y: number, presence: number): TextPaint | undefined {
        const w = finite(c.width + 8), h = finite(c.height + 4), b = box(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
        if (!safe(b)) return undefined;
        rectangles.push(b);
        return { ...b, text, x: finite(b.left + 4 - c.left), y: finite(b.top + 2 - c.top), presence };
    }
    for (const link of strokes) {
        const text = lineText(link.view.link.label ?? ""), c = measured(text);
        if (!c) continue;
        const [a, b, d, e] = link.curve;
        const center = point(a.x / 8 + b.x * 3 / 8 + d.x * 3 / 8 + e.x / 8,
            a.y / 8 + b.y * 3 / 8 + d.y * 3 / 8 + e.y / 8);
        const dx = finite(-a.x - b.x + d.x + e.x), dy = finite(-a.y - b.y + d.y + e.y), len = finite(Math.hypot(dx, dy));
        const nx = len ? -dy / len : 1, ny = len ? dx / len : 0;
        const offset = finite(Math.abs(nx) * (c.width + 8) / 2 + Math.abs(ny) * (c.height + 4) / 2 + 5);
        for (const sign of [1, -1]) {
            const paint = accept(text, c, finite(center.x + sign * nx * offset), finite(center.y + sign * ny * offset), link.presence);
            if (paint) { labels.push(paint); break; }
        }
    }
    const acceptedSlots: { curve: Curve; square: Box }[] = [];
    if (showSlots && reliable) for (const slot of slots) {
        if (slot.presence <= 0) continue;
        // Reserve the painted square, including half of its 1.5px stroke.
        const square = expand(box(slot.end.x - 3, slot.end.y - 3, slot.end.x + 3, slot.end.y + 3), .75);
        const segment: Curve = [slot.start, slot.start, slot.end, slot.end];
        const segmentBounds = expand(bounds(segment), .75);
        if (!inside(square) || !inside(segmentBounds)) continue;
        const owner = circles.find(n => n.view.node.id === slot.owner);
        if (!owner || finite((slot.start.x - owner.point.x) * (slot.end.x - slot.start.x)
            + (slot.start.y - owner.point.y) * (slot.end.y - slot.start.y)) < 0) continue;
        if (circles.some(n => circleHits(square, n.point, radius + 2)
            || (n.view.node.id !== slot.owner && lineCircle(slot.start, slot.end, n.point, radius + 2.75)))) continue;
        if (rectangles.some(b => overlaps(expand(square, 2), b) || curveHits(expand(b, 2.75), segment))) continue;
        if (strokes.some(l => curveHits(expand(square, 2 + (l.view.result || l.view.role === "active" ? 1.5 : .75)), l.curve)
            || curvesHit(segment, l.curve, 2.75 + (l.view.result || l.view.role === "active" ? 1.5 : .75)))) continue;
        if (acceptedSlots.some(s => overlaps(expand(square, 2), s.square) || curveHits(expand(square, 2.75), s.curve)
            || curveHits(expand(s.square, 2.75), segment) || curvesHit(segment, s.curve, 3.5))) continue;
        acceptedSlots.push({ curve: segment, square }); slotPaint.push(slot);
    }
    if (captions) for (const node of circles) {
        const text = lineText(node.view.caption ?? ""), c = measured(text);
        if (!c) continue;
        const { x, y } = node.point, side = finite(radius + 4 + (c.width + 8) / 2), vertical = finite(radius + 4 + (c.height + 4) / 2);
        for (const [cx, cy] of [[x, y + vertical], [x, y - vertical], [x + side, y], [x - side, y],
            [x + side, y + radius], [x - side, y + radius], [x + side, y - radius], [x - side, y - radius]]) {
            const b = box(cx! - (c.width + 8) / 2, cy! - (c.height + 4) / 2, cx! + (c.width + 8) / 2, cy! + (c.height + 4) / 2);
            if (acceptedSlots.some(s => overlaps(expand(b, 2), s.square) || curveHits(expand(b, 2.75), s.curve))) continue;
            const paint = accept(text, c, cx!, cy!, node.presence);
            if (paint) { captionPaint.push(paint); break; }
        }
    }
    return { labels, captions: captionPaint, slots: slotPaint };
}
