import type { Step } from "./types.js";

/** Internal adapter shared by unbounded and widget-budgeted state playback. */
export function* stateSteps<S>(states: Iterable<S>): Generator<Step<S, undefined>> {
    const iterator = states[Symbol.iterator]();
    let index = 0, exhausted = false, failed = false;
    try {
        while (true) {
            const item = iterator.next();
            if (item.done) { exhausted = true; return; }
            yield { index: index++, state: item.value, event: undefined };
        }
    } catch (error) {
        failed = true;
        throw error;
    } finally {
        if (!exhausted) {
            if (failed) {
                try { iterator.return?.(); } catch { /* Preserve source failure. */ }
            } else iterator.return?.();
        }
    }
}
