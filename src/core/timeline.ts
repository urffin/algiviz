import type { SortEvent, SortSnapshot, SortStep } from "./types.js";

export interface SortFrame {
    readonly previous: SortSnapshot;
    readonly current: SortSnapshot;
    readonly progress: number;
    readonly stepIndex: number;
    readonly event: SortEvent;
}

export interface SortTimeline {
    readonly durationMs: number;
    sample(timeMs: number): SortFrame;
}

/** Step i is complete at i * stepDurationMs; the final state is held afterwards. */
export function createSortTimeline(
    steps: readonly SortStep[],
    options: { stepDurationMs: number; finalHoldMs: number }
): SortTimeline {
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
        sample(timeMs: number): SortFrame {
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
