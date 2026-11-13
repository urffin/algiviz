import { createPlayback, type AdvanceBudget } from "../playback/player.js";
import type { Step } from "../playback/types.js";

/** Internal stream engine; normal headless players never receive this budget. */
export function createStreamPlayback<State>(steps: Iterable<Step<State, undefined>>,
    timing: { stepDurationMs: number | undefined; finalHoldMs: number },
    maxStepsPerFrame: number | undefined, isTerminal: () => boolean = () => false) {
    const budget: AdvanceBudget | undefined = maxStepsPerFrame === undefined ? undefined
        : { remainingReads: 0, remainingMs: 0 };
    const player = createPlayback(steps, { ...timing, isTerminal }, true, budget);
    return Object.freeze({
        get frame() { return player.frame; },
        get finished() { return player.finished; },
        get pendingMs() { return budget?.remainingMs ?? 0; },
        advance(deltaMs: number) {
            if (budget) budget.remainingReads = maxStepsPerFrame!;
            player.advance(deltaMs);
        },
        nextStep() { player.nextStep(); },
        dispose() { player.dispose(); },
    });
}
