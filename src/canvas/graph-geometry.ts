import type { GraphObjects, GraphNodeView, GraphEdgeView } from "../graph/types.js";
import type { SceneFrame } from "../scene/index.js";

type Point = Readonly<{ x: number; y: number }>;
type Curve = readonly [Point, Point, Point, Point];
export interface GraphNodePaint {
    readonly view: GraphNodeView;
    readonly point: Point;
    readonly presence: number;
}
export interface GraphEdgePaint {
    readonly view: GraphEdgeView;
    readonly curve: Curve;
    readonly arrow: readonly Point[];
    readonly label: Point;
    readonly presence: number;
    readonly showLabel: boolean;
}

function finite(value: number): number {
    if (!Number.isFinite(value)) throw new RangeError("Graph drawing geometry is not representable");
    return value;
}
function point(x: number, y: number): Point { return { x: finite(x), y: finite(y) }; }
function mix(a: Point, b: Point, p: number): Point { return point((1 - p) * a.x + p * b.x, (1 - p) * a.y + p * b.y); }
function unit(x: number, y: number): Point {
    const length = finite(Math.hypot(x, y));
    return length === 0 ? { x: 1, y: 0 } : point(x / length, y / length);
}
function laneOffset(view: GraphEdgeView): number {
    return (view.routeIndex - (view.routeCount - 1) / 2) * 18;
}
function sameRoute(before: GraphEdgeView, after: GraphEdgeView): boolean {
    const directed = before.edge.directed === true;
    if (directed !== (after.edge.directed === true)) return false;
    return (before.from === after.from && before.to === after.to)
        || (!directed && before.from === after.to && before.to === after.from);
}

