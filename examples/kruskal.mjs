import { createDynamicGraphTrace, createGraphTrace } from '@grundyjs/algiviz/graph';
import { timing } from './player-settings.mjs';

const input = {
    nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }],
    edges: [
        { id: 'AB', from: 'A', to: 'B', weight: 3 },
        { id: 'AC', from: 'A', to: 'C', weight: 1 },
        { id: 'BC', from: 'B', to: 'C', weight: 2 },
        { id: 'BD', from: 'B', to: 'D', weight: 4 },
        { id: 'CD', from: 'C', to: 'D', weight: 5 },
        { id: 'CE', from: 'C', to: 'E', weight: 6 },
        { id: 'DE', from: 'D', to: 'E', weight: 7 },
    ],
};
const layout = [
    { nodeId: 'A', x: 0, y: 0 }, { nodeId: 'B', x: 0, y: 1.35 },
    { nodeId: 'C', x: 1.05, y: .55 }, { nodeId: 'D', x: 2.3, y: 1.45 },
    { nodeId: 'E', x: 2.45, y: 0 },
];

function* edgeDecisions({ nodes, edges }) {
    const parents = new Map(nodes.map(({ id }) => [id, id]));
    function root(id) {
        while (parents.get(id) !== id) {
            const parent = parents.get(id);
            parents.set(id, parents.get(parent));
            id = parents.get(id);
        }
        return id;
    }

    let remaining = nodes.length - 1;
    for (const edge of [...edges].sort((a, b) => a.weight - b.weight)) {
        const from = root(edge.from), to = root(edge.to);
        const accepted = from !== to;
        if (accepted) {
            parents.set(from, to);
            remaining--;
        }
        yield { edge, accepted };
        if (remaining === 0) return;
    }
}

function describe(step, forest, totalWeight, message) {
    return Object.freeze({
        ...step, state: Object.freeze({ graph: step.state, forest, totalWeight, message }),
    });
}

export function* kruskalSteps() {
    const graph = createGraphTrace(input, { layout });
    const forest = createDynamicGraphTrace({ nodes: input.nodes, edges: [] }, { layout });
    forest.start();
    const selected = [];
    let totalWeight = 0;
    yield describe(graph.start(), forest.state, totalWeight, 'Start with five separate vertices. Consider edges from lowest weight to highest.');

    for (const { edge, accepted } of edgeDecisions(graph.state.graph)) {
        const mark = { id: edge.id, role: accepted ? 'accepted' : 'rejected' };
        if (accepted) {
            selected.push(edge);
            totalWeight += edge.weight;
            forest.edit({ edges: selected, marks: { edges: [mark] } });
        }
        const message = accepted
            ? `Accept ${edge.from}–${edge.to} (weight ${edge.weight}). It joins two components.`
            : `Skip ${edge.from}–${edge.to} (weight ${edge.weight}). It would form a cycle.`;
        yield describe(graph.mark({ edges: [mark] }), forest.state, totalWeight, message);
    }

    const result = { edgeIds: selected.map(edge => edge.id) };
    forest.done({ result });
    yield describe(graph.done({ result }), forest.state, totalWeight,
        `Minimum spanning tree: ${selected.length} edges.`);
}

export function prepareKruskalSession(mode) {
    if (mode === 'history') {
        return { ...timing, history: () => Object.freeze(Array.from(kruskalSteps(), step => step.state)) };
    }
    if (mode === 'generator') {
        return { ...timing, stepSource: kruskalSteps, isTerminal: step => step.event.type === 'done', rewindCapacity: 8 };
    }
    throw new RangeError('Choose a playback mode');
}
