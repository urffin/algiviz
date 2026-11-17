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

/** Build a complete numeric drawing plan before making any Canvas calls. */
export function graphGeometry(scene: SceneFrame<GraphObjects, undefined>, width: number, height: number) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let maxLoop = 0, maxLane = 0;
    const radius = Math.min(16, width / 8, height / 8);
    for (const object of scene.objects) for (const endpoint of [object.previous, object.current]) {
        if (endpoint?.type === "graphNode") {
            const { x, y } = endpoint.data.position;
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        } else if (endpoint?.type === "graphEdge") {
            const { edge, routeCount } = endpoint.data;
            if (edge.from === edge.to) maxLoop = Math.max(maxLoop, radius * 1.5 + (routeCount - 1) * 12);
            else maxLane = Math.max(maxLane, (routeCount - 1) * 9);
        }
    }
    const padding = Math.min(width / 3, height / 3, Math.max(32, maxLoop * 2.5 + radius, maxLane + radius + 12));
    const spanX = minX === Infinity ? 0 : finite(maxX - minX), spanY = minY === Infinity ? 0 : finite(maxY - minY);
    let scale = Math.min(spanX > 0 ? (width - 2 * padding) / spanX : Infinity,
        spanY > 0 ? (height - 2 * padding) / spanY : Infinity);
    if (spanX === 0 && spanY === 0) scale = 1;
    if (!Number.isFinite(scale) || scale <= 0) throw new RangeError("Graph drawing scale is not representable");
    const left = finite((width - spanX * scale) / 2), top = finite((height - spanY * scale) / 2);
    function position(view: GraphNodeView): Point {
        return point(left + (view.position.x - minX) * scale, top + (view.position.y - minY) * scale);
    }
    function node(id: string, generation: "previous" | "current"): Point {
        const transition = scene.get(id);
        const endpoint = transition?.[generation] ?? transition?.current ?? transition?.previous;
        if (endpoint?.type !== "graphNode") throw new RangeError("Missing graph drawing endpoint");
        return position(endpoint.data);
    }
    function curve(view: GraphEdgeView, generation: "previous" | "current"): Curve {
        const a = node(view.from, generation), b = node(view.to, generation);
        const dx = b.x - a.x, dy = b.y - a.y;
        if (view.edge.from === view.edge.to || (dx === 0 && dy === 0)) {
            const loop = finite(radius * 1.5 + view.routeIndex * 12), diagonal = radius * Math.SQRT1_2;
            return [point(a.x - diagonal, a.y - diagonal), point(a.x - 2 * loop, a.y - 2.5 * loop),
                point(b.x + 2 * loop, b.y - 2.5 * loop), point(b.x + diagonal, b.y - diagonal)];
        }
        const direction = unit(dx, dy), orientation = view.edge.from <= view.edge.to ? 1 : -1;
        const lane = finite((view.routeIndex - (view.routeCount - 1) / 2) * 18);
        const control = point(a.x / 2 + b.x / 2 - direction.y * orientation * lane * 2,
            a.y / 2 + b.y / 2 + direction.x * orientation * lane * 2);
        const startDirection = unit(control.x - a.x, control.y - a.y), endDirection = unit(b.x - control.x, b.y - control.y);
        const start = point(a.x + startDirection.x * radius, a.y + startDirection.y * radius);
        const end = point(b.x - endDirection.x * radius, b.y - endDirection.y * radius);
        return [start, mix(start, control, 2 / 3), mix(end, control, 2 / 3), end];
    }
    const nodes: GraphNodePaint[] = [], edges: GraphEdgePaint[] = [];
    for (const object of scene.objects) {
        const endpoint = object.current ?? object.previous!;
        if (endpoint.type === "graphNode") {
            const before = object.previous?.type === "graphNode" ? object.previous.data : endpoint.data;
            const after = object.current?.type === "graphNode" ? object.current.data : endpoint.data;
            nodes.push({ view: endpoint.data, point: mix(position(before), position(after), scene.progress), presence: object.presence });
        } else {
            const before = object.previous?.type === "graphEdge" ? object.previous.data : endpoint.data;
            const after = object.current?.type === "graphEdge" ? object.current.data : endpoint.data;
            const a = curve(before, "previous"), b = curve(after, "current");
            const path: Curve = [mix(a[0], b[0], scene.progress), mix(a[1], b[1], scene.progress),
                mix(a[2], b[2], scene.progress), mix(a[3], b[3], scene.progress)];
            const tangent = unit(path[3].x - path[2].x, path[3].y - path[2].y), arrowSize = Math.min(8, radius * .6);
            const base = point(path[3].x - tangent.x * arrowSize, path[3].y - tangent.y * arrowSize);
            const arrow = endpoint.data.edge.directed ? [path[3],
                point(base.x - tangent.y * arrowSize * .5, base.y + tangent.x * arrowSize * .5),
                point(base.x + tangent.y * arrowSize * .5, base.y - tangent.x * arrowSize * .5)] : [];
            const label = point(path[0].x / 8 + path[1].x * 3 / 8 + path[2].x * 3 / 8 + path[3].x / 8,
                path[0].y / 8 + path[1].y * 3 / 8 + path[2].y * 3 / 8 + path[3].y / 8 - 9);
            edges.push({ view: endpoint.data, curve: path, arrow, label, presence: object.presence });
        }
    }
    return { nodes, edges, radius };
}
