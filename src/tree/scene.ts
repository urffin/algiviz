import type { Scene, SceneObject } from "../scene/index.js";
import type { TreeSnapshot, TreeSceneOptions, TreeObjects } from "./types.js";
import { record, string, captureTree } from "./validation.js";
import { captureLayout, captureAnnotations, captureCaptions, captureResult } from "./attributes.js";

export function treeScene<N = unknown, L = unknown>(state: TreeSnapshot<N, L, "ordered">, options: TreeSceneOptions): Scene<TreeObjects<N, L, "ordered">>;
export function treeScene<N = unknown, L = unknown>(state: TreeSnapshot<N, L, "binary">, options: TreeSceneOptions): Scene<TreeObjects<N, L, "binary">>;
export function treeScene<N = unknown, L = unknown>(state: TreeSnapshot<N, L>, options: TreeSceneOptions): Scene<TreeObjects<N, L>>;
/** Validate immutable endpoints; original records/payloads remain references in frozen view wrappers. */
export function treeScene<N = unknown, L = unknown>(state: TreeSnapshot<N, L>, options: TreeSceneOptions): Scene<TreeObjects<N, L>> {
    const namespace = string(record(options, ["namespace"]).namespace);
    const fields = record(state, ["tree", "layout", "nodeMarks", "linkMarks", "nodeCaptions", "result"]);
    const model = captureTree<N, L>(fields.tree);
    const positions = captureLayout(fields.layout, model.tree.nodes, model.nodeIds, true);
    const nodes = new Map(captureAnnotations(fields.nodeMarks, model.tree.nodes).map(item => [item.id, item.role]));
    const links = new Map(captureAnnotations(fields.linkMarks, model.tree.links).map(item => [item.id, item.role]));
    const captions = new Map(captureCaptions(fields.nodeCaptions, model.tree.nodes, true).map(item => [item.id, item.text]));
    const result = fields.result === null ? null : captureResult(fields.result, model.nodeIds, model.linkIds, true);
    const selectedNodes = new Set(result?.nodeIds), selectedLinks = new Set(result?.linkIds);
    // Tree-specific domains also avoid collisions with graph objects sharing a namespace.
    const ids = new Map(model.tree.nodes.map(node => [node.id, JSON.stringify([namespace, "tree", "node", node.id])]));
    const objects: SceneObject<TreeObjects<N, L>>[] = model.tree.links.map((link, i) => Object.freeze({
        id: JSON.stringify([namespace, "tree", "link", link.id]), type: "treeLink" as const, zIndex: 0,
        data: Object.freeze({ link: model.sourceLinks[i]!, from: ids.get(link.parentId)!, to: ids.get(link.childId)!,
            role: links.get(link.id) ?? null, result: selectedLinks.has(link.id) })
    }));
    for (const [i, node] of model.tree.nodes.entries()) objects.push(Object.freeze({
        id: ids.get(node.id)!, type: "treeNode" as const, zIndex: 1,
        data: Object.freeze({ node: model.sourceNodes[i]!, position: positions.sources[i]!,
            caption: captions.get(node.id) ?? null, role: nodes.get(node.id) ?? null,
            result: selectedNodes.has(node.id), root: node.id === model.tree.rootId })
    }));
    return Object.freeze({ objects: Object.freeze(objects) });
}
