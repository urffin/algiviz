import type { ListInput, ListNode, ListPointerId } from "./types.js";

export const limit = 1_000_000;

/** Capture recognized own data fields without inspecting application values. */
export function record<K extends string>(value: unknown, keys: readonly K[], required: readonly K[] = keys): Record<K, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Expected a plain list record");
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError("Expected a plain list record");
    const fields = Object.create(null) as Record<K, unknown>;
    for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor) {
            if (required.includes(key)) throw new TypeError(`Missing list field: ${key}`);
            fields[key] = undefined;
        } else {
            if (!("value" in descriptor)) throw new TypeError(`List field must be a data property: ${key}`);
            fields[key] = descriptor.value;
        }
    }
    return fields;
}

/** Limits precede copying; density precedes inspection of element records. */
export function array(value: unknown, maximum: number): unknown[] {
    if (!Array.isArray(value)) throw new TypeError("Expected a dense list array");
    const length: unknown = Object.getOwnPropertyDescriptor(value, "length")?.value;
    if (typeof length !== "number" || !Number.isInteger(length) || length < 0 || length > 0xffffffff) throw new TypeError("Invalid list array length");
    if (length > maximum) throw new RangeError("List collection exceeds its limit");
    const values: unknown[] = [];
    for (let i = 0; i < length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, i);
        if (!descriptor || !("value" in descriptor)) throw new TypeError("List arrays require own data elements");
        values.push(descriptor.value);
    }
    return values;
}
export function text(value: unknown): string {
    if (typeof value !== "string") throw new TypeError("Expected list text");
    return value;
}
export function string(value: unknown): string {
    const result = text(value);
    if (!result.length) throw new TypeError("Expected a nonempty list string");
    return result;
}
export function coordinate(value: unknown): number {
    if (typeof value !== "number") throw new TypeError("Expected a numeric list coordinate");
    if (!Number.isFinite(value)) throw new RangeError("List coordinates must be finite");
    return value;
}
export function reference(value: unknown): string | null { return value === null ? null : string(value); }
export function member(id: string, ids: ReadonlySet<string>): void {
    if (!ids.has(id)) throw new RangeError(`Unknown list node: ${id}`);
}
export function unique(id: string, seen: Set<string>): void {
    if (seen.has(id)) throw new RangeError(`Duplicate list identity: ${id}`);
    seen.add(id);
}
export function pointer(value: unknown): ListPointerId {
    const kind = string(record(value, ["kind"]).kind);
    if (kind === "head") return Object.freeze({ kind });
    if (kind !== "next") throw new RangeError("Unsupported list pointer kind");
    return Object.freeze({ kind, nodeId: string(record(value, ["nodeId"]).nodeId) });
}
export function pointerKey(id: ListPointerId): string {
    return id.kind === "head" ? JSON.stringify(["head"]) : JSON.stringify(["next", id.nodeId]);
}
export interface Model<Value> {
    readonly list: ListInput<Value>;
    readonly ids: ReadonlySet<string>;
    readonly byId: ReadonlyMap<string, ListNode<Value>>;
    readonly pointers: readonly ListPointerId[];
    readonly sourceNodes: readonly ListNode<Value>[];
}

/** Validate a complete chain iteratively; storage order is independent of next. */
export function structure<Value>(headId: string | null, value: unknown): Model<Value> {
    const sources = array(value, limit), ids = new Set<string>();
    const nodes = sources.map(source => {
        const fields = record(source, ["id", "value", "nextId"]);
        const id = string(fields.id), payload = fields.value as Value, nextId = reference(fields.nextId);
        unique(id, ids);
        return Object.freeze({ id, value: payload, nextId });
    });
    if (!nodes.length) {
        if (headId !== null) throw new RangeError("An empty list requires null head");
    } else {
        if (headId === null) throw new RangeError("A nonempty list requires a head");
        member(headId, ids);
    }
    const incoming = new Map<string, number>(), byId = new Map(nodes.map(node => [node.id, node]));
    for (const node of nodes) if (node.nextId !== null) {
        member(node.nextId, ids);
        if (node.nextId === node.id) throw new RangeError("List self-links are invalid");
        incoming.set(node.nextId, (incoming.get(node.nextId) ?? 0) + 1);
    }
    for (const node of nodes) if ((incoming.get(node.id) ?? 0) !== (node.id === headId ? 0 : 1)) throw new RangeError("Invalid list incoming pointer count");
    const visited = new Set<string>();
    for (let id = headId; id !== null; id = byId.get(id)!.nextId) {
        if (visited.has(id)) throw new RangeError("List contains a cycle");
        visited.add(id);
    }
    if (visited.size !== nodes.length) throw new RangeError("List contains unreachable nodes");
    const pointers: ListPointerId[] = [Object.freeze({ kind: "head" })];
    for (const node of nodes) pointers.push(Object.freeze({ kind: "next", nodeId: node.id }));
    return { list: Object.freeze({ headId, nodes: Object.freeze(nodes) }), ids, byId,
        pointers: Object.freeze(pointers), sourceNodes: sources as ListNode<Value>[] };
}
export function model<Value>(value: unknown): Model<Value> {
    const fields = record(value, ["headId", "nodes"]);
    return structure(reference(fields.headId), fields.nodes);
}
