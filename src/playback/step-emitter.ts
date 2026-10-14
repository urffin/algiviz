import type { Step } from "./types.js";

/**
 * Capture state in a frozen, consecutively indexed step. Use one emitter per iterator.
 * The callback owns snapshot isolation; state and event are not cloned or frozen.
 */
export function createStepEmitter<State>(snapshot: () => State) {
    let index = 0;
    return <Event>(event: Event): Step<State, Event> => {
        const state = snapshot();
        const step = Object.freeze({ index, state, event });
        index++;
        return step;
    };
}
