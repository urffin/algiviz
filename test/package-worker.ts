import { Player, type PlayerStatus, type PlayerCloseResult } from '@grundyjs/algiviz/player';
import { createAsyncSource, type AsyncSourceFactory, type AsyncSourceSignal } from '@grundyjs/algiviz/playback';
import { createWorkerSourceFactory, WorkerSourceError, type WorkerSourceFactory, type WorkerSourceCloseResult,
    type WorkerSourceSession } from '@grundyjs/algiviz/worker';

if (typeof createWorkerSourceFactory !== 'function' || typeof WorkerSourceError !== 'function') throw new Error('Worker entry must import without Worker/DOM globals');

interface Init { readonly count: number }
interface State { readonly values: ArrayBuffer; readonly step: number }
export function workerTypes(signal: AsyncSourceSignal) {
    const factory = createWorkerSourceFactory<State, Init>({ worker: () => new Worker('worker.js', { type: 'module' }),
        input: () => ({ count: 1 }), shutdown: { gracePeriodMs: undefined } });
    const callable: WorkerSourceFactory<State> = factory;
    const compatible: AsyncSourceFactory<State> = factory;
    const session: WorkerSourceSession<State> = factory(signal);
    const report: Promise<WorkerSourceCloseResult> = session.closed;
    const iterator = session[Symbol.asyncIterator]();
    const returned: Promise<IteratorResult<State, void>> = iterator.return();
    // @ts-expect-error No next input channel.
    iterator.next(1);
    // @ts-expect-error No return payload.
    iterator.return(1);
    // @ts-expect-error No throw channel.
    iterator.throw;
    const source = createAsyncSource(factory);
    source.next().then(result => {
        if (result.kind === 'value') {
            const value: ArrayBuffer = result.value.values;
            // @ts-expect-error State is inferred through the actual factory result.
            const wrong: string = result.value.step;
            void value; void wrong;
        }
    });
    createWorkerSourceFactory<State>({ worker: () => new Worker('x'), input: () => undefined, shutdown: undefined });
    const unknown = createAsyncSource(createWorkerSourceFactory({ worker: () => new Worker('x'), input: () => undefined }));
    unknown.next().then(result => {
        // @ts-expect-error State cannot be inferred from an untyped Worker handle.
        if (result.kind === 'value') result.value.missing;
    });
    // @ts-expect-error Worker factory is synchronous.
    createWorkerSourceFactory<State>({ worker: async () => new Worker('x'), input: () => undefined });
    // @ts-expect-error No SharedWorker handle.
    createWorkerSourceFactory<State>({ worker: () => new SharedWorker('x'), input: () => undefined });
    // @ts-expect-error Init is not a promise.
    createWorkerSourceFactory<State, Init>({ worker: () => new Worker('x'), input: async () => ({ count: 1 }) });
    // @ts-expect-error Input factory is required even for void input.
    createWorkerSourceFactory<State>({ worker: () => new Worker('x') });
    // @ts-expect-error Numeric grace.
    createWorkerSourceFactory<State>({ worker: () => new Worker('x'), input: () => undefined, shutdown: { gracePeriodMs: '1' } });
    // @ts-expect-error No implicit read timeout.
    createWorkerSourceFactory<State>({ worker: () => new Worker('x'), input: () => undefined, shutdown: { readTimeoutMs: 1 } });
    // @ts-expect-error Session is not a second async adapter.
    session.dispose();
    // @ts-expect-error Closed identity is readonly.
    session.closed = report;
    const error = new WorkerSourceError('remote', { code: 'remote', origin: 'worker', phase: 'next',
        remote: { phase: 'next', thrownKind: 'undefined', name: 'ThrownValue', message: 'undefined', stack: null }, cleanup: undefined });
    // @ts-expect-error Error metadata is readonly.
    error.phase = 'return';
    // @ts-expect-error Error codes are closed.
    new WorkerSourceError('x', { code: 'timeout', origin: 'host', phase: 'next' });
    void callable; void compatible; void returned;
}

export function closeTypes(report: WorkerSourceCloseResult) {
    if (report.kind === 'disposed') { const reason: unknown = report.reason; void reason; }
    else if (report.kind === 'failed') { const error: unknown = report.error; const phase: string = report.phase; void error; void phase; }
    else {
        // @ts-expect-error Completed has no fabricated error.
        report.error;
    }
    if (report.termination.kind === 'not-created') {
        // @ts-expect-error No terminate outcome when no Worker exists.
        report.termination.terminate;
    } else { const state: 'requested' | 'failed' = report.termination.terminate; void state; }
    // @ts-expect-error Report wrappers are readonly.
    report.cleanup.count = 1;
    // @ts-expect-error No unbounded diagnostic journal.
    report.cleanup.errors;
}

export function workerPlayerTypes(host: HTMLElement) {
    const factory = createWorkerSourceFactory<State, Init>({
        worker: () => new Worker('worker.js', { type: 'module' }), input: () => ({ count: 4 }),
    });
    const ui = new Player(host, { asyncSource: factory, render(frame) {
        const step: number = frame.current.step;
        const buffer: ArrayBuffer = frame.previous.values;
        const event: undefined = frame.event;
        // @ts-expect-error Worker State inference is preserved by Player.
        frame.current.missing;
        void step; void buffer; void event;
    }, stepDurationMs: 100, rewindCapacity: 3, maxStepsPerFrame: 1 });
    const typed: Player<State> = ui;
    const status: PlayerStatus = ui.restart();
    const closed: Promise<PlayerCloseResult> = ui.closed;
    // @ts-expect-error Player commands remain synchronous.
    const preparation: Promise<PlayerStatus> = ui.start();
    // @ts-expect-error Transport reports are separately observed per source session.
    const workerReport: Promise<WorkerSourceCloseResult> = ui.closed;
    // @ts-expect-error Worker uses asyncSource, not a fourth source kind.
    new Player(host, { workerSource: factory, render() {} });
    // @ts-expect-error Source capabilities remain mutually exclusive.
    new Player(host, { asyncSource: factory, source: () => [], render() {} });
    void typed; void status; void closed; void preparation; void workerReport;
}
