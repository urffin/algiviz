import type { Step, Frame, Timeline } from "./types.js";

/** Step i is complete at i * stepDurationMs; the final state is held afterwards. */
export function createTimeline<S, E>(
    steps: readonly Step<S, E>[],
    options: { stepDurationMs: number; finalHoldMs: number }
): Timeline<S, E> {
    if (!steps.length) throw new RangeError("Timeline requires at least one step");
    const { stepDurationMs, finalHoldMs } = options;
    if (!Number.isFinite(stepDurationMs) || stepDurationMs <= 0 ||
        !Number.isFinite(finalHoldMs) || finalHoldMs < 0) {
        throw new RangeError("Expected positive step duration and non-negative final hold");
    }
    const history = steps.slice();
    const end = (history.length - 1) * stepDurationMs;
    const durationMs = end + finalHoldMs;
    if (!Number.isFinite(durationMs)) throw new RangeError("Timeline duration is too large");
    return Object.freeze({
        durationMs,
        sample(timeMs: number): Frame<S, E> {
            if (!Number.isFinite(timeMs)) throw new TypeError("Time must be finite");
            const time = Math.max(0, Math.min(timeMs, durationMs));
            const index = Math.min(history.length - 1, Math.ceil(time / stepDurationMs));
            const step = history[index]!;
            const previous = time >= end || index === 0 ? step : history[index - 1]!;
            const progress = previous === step ? 1 :
                Math.min(1, (time - (index - 1) * stepDurationMs) / stepDurationMs);
            return Object.freeze({ previous: previous.state, current: step.state,
                progress, stepIndex: index, event: step.event });
        }
    });
}

