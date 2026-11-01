import { createPlayback, type Player } from './player.js';
import type { Frame, Step } from './types.js';

/** Lazy state playback. Exhaustion is detected on the request after the last state.
 * States must be immutable snapshots. Generator return values are ignored. */
export function createStatePlayer<S>(states: Iterable<S>, options: {
    stepDurationMs?: number | undefined;
    finalHoldMs?: number | undefined;
    render?: (frame: Frame<S, undefined>) => void;
} = {}): Player<S, undefined> {
    function* steps(): Generator<Step<S, undefined>> {
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
    return createPlayback(steps(), { ...options, isTerminal: () => false }, true);
}
