import type { Step } from "./types.js";
import type { Frame } from "./types.js";

export interface Player<S, E> {
    readonly frame: Frame<S, E>;
    readonly finished: boolean;
    /** Advance by playback time; pass zero to redraw without consuming steps. */
    advance(deltaMs: number): Frame<S, E>;
    /** Close the source early. The last frame remains readable. */
    dispose(): void;
}

/** Forward-only playback. The source must reach a step accepted by isTerminal. */
export function createPlayer<S, E>(
    steps: Iterable<Step<S, E>>,
    options: {
        stepDurationMs: number;
        finalHoldMs: number;
        isTerminal: (step: Step<S, E>) => boolean;
        /** Called initially and on each advance, including advance(0). */
        render?: (frame: Frame<S, E>) => void;
    }
): Player<S, E> {
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
    let current: Step<S, E>;
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
        if (options.isTerminal(current) && elapsed === stepDurationMs) {
            previous = current;
            close();
            finished = hold >= finalHoldMs;
        }
    };
    const frame = (): Frame<S, E> => Object.freeze({
        previous: previous.state, current: current.state,
        progress: elapsed / stepDurationMs,
        stepIndex: current.index, event: current.event
    });
    try {
        complete();
        options.render?.(frame());
    } catch (error) {
        close();
        throw error;
    }
    return Object.freeze({
        get frame() { return frame(); },
        get finished() { return finished; },
        advance(deltaMs: number): Frame<S, E> {
            if (disposed) throw new Error("Player has been disposed");
            if (!Number.isFinite(deltaMs) || deltaMs < 0) {
                throw new RangeError("Expected finite non-negative playback time");
            }
            try {
                let remaining = deltaMs;
                while (remaining > 0 && !finished) {
                    if (elapsed === stepDurationMs) {
                        if (options.isTerminal(current)) {
                            hold += Math.min(remaining, finalHoldMs - hold);
                            complete();
                            break;
                        }
                        const next = iterator.next();
                        if (next.done) throw new RangeError("Step source ended without a terminal step");
                        previous = current;
                        current = next.value;
                        elapsed = 0;
                    }
                    const amount = Math.min(remaining, stepDurationMs - elapsed);
                    elapsed += amount;
                    remaining -= amount;
                    complete();
                }
                const result = frame();
                options.render?.(result);
                return result;
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

