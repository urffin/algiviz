import type { ListObjects, ListNodeView, ListPointerView, ListPosition } from "../list/types.js";
import type { SceneFrame } from "../scene/index.js";

export interface Point { x: number; y: number }
export interface Box { left: number; top: number; right: number; bottom: number }
export interface Glyph {
    box: Box;
    alpha: number;
    view: ListPointerView;
}
export interface NodeGlyph<Value> {
    box: Box;
    divider: number;
    port: Point;
    alpha: number;
    view: ListNodeView<Value>;
    exiting: boolean;
}
export interface Route {
    points: readonly Point[];
    arrow: readonly Point[];
    lineWidth: number;
    alpha: number;
    view: ListPointerView;
    marker: Glyph | undefined;
}

export function finite(value: number): number {
    if (!Number.isFinite(value)) throw new RangeError("List drawing geometry is not representable");
    return value;
}
function point(x: number, y: number): Point { return { x: finite(x), y: finite(y) }; }
function box(center: Point, halfWidth: number, halfHeight: number): Box {
    const left = finite(center.x - halfWidth), right = finite(center.x + halfWidth);
    const top = finite(center.y - halfHeight), bottom = finite(center.y + halfHeight);
    if (!(left < center.x && center.x < right && top < center.y && center.y < bottom)) {
        throw new RangeError("List glyph extent is not representable");
    }
    return { left, top, right, bottom };
}
function mix(a: Point, b: Point, p: number): Point {
    return point((1 - p) * a.x + p * b.x, (1 - p) * a.y + p * b.y);
}
function headCenter(layout: readonly ListPosition[], gap: number): Point {
    let x = Infinity, y = Infinity;
    for (const node of layout) { x = Math.min(x, node.x); y = Math.min(y, node.y); }
    return point((layout.length ? x : 0) - 1 - gap, (layout.length ? y : 0) - 0.5 - gap);
}
function nullCenter(owner: Point, head: boolean, gap: number): Point {
    return head ? point(owner.x, owner.y + (1 + gap)) : point(owner.x + (1 + gap), owner.y);
}

