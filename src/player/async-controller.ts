import type { Frame } from "../playback/types.js";
import type { AsyncSourceFactory, AsyncSourceCloseResult } from "../playback/async-source.js";
import type { ControllerOptions, StateController } from "./controller.js";
import type { PlayerStatus } from "./types.js";
import { createAsyncSession, type AsyncSession } from "./async-session.js";
import { createCloseReport } from "./close-report.js";

interface Owned<State> {
    session: AsyncSession<State>;
    closing: boolean;
    report: AsyncSourceCloseResult | undefined;
    failureReported: boolean;
}

/** Async-specific intents and preparation; synchronous engines keep their controller. */
export function createAsyncController<State>(options: ControllerOptions<State>): StateController<State> {
    const { render, scheduler, stepDurationMs, finalHoldMs = 0, rewindCapacity, maxStepsPerFrame,
        onChange = () => {}, onStatus = () => {}, onError = () => {} } = options;
    const diagnostics = createCloseReport();
    const owned = new Set<Owned<State>>();
    let current: Owned<State> | null = null, candidate: Owned<State> | null = null;
    let frame: Frame<State, undefined> | null = null;
    let preparing: "start" | "restart" | null = null;
    let preparationFailure: { error: unknown } | null = null;
    let started = false, disposed = false, failed = false, running = false, manual = false, replay = false;
    let busy = false, notifying = false, reduced = false, hasError = false;
    let error: unknown = null, speed = 1, pendingMs = 0;
    let request: number | null = null, last: number | null = null;
    let disposalSnapshot: Owned<State>[] = [], uiFinished = false;
    const failures: unknown[] = [];
    const timed = stepDurationMs !== undefined;

    const cleanupPending = () => [...owned].some(item => item.closing && !item.report);
    function status(): PlayerStatus {
        const finished = !failed && !!current?.session.finished;
        const usable = !disposed && !preparing && !failed && !!current && !finished && !busy;
        return Object.freeze({
            phase: disposed ? 'disposed' : failed ? 'error' : finished ? 'finished' : running ? 'playing' : started ? 'paused' : 'idle',
            mode: 'stream', started, timed, speed, error, hasError,
            waiting: !disposed && !!(candidate ?? current)?.session.waiting,
            preparing, cleanupPending: cleanupPending(),
            canPause: !disposed && !failed && (running || manual || replay),
            stepIndex: frame?.stepIndex ?? null, progress: frame?.progress ?? null, positionMs: null, durationMs: null,
            canStart: !disposed && !started && !preparing && !cleanupPending() && !busy,
            canRestart: !disposed && started && !preparing && !cleanupPending() && !busy,
            canPlay: usable && timed, canNext: usable, canSeek: false,
            canPrevious: !disposed && !failed && !preparing && !busy && !!current?.session.canPrevious,
            rewindStartIndex: current?.session.rewindStartIndex ?? null,
            rewindEndIndex: current?.session.rewindEndIndex ?? null,
        });
    }
    function stop() {
        running = false; manual = false; replay = false; last = null; pendingMs = 0;
        if (request !== null) scheduler!.cancel(request);
        request = null;
    }
    function release(item: Owned<State> | null) {
        if (item?.report && item !== current && item !== candidate) owned.delete(item);
    }
    function retire(item: Owned<State> | null, reason: unknown) {
        if (!item || item.closing) return;
        item.closing = true;
        item.session.dispose(reason);
        release(item);
    }
    function finishDisposal() {
        if (!disposed || !uiFinished || disposalSnapshot.some(item => !item.report)) return;
        diagnostics.finish(disposalSnapshot.map(item => item.report!));
        disposalSnapshot = [];
    }
    function present() {
        frame = current!.session.frame;
        if (frame) render(reduced ? { ...frame, previous: frame.current, progress: 1 } : frame);
    }
    function fatal(caught: unknown) {
        stop(); error = caught; hasError = true; failed = true;
        const old = current, next = candidate;
        if (old?.session.frame) frame = old.session.frame;
        current = null; candidate = null; preparing = null; preparationFailure = null;
        retire(old, caught); retire(next, caught);
        failures.push(caught);
    }
    function publish() {
        notifying = true;
        try { const snapshot = status(); onChange(snapshot); onStatus(snapshot); }
        finally { notifying = false; }
    }
    function act(action: () => void, clearError = true, asynchronous = false): PlayerStatus {
        if (disposed) throw new Error('Player controls have been disposed');
        if (busy || notifying) throw new Error('Playback cannot be changed from a render/status callback');
        busy = true;
        if (clearError) { error = null; hasError = false; }
        try { action(); } catch (caught) { fatal(caught); }
        finally { busy = false; }
        try { publish(); }
        catch (caught) {
            diagnostics.record('onStatus', caught);
            if (!failures.length && !failed) fatal(caught);
            try { onChange(status()); } catch (secondary) { diagnostics.record('onStatus', secondary); }
        }
        while (failures.length) {
            if (disposed) { failures.length = 0; break; }
            const caught = failures.shift();
            try { onError(caught); }
            catch (notification) {
                diagnostics.record('onError', notification);
                if (!asynchronous) throw notification;
            }
        }
        return status();
    }
    function event(action: () => void) {
        if (disposed) return;
        // Source continuations never create a detached rejection from user callbacks.
        act(action, false, true);
    }
    function schedule() {
        if (!running || disposed || request !== null) return;
        if (current?.session.blocked && current.session.waiting) { last = null; pendingMs = 0; return; }
        request = scheduler!.request(tick);
    }
    function beginPlay() {
        if (!current || current.session.finished) return;
        running = true; last = null;
        current.session.requestIfBlocked();
        schedule();
    }
    function drivePreparation() {
        if (!preparing || !candidate) return;
        const next = candidate;
        if (next.session.failure && !preparationFailure) {
            const caught = next.session.failure.error;
            preparationFailure = { error: caught }; next.failureReported = true;
            error = caught; hasError = true; if (!current) failed = true;
            replay = false;
            failures.push(caught); retire(next, caught);
        }
        if (preparationFailure) {
            if (!next.report) return;
            candidate = null; preparing = null; preparationFailure = null; release(next);
            if (current?.session.failure && !current.failureReported) {
                current.failureReported = true; fatal(current.session.failure.error);
            }
            return;
        }
        if (!next.session.hasReady) return;
        if (current) {
            retire(current, 'player:restart');
            if (!current.report) return;
            const previous = current;
            current = null; release(previous);
            if (previous.report!.cleanupErrors.length) {
                const caught = previous.report!.cleanupErrors[0]!.error;
                error = caught; hasError = true; failed = true; replay = false;
                preparationFailure = { error: caught }; failures.push(caught); retire(next, caught);
                drivePreparation(); return;
            }
        }
        next.session.initialize();
        current = next; candidate = null; preparing = null; started = true; failed = false;
        present();
        if (replay) { replay = false; beginPlay(); }
    }
    function changed(item: Owned<State>) {
        event(() => {
            if (preparing) { drivePreparation(); return; }
            if (item !== current) return;
            if (item.session.failure && !item.failureReported) {
                item.failureReported = true; fatal(item.session.failure.error); return;
            }
            if (manual) {
                manual = !item.session.nextStep();
                if (!manual) present();
            } else if (running) schedule();
        });
    }
    function prepare(kind: "start" | "restart", autoplay = false) {
        if (preparing || cleanupPending()) { if (!autoplay) replay = false; return; }
        stop(); preparing = kind; preparationFailure = null; replay = autoplay;
        let item!: Owned<State>;
        const session = createAsyncSession(options.asyncSource as AsyncSourceFactory<State>,
            { stepDurationMs, finalHoldMs, rewindCapacity, maxStepsPerFrame }, () => changed(item));
        item = { session, closing: false, report: undefined, failureReported: false };
        owned.add(item); candidate = item;
        session.source.closed.then(report => {
            item.report = report;
            for (const issue of report.cleanupErrors) diagnostics.record(issue.phase, issue.error);
            if (disposed) { release(item); finishDisposal(); return; }
            if (preparing || item.closing) event(() => { drivePreparation(); release(item); });
            else release(item);
        });
        session.pull();
    }
    function requireSession() {
        if (!current || failed) throw new Error('Start or restart playback first');
        return current.session;
    }
    function tick(now: number) {
        request = null;
        if (!running || disposed) return;
        event(() => {
            const baseline = last === null;
            const delta = baseline ? 0 : Math.min(100, Math.max(0, now - last!)) * speed;
            last = now;
            const session = requireSession();
            session.advance(pendingMs + delta, baseline && session.hasReady);
            pendingMs = session.pendingMs;
            present();
            if (session.finished) stop();
            else schedule();
        });
    }
    const blockedCommand = () => preparing !== null || cleanupPending() && failed;
    return Object.freeze({
        get status() { return status(); },
        get frame() { return frame; },
        closed: diagnostics.closed,
        get dataBlocked() { return !!current?.session.blocked && current.session.waiting && (running || manual); },
        recordError: diagnostics.record,
        finishDispose() { uiFinished = true; finishDisposal(); },
        start() { return act(() => { if (!started) prepare('start'); }, !preparing && !cleanupPending()); },
        restart() { return act(() => { prepare('restart'); }, !preparing && !cleanupPending()); },
        replay() { return act(() => { prepare('restart', true); }, !preparing && !cleanupPending()); },
        play() {
            if (!timed) throw new Error('Set stepDurationMs to enable Play');
            return act(() => { if (blockedCommand()) return; requireSession(); if (!running) { manual = false; beginPlay(); } }, !blockedCommand());
        },
        pause() { return act(stop, false); },
        next() { return act(() => {
            if (blockedCommand()) return;
            const session = requireSession(); stop(); manual = !session.nextStep();
            if (!manual) present();
        }, !blockedCommand()); },
        previous() {
            if (rewindCapacity === undefined) throw new Error('Previous is unavailable for a stream without rewindCapacity');
            return act(() => { if (blockedCommand()) return; const session = requireSession(); stop(); session.previous(); present(); }, !blockedCommand());
        },
        seek() { throw new Error('Seeking is unavailable for a stream'); },
        setSpeed(value: number) {
            if (!Number.isFinite(value) || value <= 0) throw new TypeError('Speed must be positive');
            return act(() => { speed = value; last = null; }, false);
        },
        setReducedMotion(value: boolean) { return act(() => { reduced = !!value; if (current && !failed) present(); }, false); },
        dispose() {
            if (disposed) return;
            if (busy || notifying) throw new Error('Playback cannot be disposed from a render/status callback');
            stop(); disposed = true; preparing = null;
            disposalSnapshot = [...owned];
            current = null; candidate = null;
            for (const item of disposalSnapshot) retire(item, 'player:dispose');
            try {
                try { publish(); }
                catch (caught) {
                    diagnostics.record('onStatus', caught); error = caught; hasError = true;
                    try { onError(caught); } catch (notification) { diagnostics.record('onError', notification); throw notification; }
                    throw caught;
                }
            } finally {
                if (!options.deferClose) { uiFinished = true; finishDisposal(); }
            }
        },
    });
}
