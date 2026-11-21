import type { Scene, SceneObject } from "../scene/index.js";
import type { ListSnapshot, ListSceneOptions, ListObjects } from "./types.js";
import { model, record, string, pointerKey } from "./validation.js";
import * as attributes from "./attributes.js";

/** Validate complete immutable endpoints; payload/node/position references remain caller-owned. */
export function listScene<Value = unknown>(state: ListSnapshot<Value>, options: ListSceneOptions): Scene<ListObjects<Value>> {
    const namespace = string(record(options, ["namespace"]).namespace);
    return captureListScene<Value>(state, namespace).scene;
}

/** A renderer needs owned endpoint data before calling its presenter. */
export function captureListScene<Value>(state: unknown, namespace: string, own = false) {
    const fields = record(state, ["list", "layout", "nodeMarks", "pointerMarks", "nodeCaptions", "result"]);
    const current = model<Value>(fields.list), positions = attributes.layout(fields.layout, current, true);
    // Snapshot mode rejects null roles before returning.
    const nodeMarks = attributes.nodeMarks(fields.nodeMarks, current, true) as ListSnapshot<Value>["nodeMarks"];
    const pointerMarks = attributes.pointerMarks(fields.pointerMarks, current, true) as ListSnapshot<Value>["pointerMarks"];
    const nodeCaptions = attributes.captions(fields.nodeCaptions, current, true);
    const nodes = new Map(nodeMarks.map(mark => [mark.id, mark.role]));
    const pointers = new Map(pointerMarks.map(mark => [pointerKey(mark.id), mark.role]));
    const captions = new Map(nodeCaptions.map(item => [item.id, item.text]));
    const result = fields.result === null ? null : attributes.result(fields.result, current, true);
    const selectedNodes = new Set(result?.nodeIds), selectedPointers = new Set(result?.pointerIds.map(pointerKey));
    const ids = new Map(current.list.nodes.map(node => [node.id, JSON.stringify([namespace, "list", "node", node.id])]));
    const objects: SceneObject<ListObjects<Value>>[] = current.pointers.map(pointer => {
        const head = pointer.kind === "head", key = pointerKey(pointer);
        const target = head ? current.list.headId : current.byId.get(pointer.nodeId)!.nextId;
        return Object.freeze({
            id: JSON.stringify(head ? [namespace, "list", "pointer", "head"] : [namespace, "list", "pointer", "next", pointer.nodeId]),
            type: "listPointer" as const, zIndex: 0,
            data: Object.freeze({ pointer, from: head ? null : ids.get(pointer.nodeId)!, to: target === null ? null : ids.get(target)!,
                role: pointers.get(key) ?? null, result: selectedPointers.has(key) })
        });
    });
    for (const [i, node] of current.list.nodes.entries()) objects.push(Object.freeze({
        id: ids.get(node.id)!, type: "listNode" as const, zIndex: 1,
        data: Object.freeze({ node: own ? node : current.sourceNodes[i]!,
            position: (own ? positions.positions : positions.sources)[i]!,
            caption: captions.get(node.id) ?? null, role: nodes.get(node.id) ?? null,
            result: selectedNodes.has(node.id), head: node.id === current.list.headId, tail: node.nextId === null })
    }));
    return {
        scene: Object.freeze({ objects: Object.freeze(objects) }),
        snapshot: Object.freeze({ list: current.list, layout: positions.positions, nodeMarks, pointerMarks, nodeCaptions, result })
    };
}
