import { exposeWorkerSource } from '../dist/worker/runtime.js';

let generation, configuration, pending, returnGate, reads = 0, returns = 0;
const metric = data => postMessage({ channel: 'player-worker-fixture', generation, ...data });
const snapshot = index => ({ generation, index, buffer: new Float64Array([generation * 100 + index]).buffer });
addEventListener('message', event => {
    const command = event.data;
    if (command?.channel !== 'player-worker-fixture') return;
    if (command.type === 'cleanup') { returnGate?.resolve({ done: true }); return; }
    if (!pending || command.read !== pending.id) return;
    const request = pending; pending = undefined;
    if (command.type === 'value') request.resolve({ done: false, value: snapshot(command.index) });
    else if (command.type === 'eof') request.resolve({ done: true, value: 'ignored' });
    else if (command.type === 'reject') request.reject(new Error(command.message ?? 'Worker request rejected'));
    queueMicrotask(() => metric({ event: 'settled', read: request.id }));
});
exposeWorkerSource({
    scope: self,
    source(input, signal) {
        generation = input.generation; configuration = input;
        returnGate = {};
        returnGate.promise = new Promise(resolve => { returnGate.resolve = resolve; });
        signal.subscribe(reason => {
            metric({ event: 'abort', reason });
            if (pending && !configuration.ignoreCancellation) {
                const request = pending; pending = undefined;
                request.resolve({ done: false, value: snapshot(-1) });
            }
        });
        return { [Symbol.asyncIterator]: () => ({
            next() {
                reads++; const promise = new Promise((resolve, reject) => { pending = { id: reads, resolve, reject }; });
                metric({ event: 'request', read: reads }); return promise;
            },
            async return() {
                returns++; metric({ event: 'return', returns, reason: signal.reason });
                if (configuration.cleanupError) throw new Error('Worker cleanup failed');
                return returnGate.promise;
            },
        }) };
    },
    transfer: state => [state.buffer],
});
