import { exposeWorkerSource } from '../dist/worker/runtime.js';

let mode, calls = 0, returns = 0, previous;
const metric = data => postMessage({ channel: 'native-worker-check', ...data });
exposeWorkerSource({
    scope: self,
    source(input, signal) {
        mode = input.mode;
        if (mode === 'cleanup') signal.subscribe(() => { throw new Error('abort failed'); });
        return {
            [Symbol.asyncIterator]() {
                return {
                    async next() {
                        calls++; metric({ event: 'next', calls });
                        if (mode === 'empty') return { done: true, value: 'ignored' };
                        if (mode === 'error') throw undefined;
                        if (mode === 'function') return { done: false, value: () => {} };
                        if (mode === 'shared') return { done: false, value: new Map([[1, new Uint8Array(new SharedArrayBuffer(1))]]) };
                        if (mode === 'never') return new Promise(() => {});
                        if (calls === 2 && mode === 'busy') { metric({ event: 'busy' }); while (true) {} }
                        if (calls === 2 && (mode === 'cooperative' || mode === 'late')) return new Promise((resolve, reject) => {
                            signal.subscribe(reason => {
                                metric({ event: 'cancel', reason });
                                if (mode === 'late') reject(new Error('late next'));
                                else resolve({ done: false, value: 'discard' });
                            });
                        });
                        if (calls > 2) return { done: true, value: 'ignored' };
                        const previousBytes = previous?.byteLength ?? null;
                        const buffer = new Uint8Array([calls, 2, 3, 4]).buffer;
                        previous = buffer;
                        const value = { calls, buffer, previousBytes, initial: input.buffer ? new Uint8Array(input.buffer)[0] : null };
                        if (mode === 'clone') { value.self = value; value.map = new Map([[1, 'ok']]); value.error = new Error('state', { cause: { n: 1 } }); }
                        return { done: false, value };
                    },
                    async return() {
                        returns++; metric({ event: 'return', returns, aborted: signal.aborted, reason: signal.reason });
                        if (mode === 'cleanup') throw new Error('return failed');
                        if (mode === 'never-return') return new Promise(() => {});
                        return { done: true };
                    },
                };
            },
        };
    },
    transfer(state) {
        if (mode === 'transfer') return [state.buffer];
        if (mode === 'bad-transfer') return [state.buffer, state.buffer];
        return [];
    },
});
