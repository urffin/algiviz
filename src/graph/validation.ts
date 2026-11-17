import type {
    GraphInput, GraphNode, GraphEdge, GraphPosition, GraphMark,
    GraphAnnotation, GraphResult, GraphNodeCaption, GraphNodeCaptionPatch
} from "./types.js";

/** Capture known own data properties before validating their values; never call accessors. */
export function record<K extends string>(value: unknown, keys: readonly K[], required: readonly K[] = keys): Record<K, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Expected a plain graph record");
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError("Expected a plain graph record");
    const captured = Object.create(null) as Record<K, unknown>;
    for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor) {
            if (required.includes(key)) throw new TypeError(`Missing graph field: ${key}`);
            captured[key] = undefined;
        } else {
            if (!("value" in descriptor)) throw new TypeError(`Graph field must be a data property: ${key}`);
            captured[key] = descriptor.value;
        }
    }
    return captured;
}

/** Snapshot the entire array shape/elements before examining any record or scalar. */
export function array(value: unknown): unknown[] {
    if (!Array.isArray(value)) throw new TypeError("Expected a dense graph array");
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    const length: unknown = lengthDescriptor?.value;
    if (typeof length !== "number" || !Number.isInteger(length) || length < 0 || length > 0xffffffff) {
        throw new TypeError("Invalid graph array length");
    }
    const captured: unknown[] = [];
    for (let i = 0; i < length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, i);
        if (!descriptor || !("value" in descriptor)) throw new TypeError("Graph arrays require own data elements");
        captured.push(descriptor.value);
    }
    return captured;
}

export function string(value: unknown): string {
    if (typeof value !== "string" || value.length === 0) throw new TypeError("Expected a nonempty graph string");
    return value;
}
function label(value: unknown): string | undefined {
    if (value !== undefined && typeof value !== "string") throw new TypeError("Graph labels must be strings");
    return value;
}
function boolean(value: unknown): boolean | undefined {
    if (value !== undefined && typeof value !== "boolean") throw new TypeError("Graph direction must be boolean");
    return value;
}
function number(value: unknown): number {
    if (typeof value !== "number") throw new TypeError("Graph coordinates and weights must be numbers");
    if (!Number.isFinite(value)) throw new RangeError("Graph coordinates and weights must be finite");
    return value;
}
function member(id: string, ids: ReadonlySet<string>): void {
    if (!ids.has(id)) throw new RangeError(`Unknown graph id: ${id}`);
}
function unique(id: string, seen: Set<string>): void {
    if (seen.has(id)) throw new RangeError(`Duplicate graph id: ${id}`);
    seen.add(id);
}

export function captureGraph<N, E>(value: unknown) {
    const input = record(value, ["nodes", "edges"]);
    const sourceNodes = array(input.nodes) as GraphNode<N>[];
    const nodeIds = new Set<string>(), nodes: GraphNode<N>[] = [];
    for (const source of sourceNodes) {
        const fields = record(source, ["id", "label", "data"], ["id"]);
        const id = string(fields.id), text = label(fields.label), data = fields.data as N | undefined;
        unique(id, nodeIds);
        nodes.push(Object.freeze({ id, ...(text === undefined ? {} : { label: text }), ...(data === undefined ? {} : { data }) }));
    }
    const sourceEdges = array(input.edges) as GraphEdge<E>[];
    const edgeIds = new Set<string>(), edges: GraphEdge<E>[] = [];
    for (const source of sourceEdges) {
        const fields = record(source, ["id", "from", "to", "directed", "weight", "label", "data"], ["id", "from", "to"]);
        const id = string(fields.id), from = string(fields.from), to = string(fields.to);
        const directed = boolean(fields.directed), weight = fields.weight === undefined ? undefined : number(fields.weight);
        const text = label(fields.label), data = fields.data as E | undefined;
        unique(id, edgeIds);
        member(from, nodeIds); member(to, nodeIds);
        edges.push(Object.freeze({ id, from, to, ...(directed === undefined ? {} : { directed }),
            ...(weight === undefined ? {} : { weight }), ...(text === undefined ? {} : { label: text }),
            ...(data === undefined ? {} : { data }) }));
    }
    const graph: GraphInput<N, E> = Object.freeze({ nodes: Object.freeze(nodes), edges: Object.freeze(edges) });
    return { graph, nodeIds, edgeIds, sourceNodes, sourceEdges };
}

export function defaultLayout(nodes: readonly GraphNode[]): readonly GraphPosition[] {
    return Object.freeze(nodes.map((node, i) => {
        const angle = -Math.PI / 2 + 2 * Math.PI * i / nodes.length;
        return Object.freeze({ nodeId: node.id, x: nodes.length === 1 ? 0.5 : 0.5 + 0.4 * Math.cos(angle),
            y: nodes.length === 1 ? 0.5 : 0.5 + 0.4 * Math.sin(angle) });
    }));
}

