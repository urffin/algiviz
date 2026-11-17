import type { Scene, SceneObject } from "../scene/index.js";
import type { GraphSnapshot, GraphSceneOptions, GraphObjects } from "./types.js";
import { record, string, captureGraph, captureLayout, captureAnnotations, captureResult, captureCaptions } from "./validation.js";

/** Validate/project an immutable snapshot, retaining the caller's node/edge/position records. */
export function graphScene<N = unknown, E = unknown>(state: GraphSnapshot<N, E>, options: GraphSceneOptions): Scene<GraphObjects<N, E>> {
    const namespace = string(record(options, ["namespace"]).namespace);
    const fields = record(state, ["graph", "layout", "nodeMarks", "edgeMarks", "result", "nodeCaptions"], ["graph", "layout", "nodeMarks", "edgeMarks", "result"]);
    const model = captureGraph<N, E>(fields.graph);
    const positions = captureLayout(fields.layout, model.graph.nodes, model.nodeIds, true);
    const nodeMarks = new Map(captureAnnotations(fields.nodeMarks, model.graph.nodes).map(mark => [mark.id, mark.role]));
    const edgeMarks = new Map(captureAnnotations(fields.edgeMarks, model.graph.edges).map(mark => [mark.id, mark.role]));
    const captions = new Map(captureCaptions(fields.nodeCaptions, model.graph.nodes, true).map(item => [item.id, item.text]));
    const result = fields.result === null ? null : captureResult(fields.result, model.nodeIds, model.edgeIds, true);
    const resultNodes = new Set(result?.nodeIds), resultEdges = new Set(result?.edgeIds);
    const nodeSceneIds = new Map(model.graph.nodes.map(node => [node.id, JSON.stringify([namespace, "node", node.id])]));
    const groups = new Map<string, number[]>();
    for (const [i, edge] of model.graph.edges.entries()) {
        const pair = edge.from <= edge.to ? [edge.from, edge.to] : [edge.to, edge.from];
        const key = JSON.stringify(pair), group = groups.get(key);
        if (group) group.push(i); else groups.set(key, [i]);
    }
    const routes = new Map<number, { routeIndex: number; routeCount: number }>();
    for (const group of groups.values()) group.forEach((edge, i) => routes.set(edge, { routeIndex: i, routeCount: group.length }));
    const objects: SceneObject<GraphObjects<N, E>>[] = model.graph.edges.map((edge, i) => Object.freeze({
        id: JSON.stringify([namespace, "edge", edge.id]), type: "graphEdge" as const, zIndex: 0,
        data: Object.freeze({ edge: model.sourceEdges[i]!, from: nodeSceneIds.get(edge.from)!, to: nodeSceneIds.get(edge.to)!,
            role: edgeMarks.get(edge.id) ?? null, result: resultEdges.has(edge.id), ...routes.get(i)! })
    }));
    for (const [i, node] of model.graph.nodes.entries()) objects.push(Object.freeze({
        id: nodeSceneIds.get(node.id)!, type: "graphNode" as const, zIndex: 1,
        data: Object.freeze({ node: model.sourceNodes[i]!, ...(captions.has(node.id) ? { caption: captions.get(node.id)! } : {}), position: positions.sources[i]!,
            role: nodeMarks.get(node.id) ?? null, result: resultNodes.has(node.id) })
    }));
    return Object.freeze({ objects: Object.freeze(objects) });
}
