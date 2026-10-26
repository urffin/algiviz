/** Application-owned undirected graph BFS; no drawing knowledge. */
import { createStepEmitter } from '@grundyjs/algiviz/playback';

export function* graphSteps(input, start, target = null) {
    if (!input || !Array.isArray(input.nodes) || !Array.isArray(input.edges))
        throw new TypeError('Expected node and edge arrays');
    const nodes = Array.from(input.nodes, node => {
        if (!node || typeof node.id !== 'string' || !node.id ||
            (node.label !== undefined && typeof node.label !== 'string'))
            throw new TypeError('Expected non-empty node IDs and string labels');
        return Object.freeze({ id: node.id, label: node.label ?? node.id });
    });
    const ids = new Set(nodes.map(node => node.id));
    if (ids.size !== nodes.length) throw new TypeError('Expected unique node IDs');
    if (!ids.has(start)) throw new RangeError('Start node must belong to the graph');
    if (target !== null && !ids.has(target)) throw new RangeError('Target node must belong to the graph');
    const edgeIds = new Set();
    const edges = Array.from(input.edges, edge => {
        if (!edge || typeof edge.id !== 'string' || !edge.id || edgeIds.has(edge.id) ||
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
    const distance = new Map([[start, 0]]), parent = new Map([[start, null]]), parentEdge = new Map();
    let head = 0, current = null, activeEdge = null, phase = 'traversal';
    let path = [], edgeChecks = 0, maxQueueSize = 1;
    const capture = createStepEmitter(() => Object.freeze({
        graph, start, target, current, activeEdge, phase,
        queue: Object.freeze(queue.slice(head)), visited: Object.freeze([...visited]),
        treeEdges: Object.freeze([...treeEdges]), path: Object.freeze([...path]),
        discoveredCount: discovered.size, processedCount: visited.length, edgeChecks, maxQueueSize,
        distances: Object.freeze(nodes.map(node => Object.freeze({
            id: node.id, distance: distance.get(node.id) ?? null
        }))),
        parents: Object.freeze(nodes.map(node => Object.freeze({
            id: node.id, parent: parent.get(node.id) ?? null, edge: parentEdge.get(node.id) ?? null
        }))),
    }));
    const emit = (kind, vertex = null, source = current) => capture(Object.freeze({ kind, target: vertex, source }));
    yield emit('start', start);
    while (head < queue.length) {
        current = queue[head++];
        activeEdge = null;
        yield emit('dequeue', current);
        for (const { target: neighbor, edge } of adjacency.get(current)) {
            activeEdge = edge;
            edgeChecks++;
            yield emit('examine', neighbor);
            if (discovered.has(neighbor)) {
                yield emit('skip', neighbor);
                continue;
            }
            discovered.add(neighbor); // Mark on enqueue, so cycles never enqueue twice.
            distance.set(neighbor, distance.get(current) + 1);
            parent.set(neighbor, current);
            parentEdge.set(neighbor, edge);
            treeEdges.push(edge);
            queue.push(neighbor);
            maxQueueSize = Math.max(maxQueueSize, queue.length - head);
            yield emit('discover', neighbor);
        }
        activeEdge = null;
        const completed = current;
        visited.push(completed);
        current = null;
        yield emit('settle', completed);
    }
    phase = 'traversal-complete';
    yield emit('traversal-done');
    if (target !== null && discovered.has(target)) {
        phase = 'path';
        for (let vertex = target; vertex !== null; vertex = parent.get(vertex)) {
            path.push(vertex);
            yield emit('path', vertex, parent.get(vertex));
        }
        path = path.reverse();
    }
    phase = 'finished';
    yield emit('finished');
}

function fixedGraph(labels, pairs) {
    return Object.freeze({
        nodes: Object.freeze([...labels].map(id => Object.freeze({ id }))),
        edges: Object.freeze(pairs.map(([id, from, to]) => Object.freeze({ id, from, to }))),
    });
}
// Kept for the original walkthrough, tests and README GIF.
export const sampleGraph = fixedGraph('ABCDEFG', [
    ['AB', 'A', 'B'], ['AC', 'A', 'C'], ['BD', 'B', 'D'],
    ['CD', 'C', 'D'], ['DE', 'D', 'E'], ['BC', 'B', 'C'], ['FG', 'F', 'G'],
]);
export const graphExamples = Object.freeze([
    Object.freeze({ id: 'layers', label: 'Layers and a cycle', start: 'A', target: 'G',
        graph: fixedGraph('ABCDEFGH', ['AB', 'AC', 'BD', 'BE', 'CE', 'CF', 'DG', 'EG', 'FG'].map(pair => [pair, ...pair])) }),
    Object.freeze({ id: 'chain', label: 'Chain', start: 'A', target: 'E',
        graph: fixedGraph('ABCDE', ['AB', 'BC', 'CD', 'DE'].map(pair => [pair, ...pair])) }),
    Object.freeze({ id: 'diamond', label: 'Two shortest paths', start: 'A', target: 'D',
        graph: fixedGraph('ABCD', ['AB', 'AC', 'BD', 'CD'].map(pair => [pair, ...pair])) }),
    Object.freeze({ id: 'circle', label: 'Original disconnected graph', start: 'A', target: 'E', graph: sampleGraph }),
]);
