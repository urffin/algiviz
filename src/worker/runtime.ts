import type { WorkerSourceSignal, WorkerSourceCancellation, WorkerSourceRemotePhase, WorkerSourceErrorCode } from './types.js';
import { record, describe } from './error.js';
import { channel, envelope, packet, requestId, cancelSnapshot, type WireCleanup, type WireIssue } from './protocol.js';
import { prepareData, inspectData } from './data.js';
export type * from './types.js';

export type WorkerStateFactory<Init, State> = (input: Init, signal: WorkerSourceSignal) => Iterable<State> | AsyncIterable<State>;
export type WorkerTransferSelector<State> = (state: Readonly<State>) => readonly ArrayBuffer[];
export interface WorkerSourceEndpointOptions<Init, State> {
    readonly scope: DedicatedWorkerGlobalScope;
    readonly source: WorkerStateFactory<Init, State>;
    readonly transfer?: WorkerTransferSelector<State> | undefined;
}
const installed = new WeakSet<object>();
const objectLike = (value: unknown): value is object => value !== null && (typeof value === 'object' || typeof value === 'function');
const protocolFailures = new WeakSet<object>();
class InvalidProtocol extends Error {
    constructor(message: string) { super(message); protocolFailures.add(this); }
}
const isProtocolFailure = (value: unknown) => objectLike(value) && protocolFailures.has(value);

