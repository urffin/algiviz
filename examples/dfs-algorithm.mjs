// Application-owned simple undirected graph DFS. Mirrors the website walkthrough.
import { graphExamples } from "./graph-algorithm.mjs";
const edgeId = (a, b) => JSON.stringify(a < b ? [a, b] : [b, a]);
const nonemptyString = (value) => typeof value === "string" && !!value.trim();
/** Clone a simple undirected graph. Neighbor order follows edge input order, without sorting. */
export function createBfsGraph(input) {
    if (!input || !Array.isArray(input.vertices) || !Array.isArray(input.edges))
        throw new TypeError("Expected vertex and edge arrays");
    const neighbors = new Map();
    const vertices = [];
    for (const vertex of input.vertices) {
        if (!vertex || !nonemptyString(vertex.id) || !nonemptyString(vertex.label))
            throw new TypeError("Expected nonempty vertex IDs and labels");
        if (neighbors.has(vertex.id))
            throw new RangeError("Duplicate vertex ID");
        neighbors.set(vertex.id, []);
        vertices.push(Object.freeze({ id: vertex.id, label: vertex.label }));
    }
    const edges = [];
    const seen = new Set();
    for (const edge of input.edges) {
        if (!edge || !nonemptyString(edge.source) || !nonemptyString(edge.target))
            throw new TypeError("Expected edge endpoints");
        const source = neighbors.get(edge.source), target = neighbors.get(edge.target);
        if (!source || !target)
            throw new RangeError("Unknown edge endpoint");
        if (edge.source === edge.target)
            throw new RangeError("Self-loops are not supported");
        const id = edgeId(edge.source, edge.target);
        if (seen.has(id))
            throw new RangeError("Parallel edges are not supported");
        seen.add(id);
        // Canonical endpoint order also keeps the visual edge identity independent of direction.
        const [a, b] = edge.source < edge.target ? [edge.source, edge.target] : [edge.target, edge.source];
        edges.push(Object.freeze({ id, source: a, target: b }));
        source.push(Object.freeze({ vertex: edge.target, edgeId: id }));
        target.push(Object.freeze({ vertex: edge.source, edgeId: id }));
    }
    return Object.freeze({
        vertices: Object.freeze(vertices),
        edges: Object.freeze(edges),
        adjacency: Object.freeze(Object.fromEntries([...neighbors].map(([id, entries]) => [id, Object.freeze(entries)])))
    });
}
import { createStepEmitter } from "@grundyjs/algiviz/playback";

/** Explicit call frames reproduce recursive DFS without using the JavaScript call stack. */
export function* iterateDepthFirstSearch(input, start, target = null) {
    const graph = createBfsGraph(input);
    if (typeof start !== "string" ||
        !start.trim() ||
        (target !== null && (typeof target !== "string" || !target.trim())))
        throw new TypeError("Expected a start ID and an optional target ID");
    if (!Object.hasOwn(graph.adjacency, start))
        throw new RangeError("Unknown start vertex");
    if (target !== null && !Object.hasOwn(graph.adjacency, target))
        throw new RangeError("Unknown target vertex");
    const status = Object.fromEntries(graph.vertices.map(v => [v.id, "unseen"]));
    const depth = Object.fromEntries(graph.vertices.map(v => [v.id, null]));
    const parent = Object.fromEntries(graph.vertices.map(v => [v.id, null]));
    const stack = [{ vertex: start, nextNeighbor: 0 }];
    const order = [start], finishOrder = [];
    let activeEdge = null;
    let phase = "traversal";
    let path = [];
    let edgeChecks = 0, maxStackSize = 1;
    status[start] = "visiting";
    depth[start] = 0;
    const emit = createStepEmitter(() => Object.freeze({
        graph,
        start,
        target,
        stack: Object.freeze(stack.map(call => Object.freeze({ ...call }))),
        current: stack.at(-1)?.vertex ?? null,
        status: Object.freeze({ ...status }),
        depth: Object.freeze({ ...depth }),
        parent: Object.freeze({ ...parent }),
        order: Object.freeze([...order]),
        finishOrder: Object.freeze([...finishOrder]),
        activeEdge,
        phase,
        path: Object.freeze([...path]),
        discoveredCount: order.length,
        finishedCount: finishOrder.length,
        edgeChecks,
        maxStackSize
    }));
    const snapshot = (event) => emit(Object.freeze(event));
    yield snapshot({ type: "start" });
    while (stack.length) {
        const call = stack.at(-1);
        const neighbors = graph.adjacency[call.vertex];
        if (call.nextNeighbor === neighbors.length) {
            stack.pop();
            status[call.vertex] = "finished";
            finishOrder.push(call.vertex);
            activeEdge = null;
            yield snapshot({ type: "return", vertex: call.vertex, to: stack.at(-1)?.vertex ?? null });
            continue;
        }
        const neighbor = neighbors[call.nextNeighbor++];
        activeEdge = Object.freeze({ edgeId: neighbor.edgeId, from: call.vertex, to: neighbor.vertex });
        edgeChecks++;
        yield snapshot({ type: "inspect-edge", ...activeEdge });
        if (status[neighbor.vertex] !== "unseen") {
            yield snapshot({ type: "skip", ...activeEdge });
            continue;
        }
        status[neighbor.vertex] = "visiting";
        parent[neighbor.vertex] = call.vertex;
        depth[neighbor.vertex] = depth[call.vertex] + 1;
        order.push(neighbor.vertex);
        stack.push({ vertex: neighbor.vertex, nextNeighbor: 0 });
        maxStackSize = Math.max(maxStackSize, stack.length);
        yield snapshot({ type: "discover", ...activeEdge });
    }
    phase = "traversal-complete";
    yield snapshot({ type: "traversal-done" });
    if (target !== null && depth[target] !== null) {
        phase = "path";
        for (let vertex = target; vertex !== null; vertex = parent[vertex]) {
            path.push(vertex);
            yield snapshot({ type: "path-step", vertex });
        }
        path = path.reverse();
    }
    phase = "done";
    yield snapshot({ type: "done" });
}
export function depthFirstSearchSteps(input, start, target = null) {
    return Object.freeze([...iterateDepthFirstSearch(input, start, target)]);
}

export const dfsExamples = Object.freeze(graphExamples.filter(e => e.id !== 'circle').map(e => Object.freeze({
    id: e.id, label: e.id === 'diamond' ? 'Diamond and a cycle' : e.label, start: e.start, target: e.id === 'layers' ? 'F' : e.target,
    graph: Object.freeze({ vertices: Object.freeze(e.graph.nodes.map(n => Object.freeze({ id: n.id, label: n.label ?? n.id }))),
        edges: Object.freeze(e.graph.edges.map(e => Object.freeze({ source: e.from, target: e.to }))) })
})));
