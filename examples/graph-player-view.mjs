import { createGraphRenderer } from '@grundyjs/algiviz/canvas/graph';
import { mapFrame } from '@grundyjs/algiviz/playback';

export function createStockGraphView() {
    const renderer = createGraphRenderer({ theme: 'dark', roleColors: { tree: '#a78bfa', path: '#34d399' } });
    return {
        height: width => Math.max(280, Math.min(480, width * .6)),
        render(context, frame, size) {
            renderer.render(context, mapFrame(frame, state => state.visual), size);
        }
    };
}
