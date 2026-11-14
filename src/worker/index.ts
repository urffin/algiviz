import type { AsyncSourceSignal } from '../playback/async-source.js';
import type { WorkerSourceCloseResult, WorkerSourceShutdownOptions, WorkerSourceIssue, WorkerSourcePhase,
    WorkerSourceTermination, WorkerSourceCancellation } from './types.js';
import { WorkerSourceError, diagnostics, record } from './error.js';
import { channel, envelope, identity, nextId, packet, cancellation, requestId, wireCleanup, wireIssue } from './protocol.js';
import { inspectData, prepareData } from './data.js';
export { WorkerSourceError } from './error.js';
export type { WorkerSourceErrorOptions } from './error.js';
export type * from './types.js';

export interface WorkerSourceIterator<State> {
    next(): Promise<IteratorResult<State, void>>;
    return(): Promise<IteratorResult<State, void>>;
}
export interface WorkerSourceSession<State> extends AsyncIterable<State> {
    readonly closed: Promise<WorkerSourceCloseResult>;
    [Symbol.asyncIterator](): WorkerSourceIterator<State>;
}
export type WorkerSourceFactory<State> = (signal: AsyncSourceSignal) => WorkerSourceSession<State>;
export interface WorkerSourceOptions<Init> {
    readonly worker: () => Worker;
    readonly input: () => Init;
    readonly shutdown?: WorkerSourceShutdownOptions | undefined;
}

const used = new WeakSet<object>();
const done = () => ({ done: true as const, value: undefined });
const now = () => globalThis.performance?.now() ?? Date.now();

export function createWorkerSourceFactory<State, Init = void>(options: WorkerSourceOptions<Init>): WorkerSourceFactory<State> {
    if (!record(options)) throw new TypeError('Expected Worker/input factories and shutdown options');
    const workerFactory = options.worker, inputFactory = options.input, shutdown = options.shutdown;
    if (typeof workerFactory !== 'function' || typeof inputFactory !== 'function' || shutdown !== undefined && !record(shutdown))
        throw new TypeError('Expected Worker/input factories and shutdown options');
    const suppliedGrace = shutdown?.gracePeriodMs;
    const grace = suppliedGrace === undefined ? 1000 : suppliedGrace;
    if (typeof grace !== 'number') throw new TypeError('Expected numeric shutdown grace');
    if (!Number.isFinite(grace) || grace < 0) throw new RangeError('Shutdown grace must be finite and non-negative');
    return signal => {
        if (!signal || typeof signal.aborted !== 'boolean' || typeof signal.subscribe !== 'function') throw new TypeError('Expected an AsyncSourceSignal');
        return session<State, Init>(signal, workerFactory, inputFactory, grace);
    };
}

