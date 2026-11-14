import type { WorkerSourceCleanupSummary, WorkerSourceErrorCode, WorkerSourceIssue, WorkerSourcePhase,
    WorkerSourceRemoteError, WorkerSourceRemotePhase, WorkerSourceThrownKind } from './types.js';

const phases = new Set(['create', 'input', 'init', 'acquire', 'next', 'transfer', 'serialize', 'post', 'protocol',
    'worker', 'messageerror', 'abort-listener', 'return', 'terminate', 'teardown']);
const remotePhases = new Set(['init', 'acquire', 'next', 'transfer', 'serialize', 'post', 'protocol', 'abort-listener', 'return', 'teardown']);
const codes = new Set(['startup', 'protocol', 'serialization', 'transport', 'remote', 'cleanup']);
const thrownKinds = new Set(['undefined', 'null', 'boolean', 'number', 'bigint', 'string', 'symbol', 'object', 'function']);
export const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';
export const validPhase = (value: unknown): value is WorkerSourcePhase => typeof value === 'string' && phases.has(value);
export const validCode = (value: unknown): value is WorkerSourceErrorCode => typeof value === 'string' && codes.has(value);

export interface WorkerSourceErrorOptions {
    readonly code: WorkerSourceErrorCode;
    readonly origin: 'host' | 'worker';
    readonly phase: WorkerSourcePhase;
    readonly remote?: WorkerSourceRemoteError | null | undefined;
    readonly cleanup?: WorkerSourceCleanupSummary | null | undefined;
}

export function remoteSnapshot(value: unknown): WorkerSourceRemoteError {
    if (!record(value) || typeof value.phase !== 'string' || !remotePhases.has(value.phase) ||
        typeof value.thrownKind !== 'string' || !thrownKinds.has(value.thrownKind) ||
        typeof value.name !== 'string' || typeof value.message !== 'string' ||
        !(value.stack === null || typeof value.stack === 'string')) throw new TypeError('Invalid remote error descriptor');
    return Object.freeze({ phase: value.phase as WorkerSourceRemotePhase, thrownKind: value.thrownKind as WorkerSourceThrownKind,
        name: value.name.slice(0, 128), message: value.message.slice(0, 4096), stack: value.stack === null ? null : value.stack.slice(0, 16384) });
}

export function issueSnapshot(value: unknown): WorkerSourceIssue {
    if (!record(value) || !validPhase(value.phase) || (value.origin !== 'host' && value.origin !== 'worker') || !('error' in value))
        throw new TypeError('Invalid worker source issue');
    return Object.freeze({ origin: value.origin, phase: value.phase, error: value.error });
}

export function summarySnapshot(value: unknown): WorkerSourceCleanupSummary {
    if (!record(value) || typeof value.count !== 'number') throw new TypeError('Invalid cleanup summary');
    if (!Number.isSafeInteger(value.count) || value.count < 0) throw new RangeError('Invalid cleanup count');
    if ((value.count === 0) !== (value.first === null)) throw new TypeError('Cleanup count/first mismatch');
    return Object.freeze({ count: value.count, first: value.first === null ? null : issueSnapshot(value.first) });
}

export class WorkerSourceError extends Error {
    override readonly name = 'WorkerSourceError' as const;
    readonly code: WorkerSourceErrorCode;
    readonly origin: 'host' | 'worker';
    readonly phase: WorkerSourcePhase;
    readonly remote: WorkerSourceRemoteError | null;
    readonly cleanup: WorkerSourceCleanupSummary | null;
    constructor(message: string, options: WorkerSourceErrorOptions) {
        if (typeof message !== 'string' || !record(options) || !validCode(options.code) || !validPhase(options.phase) ||
            (options.origin !== 'host' && options.origin !== 'worker')) throw new TypeError('Invalid worker source error');
        super(message);
        const remote = options.remote == null ? null : remoteSnapshot(options.remote);
        const cleanup = options.cleanup == null ? null : summarySnapshot(options.cleanup);
        if (remote && (options.origin !== 'worker' || remote.phase !== options.phase) || options.code === 'remote' && !remote ||
            options.code === 'cleanup' && (!cleanup?.first || cleanup.first.phase !== options.phase || cleanup.first.origin !== options.origin) ||
            options.code !== 'cleanup' && cleanup !== null) throw new TypeError('Inconsistent worker source error metadata');
        this.code = options.code; this.origin = options.origin; this.phase = options.phase; this.remote = remote; this.cleanup = cleanup;
        for (const key of ['name', 'code', 'origin', 'phase', 'remote', 'cleanup']) Object.defineProperty(this, key, { writable: false, configurable: false });
    }
}

export function describe(error: unknown, phase: WorkerSourceRemotePhase): WorkerSourceRemoteError {
    const thrownKind = error === null ? 'null' : typeof error;
    let name = 'ThrownValue';
    try { if (error instanceof Error) name = 'Error'; } catch { /* A thrown Proxy can trap getPrototypeOf. */ }
    let message = `Remote source threw ${thrownKind}`, stack: string | null = null;
    if (typeof error === 'string') message = error;
    else if (error !== null && (typeof error === 'object' || typeof error === 'function')) {
        // User getters may throw. Never invoke a user stringifier.
        try { const value = (error as { name?: unknown }).name; if (typeof value === 'string') name = value; } catch { /* Safe fallback. */ }
        try { const value = (error as { message?: unknown }).message; if (typeof value === 'string') message = value; } catch { /* Safe fallback. */ }
        try { const value = (error as { stack?: unknown }).stack; if (typeof value === 'string') stack = value; } catch { /* Safe fallback. */ }
    }
    return Object.freeze({ phase, thrownKind, name: name.slice(0, 128), message: message.slice(0, 4096), stack: stack?.slice(0, 16384) ?? null });
}

export function diagnostics() {
    let count = 0, first: WorkerSourceIssue | null = null;
    return {
        add(issue: WorkerSourceIssue, amount = 1) {
            count = Math.min(Number.MAX_SAFE_INTEGER, count + amount);
            first ??= issueSnapshot(issue);
        },
        get summary(): WorkerSourceCleanupSummary { return Object.freeze({ count, first }); },
        get error(): WorkerSourceError | null {
            return first ? new WorkerSourceError('Worker source cleanup failed', { code: 'cleanup', origin: first.origin,
                phase: first.phase, cleanup: Object.freeze({ count, first }) }) : null;
        },
    };
}
