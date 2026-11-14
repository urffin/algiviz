import { record, remoteSnapshot, validCode } from './error.js';
import type { WorkerSourceCancellation, WorkerSourceErrorCode, WorkerSourceRemoteError } from './types.js';

export const channel = '@grundyjs/algiviz/worker';
export const version = 1;
export interface Envelope { channel: typeof channel; version: number; session: string; type: string }
export interface WireIssue { readonly code: WorkerSourceErrorCode; readonly remote: WorkerSourceRemoteError }
export interface WireCleanup { readonly count: number; readonly first: WireIssue | null }
let sequence = 0;
export function identity(): string {
    sequence = nextId(sequence);
    return `${Date.now().toString(36)}-${sequence}-${Math.random().toString(36).slice(2)}`;
}
export function nextId(previous: number): number {
    if (!Number.isSafeInteger(previous) || previous < 0 || previous === Number.MAX_SAFE_INTEGER) throw new RangeError('Worker request ID exhausted');
    return previous + 1;
}
export const requestId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
export function envelope(value: unknown): value is Record<string, unknown> & Envelope {
    return record(value) && value.channel === channel && typeof value.session === 'string' && value.session.length > 0 &&
        typeof value.type === 'string' && value.version === version;
}
export function packet(session: string, type: string, data: Record<string, unknown> = {}) {
    return { channel, version, session, type, ...data };
}
export function cancellation(reason: unknown, returned = false): WorkerSourceCancellation {
    return Object.freeze({ kind: returned ? 'return' : reason === 'player:restart' ? 'restart' : reason === 'player:dispose' ? 'dispose' : 'cancel',
        message: typeof reason === 'string' ? reason.slice(0, 4096) : null });
}
export function cancelSnapshot(value: unknown): WorkerSourceCancellation {
    if (!record(value) || !['restart', 'dispose', 'return', 'cancel'].includes(value.kind as string) ||
        !(value.message === null || typeof value.message === 'string' && value.message.length <= 4096)) throw new TypeError('Invalid cancellation');
    return Object.freeze({ kind: value.kind as WorkerSourceCancellation['kind'], message: value.message });
}
export function wireIssue(value: unknown): WireIssue {
    if (!record(value) || !validCode(value.code)) throw new TypeError('Invalid wire issue');
    return Object.freeze({ code: value.code, remote: remoteSnapshot(value.remote) });
}
export function wireCleanup(value: unknown): WireCleanup {
    if (!record(value) || !Number.isSafeInteger(value.count) || (value.count as number) < 0 ||
        (value.count === 0) !== (value.first === null)) throw new TypeError('Invalid wire cleanup');
    return Object.freeze({ count: value.count as number, first: value.first === null ? null : wireIssue(value.first) });
}
