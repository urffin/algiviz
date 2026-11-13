import { createPlayback, type Player } from './player.js';
import type { Frame } from './types.js';
import { stateSteps } from './state-steps.js';

/** Lazy state playback. Exhaustion is detected on the request after the last state.
 * States must be immutable snapshots. Generator return values are ignored. */
export function createStatePlayer<S>(states: Iterable<S>, options: {
    stepDurationMs?: number | undefined;
    finalHoldMs?: number | undefined;
    render?: (frame: Frame<S, undefined>) => void;
} = {}): Player<S, undefined> {
    return createPlayback(stateSteps(states), { ...options, isTerminal: () => false }, true);
}
