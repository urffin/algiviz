/** Application-owned undirected graph BFS; no drawing knowledge. */
import { createStepEmitter } from '@grundyjs/algiviz/playback';
export function* graphSteps(input, start) {
    const nodes = input.nodes.map(node => Object.freeze({ id: node.id, label: node.label ?? node.id }));
    const ids = new Set(nodes.map(node => node.id));
    if (ids.size !== nodes.length || nodes.some(node => typeof node.id !== 'string' || !node.id ||
        typeof node.label !== 'string')) throw new TypeError('Expected unique non-empty node IDs and string labels');
    if (!ids.has(start)) throw new RangeError('Start node must belong to the graph');
    const edgeIds = new Set();
    const edges = input.edges.map(edge => {
        if (typeof edge.id !== 'string' || !edge.id || edgeIds.has(edge.id) ||
            !ids.has(edge.from) || !ids.has(edge.to)) throw new TypeError('Invalid edge ID or endpoint');
        edgeIds.add(edge.id);
        return Object.freeze({ id: edge.id, from: edge.from, to: edge.to });
    });
    const graph = Object.freeze({ nodes: Object.freeze(nodes), edges: Object.freeze(edges) });
    const adjacency = new Map(nodes.map(node => [node.id, []]));
    for (const edge of edges) {
        adjacency.get(edge.from).push({ target: edge.to, edge: edge.id });
        if (edge.from !== edge.to) adjacency.get(edge.to).push({ target: edge.from, edge: edge.id });
    }
    const queue = [start], discovered = new Set([start]), visited = [], treeEdges = [];
    const distance = new Map([[start, 0]]);
    let current = null, activeEdge = null;
    const capture = createStepEmitter(() => Object.freeze({
            graph, start, current, activeEdge,
            queue: Object.freeze([...queue]), visited: Object.freeze([...visited]),
            treeEdges: Object.freeze([...treeEdges]),
            distances: Object.freeze(nodes.map(node => Object.freeze({
                id: node.id, distance: distance.get(node.id) ?? null
            }))),
    }));
    const emit = (kind, target = null) => capture(Object.freeze({ kind, target }));
    yield emit('start', start);
    while (queue.length) {
        current = queue.shift();
        activeEdge = null;
        yield emit('dequeue', current);
        for (const { target, edge } of adjacency.get(current)) {
            activeEdge = edge;
            yield emit('examine', target);
            if (discovered.has(target)) {
                yield emit('skip', target);
                continue;
            }
            discovered.add(target); // Mark on enqueue, so cycles never enqueue twice.
            distance.set(target, distance.get(current) + 1);
            treeEdges.push(edge);
            queue.push(target);
            yield emit('discover', target);
        }
        activeEdge = null;
        visited.push(current);
        yield emit('settle', current);
    }
    current = null;
    yield emit('finished');
}
export const sampleGraph = Object.freeze({
    nodes: Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(id => Object.freeze({ id }))),
    edges: Object.freeze([
        ['AB', 'A', 'B'], ['AC', 'A', 'C'], ['BD', 'B', 'D'],
        ['CD', 'C', 'D'], ['DE', 'D', 'E'], ['BC', 'B', 'C'], ['FG', 'F', 'G'],
    ].map(([id, from, to]) => Object.freeze({ id, from, to }))),
});
