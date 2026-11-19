import type { TreeKind, TreeBinarySlot, TreeNode, TreeLink, TreeInput } from "./types.js";

/** Capture recognized own data properties; opaque application payloads are never inspected. */
export function record<K extends string>(value: unknown, keys: readonly K[], required: readonly K[] = keys): Record<K, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Expected a plain tree record");
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError("Expected a plain tree record");
    const captured = Object.create(null) as Record<K, unknown>;
    for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor) {
            if (required.includes(key)) throw new TypeError(`Missing tree field: ${key}`);
            captured[key] = undefined;
        } else {
            if (!("value" in descriptor)) throw new TypeError(`Tree field must be a data property: ${key}`);
            captured[key] = descriptor.value;
        }
    }
    return captured;
}

/** Snapshot array shape before inspecting any element record. */
export function array(value: unknown): unknown[] {
    if (!Array.isArray(value)) throw new TypeError("Expected a dense tree array");
    const length = Object.getOwnPropertyDescriptor(value, "length")?.value as unknown;
    if (typeof length !== "number" || !Number.isInteger(length) || length < 0 || length > 0xffffffff) {
        throw new TypeError("Invalid tree array length");
    }
    const captured: unknown[] = [];
    for (let i = 0; i < length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, i);
        if (!descriptor || !("value" in descriptor)) throw new TypeError("Tree arrays require own data elements");
        captured.push(descriptor.value);
    }
    return captured;
}
export function string(value: unknown): string {
    if (typeof value !== "string" || value.length === 0) throw new TypeError("Expected a nonempty tree string");
    return value;
}
export function text(value: unknown): string {
    if (typeof value !== "string") throw new TypeError("Expected tree text");
    return value;
}
export function number(value: unknown): number {
    if (typeof value !== "number") throw new TypeError("Expected a numeric tree coordinate");
    if (!Number.isFinite(value)) throw new RangeError("Tree coordinates must be finite");
    return value;
}
export function member(id: string, ids: ReadonlySet<string>): void {
    if (!ids.has(id)) throw new RangeError(`Unknown tree id: ${id}`);
}
export function unique(id: string, seen: Set<string>): void {
    if (seen.has(id)) throw new RangeError(`Duplicate tree id: ${id}`);
    seen.add(id);
}
function kind(value: unknown): TreeKind {
    const name = string(value);
    if (name !== "ordered" && name !== "binary") throw new RangeError("Unsupported tree kind");
    return name;
}
function binarySlot(value: unknown): TreeBinarySlot {
    const name = string(value);
    if (name !== "left" && name !== "right") throw new RangeError("Unsupported binary tree slot");
    return name;
}
function label(value: unknown): string | undefined { return value === undefined ? undefined : text(value); }
export function root(value: unknown): string | null { return value === null ? null : string(value); }

export interface Model<N, L> {
    readonly tree: TreeInput<N, L>;
    readonly nodeIds: ReadonlySet<string>;
    readonly linkIds: ReadonlySet<string>;
    readonly sourceNodes: readonly TreeNode<N>[];
    readonly sourceLinks: readonly TreeLink<L>[];
}