export function captureLayout(value: unknown, nodes: readonly GraphNode[], ids: ReadonlySet<string>, ordered = false) {
    const sources = array(value) as GraphPosition[];
    const byId = new Map<string, GraphPosition>();
    for (const source of sources) {
        const fields = record(source, ["nodeId", "x", "y"]);
        const nodeId = string(fields.nodeId), x = number(fields.x), y = number(fields.y);
        member(nodeId, ids);
        if (byId.has(nodeId)) throw new RangeError(`Duplicate graph position: ${nodeId}`);
        byId.set(nodeId, Object.freeze({ nodeId, x, y }));
    }
    const layout = nodes.map(node => {
        const position = byId.get(node.id);
        if (!position) throw new RangeError(`Missing graph position: ${node.id}`);
        return position;
    });
    if (ordered && [...byId.keys()].some((id, i) => id !== nodes[i]!.id)) {
        throw new RangeError("Snapshot layout must follow node order");
    }
    return { layout: Object.freeze(layout), sources };
}

export function captureMarks(value: unknown, ids: ReadonlySet<string>): readonly GraphMark[] {
    const values = value === undefined ? [] : array(value), seen = new Set<string>();
    return Object.freeze(values.map(source => {
        const fields = record(source, ["id", "role"]);
        const id = string(fields.id), role = fields.role === null ? null : string(fields.role);
        member(id, ids); unique(id, seen);
        return Object.freeze({ id, role });
    }));
}

export function applyMarks(previous: readonly GraphAnnotation[], patch: readonly GraphMark[], order: readonly { readonly id: string }[]): readonly GraphAnnotation[] {
    const roles = new Map(previous.map(mark => [mark.id, mark.role]));
    for (const { id, role } of patch) { if (role === null) roles.delete(id); else roles.set(id, role); }
    return Object.freeze(order.filter(item => roles.has(item.id)).map(item => Object.freeze({ id: item.id, role: roles.get(item.id)! })));
}

export function captureAnnotations(value: unknown, order: readonly { readonly id: string }[]): readonly GraphAnnotation[] {
    const values = array(value), positions = new Map(order.map((item, i) => [item.id, i]));
    let last = -1;
    return Object.freeze(values.map(source => {
        const fields = record(source, ["id", "role"]), id = string(fields.id), role = string(fields.role);
        const position = positions.get(id);
        if (position === undefined) throw new RangeError(`Unknown graph annotation: ${id}`);
        if (position <= last) throw new RangeError("Snapshot marks must be unique and follow topology order");
        last = position;
        return Object.freeze({ id, role });
    }));
}

export function captureResult(value: unknown, nodeIds: ReadonlySet<string>, edgeIds: ReadonlySet<string>, snapshot = false): GraphResult {
    const fields = record(value, ["nodeIds", "edgeIds"], snapshot ? ["nodeIds", "edgeIds"] : []);
    function selection(value: unknown, ids: ReadonlySet<string>) {
        const values = !snapshot && value === undefined ? [] : array(value), seen = new Set<string>();
        for (const value of values) {
            const id = string(value); member(id, ids);
            if (snapshot && seen.has(id)) throw new RangeError(`Duplicate graph result: ${id}`);
            seen.add(id);
        }
        return Object.freeze([...seen]);
    }
    const nodes = selection(fields.nodeIds, nodeIds), edges = selection(fields.edgeIds, edgeIds);
    return Object.freeze({ nodeIds: nodes, edgeIds: edges });
}

/** Capture a supplied caption patch before committing roles or text. */
export function captureCaptionPatches(value: unknown, ids: ReadonlySet<string>, nullable = true): readonly GraphNodeCaptionPatch[] {
    const values = value === undefined ? [] : array(value), seen = new Set<string>();
    return Object.freeze(values.map(source => {
        const fields = record(source, ["id", "text"]), id = string(fields.id);
        const text = fields.text;
        if (typeof text !== "string" && !(nullable && text === null)) throw new TypeError("Graph caption text must be a string");
        member(id, ids); unique(id, seen);
        return Object.freeze({ id, text: text as string | null });
    }));
}
export function applyCaptions(previous: readonly GraphNodeCaption[], patch: readonly GraphNodeCaptionPatch[], nodes: readonly GraphNode[]): readonly GraphNodeCaption[] {
    const text = new Map(previous.map(item => [item.id, item.text]));
    for (const item of patch) { if (item.text === null) text.delete(item.id); else text.set(item.id, item.text); }
    return Object.freeze(nodes.filter(node => text.has(node.id)).map(node => Object.freeze({ id: node.id, text: text.get(node.id)! })));
}
export function captureCaptions(value: unknown, nodes: readonly GraphNode[], ordered = false): readonly GraphNodeCaption[] {
    const patch = captureCaptionPatches(value, new Set(nodes.map(node => node.id)), false);
    if (ordered) {
        const order = new Map(nodes.map((node, i) => [node.id, i])); let last = -1;
        for (const item of patch) { const index = order.get(item.id)!;
            if (index <= last) throw new RangeError("Snapshot captions must follow node order"); last = index;
        }
    }
    return applyCaptions([], patch, nodes);
}
