/** Application-owned undirected graph BFS; no drawing knowledge. */
import { createStepEmitter } from '@grundyjs/algiviz/playback';
import { createGraphTrace } from '@grundyjs/algiviz/graph';

export function* graphSteps(input, start, target = null, options) {
    const trace = createGraphTrace(input, options);
    const graph = trace.state.graph, { nodes, edges } = graph;
    const ids = new Set(nodes.map(node => node.id));
    if (!ids.has(start)) throw new RangeError('Start node must belong to the graph');
    if (target !== null && !ids.has(target)) throw new RangeError('Target node must belong to the graph');
    if (edges.some(edge => edge.directed || edge.weight !== undefined))
        throw new RangeError('This BFS example expects an undirected, unweighted graph');
    trace.start();
    const adjacency = new Map(nodes.map(node => [node.id, []]));
    for (const edge of edges) {
        adjacency.get(edge.from).push({ target: edge.to, edge: edge.id });
        if (edge.from !== edge.to) adjacency.get(edge.to).push({ target: edge.from, edge: edge.id });
    }
    const queue = [start], discovered = new Set([start]), visited = [], treeEdges = [];
    const distance = new Map([[start, 0]]), parent = new Map([[start, null]]), parentEdge = new Map();
    let head = 0, current = null, activeEdge = null, phase = 'traversal';
    let path = [], edgeChecks = 0, maxQueueSize = 1;
    let event;
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
        visual: trace.state, event,
    }));
    function emit(kind, vertex = null, source = current) {
        event = Object.freeze({ kind, target: vertex, source });
        const pathNodes = new Set(path), pathEdges = new Set();
        for (let i = 1; i < path.length; i++) {
            const a = path[i - 1], b = path[i];
            pathEdges.add(parent.get(a) === b ? parentEdge.get(a) : parentEdge.get(b));
        }
        if (kind === 'finished') {
            trace.done(target === null ? undefined : { result: { nodeIds: path, edgeIds: [...pathEdges] } });
        } else {
            const processed = new Set(visited), tree = new Set(treeEdges);
            trace.mark({
                nodeCaptions: nodes.map(({ id }) => ({ id, text: 'd = ' + (distance.get(id) ?? (phase === 'traversal' ? '—' : '∞')) })),
                nodes: nodes.map(({ id }) => ({ id, role: pathNodes.has(id) ? 'path' : id === current ? 'active'
                    : processed.has(id) ? 'visited' : discovered.has(id) ? 'queued' : null })),
                edges: edges.map(({ id }) => ({ id, role: pathEdges.has(id) ? 'path' : id === activeEdge ? 'active'
                    : tree.has(id) ? 'tree' : null }))
            });
        }
        return capture(event);
    }
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

export { sampleGraph, graphExamples } from './graph-presets.mjs';
