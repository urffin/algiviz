import { createDynamicGraphTrace } from '@grundyjs/algiviz/graph';
import { timing } from './player-settings.mjs';

const initial = {
    nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
    edges: [
        { id: 'AB', from: 'A', to: 'B', label: 'AB' },
        { id: 'AC', from: 'A', to: 'C', label: 'AC' },
        { id: 'BC', from: 'C', to: 'B', label: 'BC' },
        { id: 'BD', from: 'B', to: 'D', label: 'BD' },
    ],
};
const layout = [
    { nodeId: 'A', x: 0, y: 1 }, { nodeId: 'B', x: 1.3, y: 1 },
    { nodeId: 'C', x: .3, y: 0 }, { nodeId: 'D', x: 2, y: .2 },
];
const describe = (step, message) => Object.freeze({
    ...step, state: Object.freeze({ visual: step.state, message }),
});

export function* contractionSteps() {
    const trace = createDynamicGraphTrace(initial, { layout });
    yield describe(trace.start(), 'Start with four vertices and four edges.');
    yield describe(trace.mark({
        nodes: [{ id: 'A', role: 'active' }, { id: 'B', role: 'active' }],
        edges: [{ id: 'AB', role: 'active' }],
    }), 'Select AB. Keep A and absorb B.');

    const { nodes, edges } = trace.state.graph;
    const redirected = edges.filter(edge => edge.id !== 'AB' && (edge.from === 'B' || edge.to === 'B'));
    yield describe(trace.edit({
        nodes: nodes.filter(node => node.id !== 'B'),
        edges: edges.filter(edge => edge.id !== 'AB').map(edge => ({
            ...edge, from: edge.from === 'B' ? 'A' : edge.from, to: edge.to === 'B' ? 'A' : edge.to,
        })),
        marks: { edges: redirected.map(edge => ({ id: edge.id, role: 'queued' })) },
    }), 'Remove B and AB. Redirect BC and BD to A and keep their IDs.');

    yield describe(trace.done({
        result: { nodeIds: ['A'], edgeIds: redirected.map(edge => edge.id) },
    }), 'Result: three vertices and three edges. AC and BC now run in parallel.');
}

export function prepareContractionSession(mode) {
    if (mode === 'history') {
        return { ...timing, history: () => Object.freeze(Array.from(contractionSteps(), step => step.state)) };
    }
    if (mode === 'generator') {
        return { ...timing, stepSource: contractionSteps, isTerminal: step => step.event.type === 'done', rewindCapacity: 4 };
    }
    throw new RangeError('Choose a playback mode');
}
