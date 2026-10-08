import type { SortStep } from "./types.js";
import type { SortFrame } from "./timeline.js";

export interface SortPlayer {
    readonly frame: SortFrame;
    readonly finished: boolean;
    /** Advance by playback time; pass zero to redraw without consuming steps. */
    advance(deltaMs: number): SortFrame;
    /** Close the source early. The last frame remains readable. */
    dispose(): void;
}

/** Forward-only playback. The source must end with a `done` event. */
export function createSortPlayer(
    steps: Iterable<SortStep>,
    options: { stepDurationMs: number; finalHoldMs: number }
): SortPlayer {
    const { stepDurationMs, finalHoldMs } = options;
    if (!Number.isFinite(stepDurationMs) || stepDurationMs <= 0 ||
        !Number.isFinite(finalHoldMs) || finalHoldMs < 0) {
        throw new RangeError("Expected positive step duration and non-negative final hold");
    }
    const iterator = steps[Symbol.iterator]();
    let closed = false;
    const close = () => {
        if (!closed) {
            closed = true;
            iterator.return?.();
        }
    };
    let current: SortStep;
    try {
        const first = iterator.next();
        if (first.done) throw new RangeError("Player requires at least one step");
        current = first.value;
    } catch (error) {
        close();
        throw error;
    }
    let previous = current;
    let elapsed = stepDurationMs;
    let hold = 0;
    let disposed = false;
    let finished = false;
    const complete = () => {
        if (current.event.type === "done" && elapsed === stepDurationMs) {
            previous = current;
            close();
            finished = hold >= finalHoldMs;
        }
    };
    complete();
    const frame = (): SortFrame => Object.freeze({
        previous: previous.state, current: current.state,
        progress: elapsed / stepDurationMs,
        stepIndex: current.index, event: current.event
    });
    return Object.freeze({
        get frame() { return frame(); },
        get finished() { return finished; },
        advance(deltaMs: number): SortFrame {
            if (disposed) throw new Error("Player has been disposed");
            if (!Number.isFinite(deltaMs) || deltaMs < 0) {
                throw new RangeError("Expected finite non-negative playback time");
            }
            try {
                let remaining = deltaMs;
                while (remaining > 0 && !finished) {
                    if (elapsed === stepDurationMs) {
                        if (current.event.type === "done") {
                            hold += Math.min(remaining, finalHoldMs - hold);
                            complete();
                            break;
                        }
                        const next = iterator.next();
                        if (next.done) throw new RangeError("Step source ended without a done event");
                        previous = current;
                        current = next.value;
                        elapsed = 0;
                    }
                    const amount = Math.min(remaining, stepDurationMs - elapsed);
                    elapsed += amount;
                    remaining -= amount;
                    complete();
                }
                return frame();
            } catch (error) {
                disposed = true;
                close();
                throw error;
            }
        },
        dispose() {
            disposed = true;
            close();
        }
    });
}
