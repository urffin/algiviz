import type { TreePosition, TreeMark, TreeAnnotation, TreeNodeCaption, TreeNodeCaptionPatch, TreeResult } from "./types.js";
import { record, array, string, text, number, member, unique } from "./validation.js";
type Entity = { readonly id: string };

export function captureLayout(value: unknown, nodes: readonly Entity[], ids: ReadonlySet<string>, ordered = false) {
    const sources = array(value) as TreePosition[], positions = new Map<string, TreePosition>();
    for (const source of sources) {
        const fields = record(source, ["nodeId", "x", "y"]);
        const nodeId = string(fields.nodeId), x = number(fields.x), y = number(fields.y);
        member(nodeId, ids);
        if (positions.has(nodeId)) throw new RangeError(`Duplicate tree position: ${nodeId}`);
        positions.set(nodeId, Object.freeze({ nodeId, x, y }));
    }
    const layout = nodes.map(node => {
        const position = positions.get(node.id);
        if (!position) throw new RangeError(`Missing tree position: ${node.id}`);
        return position;
    });
    if (ordered && [...positions.keys()].some((id, i) => id !== nodes[i]!.id)) throw new RangeError("Tree snapshot layout must follow node order");
    return { layout: Object.freeze(layout), sources };
}
export function captureMarks(value: unknown, ids: ReadonlySet<string>): readonly TreeMark[] {
    const values = value === undefined ? [] : array(value), seen = new Set<string>();
    return Object.freeze(values.map(source => {
        const fields = record(source, ["id", "role"]);
        const id = string(fields.id), role = fields.role === null ? null : string(fields.role);
        member(id, ids); unique(id, seen);
        return Object.freeze({ id, role });
    }));
}
export function applyMarks(previous: readonly TreeAnnotation[], patch: readonly TreeMark[], order: readonly Entity[]): readonly TreeAnnotation[] {
    const roles = new Map(previous.map(mark => [mark.id, mark.role]));
    for (const { id, role } of patch) { if (role === null) roles.delete(id); else roles.set(id, role); }
    return Object.freeze(order.filter(item => roles.has(item.id)).map(item => Object.freeze({ id: item.id, role: roles.get(item.id)! })));
}
export function captureAnnotations(value: unknown, order: readonly Entity[]): readonly TreeAnnotation[] {
    const values = array(value), positions = new Map(order.map((item, i) => [item.id, i])); let last = -1;
    return Object.freeze(values.map(source => {
        const fields = record(source, ["id", "role"]), id = string(fields.id), role = string(fields.role);
        const position = positions.get(id);
        if (position === undefined) throw new RangeError(`Unknown tree annotation: ${id}`);
        if (position <= last) throw new RangeError("Tree snapshot marks must be unique and follow entity order");
        last = position;
        return Object.freeze({ id, role });
    }));
}
export function captureCaptionPatches(value: unknown, ids: ReadonlySet<string>): readonly TreeNodeCaptionPatch[] {
    const values = value === undefined ? [] : array(value), seen = new Set<string>();
    return Object.freeze(values.map(source => {
        const fields = record(source, ["id", "text"]), id = string(fields.id);
        const caption = fields.text === null ? null : text(fields.text);
        member(id, ids); unique(id, seen);
        return Object.freeze({ id, text: caption });
    }));
}
export function applyCaptions(previous: readonly TreeNodeCaption[], patch: readonly TreeNodeCaptionPatch[], order: readonly Entity[]): readonly TreeNodeCaption[] {
    const captions = new Map(previous.map(item => [item.id, item.text]));
    for (const item of patch) { if (item.text === null) captions.delete(item.id); else captions.set(item.id, item.text); }
    return Object.freeze(order.filter(item => captions.has(item.id)).map(item => Object.freeze({ id: item.id, text: captions.get(item.id)! })));
}
export function captureCaptions(value: unknown, nodes: readonly Entity[], ordered = false): readonly TreeNodeCaption[] {
    const values = array(value), positions = new Map(nodes.map((node, i) => [node.id, i]));
    const seen = new Set<string>(); let last = -1;
    const captions = values.map(source => {
        const fields = record(source, ["id", "text"]), id = string(fields.id), caption = text(fields.text);
        const position = positions.get(id);
        if (position === undefined) throw new RangeError(`Unknown tree caption: ${id}`);
        unique(id, seen);
        if (ordered && position <= last) throw new RangeError("Tree snapshot captions must follow node order");
        last = position;
        return Object.freeze({ id, text: caption });
    });
    return applyCaptions([], captions, nodes);
}
export function captureResult(value: unknown, nodeIds: ReadonlySet<string>, linkIds: ReadonlySet<string>, snapshot = false): TreeResult {
    const fields = record(value, ["nodeIds", "linkIds"], snapshot ? ["nodeIds", "linkIds"] : []);
    function selection(value: unknown, ids: ReadonlySet<string>) {
        const values = !snapshot && value === undefined ? [] : array(value), seen = new Set<string>();
        const selected = values.map(value => { const id = string(value); member(id, ids); unique(id, seen); return id; });
        return Object.freeze(selected);
    }
    const nodes = selection(fields.nodeIds, nodeIds), links = selection(fields.linkIds, linkIds);
    return Object.freeze({ nodeIds: nodes, linkIds: links });
}
