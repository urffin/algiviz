import { createPlayback, type AdvanceBudget } from "../playback/player.js";
import { createRewindBuffer } from "../playback/rewind-buffer.js";
import type { Step } from "../playback/types.js";

const objectLike = (value: unknown): value is object =>
    value !== null && (typeof value === 'object' || typeof value === 'function');

/** Owns the physical iterator separately from replaceable buffered playback. */
export function createStepSession<State, Event>(source: Iterable<Step<State, Event>>,
    isTerminal: (step: Step<State, Event>) => boolean,
    timing: { stepDurationMs: number | undefined; finalHoldMs: number },
    capacity: number | undefined, maxStepsPerFrame: number | undefined) {
    const iterator = source[Symbol.iterator]();
    if (!objectLike(iterator)) throw new TypeError('Expected a source iterator');
    let closed = false, retiring = false;
    const close = () => {
        if (closed) return;
        closed = true;
        iterator.return?.();
    };
    const admitted: Iterable<{ step: Step<State, Event>; terminal: boolean }> = {
        *[Symbol.iterator]() {
            while (true) {
                const result = iterator.next();
                if (!objectLike(result)) throw new TypeError('Expected an iterator result');
                if (result.done) throw new RangeError('Step source ended without a terminal step');
                const value = result.value;
                if (!objectLike(value)) throw new TypeError('Expected a step');
                const index = value.index;
                if (typeof index !== 'number') throw new TypeError('Step index must be a number');
                if (!Number.isFinite(index)) throw new RangeError('Step index must be finite');
                const step = Object.freeze({ index, state: value.state, event: value.event });
                const terminal = isTerminal(step);
                if (typeof terminal !== 'boolean') throw new TypeError('isTerminal must return a boolean');
                yield { step, terminal };
                if (terminal) return;
            }
        },
    };
    let buffer: ReturnType<typeof createRewindBuffer<{ step: Step<State, Event>; terminal: boolean }>>;
    try { buffer = createRewindBuffer(admitted, { capacity: capacity ?? 1 }); }
    catch (error) { try { close(); } catch { /* Preserve preparation failure. */ } throw error; }
    const budget: AdvanceBudget | undefined = maxStepsPerFrame === undefined ? undefined
        : { remainingReads: 0, remainingMs: 0 };
    function create() {
        function* replay() {
            yield buffer.current.step;
            while (!buffer.current.terminal) yield buffer.next().step;
        }
        const replayIterator = replay();
        return createPlayback({ [Symbol.iterator]: () => ({
            next: () => replayIterator.next(),
            return() {
                replayIterator.return(undefined);
                // Completing a terminal endpoint closes before its final hold.
                // Retiring a replay cursor for Previous keeps the source alive.
                if (!retiring) close();
                return { done: true, value: undefined };
            },
        }) }, { ...timing, isTerminal: () => buffer.current.terminal }, false, budget);
    }
    let player: ReturnType<typeof create>;
    try { player = create(); }
    catch (error) { try { buffer.dispose(); } finally { try { close(); } catch { /* Primary wins. */ } } throw error; }
    return Object.freeze({
        get frame() { return player.frame; },
        get finished() { return player.finished; },
        get pendingMs() { return budget?.remainingMs ?? 0; },
        get canPrevious() { return capacity !== undefined && buffer.canPrevious; },
        get rewindStartIndex() { return capacity === undefined ? undefined : buffer.startPosition; },
        get rewindEndIndex() { return capacity === undefined ? undefined : buffer.endPosition; },
        advance(deltaMs: number) {
            if (budget) budget.remainingReads = maxStepsPerFrame!;
            player.advance(deltaMs);
        },
        nextStep() { player.nextStep(); },
        previousStep() {
            if (!buffer.canPrevious) return;
            retiring = true;
            try { player.dispose(); } finally { retiring = false; }
            buffer.previous();
            if (budget) budget.remainingMs = 0;
            player = create();
        },
        dispose() {
            retiring = true;
            try { player.dispose(); }
            finally { try { buffer.dispose(); } finally { close(); } }
        },
    });
}
