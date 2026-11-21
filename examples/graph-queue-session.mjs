import { createListTrace } from '@grundyjs/algiviz/list';
import { graphSteps } from './graph-algorithm.mjs';
import { prepareGraphSession } from './graph-session.mjs';

function queueInput(queue) {
    return {
        headId: queue[0] ?? null,
        nodes: queue.map((id, index) => ({ id, value: id, nextId: queue[index + 1] ?? null })),
    };
}

export function* graphQueueSteps(graph, start, target, options, layout) {
    let trace;
    for (const step of graphSteps(graph, start, target, options)) {
        const { queue, event } = step.state;
        if (event.kind === 'start') {
            const list = queueInput(queue);
            trace = createListTrace(list, { layout: layout(list) });
            trace.start();
        } else if (event.kind === 'dequeue' || event.kind === 'discover') {
            const list = queueInput(queue);
            trace.edit({ ...list, layout: layout(list) });
        } else if (event.kind === 'finished') {
            trace.done();
        }

        yield Object.freeze({
            ...step,
            state: Object.freeze({ ...step.state, queueVisual: trace.state }),
        });
    }
}

export function prepareGraphQueueSession(graph, start, target, preset, mode, layout) {
    return prepareGraphSession(graph, start, target, preset, mode,
        (input, from, to, options) => graphQueueSteps(input, from, to, options, layout));
}
