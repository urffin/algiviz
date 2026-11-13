import { createAsyncSource, type AsyncSourceFactory, type AsyncSourceReadResult } from "../playback/async-source.js";
import type { Frame } from "../playback/types.js";

/** A clock/window over available states. Only pull() enters the async source. */
export function createAsyncSession<State>(factory: AsyncSourceFactory<State>, options: {
    stepDurationMs?: number | undefined; finalHoldMs: number;
    rewindCapacity?: number | undefined; maxStepsPerFrame?: number | undefined;
}, changed: () => void) {
    const source = createAsyncSource(factory);
    const values = new Map<number, State>();
    let position = 0, start = 0, end = 0;
    let frame: Frame<State, undefined> | null = null;
    let ready: AsyncSourceReadResult<State> | undefined;
    let failure: { error: unknown } | undefined;
    let waiting = false, ended = false, disposed = false, finished = false;
    let hold = 0, pendingMs = 0;
    const duration = options.stepDurationMs ?? 1;

    function pull() {
        if (waiting || ready || failure || ended || disposed) return;
        waiting = true;
        source.next().then(result => {
            waiting = false;
            if (!disposed) { ready = result; changed(); }
        }, error => {
            waiting = false;
            if (!disposed) { failure = { error }; changed(); }
        });
    }
    function terminal() { return ended && position === end; }
    function complete() {
        if (terminal() && frame?.progress === 1) {
            frame = Object.freeze({ ...frame, previous: frame.current });
            finished = hold >= options.finalHoldMs;
        }
    }
    function select(value: State, progress: number) {
        frame = Object.freeze({ previous: frame ? frame.current : value, current: value, progress,
            stepIndex: position, event: undefined });
        complete();
    }
    function consume(progress: number): boolean {
        if (position < end) { position++; select(values.get(position)!, progress); return true; }
        if (!ready) { pull(); return false; }
        const item = ready; ready = undefined;
        if (item.kind === "done") { ended = true; complete(); return true; }
        if (item.kind === "cancelled") return false;
        if (end === Number.MAX_SAFE_INTEGER) throw new RangeError("Async stream position is too large");
        position = ++end;
        values.set(position, item.value);
        const capacity = options.rewindCapacity ?? 1;
        if (values.size > capacity) values.delete(start++);
        select(item.value, progress);
        return true;
    }
    function blocked() {
        return !!frame && frame.progress === 1 && !terminal() && position === end && !ready;
    }
    return {
        source,
        get frame() { return frame; },
        get finished() { return finished; },
        get waiting() { return waiting; },
        get failure() { return failure; },
        get hasReady() { return ready !== undefined; },
        get blocked() { return blocked(); },
        get pendingMs() { return pendingMs; },
        get canPrevious() { return options.rewindCapacity !== undefined && position > start; },
        get rewindStartIndex() { return frame && options.rewindCapacity !== undefined ? start : null; },
        get rewindEndIndex() { return frame && options.rewindCapacity !== undefined ? end : null; },
        pull,
        initialize() {
            if (ready?.kind !== "value") throw new Error("Async first state is not ready");
            const value = ready.value; ready = undefined;
            values.set(0, value); select(value, 1);
        },
        requestIfBlocked() { if (blocked()) pull(); },
        nextStep() {
            pendingMs = 0;
            if (!frame || finished) return true;
            if (frame.progress < 1) { frame = Object.freeze({ ...frame, progress: 1 }); complete(); return true; }
            if (terminal()) { hold = options.finalHoldMs; complete(); return true; }
            return consume(1);
        },
        previous() {
            pendingMs = 0;
            if (options.rewindCapacity === undefined || position <= start) return;
            position--; hold = 0; finished = false;
            const value = values.get(position)!;
            frame = Object.freeze({ previous: value, current: value, progress: 1, stepIndex: position, event: undefined });
        },
        advance(delta: number, resumeReady: boolean) {
            if (!Number.isFinite(delta) || delta < 0) throw new RangeError("Playback time must be finite and non-negative");
            pendingMs = 0;
            if (!frame || finished) return;
            let remaining = delta, reads = options.maxStepsPerFrame ?? Infinity;
            if (resumeReady && frame.progress === 1 && position === end && ready) consume(0);
            while (remaining > 0 && !finished) {
                if (frame.progress === 1) {
                    if (terminal()) {
                        const amount = Math.min(remaining, options.finalHoldMs - hold);
                        hold += amount; remaining -= amount; complete(); break;
                    }
                    const alreadyRequested = position === end && ready !== undefined;
                    if (!alreadyRequested && reads === 0) break;
                    if (!alreadyRequested) reads--;
                    if (!consume(0)) { remaining = 0; break; }
                    if (terminal() && frame.progress === 1) continue;
                }
                const elapsed: number = frame.progress * duration;
                const needed = duration - elapsed;
                const amount = Math.min(remaining, needed);
                frame = Object.freeze({ ...frame, progress: amount === needed ? 1 : (elapsed + amount) / duration });
                remaining -= amount; complete();
            }
            pendingMs = finished || blocked() && waiting ? 0 : remaining;
        },
        dispose(reason: unknown) {
            if (disposed) return;
            disposed = true; waiting = false; ready = undefined; values.clear();
            source.dispose(reason);
        },
    };
}

export type AsyncSession<State> = ReturnType<typeof createAsyncSession<State>>;