/** Validate a complete topology, iteratively so valid deep trees do not depend on call-stack depth. */
function hierarchy<N, L>(rootId: string | null, nodes: readonly TreeNode<N>[], links: readonly TreeLink<L>[], nodeIds: ReadonlySet<string>, mode: TreeKind): void {
    if (nodes.length === 0) {
        if (rootId !== null || links.length !== 0) throw new RangeError("An empty tree requires null root and no links");
        return;
    }
    if (rootId === null) throw new RangeError("A nonempty tree requires a root");
    member(rootId, nodeIds);
    const pairs = new Map<string, Set<string>>(), slots = new Map<string, Set<string>>();
    const incoming = new Map<string, number>(), children = new Map<string, TreeLink<L>[]>();
    for (const link of links) {
        if (link.parentId === link.childId) throw new RangeError("Tree self-links are invalid");
        const targets = pairs.get(link.parentId) ?? new Set<string>();
        if (targets.has(link.childId)) throw new RangeError("Repeated tree parent-child pair");
        targets.add(link.childId); pairs.set(link.parentId, targets);
        if (mode === "binary") {
            const occupied = slots.get(link.parentId) ?? new Set<string>();
            const slot = link.slot!;
            if (occupied.has(slot)) throw new RangeError("Binary tree slot is already occupied");
            occupied.add(slot); slots.set(link.parentId, occupied);
        }
        incoming.set(link.childId, (incoming.get(link.childId) ?? 0) + 1);
        const list = children.get(link.parentId) ?? []; list.push(link); children.set(link.parentId, list);
    }
    for (const node of nodes) {
        if ((incoming.get(node.id) ?? 0) !== (node.id === rootId ? 0 : 1)) {
            throw new RangeError("Tree root/parent count is invalid");
        }
    }
    const visited = new Set<string>(), pending = [rootId];
    while (pending.length) {
        const id = pending.pop()!;
        if (visited.has(id)) throw new RangeError("Tree contains a cycle");
        visited.add(id);
        const list = children.get(id) ?? [];
        // LIFO: right is pushed first, so binary traversal visits left first.
        if (mode === "binary") {
            for (const slot of ["right", "left"]) for (const link of list) if (link.slot === slot) pending.push(link.childId);
        } else for (let i = list.length - 1; i >= 0; i--) pending.push(list[i]!.childId);
    }
    if (visited.size !== nodes.length) throw new RangeError("Tree contains unreachable nodes or a disconnected cycle");
}

export function captureStructure<N, L>(mode: TreeKind, rootId: string | null, nodeValue: unknown, linkValue: unknown): Model<N, L> {
    const sourceNodes = array(nodeValue) as TreeNode<N>[], nodeIds = new Set<string>();
    const nodes = sourceNodes.map(source => {
        const fields = record(source, ["id", "label", "data"], ["id"]);
        const id = string(fields.id), name = label(fields.label), data = fields.data as N | undefined;
        unique(id, nodeIds);
        return Object.freeze({ id, ...(name === undefined ? {} : { label: name }), ...(data === undefined ? {} : { data }) });
    });
    const sourceLinks = array(linkValue) as TreeLink<L>[], linkIds = new Set<string>();
    const links = sourceLinks.map(source => {
        const fields = record(source, ["id", "parentId", "childId", "slot", "label", "data"],
            mode === "binary" ? ["id", "parentId", "childId", "slot"] : ["id", "parentId", "childId"]);
        const id = string(fields.id), parentId = string(fields.parentId), childId = string(fields.childId);
        let slot: TreeBinarySlot | undefined;
        if (mode === "binary") slot = binarySlot(fields.slot);
        else if (fields.slot !== undefined) throw new TypeError("Ordered tree links cannot have binary slots");
        const name = label(fields.label), data = fields.data as L | undefined;
        unique(id, linkIds); member(parentId, nodeIds); member(childId, nodeIds);
        return Object.freeze({ id, parentId, childId, ...(slot === undefined ? {} : { slot }),
            ...(name === undefined ? {} : { label: name }), ...(data === undefined ? {} : { data }) });
    });
    hierarchy(rootId, nodes, links, nodeIds, mode);
    // Kind and link slots were checked together before constructing this discriminated union.
    const tree = Object.freeze({ kind: mode, rootId, nodes: Object.freeze(nodes), links: Object.freeze(links) }) as TreeInput<N, L>;
    return { tree, nodeIds, linkIds, sourceNodes, sourceLinks };
}
export function captureTree<N, L>(value: unknown): Model<N, L> {
    const fields = record(value, ["kind", "rootId", "nodes", "links"]);
    const mode = kind(fields.kind), rootId = root(fields.rootId);
    return captureStructure<N, L>(mode, rootId, fields.nodes, fields.links);
}
