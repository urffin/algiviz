import { createGraphTrace } from '@grundyjs/algiviz/graph';

export const size = { width: 640, height: 400 };
export function graphFrames() {
    const graph = {
        nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C', label: '' }, { id: 'isolated', label: '<node>' }],
        edges: [
            { id: 'forward', from: 'A', to: 'B', directed: true, weight: -1 },
            { id: 'back', from: 'B', to: 'A', directed: true, weight: 0 },
            { id: 'parallel', from: 'A', to: 'B', label: '<edge>' },
            { id: 'loop', from: 'A', to: 'A', directed: true },
            { id: 'loop2', from: 'A', to: 'A' }
        ]
    };
    const layout = [{ nodeId: 'A', x: 0, y: 0 }, { nodeId: 'B', x: 2, y: 0 },
        { nodeId: 'C', x: 1, y: 1 }, { nodeId: 'isolated', x: 3, y: 1 }];
    const trace = createGraphTrace(graph, { layout }), start = trace.start();
    const marked = trace.mark({ nodes: [{ id: 'A', role: 'active' }, { id: 'B', role: 'queued' }],
        edges: [{ id: 'forward', role: 'visited' }] });
    const moved = trace.setLayout(layout.map(p => ({ ...p, x: p.nodeId === 'A' ? 2 : p.nodeId === 'B' ? 0 : p.x })));
    const done = trace.done({ result: { nodeIds: ['B'], edgeIds: ['forward'] } });
    const frame = (previous, current, progress = 1) => ({ previous: previous.state, current: current.state,
        progress, stepIndex: current.index, event: undefined });
    return { graph, layout, start, marked, moved, done, frame,
        endpoint: step => frame(step, step), motion: p => frame(marked, moved, p) };
}
