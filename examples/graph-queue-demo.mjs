import { createListRenderer } from '@grundyjs/algiviz/canvas/list';
import { mountGraphDemo } from './graph-page.mjs';
import { createStockGraphView } from './graph-player-view.mjs';
import { prepareGraphQueueSession } from './graph-queue-session.mjs';

const queue = createListRenderer({ theme: 'dark', presentNode: ({ node }) => ({ label: node.value }) });
const queueDrawing = {
    height: width => Math.max(130, Math.min(175, width * 0.26)),
    render(context, frame, size) {
        queue.render(context, { ...frame, previous: frame.previous.queueVisual, current: frame.current.queueVisual }, size);
    },
};

mountGraphDemo(
    () => [createStockGraphView(), queueDrawing],
    (graph, start, target, preset, mode) => prepareGraphQueueSession(graph, start, target, preset, mode, queue.layout),
);
