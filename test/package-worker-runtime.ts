import { exposeWorkerSource, type WorkerStateFactory, type WorkerTransferSelector, type WorkerSourceSignal,
    type WorkerSourceCloseResult } from '@grundyjs/algiviz/worker/runtime';
import type { AsyncSourceSignal } from '@grundyjs/algiviz/playback';

interface Init { readonly count: number }
interface State { readonly values: ArrayBuffer; readonly step: number }
export function endpointTypes(scope: DedicatedWorkerGlobalScope, signal: WorkerSourceSignal) {
    const base: AsyncSourceSignal = signal;
    const source: WorkerStateFactory<Init, State> = function* (input, local) {
        if (!local.aborted) yield { values: new ArrayBuffer(input.count), step: 0 };
    };
    const asyncSource: WorkerStateFactory<Init, State> = async function* (input) { yield { values: new ArrayBuffer(input.count), step: 0 }; };
    const transfer: WorkerTransferSelector<State> = state => [state.values];
    const installed: void = exposeWorkerSource({ scope, source, transfer });
    exposeWorkerSource({ scope, source: asyncSource, transfer: undefined });
    exposeWorkerSource({ scope, source: function* (input: Init) { yield { x: input.count }; }, transfer(state) { const n: number = state.x; void n; return []; } });
    const unsubscribe: () => void = signal.subscribe(reason => {
        const kind: 'restart' | 'dispose' | 'return' | 'cancel' = reason.kind;
        const message: string | null = reason.message;
        // @ts-expect-error Wire reason is readonly.
        reason.kind = 'cancel';
        void kind; void message;
    });
    // @ts-expect-error No public abort controller.
    signal.aborted = true;
    // @ts-expect-error Source must directly return an iterable.
    const promised: WorkerStateFactory<Init, State> = async () => (async function* () { yield { values: new ArrayBuffer(8), step: 0 }; })();
    // @ts-expect-error Transfer selector is synchronous.
    const asyncTransfer: WorkerTransferSelector<State> = async state => [state.values];
    // @ts-expect-error Other transferable resources are not ArrayBuffers.
    const ports: WorkerTransferSelector<State> = () => [new MessageChannel().port1];
    const readonly: WorkerTransferSelector<State> = state => {
        // @ts-expect-error Selector input is shallow readonly.
        state.step = 1; return [];
    };
    // @ts-expect-error Dedicated Worker scope required.
    exposeWorkerSource({ scope: {}, source });
    // @ts-expect-error WebWorker declarations must not pull in Window DOM types.
    let element: HTMLElement;
    const report: WorkerSourceCloseResult | null = null;
    void base; void installed; void unsubscribe; void promised; void asyncTransfer; void ports; void readonly; void element; void report;
}
