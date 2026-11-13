import { createStreamPlayback } from "./stream-playback.js";
import { createRewindBuffer } from "../playback/rewind-buffer.js";
import type { Step } from "../playback/types.js";

/** Owns the source buffer; replaceable forward players own only replay iterators. */
export function createRewindSession<State>(source: Iterable<State>, capacity: number,
    timing: { stepDurationMs: number | undefined; finalHoldMs: number }, maxStepsPerFrame?: number) {
    const buffer = createRewindBuffer(source, { capacity });
    function* steps(): Generator<Step<State, undefined>> {
        yield { state: buffer.current, index: buffer.position, event: undefined };
        while (buffer.canNext) {
            const before = buffer.position;
            const state = buffer.next();
            if (before === buffer.position) return; // Exhaustion probe, not a new step.
            yield { state, index: buffer.position, event: undefined };
        }
    }
    // After rewinding an exhausted source, the final buffered value is known.
    const create = () => createStreamPlayback(steps(), timing, maxStepsPerFrame,
        () => buffer.sourceEnded && buffer.position === buffer.endPosition);
    let player: ReturnType<typeof create>;
    try { player = create(); }
    catch (error) { try { buffer.dispose(); } catch { /* Preserve preparation failure. */ } throw error; }
    return Object.freeze({
        get frame() { return player.frame; },
        get finished() { return player.finished; },
        get pendingMs() { return player.pendingMs; },
        get canPrevious() { return buffer.canPrevious; },
        get rewindStartIndex() { return buffer.startPosition; },
        get rewindEndIndex() { return buffer.endPosition; },
        advance(deltaMs: number) { player.advance(deltaMs); },
        nextStep() { player.nextStep(); },
        previousStep() {
            if (!buffer.canPrevious) return;
            player.dispose();
            buffer.previous();
            player = create();
        },
        dispose() {
            try { player.dispose(); }
            finally { buffer.dispose(); }
        },
    });
}