/** Build a complete numeric drawing plan before making any Canvas calls. */
export function graphGeometry(scene: SceneFrame<GraphObjects, undefined>, width: number, height: number, nodeRadius: number, topologyTransitions: boolean,
    edgeBend?: (this: void, view: GraphEdgeView) => number | undefined) {
    const p = scene.progress;
    function nodeView(id: string, generation: "previous" | "current", fallback: boolean): GraphNodeView {
        const transition = scene.get(id);
        const endpoint = transition?.[generation] ?? (fallback ? transition?.current ?? transition?.previous : undefined);
        if (endpoint?.type !== "graphNode") throw new RangeError("Missing graph drawing endpoint");
        return endpoint.data;
    }
    // Reserve room for the coincident-node fallback if the node paths could meet.
    function mayCoincide(view: GraphEdgeView): boolean {
        const a = nodeView(view.from, "previous", true).position, b = nodeView(view.to, "previous", true).position;
        const c = nodeView(view.from, "current", true).position, d = nodeView(view.to, "current", true).position;
        return (a.x <= b.x && c.x >= d.x || a.x >= b.x && c.x <= d.x)
            && (a.y <= b.y && c.y >= d.y || a.y >= b.y && c.y <= d.y);
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let maxLoop = 0, maxLane = 0, maxBend = 0;
    const bends = edgeBend === undefined ? undefined : new Map<GraphEdgeView, number | undefined>();
    const radius = Math.min(nodeRadius, width / 8, height / 8);
    for (const object of scene.objects) for (const endpoint of [object.previous, object.current]) {
        if (endpoint?.type === "graphNode") {
            const { x, y } = endpoint.data.position;
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        } else if (endpoint?.type === "graphEdge") {
            const view = endpoint.data, { edge, routeCount } = view;
            if (edge.from === edge.to || (topologyTransitions && mayCoincide(view))) {
                maxLoop = Math.max(maxLoop, radius * 1.5 + (routeCount - 1) * 12);
            }
            if (edge.from !== edge.to) {
                maxLane = Math.max(maxLane, (routeCount - 1) * 9);
                if (bends && !bends.has(view)) {
                    const bend = edgeBend?.(view);
                    if (bend !== undefined) {
                        if (typeof bend !== "number") throw new TypeError("Graph edge bend must be a number");
                        if (!Number.isFinite(bend)) throw new RangeError("Graph edge bend must be finite");
                        maxBend = Math.max(maxBend, Math.abs(bend));
                    }
                    bends.set(view, bend);
                }
            }
        }
    }
    const strokePadding = topologyTransitions ? 1.5 : 0;
    const stockPadding = Math.max(32, maxLoop * 2.5 + radius, maxLane + radius + 12) + strokePadding;
    const padding = Math.min(width / 3, height / 3, Math.max(stockPadding, maxBend + 1.5));
    const spanX = minX === Infinity ? 0 : finite(maxX - minX), spanY = minY === Infinity ? 0 : finite(maxY - minY);
    let scale = Math.min(spanX > 0 ? (width - 2 * padding) / spanX : Infinity,
        spanY > 0 ? (height - 2 * padding) / spanY : Infinity);
    if (spanX === 0 && spanY === 0) scale = 1;
    if (!Number.isFinite(scale) || scale <= 0) throw new RangeError("Graph drawing scale is not representable");
    const left = finite((width - spanX * scale) / 2), top = finite((height - spanY * scale) / 2);
    function position(view: GraphNodeView): Point {
        return point(left + (view.position.x - minX) * scale, top + (view.position.y - minY) * scale);
    }
    function attached(id: string, generation: "previous" | "current"): Point {
        const view = nodeView(id, generation, false);
        const transition = scene.get(id)!;
        if (transition.previous?.type === "graphNode" && transition.current?.type === "graphNode") {
            return mix(position(transition.previous.data), position(transition.current.data), p);
        }
        return position(view);
    }
    function curve(view: GraphEdgeView, a: Point, b: Point, offset: number, loopIndex: number, previous?: GraphEdgeView): Curve {
        const dx = b.x - a.x, dy = b.y - a.y;
        if (view.edge.from === view.edge.to || (dx === 0 && dy === 0)) {
            const loop = finite(radius * 1.5 + loopIndex * 12), diagonal = radius * Math.SQRT1_2;
            return [point(a.x - diagonal, a.y - diagonal), point(a.x - 2 * loop, a.y - 2.5 * loop),
                point(b.x + 2 * loop, b.y - 2.5 * loop), point(b.x + diagonal, b.y - diagonal)];
        }
        const direction = unit(dx, dy), orientation = view.edge.from <= view.edge.to ? 1 : -1;
        const lane = finite(offset);
        const bend = bends?.get(view), previousBend = previous && bends?.get(previous);
        let control: Point;
        if (bend === undefined && previousBend === undefined) {
            control = point(a.x / 2 + b.x / 2 - direction.y * orientation * lane * 2,
                a.y / 2 + b.y / 2 + direction.x * orientation * lane * 2);
        } else {
            const limit = Math.min(Math.hypot(dx, dy) / 4, Math.max(0, padding - 1.5));
            const clamp = (requested: number) => Math.max(-limit, Math.min(limit, requested));
            let shift = bend === undefined ? orientation * laneOffset(view) * 2 : clamp(bend);
            if (previous) {
                const fromShift = previousBend === undefined ? orientation * laneOffset(previous) * 2
                    : clamp(previousBend) * (previous.from === view.from ? 1 : -1);
                shift = (1 - p) * fromShift + p * shift;
            }
            control = point(a.x / 2 + b.x / 2 - direction.y * shift, a.y / 2 + b.y / 2 + direction.x * shift);
        }
        const startDirection = unit(control.x - a.x, control.y - a.y), endDirection = unit(b.x - control.x, b.y - control.y);
        const start = point(a.x + startDirection.x * radius, a.y + startDirection.y * radius);
        const end = point(b.x - endDirection.x * radius, b.y - endDirection.y * radius);
        return [start, mix(start, control, 2 / 3), mix(end, control, 2 / 3), end];
    }
    const nodes: GraphNodePaint[] = [], edges: GraphEdgePaint[] = [];
    function addEdge(view: GraphEdgeView, path: Curve, presence: number, showLabel: boolean): void {
        const tangent = unit(path[3].x - path[2].x, path[3].y - path[2].y), arrowSize = Math.min(8, radius * .6);
        const base = point(path[3].x - tangent.x * arrowSize, path[3].y - tangent.y * arrowSize);
        const arrow = view.edge.directed ? [path[3],
            point(base.x - tangent.y * arrowSize * .5, base.y + tangent.x * arrowSize * .5),
            point(base.x + tangent.y * arrowSize * .5, base.y - tangent.x * arrowSize * .5)] : [];
        const label = point(path[0].x / 8 + path[1].x * 3 / 8 + path[2].x * 3 / 8 + path[3].x / 8,
            path[0].y / 8 + path[1].y * 3 / 8 + path[2].y * 3 / 8 + path[3].y / 8 - 9);
        edges.push({ view, curve: path, arrow, label, presence, showLabel });
    }
    function dynamicRoute(view: GraphEdgeView, generation: "previous" | "current", presence: number,
        showLabel: boolean, offset = laneOffset(view), loopIndex = view.routeIndex, previous?: GraphEdgeView): void {
        if (presence === 0) return;
        const path = curve(view, attached(view.from, generation), attached(view.to, generation), offset, loopIndex, previous);
        addEdge(view, path, presence, showLabel);
    }
    function dynamicEdge(before: GraphEdgeView | undefined, after: GraphEdgeView | undefined): void {
        if (before && after && sameRoute(before, after)) {
            dynamicRoute(after, "current", 1, true,
                (1 - p) * laneOffset(before) + p * laneOffset(after),
                (1 - p) * before.routeIndex + p * after.routeIndex, before);
            return;
        }
        if (before) dynamicRoute(before, "previous", 1 - p, !after || p < .5);
        if (after) dynamicRoute(after, "current", p, !before || p >= .5);
    }
    function legacyRoute(view: GraphEdgeView, generation: "previous" | "current"): Curve {
        return curve(view, position(nodeView(view.from, generation, true)), position(nodeView(view.to, generation, true)),
            laneOffset(view), view.routeIndex);
    }
    for (const object of scene.objects) {
        const endpoint = object.current ?? object.previous!;
        if (endpoint.type === "graphNode") {
            if (topologyTransitions && object.presence === 0) continue;
            const before = object.previous?.type === "graphNode" ? object.previous.data : endpoint.data;
            const after = object.current?.type === "graphNode" ? object.current.data : endpoint.data;
            nodes.push({ view: endpoint.data, point: mix(position(before), position(after), scene.progress), presence: object.presence });
        } else {
            const before = object.previous?.type === "graphEdge" ? object.previous.data : undefined;
            const after = object.current?.type === "graphEdge" ? object.current.data : undefined;
            if (topologyTransitions) {
                dynamicEdge(before, after);
            } else {
                const a = legacyRoute(before ?? endpoint.data, "previous"), b = legacyRoute(after ?? endpoint.data, "current");
                addEdge(endpoint.data, [mix(a[0], b[0], p), mix(a[1], b[1], p),
                    mix(a[2], b[2], p), mix(a[3], b[3], p)], object.presence, true);
            }
        }
    }
    return { nodes, edges, radius };
}
