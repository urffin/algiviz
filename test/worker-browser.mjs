import { createAsyncSource } from '../dist/playback/index.js';
import { createWorkerSourceFactory, WorkerSourceError } from '../dist/worker/index.js';

const checks = [], unexpected = [], workers = new Set();
addEventListener('error', event => unexpected.push(String(event.message)));
addEventListener('unhandledrejection', event => unexpected.push(String(event.reason)));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function bounded(promise, ms = 4000) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Native check timeout')), ms); })]); }
    finally { clearTimeout(timer); }
}
async function waitUntil(predicate) {
    const start = performance.now();
    while (!predicate()) { if (performance.now() - start > 3000) throw new Error('Metric timeout'); await delay(5); }
}
function environment(mode, { grace = 1000, url = './worker-native-fixture.mjs', buffer } = {}) {
    let session, worker, creations = 0, terminations = 0, pulls = 0;
    const metrics = [];
    const factory = createWorkerSourceFactory({
        worker() {
            creations++; worker = new Worker(new URL(url, import.meta.url), { type: 'module' }); workers.add(worker);
            const terminate = worker.terminate.bind(worker), post = worker.postMessage.bind(worker);
            worker.terminate = () => { terminations++; workers.delete(worker); terminate(); };
            worker.postMessage = (value, transfer) => { if (value.type === 'pull') pulls++; post(value, transfer); };
            worker.addEventListener('message', event => { if (event.data?.channel === 'native-worker-check') metrics.push(event.data); });
            if (url.includes('missing')) worker.addEventListener('error', event => event.preventDefault());
            return worker;
        },
        input: () => ({ mode, buffer }), shutdown: { gracePeriodMs: grace },
    });
    const source = createAsyncSource(signal => (session = factory(signal)));
    return { source, factory, metrics, get session() { return session; }, get creations() { return creations; },
        get terminations() { return terminations; }, get pulls() { return pulls; } };
}
async function using(mode, fn, options) {
    const env = environment(mode, options);
    try { await fn(env); }
    finally { env.source.dispose(); await bounded(env.source.closed); }
}
async function check(name, fn) {
    const item = document.createElement('li'); item.textContent = name; document.querySelector('#checks').append(item);
    try { await fn(); checks.push({ name, passed: true }); item.textContent += ' ✓'; }
    catch (error) { checks.push({ name, passed: false, error: String(error?.stack ?? error) }); item.textContent += ' FAILED'; item.className = 'failed'; }
}
await check('construction/disposal without a read creates no Worker', async () => {
    const env = environment('finite'); env.source.dispose(); await env.source.closed; assert(env.creations === 0, 'eager Worker');
});
await check('same public promise, one pull, no prefetch and EOF release before done', () => using('finite', async env => {
    const first = env.source.next(); assert(first === env.source.next(), 'read not coalesced');
    assert((await first).value.calls === 1, 'wrong first request'); await delay(30); assert(env.pulls === 1, 'prefetch');
    await env.source.next(); const eof = await env.source.next(); assert(eof.kind === 'done', 'missing EOF');
    assert(env.pulls === 3 && env.terminations === 1, 'EOF did not release Worker');
    assert((await env.session.closed).termination.kind === 'acknowledged', 'EOF not acknowledged');
    assert(!env.metrics.some(m => m.event === 'return'), 'return after EOF');
}));
await check('empty EOF releases Worker and preserves headless RangeError', () => using('empty', async env => {
    try { await env.source.next(); throw new Error('empty read succeeded'); } catch (error) { assert(error instanceof RangeError, 'wrong empty error'); }
    assert((await env.session.closed).kind === 'completed' && env.terminations === 1, 'empty transport not released');
}));
await check('initialization is copied and host input remains attached', async () => {
    const buffer = new Uint8Array([17]).buffer;
    await using('finite', async env => { assert((await env.source.next()).value.initial === 17, 'input lost'); assert(buffer.byteLength === 1, 'input transferred'); }, { buffer });
});
await check('default copy retains sender storage and prior host states', () => using('copy', async env => {
    const first = (await env.source.next()).value, second = (await env.source.next()).value;
    assert(second.previousBytes === 4, 'copy detached sender'); assert(new Uint8Array(first.buffer)[0] === 1, 'prior host state changed');
}));
await check('ArrayBuffer transfer detaches sender and preserves host snapshots after cleanup', () => using('transfer', async env => {
    const first = (await env.source.next()).value, second = (await env.source.next()).value;
    assert(second.previousBytes === 0, 'sender was not detached'); env.source.dispose(); await env.source.closed;
    assert(first.buffer.byteLength === 4 && new Uint8Array(first.buffer)[0] === 1, 'retained buffer detached');
}));
await check('cyclic/Map/Error-cause snapshots survive native structured clone', () => using('clone', async env => {
    const value = (await env.source.next()).value;
    assert(value.self === value && value.map.get(1) === 'ok' && value.error.cause.n === 1, 'clone graph changed');
}));
await check('remote thrown undefined has a bounded typed descriptor', () => using('error', async env => {
    try { await env.source.next(); throw new Error('remote error missing'); }
    catch (error) { assert(error instanceof WorkerSourceError && error.code === 'remote' && error.remote.thrownKind === 'undefined', 'wrong remote error'); }
    assert((await env.session.closed).kind === 'failed', 'failure not recorded');
}));
for (const mode of ['function', 'bad-transfer', 'shared']) await check(`${mode} payload is a serialization failure without retry`, () => using(mode, async env => {
    if (mode === 'shared') assert(typeof SharedArrayBuffer === 'function', 'native SharedArrayBuffer test unavailable');
    try { await env.source.next(); throw new Error('serialization failure missing'); }
    catch (error) { assert(error instanceof WorkerSourceError && error.code === 'serialization', 'wrong serialization error'); }
    await env.source.closed; assert(env.pulls === 1 && env.terminations === 1, 'retry or leak');
}));
await check('cooperative cancellation is prompt and awaits serialized return', () => using('cooperative', async env => {
    await env.source.next(); const read = env.source.next(); await waitUntil(() => env.metrics.some(m => m.calls === 2));
    const reason = { cannotClone: () => {} }; env.source.dispose(reason);
    const result = await read; assert(result.kind === 'cancelled' && result.reason === reason, 'public cancellation changed');
    const report = await env.session.closed; assert(report.termination.kind === 'acknowledged' && report.cleanup.count === 0, 'cooperative shutdown failed');
    const returned = env.metrics.find(m => m.event === 'return'); assert(returned?.returns === 1 && returned.aborted, 'return missing');
    assert(returned.reason.kind === 'cancel' && returned.reason.message === null, 'unsafe reason crossed channel');
}));
await check('abort/return errors reach outer cleanup diagnostics once', () => using('cleanup', async env => {
    await env.source.next(); env.source.dispose(); const source = await env.source.closed, report = await env.session.closed;
    assert(report.cleanup.count === 2 && report.termination.kind === 'acknowledged', 'cleanup count/ack wrong');
    assert(source.cleanupErrors.length === 1 && source.cleanupErrors[0].error.cleanup.count === 2, 'cleanup summary lost');
}));
await check('late cancelled-read error stays diagnostic without failing cleanup', () => using('late', async env => {
    await env.source.next(); const read = env.source.next(); await waitUntil(() => env.metrics.some(m => m.calls === 2));
    env.source.dispose('player:restart'); await read;
    const report = await env.session.closed;
    assert(report.kind === 'disposed' && report.cleanup.count === 0 && report.lateReadError.error.remote.message === 'late next', 'late error misclassified');
}));
await check('never-settling next is forcibly terminated after grace', () => using('never', async env => {
    const read = env.source.next(); await waitUntil(() => env.metrics.some(m => m.calls === 1));
    env.source.dispose(); assert((await read).kind === 'cancelled', 'public read stuck');
    const report = await env.session.closed; assert(report.termination.kind === 'forced' && env.terminations === 1, 'force missing');
}, { grace: 20 }));
await check('CPU-bound Worker cannot block host cancellation/termination', () => using('busy', async env => {
    await env.source.next(); const read = env.source.next(); await waitUntil(() => env.metrics.some(m => m.event === 'busy'));
    let responsive = false; setTimeout(() => { responsive = true; }, 0);
    env.source.dispose(); assert((await read).kind === 'cancelled', 'CPU-bound public read stuck');
    const report = await env.session.closed; assert(report.termination.kind === 'forced' && responsive && env.terminations === 1, 'host blocked or force missing');
}, { grace: 30 }));
await check('never-settling return cannot hold closed indefinitely', () => using('never-return', async env => {
    await env.source.next(); env.source.dispose(); const report = await env.session.closed;
    assert(report.termination.kind === 'forced' && report.cleanup.count === 0, 'return did not force-close');
}, { grace: 20 }));
await check('native module-load error rejects and releases owned Worker', () => using('finite', async env => {
    try { await env.source.next(); throw new Error('load failure missing'); }
    catch (error) { assert(error instanceof WorkerSourceError && error.code === 'startup', 'wrong load error'); }
    await env.session.closed; assert(env.terminations === 1, 'load failure leaked Worker');
}, { grace: 20, url: './missing-worker.mjs' }));
await check('silent Worker exit remains pending until owner cancellation', () => using('finite', async env => {
    const read = env.source.next(); let settled = false; read.then(() => { settled = true; }, () => { settled = true; });
    await delay(80); assert(!settled, 'invented exit result'); env.source.dispose(); await read;
    assert((await env.session.closed).termination.kind === 'forced', 'silent exit not cancelled');
}, { grace: 20, url: './worker-silent-fixture.mjs' }));
await check('zero grace cancels startup without late source activity', () => using('finite', async env => {
    const read = env.source.next(); env.source.dispose(); assert((await read).kind === 'cancelled', 'startup cancellation stuck');
    assert((await env.session.closed).termination.kind === 'forced' && env.terminations === 1, 'zero grace not immediate');
}, { grace: 0 }));

await delay(30);
const provenance = await fetch('/provenance').then(response => response.json());
globalThis.workerReport = { date: new Date().toISOString(), environment: { userAgent: navigator.userAgent, crossOriginIsolated, sharedArrayBuffer: typeof SharedArrayBuffer },
    checks, unexpected, remainingWorkers: workers.size, provenance };
const passed = checks.filter(c => c.passed).length;
document.querySelector('#status').textContent = `${passed}/${checks.length} passed; ${unexpected.length} unexpected errors; ${workers.size} remaining Workers`;
document.querySelector('#result').textContent = JSON.stringify(globalThis.workerReport, null, 2);
for (const worker of workers) worker.terminate();
