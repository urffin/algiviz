import { createGraphRenderer } from '@grundyjs/algiviz/canvas/graph';

export function createStockGraphView() {
    const renderer = createGraphRenderer({ theme: 'dark', roleColors: { tree: '#a78bfa', path: '#34d399' } });
    return {
        height: width => Math.max(280, Math.min(480, width * .6)),
        render(context, frame, size) {
            renderer.render(context, { ...frame, previous: frame.previous.visual, current: frame.current.visual }, size);
        }
    };
}
