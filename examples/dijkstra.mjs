import { createGraphTrace } from '@grundyjs/algiviz/graph';

const source = 'A';
const vertices = ['A', 'B', 'C', 'D'];
const edges = [
    { id: 'AB', from: 'A', to: 'B', weight: 8, directed: true },
    { id: 'AC', from: 'A', to: 'C', weight: 2, directed: true },
    { id: 'AD', from: 'A', to: 'D', weight: 6, directed: true },
    { id: 'CB', from: 'C', to: 'B', weight: 3, directed: true },
    { id: 'BD', from: 'B', to: 'D', weight: 2, directed: true },
];
const layout = [
    { nodeId: 'A', x: 0, y: 1.35 },
    { nodeId: 'B', x: 1.3, y: 0 },
    { nodeId: 'C', x: .08, y: 0 },
    { nodeId: 'D', x: 2.6, y: 1.35 },
];

export function distanceLabel(distance) {
    return distance === Infinity ? '∞' : String(distance);
}

export function* dijkstraSteps() {
    const graph = createGraphTrace({ nodes: vertices.map(id => ({ id })), edges }, { layout });
    const distances = new Map(vertices.map(id => [id, Infinity]));
    const incoming = new Map();
    const settled = new Set();
    const queue = new Map([[source, 0]]);
    distances.set(source, 0);

    // This small priority queue stores one entry per vertex. Updating an
    // entry replaces its old priority, and the snapshot shows removal order.
    const orderedQueue = () => [...queue].sort(([left, a], [right, b]) => a - b || left.localeCompare(right));
    const snapshot = ({ index, state: graphState }, event, message) => Object.freeze({
        index,
        event: Object.freeze(event),
        state: Object.freeze({
            graph: graphState,
            distances: Object.freeze(vertices.map(vertex => Object.freeze({
                vertex,
                distance: distances.get(vertex),
                predecessor: incoming.get(vertex)?.from ?? null,
                settled: settled.has(vertex),
            }))),
            queue: Object.freeze(orderedQueue().map(([vertex, distance]) => Object.freeze({ vertex, distance }))),
            message,
        }),
    });

    function mark(active, edge, improved) {
        const bestEdges = new Set([...incoming.values()].map(({ id }) => id));
        return graph.mark({
            nodes: vertices.map(id => ({ id, role: id === active ? 'active' : settled.has(id) ? 'settled' : null })),
            edges: edges.map(({ id }) => ({
                id,
                role: id === edge?.id ? (improved ? 'improved' : 'unchanged') : bestEdges.has(id) ? 'predecessor' : null,
            })),
        });
    }

    yield snapshot(graph.start(), { type: 'start' }, 'Start at A. Its distance is 0; all other distances are unknown.');

    while (queue.size > 0) {
        const [[vertex, distance]] = orderedQueue();
        queue.delete(vertex);
        settled.add(vertex);
        yield snapshot(mark(vertex), { type: 'settle', vertex, distance },
            `Remove ${vertex} (distance ${distance}) from the queue and finalize its distance.`);

        for (const edge of edges.filter(({ from }) => from === vertex)) {
            const previous = distances.get(edge.to);
            const candidate = distance + edge.weight;
            const improved = candidate < previous;
            if (improved) {
                distances.set(edge.to, candidate);
                incoming.set(edge.to, edge);
                queue.set(edge.to, candidate);
            }
            const sum = `${distance} + ${edge.weight} = ${candidate}`;
            const message = improved
                ? `${vertex} → ${edge.to}: ${sum}. Update ${edge.to} from ${distanceLabel(previous)} to ${candidate}.`
                : `${vertex} → ${edge.to}: ${sum}. Keep ${edge.to} at ${previous}.`;
            yield snapshot(mark(vertex, edge, improved), {
                type: improved ? 'improve' : 'keep', edgeId: edge.id, vertex: edge.to, previous, candidate,
            }, message);
        }
    }

    const edgeIds = [...incoming.values()].map(({ id }) => id);
    yield snapshot(graph.done({ result: { nodeIds: [...settled], edgeIds } }), { type: 'done' },
        'The queue is empty. The green edges form the shortest-path tree from A.');
}
