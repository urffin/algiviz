import type { ListPosition, ListAnnotation, ListMark, ListPointerAnnotation, ListPointerMark,
    ListNodeCaption, ListNodeCaptionPatch, ListMarkUpdate, ListResult } from "./types.js";
import { array, record, string, text, coordinate, member, unique, pointer, pointerKey } from "./validation.js";
import type { Model } from "./validation.js";

export function layout(value: unknown, model: Model<unknown>, ordered = false) {
    const sources = array(value, model.ids.size) as ListPosition[], positions = new Map<string, ListPosition>();
    for (const source of sources) {
        const fields = record(source, ["nodeId", "x", "y"]);
        const nodeId = string(fields.nodeId), x = coordinate(fields.x), y = coordinate(fields.y);
        member(nodeId, model.ids);
        if (positions.has(nodeId)) throw new RangeError("Duplicate list position");
        positions.set(nodeId, Object.freeze({ nodeId, x, y }));
    }
    const positionsByNode = model.list.nodes.map(node => {
        const position = positions.get(node.id);
        if (!position) throw new RangeError(`Missing list position: ${node.id}`);
        return position;
    });
    if (ordered && [...positions.keys()].some((id, i) => id !== model.list.nodes[i]!.id)) throw new RangeError("List snapshot layout must follow node order");
    return { positions: Object.freeze(positionsByNode), sources };
}

function nodeAttributes(value: unknown, model: Model<unknown>, field: "role" | "text", nullable: boolean, ordered: boolean) {
    const values = array(value, model.ids.size), seen = new Set<string>();
    const order = new Map(model.list.nodes.map((node, i) => [node.id, i])); let last = -1;
    return values.map(source => {
        const fields = record(source, ["id", field]);
        const id = string(fields.id), attribute = nullable && fields[field] === null ? null : field === "role" ? string(fields[field]) : text(fields[field]);
        member(id, model.ids); unique(id, seen);
        const index = order.get(id)!;
        if (ordered && index <= last) throw new RangeError("List snapshot attributes must follow node order");
        last = index;
        return { id, value: attribute };
    });
}
export function nodeMarks(value: unknown, model: Model<unknown>, snapshot = false): readonly ListMark[] {
    return Object.freeze(nodeAttributes(!snapshot && value === undefined ? [] : value, model, "role", !snapshot, snapshot)
        .map(item => Object.freeze({ id: item.id, role: item.value })));
}
export function captionPatches(value: unknown, model: Model<unknown>): readonly ListNodeCaptionPatch[] {
    return Object.freeze(nodeAttributes(value === undefined ? [] : value, model, "text", true, false)
        .map(item => Object.freeze({ id: item.id, text: item.value })));
}
export function captions(value: unknown, model: Model<unknown>, ordered = false): readonly ListNodeCaption[] {
    const captured = nodeAttributes(value, model, "text", false, ordered);
    return applyCaptions([], captured.map(item => ({ id: item.id, text: item.value! })), model);
}
export function pointerMarks(value: unknown, model: Model<unknown>, snapshot = false): readonly ListPointerMark[] {
    const values = array(!snapshot && value === undefined ? [] : value, model.ids.size + 1), seen = new Set<string>();
    const order = new Map(model.pointers.map((id, i) => [pointerKey(id), i])); let last = -1;
    return Object.freeze(values.map(source => {
        const fields = record(source, ["id", "role"]), id = pointer(fields.id);
        const role = !snapshot && fields.role === null ? null : string(fields.role);
        if (id.kind === "next") member(id.nodeId, model.ids);
        const key = pointerKey(id); unique(key, seen);
        const index = order.get(key)!;
        if (snapshot && index <= last) throw new RangeError("List snapshot pointer marks must follow slot order");
        last = index;
        return Object.freeze({ id, role });
    }));
}
export function applyNodeMarks(previous: readonly ListAnnotation[], patch: readonly ListMark[], model: Model<unknown>): readonly ListAnnotation[] {
    const roles = new Map(previous.map(item => [item.id, item.role]));
    for (const item of patch) { if (item.role === null) roles.delete(item.id); else roles.set(item.id, item.role); }
    return Object.freeze(model.list.nodes.filter(node => roles.has(node.id)).map(node => Object.freeze({ id: node.id, role: roles.get(node.id)! })));
}
export function applyPointerMarks(previous: readonly ListPointerAnnotation[], patch: readonly ListPointerMark[], model: Model<unknown>): readonly ListPointerAnnotation[] {
    const roles = new Map(previous.map(item => [pointerKey(item.id), item.role]));
    for (const item of patch) { const key = pointerKey(item.id); if (item.role === null) roles.delete(key); else roles.set(key, item.role); }
    return Object.freeze(model.pointers.filter(id => roles.has(pointerKey(id))).map(id => Object.freeze({ id, role: roles.get(pointerKey(id))! })));
}
export function applyCaptions(previous: readonly ListNodeCaption[], patch: readonly ListNodeCaptionPatch[], model: Model<unknown>): readonly ListNodeCaption[] {
    const values = new Map(previous.map(item => [item.id, item.text]));
    for (const item of patch) { if (item.text === null) values.delete(item.id); else values.set(item.id, item.text); }
    return Object.freeze(model.list.nodes.filter(node => values.has(node.id)).map(node => Object.freeze({ id: node.id, text: values.get(node.id)! })));
}
export function marks(value: unknown, model: Model<unknown>) {
    const fields = record(value, ["nodes", "pointers", "nodeCaptions"], []);
    const nodes = nodeMarks(fields.nodes, model), pointers = pointerMarks(fields.pointers, model), nodeCaptions = captionPatches(fields.nodeCaptions, model);
    return { nodes, pointers, nodeCaptions } satisfies Required<ListMarkUpdate>;
}
export function result(value: unknown, model: Model<unknown>, snapshot = false): ListResult {
    const fields = record(value, ["nodeIds", "pointerIds"], snapshot ? ["nodeIds", "pointerIds"] : []);
    const nodeValues = array(!snapshot && fields.nodeIds === undefined ? [] : fields.nodeIds, model.ids.size), nodeSeen = new Set<string>();
    const nodeIds = Object.freeze(nodeValues.map(value => { const id = string(value); member(id, model.ids); unique(id, nodeSeen); return id; }));
    const pointerValues = array(!snapshot && fields.pointerIds === undefined ? [] : fields.pointerIds, model.ids.size + 1), pointerSeen = new Set<string>();
    const pointerIds = Object.freeze(pointerValues.map(value => {
        const id = pointer(value); if (id.kind === "next") member(id.nodeId, model.ids);
        unique(pointerKey(id), pointerSeen); return id;
    }));
    return Object.freeze({ nodeIds, pointerIds });
}
