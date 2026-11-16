import type { Step } from "./types.js";

/** Internal adapter shared by unbounded and widget-budgeted state playback. */
export function stateSteps<S>(states: Iterable<S>): IterableIterator<Step<S, undefined>> {
    let iterator: Iterator<S> | undefined;
    let index = 0, exhausted = false, closed = false;
    return {
        [Symbol.iterator]() { return this; },
        next(): IteratorResult<Step<S, undefined>> {
            if (closed || exhausted) return { done: true, value: undefined };
            if (!iterator) {
                const source = states;
                states = undefined!;
                iterator = source[Symbol.iterator]();
            }
            const item = iterator.next();
            if (item.done) { exhausted = true; iterator = undefined; return { done: true, value: undefined }; }
            return { done: false, value: { index: index++, state: item.value, event: undefined } };
        },
        return(): IteratorResult<Step<S, undefined>> {
            if (!closed) {
                closed = true;
                states = undefined!;
                const owned = iterator; iterator = undefined;
                // Let the owning engine latch disposal before entering source
                // cleanup, including after a failed next/result getter.
                if (!exhausted) owned?.return?.();
            }
            return { done: true, value: undefined };
        },
    };
}
