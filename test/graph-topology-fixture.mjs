import { createDynamicGraphTrace } from '@grundyjs/algiviz/graph';

export function* graphTopologySteps() {
    const trace = createDynamicGraphTrace({
        nodes: [{ id: 'A' }, { id: 'B' }],
        edges: [
            { id: 'e', from: 'A', to: 'B', directed: true, label: 'old target' },
            { id: 'exit', from: 'B', to: 'A' },
        ],
    }, { layout: [{ nodeId: 'A', x: 0, y: 1 }, { nodeId: 'B', x: 2, y: 0 }] });
    yield trace.start();
    yield trace.edit({
        nodes: [{ id: 'A' }, { id: 'C' }],
        edges: [
            { id: 'e', from: 'A', to: 'C', directed: true, label: 'new target' },
            { id: 'enter', from: 'C', to: 'A' },
        ],
        layout: [{ nodeId: 'A', x: .5, y: 1 }, { nodeId: 'C', x: 2, y: 2 }],
        marks: { edges: [{ id: 'e', role: 'queued' }] },
    });
    yield trace.done({ result: { nodeIds: ['C'], edgeIds: ['e'] } });
}