export function exposeWorkerSource<Init, State>(options: WorkerSourceEndpointOptions<Init, State>): void {
    if (!record(options) || !record(options.scope) || typeof options.source !== 'function' ||
        options.transfer !== undefined && typeof options.transfer !== 'function') throw new TypeError('Expected a Worker scope/source/transfer selector');
    const { scope, source, transfer } = options;
    if (typeof scope.addEventListener !== 'function' || typeof scope.removeEventListener !== 'function' || typeof scope.postMessage !== 'function')
        throw new TypeError('Expected a dedicated Worker scope');
    if (installed.has(scope)) throw new TypeError('Worker source endpoint is already installed');
    installed.add(scope);
    let session: string | undefined, initialized = false, acquiring = false, busy = false, closing = false, closed = false, returning = false;
    let ended = false, naturalRequest: number | undefined, currentRequest: number | null = null, lastRequest = 0;
    let iterator: Iterator<State> | AsyncIterator<State> | undefined;
    let aborted = false, reason: WorkerSourceCancellation | undefined;
    const listeners = new Set<{ listener: (reason: WorkerSourceCancellation) => void }>();
    let count = 0, first: WireIssue | null = null;
    function cleanup(error: unknown, phase: WorkerSourceRemotePhase) {
        count = Math.min(Number.MAX_SAFE_INTEGER, count + 1);
        first ??= Object.freeze({ code: isProtocolFailure(error) ? 'protocol' : 'remote', remote: describe(error, phase) });
    }
    const signal: WorkerSourceSignal = Object.freeze({
        get aborted() { return aborted; }, get reason() { return reason; },
        subscribe(listener: (reason: WorkerSourceCancellation) => void) {
            if (typeof listener !== 'function') throw new TypeError('Expected a cancellation listener');
            if (aborted) { listener(reason!); return () => {}; }
            if (closed || ended) return () => {};
            const entry = { listener }; listeners.add(entry);
            return () => { listeners.delete(entry); };
        },
    });
    function abort(cause: WorkerSourceCancellation) {
        if (aborted || ended) return;
        aborted = true; reason = cause;
        for (const entry of listeners) {
            listeners.delete(entry);
            try { entry.listener(cause); } catch (error) { cleanup(error, 'abort-listener'); }
        }
        listeners.clear();
    }
    function post(type: string, data: Record<string, unknown> = {}, buffers: ArrayBuffer[] = []) {
        scope.postMessage(packet(session!, type, data), buffers);
    }
    function fallback() {
        // A clone-safe error packet itself could not be sent. Let the native
        // Worker error mechanism notify its owner; never recurse into posting.
        queueMicrotask(() => { throw new Error('Worker source channel failed'); });
    }
    async function finish() {
        if (!closing || busy || acquiring || returning || closed) return;
        returning = true;
        if (iterator && !ended) {
            try {
                const finish = iterator.return;
                if (finish != null) {
                    if (typeof finish !== 'function') throw new InvalidProtocol('Iterator return must be callable');
                    const result: unknown = await Reflect.apply(finish, iterator, []);
                    if (!objectLike(result) || (result as IteratorResult<State>).done !== true)
                        throw new InvalidProtocol('Iterator return must finish with done: true');
                }
            } catch (error) { cleanup(error, 'return'); }
        }
        iterator = undefined; listeners.clear();
        for (const [type, listener] of [['message', message], ['messageerror', messageError]] as const) {
            try { scope.removeEventListener(type, listener as EventListener); } catch (error) { cleanup(error, 'teardown'); }
        }
        closed = true;
        const summary: WireCleanup = Object.freeze({ count, first });
        try {
            if (naturalRequest !== undefined) post('done', { request: naturalRequest, cleanup: summary });
            else post('closed', { cleanup: summary });
        } catch { fallback(); }
    }
    function stop(cause: WorkerSourceCancellation) { closing = true; abort(cause); void finish(); }
    function fail(error: unknown, phase: WorkerSourceRemotePhase, code: WorkerSourceErrorCode, request = currentRequest) {
        if (closed) return;
        const detail = describe(error, phase);
        try { post('error', { request, code, remote: detail }); } catch { fallback(); }
        if (!closing) stop(Object.freeze({ kind: 'cancel', message: 'Worker source failed' }));
    }
    function invalid(text: string) { fail(new InvalidProtocol(text), 'protocol', 'protocol'); }
    function acquire(input: Init) {
        acquiring = true;
        let phase: WorkerSourceRemotePhase = 'init';
        try {
            try { inspectData(input); }
            catch (error) { fail(error, 'serialize', 'serialization', null); return; }
            const iterable = source(input, signal);
            phase = 'acquire';
            if (iterable == null) throw new InvalidProtocol('Expected an iterable');
            const asyncMethod = (iterable as AsyncIterable<State>)[Symbol.asyncIterator];
            const method = asyncMethod ?? (iterable as Iterable<State>)[Symbol.iterator];
            if (typeof method !== 'function') throw new InvalidProtocol('Expected a callable iterator factory');
            const owned: unknown = method.call(iterable);
            if (!objectLike(owned)) throw new InvalidProtocol('Expected an iterator object');
            iterator = owned as Iterator<State> | AsyncIterator<State>;
            if (!closing) post('ready');
        } catch (error) { fail(error, phase, isProtocolFailure(error) ? 'protocol' : 'remote', null); }
        finally { acquiring = false; void finish(); }
    }
    async function pull(request: number) {
        busy = true; currentRequest = request;
        let phase: WorkerSourceRemotePhase = 'next', code: WorkerSourceErrorCode = 'remote';
        try {
            const next = iterator!.next;
            if (closing) return;
            if (typeof next !== 'function') throw new InvalidProtocol('Iterator next must be callable');
            const result: unknown = await Reflect.apply(next, iterator, []);
            if (!objectLike(result)) throw new InvalidProtocol('Expected an iterator result');
            const item = result as IteratorResult<State>;
            if (item.done) {
                ended = true;
                if (!closing) { naturalRequest = request; closing = true; listeners.clear(); }
                return;
            }
            if (closing) return;
            const value = item.value;
            if (closing) return;
            phase = 'transfer';
            const buffers = transfer ? transfer(value) : [];
            if (closing) return;
            phase = 'serialize'; code = 'serialization';
            const prepared = prepareData(value, buffers);
            if (closing) return;
            phase = 'post'; code = 'transport';
            post('value', { request, value: prepared.value }, prepared.transfer);
        } catch (error) { fail(error, phase, isProtocolFailure(error) ? 'protocol' : code, request); }
        finally { busy = false; currentRequest = null; void finish(); }
    }
    function message(event: MessageEvent) {
        if (closed) return;
        try {
            const value: unknown = event.data;
            if (!record(value) || value.channel !== channel) return;
            if (session !== undefined && typeof value.session === 'string' && value.session !== session) return;
            if (!envelope(value)) {
                if (session === undefined && typeof value.session === 'string') session = value.session;
                if (session !== undefined) invalid('Invalid Worker envelope/version');
                return;
            }
            session ??= value.session;
            if (value.type === 'cancel') { stop(cancelSnapshot(value.reason)); return; }
            if (closing) return;
            if (value.type === 'init') {
                if (initialized || !Object.hasOwn(value, 'input')) { invalid('Unexpected initialization'); return; }
                initialized = true; acquire(value.input as Init); return;
            }
            if (value.type === 'pull') {
                if (!initialized || !iterator || busy || !requestId(value.request) || value.request !== lastRequest + 1)
                    { invalid('Unexpected pull request'); return; }
                lastRequest = value.request; void pull(value.request); return;
            }
            invalid('Unexpected host message');
        } catch (error) { if (session !== undefined) fail(error, 'protocol', 'protocol'); }
    }
    function messageError() { if (session !== undefined) invalid('Host message could not be deserialized'); }
    try {
        scope.addEventListener('message', message); scope.addEventListener('messageerror', messageError);
    } catch (error) {
        try { scope.removeEventListener('message', message); } catch { /* Preserve installation error. */ }
        try { scope.removeEventListener('messageerror', messageError); } catch { /* Preserve installation error. */ }
        throw error;
    }
}