export function listGeometry<Value>(scene: SceneFrame<ListObjects<Value>, undefined>,
    previous: readonly ListPosition[], current: readonly ListPosition[], width: number, height: number, gap: number) {
    const beforeHead = headCenter(previous, gap), afterHead = headCenter(current, gap);
    const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    function include(b: Box) {
        bounds.left = Math.min(bounds.left, b.left); bounds.top = Math.min(bounds.top, b.top);
        bounds.right = Math.max(bounds.right, b.right); bounds.bottom = Math.max(bounds.bottom, b.bottom);
    }
    for (const head of [beforeHead, afterHead]) {
        include(box(head, 0.6, 0.25));
        include(box(nullCenter(head, true, gap), 0.5, 0.25));
    }
    for (const endpoint of [previous, current]) for (const node of endpoint) {
        include(box(node, 1, 0.5));
        include(box(nullCenter(node, false, gap), 0.5, 0.25));
    }
    bounds.left = finite(bounds.left - gap); bounds.right = finite(bounds.right + gap);
    bounds.top = finite(bounds.top - gap); bounds.bottom = finite(bounds.bottom + gap);
    const spanX = finite(bounds.right - bounds.left), spanY = finite(bounds.bottom - bounds.top);
    const scale = finite(Math.min(48, (width - 24) / spanX, (height - 24) / spanY));
    if (scale <= 0) throw new RangeError("List drawing scale is not representable");
    const offsetX = finite((width - spanX * scale) / 2), offsetY = finite((height - spanY * scale) / 2);
    const project = (p: Point) => point(offsetX + finite(p.x - bounds.left) * scale, offsetY + finite(p.y - bounds.top) * scale);
    function projectBox(raw: Box): Box {
        const a = project(point(raw.left, raw.top)), b = project(point(raw.right, raw.bottom));
        if (a.x >= b.x || a.y >= b.y) throw new RangeError("List fitted glyph extent is not representable");
        return { left: a.x, top: a.y, right: b.x, bottom: b.y };
    }
    const progress = scene.progress, headPosition = mix(beforeHead, afterHead, progress);
    const centers = new Map<string, Point>(), nodes: NodeGlyph<Value>[] = [];
    for (const transition of scene.objects) {
        const endpoint = transition.current ?? transition.previous!;
        if (endpoint.type !== "listNode") continue;
        const a = transition.previous?.type === "listNode" ? transition.previous.data : endpoint.data;
        const b = transition.current?.type === "listNode" ? transition.current.data : endpoint.data;
        const center = mix(a.position, b.position, progress);
        centers.set(transition.id, center);
        const nodeBox = projectBox(box(center, 1, 0.5));
        const divider = project(point(center.x + 0.5, center.y)).x;
        if (divider <= nodeBox.left || divider >= nodeBox.right) throw new RangeError("List compartment extent is not representable");
        nodes.push({ box: nodeBox, divider, port: project(point(center.x + 0.75, center.y)),
            alpha: transition.presence, view: endpoint.data, exiting: transition.current === null });
    }
    function route(branch: ListPointerView, view: ListPointerView, alpha: number): Route {
        const isHead = branch.from === null;
        const from = isHead ? headPosition : centers.get(branch.from!)!;
        const to = branch.to === null ? nullCenter(from, isHead, gap) : centers.get(branch.to)!;
        const targetBox = box(to, branch.to === null ? 0.5 : 1, branch.to === null ? 0.25 : 0.5);
        const start = isHead ? point(from.x, from.y + 0.25) : point(from.x + 1, from.y);
        const end = isHead ? point(to.x, targetBox.top) : point(targetBox.left, to.y);
        let raw: Point[];
        if (isHead) {
            const mid = start.y / 2 + end.y / 2;
            raw = [start, point(start.x, mid), point(end.x, mid), end];
        } else if (end.x >= start.x) {
            const mid = start.x / 2 + end.x / 2;
            raw = [start, point(mid, start.y), point(mid, end.y), end];
        } else {
            const lower = finite(Math.max(from.y + 0.5, targetBox.bottom) + gap);
            raw = [start, point(start.x + gap, start.y), point(start.x + gap, lower),
                point(end.x - gap, lower), point(end.x - gap, end.y), end];
        }
        const points: Point[] = [];
        for (const p of raw) {
            const pixel = project(p), last = points.at(-1);
            if (!last || pixel.x !== last.x || pixel.y !== last.y) points.push(pixel);
        }
        const arrow: Point[] = [];
        if (points.length >= 2) {
            const base = points.at(-2)!, tip = points.at(-1)!;
            const dx = tip.x - base.x, dy = tip.y - base.y, length = finite(Math.hypot(dx, dy));
            const ux = dx / length, uy = dy / length;
            const size = Math.min(7, length, scale * 0.4), wing = size / 2;
            arrow.push(point(tip.x - ux * size - uy * wing, tip.y - uy * size + ux * wing),
                tip, point(tip.x - ux * size + uy * wing, tip.y - uy * size - ux * wing));
        }
        return { points, arrow, lineWidth: Math.min(2, scale * 0.12), alpha, view,
            marker: branch.to === null ? { alpha, view, box: projectBox(targetBox) } : undefined };
    }
    const routes: Route[] = [], slots = new Map<string, ListPointerView>();
    let head: Glyph | undefined;
    for (const transition of scene.objects) {
        const endpoint = transition.current ?? transition.previous!;
        if (endpoint.type !== "listPointer") continue;
        const view = endpoint.data;
        if (view.from === null) head = { box: projectBox(box(headPosition, 0.6, 0.25)), alpha: 1, view };
        else if (view.pointer.kind === "next") slots.set(view.pointer.nodeId, view);
        const before = transition.previous?.type === "listPointer" ? transition.previous.data : undefined;
        const after = transition.current?.type === "listPointer" ? transition.current.data : undefined;
        if (before && after && before.to !== after.to) {
            routes.push(route(before, view, 1 - progress), route(after, view, progress));
        } else routes.push(route(view, view, transition.presence));
    }
    // Nodes and their next slots use matching scene IDs throughout the frame.
    const pointerViews = nodes.map(node => slots.get(node.view.node.id)!);
    return { nodes, head: head!, routes, pointerViews, scale };
}
