import type { TreeObjects, TreeNodeView, TreeLinkView, TreeSnapshot, TreeBinarySlot } from "../tree/types.js";
import type { SceneFrame } from "../scene/index.js";
import { finite } from "./tree-layout.js";

export type Point = Readonly<{ x: number; y: number }>;
export type Curve = readonly [Point, Point, Point, Point];
export interface NodePaint { view: TreeNodeView; point: Point; presence: number; paintRadius: number }
export interface LinkPaint { view: TreeLinkView; curve: Curve; presence: number }
export interface SlotPaint { owner: string; start: Point; end: Point; presence: number }
export function point(x: number, y: number): Point { return { x: finite(x), y: finite(y) }; }
export function mix(a: Point, b: Point, p: number): Point {
    return point((1 - p) * a.x + p * b.x, (1 - p) * a.y + p * b.y);
}
function emptySlots(state: TreeSnapshot): Map<string, Set<TreeBinarySlot>> {
    const result = new Map<string, Set<TreeBinarySlot>>();
    if (state.tree.kind !== "binary") return result;
    for (const node of state.tree.nodes) result.set(node.id, new Set(["left", "right"]));
    for (const link of state.tree.links) result.get(link.parentId)!.delete(link.slot);
    return result;
}

/** Joint endpoint bounds, including hidden/zero-presence ghosts, give a progress-independent camera. */
export function treeGeometry(scene: SceneFrame<TreeObjects, undefined>, previous: TreeSnapshot, current: TreeSnapshot,
    width: number, height: number, nodeRadius: number, horizontalGap: number, levelGap: number, outlined?: ReadonlySet<string>) {
    const beforeSlots = emptySlots(previous), afterSlots = emptySlots(current);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function bound(p: Point) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    for (const object of scene.objects) for (const generation of ["previous", "current"] as const) {
        const endpoint = object[generation];
        if (endpoint?.type !== "treeNode") continue;
        const { position, node } = endpoint.data; bound(position);
        const slots = generation === "previous" ? beforeSlots : afterSlots;
        for (const slot of slots.get(node.id) ?? []) bound(point(position.x + (slot === "left" ? -horizontalGap : horizontalGap), position.y + levelGap));
    }
    const radius = Math.min(nodeRadius, width / 8, height / 8);
    const outlineWidth = Math.min(1, radius / 8), ringGap = Math.min(3, radius / 4);
    const outlineRadius = radius + outlineWidth * 1.5 + ringGap;
    const padding = Math.min(width / 3, height / 3, Math.max(40, outlineRadius));
    const spanX = minX === Infinity ? 0 : finite(maxX - minX), spanY = minY === Infinity ? 0 : finite(maxY - minY);
    let scale = Math.min(spanX > 0 ? (width - 2 * padding) / spanX : Infinity, spanY > 0 ? (height - 2 * padding) / spanY : Infinity);
    if (spanX === 0 && spanY === 0) scale = 1;
    if (!Number.isFinite(scale) || scale <= 0) throw new RangeError("Tree drawing scale is not representable");
    const left = finite((width - spanX * scale) / 2), top = finite((height - spanY * scale) / 2);
    const position = (p: Point) => point(left + finite(p.x - minX) * scale, top + finite(p.y - minY) * scale);
    const nodes: NodePaint[] = [], links: LinkPaint[] = [], slots: SlotPaint[] = [];
    const nodePositions = new Map<string, Point>();
    for (const object of scene.objects) {
        const endpoint = object.current ?? object.previous!;
        if (endpoint.type !== "treeNode") continue;
        const before = object.previous?.type === "treeNode" ? object.previous.data : endpoint.data;
        const after = object.current?.type === "treeNode" ? object.current.data : endpoint.data;
        const p = mix(position(before.position), position(after.position), scene.progress);
        const paintRadius = outlined?.has(endpoint.data.node.id) ? outlineRadius : radius;
        nodePositions.set(object.id, p);
        nodes.push({ view: endpoint.data, point: p, presence: object.presence, paintRadius });
        for (const slot of ["left", "right"] as const) {
            const a = beforeSlots.get(before.node.id)?.has(slot) && object.previous !== null;
            const b = afterSlots.get(after.node.id)?.has(slot) && object.current !== null;
            if (!a && !b) continue;
            const presence = a && b ? 1 : b ? scene.progress : 1 - scene.progress;
            const dx = finite((slot === "left" ? -horizontalGap : horizontalGap) * scale);
            const dy = finite(levelGap * scale), sign = slot === "left" ? -1 : 1;
            slots.push({ owner: endpoint.data.node.id, presence,
                start: point(p.x + sign * radius / Math.SQRT2, p.y + radius / Math.SQRT2), end: point(p.x + dx, p.y + dy) });
        }
    }
    function route(view: TreeLinkView): Curve {
        // Resolve each branch's own scene IDs, including exiting endpoints with zero presence.
        const from = scene.get(view.from), to = scene.get(view.to);
        if (!from || !to) throw new RangeError("Missing tree drawing endpoint");
        const a = nodePositions.get(from.id)!, b = nodePositions.get(to.id)!;
        if (!a || !b) throw new RangeError("Missing tree drawing node");
        const sign = view.link.slot === "left" ? -1 : view.link.slot === "right" ? 1 : 0;
        const start = point(a.x + sign * radius / Math.SQRT2, a.y + radius * (sign ? 1 / Math.SQRT2 : 1));
        const end = point(b.x, b.y - radius), middle = finite(start.y / 2 + end.y / 2);
        return [start, point(start.x, middle), point(end.x, middle), end];
    }
    for (const object of scene.objects) {
        const endpoint = object.current ?? object.previous!;
        if (endpoint.type !== "treeLink") continue;
        const a = object.previous?.type === "treeLink" ? object.previous.data : undefined;
        const b = object.current?.type === "treeLink" ? object.current.data : undefined;
        if (a && b && (a.from !== b.from || a.to !== b.to || a.link.slot !== b.link.slot)) {
            links.push({ view: endpoint.data, curve: route(a), presence: 1 - scene.progress },
                { view: endpoint.data, curve: route(b), presence: scene.progress });
        } else links.push({ view: endpoint.data, curve: route(b ?? a!), presence: object.presence });
    }
    return { nodes, links, slots, radius, outlineWidth };
}
