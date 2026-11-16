import { createStepSession } from "./step-session.js";
import type { Frame, Step } from "../playback/types.js";
import type { PlayerControls, PlayerStatus } from "./types.js";
import { createRewindSession } from "./rewind-session.js";
import { createStreamPlayback } from "./stream-playback.js";
import { stateSteps } from "../playback/state-steps.js";
import type { AsyncSourceFactory } from "../playback/async-source.js";
import { createAsyncController } from "./async-controller.js";
import { createCloseReport } from "./close-report.js";
interface Session<State, Event = undefined> {
    readonly frame: Frame<State, Event>;
    readonly finished: boolean;
    readonly positionMs?: number;
    readonly durationMs?: number;
    readonly canPrevious?: boolean | undefined;
    readonly rewindStartIndex?: number | undefined;
    readonly rewindEndIndex?: number | undefined;
    readonly pendingMs?: number | undefined;
    advance(deltaMs: number): void;
    nextStep(): void;
    previousStep?(): void;
    seek?(positionMs: number): void;
    dispose(): void;
}
export interface StateController<State, Event = undefined> extends PlayerControls<State, Event> {
    setReducedMotion(value: boolean): PlayerStatus;
    replay(): PlayerStatus;
    readonly dataBlocked: boolean;
    finishDispose(): void;
    recordError(phase: "abort-listener" | "return" | "dispose" | "onStatus" | "onError", error: unknown): void;
}
export interface ControllerOptions<State, Event = undefined> {
    stepSource?: (() => Iterable<Step<State, Event>>) | undefined;
    isTerminal?: ((step: Step<State, Event>) => boolean) | undefined;
    source?: (() => Iterable<State>) | undefined;
    asyncSource?: AsyncSourceFactory<State> | undefined;
    deferClose?: boolean | undefined;
    history?: (() => readonly State[]) | undefined;
    render: (frame: Frame<State, Event>) => void;
    stepDurationMs?: number | undefined;
    finalHoldMs?: number | undefined;
    rewindCapacity?: number | undefined;
    maxStepsPerFrame?: number | undefined;
    scheduler?: { request(callback: (now: number) => void): number; cancel(id: number): void } | undefined;
    onChange?: ((status: PlayerStatus) => void) | undefined;
    onStatus?: ((status: PlayerStatus) => void) | undefined;
    onError?: ((error: unknown) => void) | undefined;
}
import { createStatePlayer, createTimeline } from '../playback/index.js';

function createRecording<State, Event>(states: readonly State[], stepDurationMs: number, finalHoldMs: number): Session<State, Event> {
    if (!Array.isArray(states)) throw new TypeError('Recording factory must return an array of states');
    const steps = Array.from({ length: states.length }, (_, index) => {
        if (!(index in states)) throw new TypeError('Recording states must not be sparse');
        return { index, state: states[index], event: undefined };
    });
    const timeline = createTimeline(steps, { stepDurationMs, finalHoldMs });
    const end = (states.length - 1) * stepDurationMs;
    let time = 0;
    function seek(value: number) {
        if (!Number.isFinite(value)) throw new TypeError('Position must be finite');
        time = Math.max(0, Math.min(value, timeline.durationMs));
    }
    return Object.freeze({
        // Public state-only options require Event to include undefined.
        get frame() { return timeline.sample(time) as Frame<State, Event>; },
        get finished() { return time >= timeline.durationMs; },
        get positionMs() { return time; },
        durationMs: timeline.durationMs,
        advance(delta: number) {
            if (!Number.isFinite(delta) || delta < 0) throw new RangeError('Playback time must be finite and non-negative');
            seek(Math.min(timeline.durationMs, time + delta));
        },
        nextStep() { seek(time >= end ? timeline.durationMs : Math.min(end, (Math.floor(time / stepDurationMs) + 1) * stepDurationMs)); },
        previousStep() { seek(Math.min(end, (Math.ceil(time / stepDurationMs) - 1) * stepDurationMs)); },
        seek,
        dispose() {}, // No iterator is owned by an already materialized recording.
    });
}

// Internal session/scheduling logic, independent of the DOM and render backend.
class PreparationFailure {
    constructor(readonly error: unknown) {}
}