function session<State, Init>(signal: AsyncSourceSignal, make: () => Worker, input: () => Init, grace: number): WorkerSourceSession<State> {
    const id = identity(), cleanup = diagnostics();
    let outcome: { kind: 'completed' } | { kind: 'disposed'; reason: unknown } |
        { kind: 'failed'; error: unknown; origin: 'host' | 'worker'; phase: WorkerSourcePhase } | undefined;
    let worker: Worker | undefined, starting = false, initial = true, ready = false, closing = false, finished = false, finishing = false;
    let decision: 'acknowledged' | 'forced' | undefined;
    let request = 0, sent = false, cancelSent = false, deadline: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined, unsubscribe: (() => void) | undefined;
    let closeError: WorkerSourceError | null = null, lateReadError: WorkerSourceIssue | null = null;
    const removers: (() => void)[] = [];
    let pending: { id: number; resolve: (value: IteratorResult<State, void>) => void; reject: (error: unknown) => void } | undefined;
    let complete!: (result: WorkerSourceCloseResult) => void;
    const closed = new Promise<WorkerSourceCloseResult>(resolve => { complete = resolve; });
    let cancelReason: WorkerSourceCancellation = cancellation(undefined);

    function issue(phase: WorkerSourcePhase, error: unknown, origin: 'host' | 'worker' = 'host') {
        cleanup.add({ origin, phase, error });
    }
    function generated(code: 'protocol' | 'serialization' | 'transport' | 'startup', phase: WorkerSourcePhase, message: string, origin: 'host' | 'worker' = 'host') {
        return new WorkerSourceError(message, { code, origin, phase });
    }
    function safe(action: () => void, phase: WorkerSourcePhase = 'teardown') { try { action(); } catch (error) { issue(phase, error); } }
    function settlePending(error: { value: unknown } | null, value: IteratorResult<State, void> = done()) {
        const item = pending; pending = undefined; sent = false;
        if (error) item?.reject(error.value); else item?.resolve(value);
    }
    function finish() {
        if (finished || finishing || starting || initial || !closing || worker && !decision) return;
        finishing = true;
        if (timer !== undefined) { const owned = timer; timer = undefined; safe(() => clearTimeout(owned)); }
        // Terminate before dropping listeners; reentrant messages cannot reopen a closing transport.
        let termination: WorkerSourceTermination = Object.freeze({ kind: 'not-created' });
        if (worker) {
            let result: 'requested' | 'failed' = 'requested';
            try { worker.terminate(); } catch (error) { result = 'failed'; issue('terminate', error); }
            termination = Object.freeze({ kind: decision!, terminate: result });
        }
        for (const remove of removers.splice(0)) safe(remove);
        const removeSignal = unsubscribe; unsubscribe = undefined;
        if (removeSignal) safe(removeSignal);
        worker = undefined; make = undefined!; input = undefined!;
        closeError = cleanup.error;
        if (outcome?.kind === 'completed' && cleanup.summary.first) {
            const first = cleanup.summary.first;
            outcome = { kind: 'failed', error: closeError, origin: first.origin, phase: first.phase };
        }
        finished = true;
        const result = Object.freeze({ ...outcome!, termination, cleanup: cleanup.summary, lateReadError });
        complete(result);
        if (outcome?.kind === 'failed') settlePending({ value: outcome.error });
        else settlePending(closeError ? { value: closeError } : null);
        finishing = false;
    }
    function force() { if (finished || decision) return; decision = 'forced'; finish(); }
    function schedule() {
        if (finished || decision || deadline === undefined || timer !== undefined) return;
        const remaining = deadline - now();
        if (remaining <= 0) { force(); return; }
        try {
            timer = setTimeout(() => { timer = undefined; schedule(); }, Math.min(2147483647, Math.max(1, remaining)));
        } catch (error) { issue('teardown', error); force(); }
    }
    function post(type: string, data: Record<string, unknown> = {}, transfer: ArrayBuffer[] = []) {
        worker!.postMessage(packet(id, type, data), transfer);
    }
    function startShutdown() {
        if (finished) return;
        if (!closing) { closing = true; deadline = now() + grace; }
        // Latch the deadline before entering even a synchronous test transport.
        if (worker && !cancelSent && !decision) {
            cancelSent = true;
            try { post('cancel', { reason: cancelReason }); } catch (error) { issue('post', error); }
        }
        if (!worker && !starting && !initial) finish();
        else { schedule(); finish(); }
    }
    function fail(error: unknown, phase: WorkerSourcePhase, origin: 'host' | 'worker' = 'host') {
        if (finished || finishing) return;
        if (outcome) {
            lateReadError ??= Object.freeze({ origin, phase, error });
            return;
        }
        outcome = { kind: 'failed', error, origin, phase };
        settlePending({ value: error });
        cancelReason = cancellation(undefined);
        startShutdown();
    }
    function protocol(message: string) {
        const error = generated('protocol', 'protocol', message);
        if (closing) issue('protocol', error); else fail(error, 'protocol');
    }
    function merge(value: unknown) {
        const summary = wireCleanup(value);
        if (summary.first) {
            const first = summary.first;
            const error = new WorkerSourceError(first.remote.message, { code: first.code, origin: 'worker', phase: first.remote.phase, remote: first.remote });
            cleanup.add({ origin: 'worker', phase: first.remote.phase, error }, summary.count);
        }
    }
    function acknowledge() {
        if (finished || decision) return;
        decision = 'acknowledged'; finish();
    }
    function pull() {
        if (!ready || !pending || closing || sent) return;
        sent = true;
        try { post('pull', { request: pending.id }); } catch (error) { fail(error, 'post'); }
    }
    function message(event: MessageEvent) {
        if (finished || finishing) return;
        try {
            const value: unknown = event.data;
            if (!record(value) || value.channel !== channel) return;
            if (typeof value.session === 'string' && value.session !== id) return;
            if (!envelope(value)) { protocol('Invalid Worker envelope/version'); return; }
            if (value.type === 'closed') {
                if (!closing) { protocol('Unsolicited close acknowledgement'); return; }
                merge(value.cleanup); acknowledge(); return;
            }
            if (value.type === 'error') {
                if (!(value.request === null || requestId(value.request)) || value.request !== null && value.request !== pending?.id)
                    { protocol('Unexpected Worker error request'); return; }
                const failure = wireIssue(value);
                if (failure.code === 'cleanup') throw new TypeError('Cleanup summary expected');
                const error = new WorkerSourceError(failure.remote.message, { code: failure.code, origin: 'worker', phase: failure.remote.phase, remote: failure.remote });
                fail(error, failure.remote.phase, 'worker'); return;
            }
            if (value.type === 'done') {
                if (!pending || !sent || value.request !== pending.id) { if (!closing) protocol('Unexpected EOF request'); return; }
                merge(value.cleanup);
                if (!outcome) { outcome = { kind: 'completed' }; closing = true; }
                acknowledge(); return;
            }
            if (closing) return; // Stale states/ready replies have no presentation authority.
            if (value.type === 'ready') {
                if (ready || !starting && !pending || value.request !== undefined) { protocol('Unexpected readiness'); return; }
                ready = true; pull(); return;
            }
            if (value.type === 'value') {
                if (!ready || !pending || !sent || value.request !== pending.id || !Object.hasOwn(value, 'value')) { protocol('Unexpected state request'); return; }
                try { inspectData(value.value); } catch (error) { fail(generated('serialization', 'serialize', 'Invalid Worker state'), 'serialize'); return; }
                settlePending(null, { done: false, value: value.value as State }); return;
            }
            protocol('Unexpected Worker message');
        } catch (error) { protocol('Invalid Worker protocol data'); }
    }
    function workerError(event: ErrorEvent) {
        const phase = ready ? 'worker' : 'init';
        let text = 'Worker execution failed';
        try { if (typeof event.message === 'string') text = event.message.slice(0, 4096); } catch { /* No event retained. */ }
        fail(generated(ready ? 'transport' : 'startup', phase, text, 'worker'), phase, 'worker');
    }
    function messageError() {
        const error = generated('transport', 'messageerror', 'Worker message could not be deserialized', 'worker');
        if (closing) issue('messageerror', error, 'worker'); else fail(error, 'messageerror', 'worker');
    }
    function listen(type: string, listener: EventListener) {
        // Register removal first, so a partially failing registration is cleaned too.
        const owned = worker!;
        removers.push(() => owned.removeEventListener(type, listener));
        owned.addEventListener(type, listener);
    }
    function acquire() {
        starting = true;
        let phase: WorkerSourcePhase = 'create';
        try {
            const owned = make();
            if (!record(owned)) throw new TypeError('Expected a dedicated Worker');
            if (used.has(owned)) throw new TypeError('Worker handle is already owned or was previously used');
            worker = owned; used.add(owned);
            if (typeof owned.postMessage !== 'function' || typeof owned.addEventListener !== 'function' ||
                typeof owned.removeEventListener !== 'function' || typeof owned.terminate !== 'function') throw new TypeError('Expected a dedicated Worker');
            listen('message', message as EventListener); listen('error', workerError as EventListener); listen('messageerror', messageError);
            if (outcome) return;
            phase = 'input'; const value = input();
            if (outcome) return;
            phase = 'serialize';
            let prepared: ReturnType<typeof prepareData>;
            try { prepared = prepareData(value); } catch { throw generated('serialization', 'serialize', 'Worker input is not cloneable without shared memory'); }
            if (outcome) return;
            phase = 'post'; post('init', { input: prepared.value });
        } catch (error) { fail(error, phase); }
        finally { starting = false; if (closing) startShutdown(); }
    }
    function abort(reason: unknown) {
        if (outcome || finished) return;
        outcome = { kind: 'disposed', reason }; cancelReason = cancellation(reason); startShutdown();
    }
    const iterator: WorkerSourceIterator<State> = Object.freeze({
        next() {
            if (outcome?.kind === 'failed') return Promise.reject(outcome.error);
            if (outcome || finished) return closed.then(() => { if (closeError) throw closeError; return done(); });
            if (pending) return Promise.reject(new WorkerSourceError('Concurrent transport next is not supported', { code: 'protocol', origin: 'host', phase: 'next' }));
            try { request = nextId(request); } catch (error) { fail(error, 'next'); return Promise.reject(error); }
            const promise = new Promise<IteratorResult<State, void>>((resolve, reject) => { pending = { id: request, resolve, reject }; });
            if (!worker) acquire(); else pull();
            return promise;
        },
        return() {
            if (!outcome) { outcome = { kind: 'disposed', reason: undefined }; cancelReason = cancellation(undefined, true); startShutdown(); }
            return closed.then(() => { if (closeError) throw closeError; return done(); });
        },
    });
    try {
        unsubscribe = signal.subscribe(abort);
        if (typeof unsubscribe !== 'function') throw new TypeError('Expected an unsubscribe function');
        if (signal.aborted) abort(signal.reason);
    } catch (error) { fail(error, 'create'); }
    finally { initial = false; if (closing) startShutdown(); }
    return Object.freeze({ closed, [Symbol.asyncIterator]: () => iterator });
}