export function createStateController<State, Event>(options: ControllerOptions<State, Event>): StateController<State, Event> {
    const { source, asyncSource, history, stepSource, isTerminal, render, stepDurationMs, finalHoldMs = 0, rewindCapacity, maxStepsPerFrame,
        scheduler, onChange = () => {}, onStatus = () => {}, onError = () => {} } = options;
    const recorded = history !== undefined;
    if ([source, asyncSource, history, stepSource].filter(value => value !== undefined).length !== 1 ||
        typeof (recorded ? history : stepSource ?? asyncSource ?? source) !== 'function' || typeof render !== 'function')
        throw new TypeError('Expected exactly one source/asyncSource/history/stepSource factory and a render callback');
    if (stepSource !== undefined ? typeof isTerminal !== 'function' : isTerminal !== undefined)
        throw new TypeError('isTerminal is required only with stepSource');
    const timed = stepDurationMs !== undefined;
    if (recorded && !timed) throw new TypeError('A recording requires stepDurationMs');
    if (recorded && rewindCapacity !== undefined) throw new TypeError('rewindCapacity is only available for a stream');
    if (rewindCapacity !== undefined && (!Number.isSafeInteger(rewindCapacity) || rewindCapacity < 1))
        throw new RangeError('rewindCapacity must be a positive safe integer');
    if (recorded && maxStepsPerFrame !== undefined) throw new TypeError('maxStepsPerFrame is only available for a stream');
    if (maxStepsPerFrame !== undefined && (!Number.isSafeInteger(maxStepsPerFrame) || maxStepsPerFrame < 1))
        throw new RangeError('maxStepsPerFrame must be a positive safe integer');
    if ((timed && (!Number.isFinite(stepDurationMs) || stepDurationMs <= 0)) ||
        !Number.isFinite(finalHoldMs) || finalHoldMs < 0)
        throw new RangeError('Expected positive step duration and non-negative final hold');
    if (timed && (!scheduler || typeof scheduler.request !== 'function' || typeof scheduler.cancel !== 'function'))
        throw new TypeError('Timed playback requires a frame scheduler');

    if (asyncSource !== undefined) return createAsyncController(options);
    const diagnostics = createCloseReport();

    let player: Session<State, Event> | null = null;
    let frame: Frame<State, Event> | null = null;
    let started = false, running = false, disposed = false;
    let failed = false, hasError = false, busy = false, notifying = false, speed = 1;
    let error: unknown = null;
    let request: number | null = null, last: number | null = null;
    let reducedMotion = false;
    let pendingMs = 0;
    function status(): PlayerStatus {
        const finished = !failed && !!player?.finished;
        return Object.freeze({
            phase: disposed ? 'disposed' : failed ? 'error' : finished ? 'finished' : running ? 'playing' : started ? 'paused' : 'idle',
            waiting: false, preparing: null, cleanupPending: false, canPause: !disposed && running,
            started, timed, speed, error, hasError, stepIndex: frame?.stepIndex ?? null, progress: frame?.progress ?? null,
            mode: recorded ? 'recording' : 'stream', positionMs: player?.positionMs ?? null, durationMs: player?.durationMs ?? null,
            canStart: !disposed && !started && !busy,
            canPlay: !disposed && started && !failed && !finished && timed && !busy,
            canNext: !disposed && started && !failed && !finished && !busy,
            canRestart: !disposed && started && !busy,
            canSeek: recorded && !disposed && !failed && !!player && (player.durationMs ?? 0) > 0 && !busy,
            canPrevious: !disposed && !failed && !!player && !busy &&
                (recorded ? (player.positionMs ?? 0) > 0 : !!player.canPrevious),
            rewindStartIndex: player?.rewindStartIndex ?? null, rewindEndIndex: player?.rewindEndIndex ?? null,
        });
    }
    function stop() {
        running = false; last = null; pendingMs = 0;
        if (request !== null) scheduler!.cancel(request);
        request = null;
    }
    function present() {
        frame = player!.frame;
        render(reducedMotion ? { ...frame, previous: frame.current, progress: 1 } : frame);
    }
    function closeQuietly(candidate: Session<State, Event> | null) {
        try { candidate?.dispose(); } catch (caught) { diagnostics.record('dispose', caught); }
    }
    function fail(caught: unknown, preserve = false) {
        stop(); error = caught; hasError = true;
        if (!preserve) {
            if (player) frame = player.frame;
            closeQuietly(player); player = null; failed = true;
        }
    }
    function publish() {
        notifying = true;
        try { const state = status(); onChange(state); onStatus(state); }
        finally { notifying = false; }
    }
    function act(action: () => void, clearError = true): PlayerStatus {
        if (disposed) throw new Error('Player controls have been disposed');
        if (busy || notifying) throw new Error('Playback cannot be changed from a render/status callback');
        busy = true;
        if (clearError) { error = null; hasError = false; }
        let failure: unknown; let hasFailure = false;
        try { action(); }
        catch (caught) {
            const preserved = caught instanceof PreparationFailure;
            fail(preserved ? caught.error : caught, preserved);
            failure = error; hasFailure = true;
        } finally { busy = false; }
        try { publish(); }
        catch (caught) {
            diagnostics.record('onStatus', caught);
            if (!hasFailure) { fail(caught); failure = caught; hasFailure = true; }
            onChange(status());
        }
        if (hasFailure) {
            try { onError(failure); } catch (caught) { diagnostics.record('onError', caught); throw caught; }
        }
        return status();
    }
    function widenStateSession(session: Session<State>): Session<State, Event> {
        // PlayerOptions permits state-only branches only when Event includes undefined.
        return { get frame() { return session.frame as Frame<State, Event>; },
            get finished() { return session.finished; }, get pendingMs() { return session.pendingMs; },
            get canPrevious() { return session.canPrevious; },
            get rewindStartIndex() { return session.rewindStartIndex; },
            get rewindEndIndex() { return session.rewindEndIndex; },
            advance: delta => session.advance(delta), nextStep: () => session.nextStep(),
            previousStep: () => session.previousStep?.(), dispose: () => session.dispose() };
    }
    function replace() {
        let candidate: Session<State, Event>;
        // A rejected source must not destroy the previous readable/usable session.
        try {
            candidate = stepSource !== undefined ? createStepSession(stepSource(), isTerminal!, { stepDurationMs, finalHoldMs }, rewindCapacity, maxStepsPerFrame)
                : recorded ? createRecording<State, Event>(history!(), stepDurationMs!, finalHoldMs)
                : widenStateSession(rewindCapacity !== undefined ? createRewindSession(source!(), rewindCapacity, { stepDurationMs, finalHoldMs }, maxStepsPerFrame)
                : maxStepsPerFrame === undefined ? createStatePlayer(source!(), { stepDurationMs, finalHoldMs })
                : createStreamPlayback(stateSteps(source!()), { stepDurationMs, finalHoldMs }, maxStepsPerFrame));
        }
        catch (caught) { throw new PreparationFailure(caught); }
        try { player?.dispose(); }
        catch (caught) { diagnostics.record('dispose', caught); closeQuietly(candidate); player = null; failed = true; throw caught; }
        player = candidate; started = true; failed = false;
        present();
    }
    function requireSession(): Session<State, Event> {
        if (!player || failed) throw new Error('Start or restart playback first');
        return player;
    }
    function tick(now: number) {
        request = null;
        if (!running || disposed) return;
        act(() => {
            // Deliberately discard long wall-clock stalls, as the shared demo does.
            const delta = last === null ? 0 : Math.min(100, Math.max(0, now - last)) * speed;
            last = now; const session = requireSession();
            session.advance(pendingMs + delta);
            pendingMs = session.pendingMs ?? 0;
            present();
            if (session.finished) stop();
            if (running) request = scheduler!.request(tick);
        });
    }
    const controls: StateController<State, Event> = Object.freeze({
        get status() { return status(); },
        get frame() { return frame; },
        closed: diagnostics.closed,
        dataBlocked: false,
        recordError: diagnostics.record,
        finishDispose() { if (disposed) diagnostics.finish(); },
        replay() { const snapshot = controls.restart(); return snapshot.phase === 'paused' ? controls.play() : snapshot; },
        start() { return act(() => { if (!started) replace(); }); },
        play() {
            if (!timed) throw new Error('Set stepDurationMs to enable Play');
            return act(() => {
                const session = requireSession();
                if (session.finished || running) return;
                running = true; last = null; request = scheduler!.request(tick);
            });
        },
        pause() { return act(stop, false); },
        next() { return act(() => { const session = requireSession(); stop(); session.nextStep(); present(); }); },
        previous() {
            if (!recorded && rewindCapacity === undefined) throw new Error('Previous is unavailable for a stream without rewindCapacity');
            return act(() => { const session = requireSession(); stop(); session.previousStep!(); present(); });
        },
        seek(positionMs: number) {
            if (!recorded) throw new Error('Seeking is unavailable for a stream');
            if (!Number.isFinite(positionMs)) throw new TypeError('Position must be finite');
            return act(() => { const session = requireSession(); stop(); session.seek!(positionMs); present(); });
        },
        restart() { return act(() => { stop(); replace(); }); },
        setSpeed(value: number) {
            if (!Number.isFinite(value) || value <= 0) throw new RangeError('Speed must be positive');
            return act(() => { speed = value; last = null; }, false);
        },
        setReducedMotion(value: boolean) {
            return act(() => { reducedMotion = !!value; if (player && !failed) present(); }, false);
        },
        dispose() {
            if (disposed) return;
            if (busy || notifying) throw new Error('Playback cannot be disposed from a render/status callback');
            stop(); disposed = true;
            let failure: unknown; let hasFailure = false;
            try { player?.dispose(); } catch (caught) { diagnostics.record('dispose', caught); failure = caught; error = caught; hasError = true; hasFailure = true; }
            player = null;
            try {
                try { publish(); } catch (caught) {
                    diagnostics.record('onStatus', caught);
                    if (!hasFailure) { failure = caught; error = caught; hasError = true; hasFailure = true; }
                }
                if (hasFailure) {
                    try { onError(failure); } catch (caught) { diagnostics.record('onError', caught); throw caught; }
                    throw failure;
                }
            } finally { if (!options.deferClose) diagnostics.finish(); }
        },
    });
    return controls;
}
