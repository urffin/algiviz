import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAsyncSource } from '@grundyjs/algiviz/playback';
import { createWorkerSourceFactory, WorkerSourceError } from '@grundyjs/algiviz/worker';
import { exposeWorkerSource } from '@grundyjs/algiviz/worker/runtime';
import { controller, deferred, fakeClock, transport, turn } from './worker-test-transport.mjs';

function setup(source, options = {}) {
    let link, session, creations = 0, inputs = 0;
    const factory = createWorkerSourceFactory({
        worker() { creations++; return (link = transport(source, options)).worker; },
        input() { inputs++; return options.input?.(); },
        shutdown: { gracePeriodMs: options.grace ?? 10 },
    });
    const adapter = createAsyncSource(signal => (session = factory(signal)));
    return { factory, adapter, get link() { return link; }, get session() { return session; }, get creations() { return creations; }, get inputs() { return inputs; } };
}
async function rejected(read, code, phase) {
    await assert.rejects(read, error => error instanceof WorkerSourceError && error.code === code && (!phase || error.phase === phase));
}

test('Worker factory/session acquisition is lazy, stable, and disposal before read creates nothing', async () => {
    const env = setup(function* () { yield 1; });
    assert.equal(env.creations, 0); env.adapter.dispose(); await env.adapter.closed;
    assert.equal(env.creations, 0);
    const control = controller(), session = env.factory(control.signal);
    assert.equal(session[Symbol.asyncIterator](), session[Symbol.asyncIterator]());
    assert.equal(session.closed, session.closed); assert.equal(env.creations, 0);
    await session[Symbol.asyncIterator]().return();
    assert.equal((await session.closed).termination.kind, 'not-created'); assert.equal(env.inputs, 0); assert.equal(control.listeners, 0);
    control.abort('too late');
});

test('one shared public read, one pull, no prefetch, undefined state and the extra EOF probe', async () => {
    let calls = 0, returns = 0;
    const value = deferred();
    const env = setup(() => ({ [Symbol.asyncIterator]() { return { next() { calls++; return calls === 1 ? value.promise : Promise.resolve({ done: true, value: 'ignored' }); }, return() { returns++; return { done: true }; } }; } }));
    const a = env.adapter.next(), b = env.adapter.next(); assert.equal(a, b);
    await turn(); assert.equal(calls, 1); assert.equal(env.link.sent.filter(p => p.type === 'pull').length, 1);
    value.resolve({ done: false, value: undefined });
    assert.deepEqual(await a, { kind: 'value', value: undefined }); await turn(); assert.equal(calls, 1);
    assert.deepEqual(await env.adapter.next(), { kind: 'done' });
    assert.equal(calls, 2); assert.equal(returns, 0); assert.equal(env.link.terminations, 1);
    assert.equal((await env.session.closed).termination.kind, 'acknowledged');
    assert.equal((await env.adapter.closed).kind, 'completed'); assert.equal(env.link.hostListeners, 0);
    await env.adapter.next(); assert.equal(calls, 2);
});

test('empty Worker source releases before the headless RangeError and never calls return', async () => {
    let returns = 0;
    const env = setup(() => ({ [Symbol.iterator]() { return { next: () => ({ done: true, value: 9 }), return() { returns++; return { done: true }; } }; } }));
    await assert.rejects(env.adapter.next(), RangeError);
    assert.equal((await env.session.closed).kind, 'completed'); assert.equal(env.link.terminations, 1); assert.equal(returns, 0);
    assert.equal((await env.adapter.closed).kind, 'failed');
});

test('native clone snapshots input/getters once, handles cycles, and isolates sender mutations', async () => {
    let reads = 0, original;
    const input = { buffer: new ArrayBuffer(8) };
    const env = setup(function* (init) {
        assert.notEqual(init, input); assert.notEqual(init.buffer, input.buffer);
        original = { number: 1, buffer: new ArrayBuffer(8) }; original.self = original;
        Object.defineProperty(original, 'getter', { enumerable: true, get() { reads++; return reads === 1 ? 'snapshot' : new SharedArrayBuffer(1); } });
        yield original; original.number = 2; yield 2;
    }, { input: () => input });
    const a = (await env.adapter.next()).value;
    assert.equal(a.self, a); assert.equal(a.getter, 'snapshot'); assert.equal(reads, 1); assert.equal(input.buffer.byteLength, 8);
    await env.adapter.next(); assert.equal(a.number, 1); assert.equal(a.buffer.byteLength, 8);
    env.adapter.dispose(); await env.adapter.closed;
});

test('explicit ArrayBuffer transfer detaches worker storage and preserves prior host snapshots', async () => {
    const buffers = [];
    const env = setup(function* () {
        for (let n = 1; n <= 2; n++) { const view = new Uint8Array([n]); buffers.push(view.buffer); yield { view }; }
    }, { transfer: state => [state.view.buffer] });
    const first = (await env.adapter.next()).value;
    assert.equal(buffers[0].byteLength, 0); assert.equal(first.view[0], 1);
    const second = (await env.adapter.next()).value; assert.equal(second.view[0], 2);
    assert.equal(buffers[1].byteLength, 0); assert.equal(first.view[0], 1);
    env.adapter.dispose(); await env.adapter.closed; assert.equal(first.view.byteLength, 1);
});

test('copy-only states leave worker buffers attached and selector empty lists are copied', async () => {
    const buffer = new Uint8Array([4]).buffer; let selections = 0;
    const env = setup(function* () { yield { buffer }; new Uint8Array(buffer)[0] = 8; yield 2; }, { transfer: () => { selections++; return []; } });
    const first = (await env.adapter.next()).value; await env.adapter.next();
    assert.equal(new Uint8Array(first.buffer)[0], 4); assert.equal(new Uint8Array(buffer)[0], 8); assert.equal(selections, 2);
    await env.adapter.next(); assert.equal(selections, 2);
});

test('standard cloneable containers and ordinary Error causes remain supported', async () => {
    const env = setup(function* () { yield { error: new Error('state', { cause: { n: 1 } }), date: new Date(12), set: new Set([2]), view: new DataView(new ArrayBuffer(8)) }; });
    const result = (await env.adapter.next()).value;
    assert.equal(result.error.message, 'state'); assert.deepEqual(result.error.cause, { n: 1 });
    assert.equal(result.date.getTime(), 12); assert.ok(result.set.has(2)); assert.equal(result.view.byteLength, 8);
    env.adapter.dispose(); await env.adapter.closed;
});

test('invalid transfer lists and clone failures are terminal without retry or extra pulls', async () => {
    for (const mode of ['duplicate', 'unreachable', 'view', 'detached', 'async', 'function', 'shared', 'nested-shared']) {
        let nexts = 0;
        const env = setup(function* () {
            nexts++; const buffer = new ArrayBuffer(8);
            if (mode === 'function') yield () => {};
            else if (mode === 'shared') yield { buffer: new SharedArrayBuffer(1) };
            else if (mode === 'nested-shared') yield new Map([[1, new Error('cause', { cause: new Uint8Array(new SharedArrayBuffer(1)) })]]);
            else yield { buffer };
        }, { transfer(state) {
            if (mode === 'duplicate') return [state.buffer, state.buffer];
            if (mode === 'unreachable') return [new ArrayBuffer(1)];
            if (mode === 'view') return [new Uint8Array(1)];
            if (mode === 'detached') { structuredClone(state.buffer, { transfer: [state.buffer] }); return [state.buffer]; }
            if (mode === 'async') return Promise.resolve([]);
            return [];
        } });
        await rejected(env.adapter.next(), 'serialization'); await env.adapter.closed;
        assert.equal(nexts, 1, mode); assert.equal(env.link.terminations, 1, mode);
        assert.equal(env.link.sent.filter(p => p.type === 'pull').length, 1, mode);
    }
});

test('input factory exceptions preserve original undefined and cleanup an already owned Worker', async () => {
    let link, session;
    const factory = createWorkerSourceFactory({ worker: () => (link = transport(function* () { yield 1; })).worker, input() { throw undefined; } });
    const adapter = createAsyncSource(signal => (session = factory(signal)));
    await assert.rejects(adapter.next(), error => error === undefined);
    const report = await session.closed;
    assert.equal(report.error, undefined); assert.equal(report.phase, 'input'); assert.equal(report.origin, 'host');
    assert.equal(link.sent.some(p => p.type === 'init'), false); assert.equal(link.terminations, 1);
    assert.equal((await adapter.closed).cleanupErrors.length, 0);
});

test('Worker creation errors keep identity and known handle reuse never disturbs the first owner', async () => {
    const failure = {};
    const factory = createWorkerSourceFactory({ worker() { throw failure; }, input: () => undefined });
    const c = controller(), session = factory(c.signal);
    await assert.rejects(session[Symbol.asyncIterator]().next(), error => error === failure);
    assert.equal((await session.closed).termination.kind, 'not-created');
    const link = transport(function* () { yield 1; yield 2; });
    const shared = createWorkerSourceFactory({ worker: () => link.worker, input: () => undefined });
    const first = createAsyncSource(shared); await first.next();
    const second = createAsyncSource(shared); await assert.rejects(second.next(), /already owned/); await second.closed;
    assert.equal(link.terminations, 0); assert.equal((await first.next()).value, 2);
    first.dispose(); await first.closed; assert.equal(link.terminations, 1);
});

test('remote thrown undefined/function/hostile descriptors are clone-safe and bounded', async () => {
    for (const value of [undefined, () => {}, new Proxy({}, { getPrototypeOf() { throw 1; }, get() { throw 2; } }),
        { get message() { throw 1; }, get name() { throw 2; }, get stack() { throw 3; } },
        Object.assign(new Error('m'.repeat(5000)), { name: 'n'.repeat(200), stack: 's'.repeat(20000) })]) {
        const env = setup(function* () { throw value; });
        await assert.rejects(env.adapter.next(), error => {
            assert.ok(error instanceof WorkerSourceError); assert.equal(error.code, 'remote');
            assert.equal(error.remote.thrownKind, value === undefined ? 'undefined' : typeof value);
            assert.ok(error.remote.name.length <= 128); assert.ok(error.remote.message.length <= 4096); assert.ok(error.remote.stack === null || error.remote.stack.length <= 16384);
            return true;
        });
        await env.adapter.closed; assert.equal(env.link.terminations, 1);
    }
});

test('selector throws are remote transfer failures; malformed iterator protocols are distinguished', async () => {
    const a = setup(function* () { yield 1; }, { transfer() { throw undefined; } });
    await rejected(a.adapter.next(), 'remote', 'transfer'); await a.adapter.closed;
    for (const source of [() => Promise.resolve([]), () => ({ [Symbol.asyncIterator]: 1, *[Symbol.iterator]() { yield 1; } }),
        () => ({ [Symbol.iterator]: () => 1 }), () => ({ [Symbol.iterator]: () => ({ next: () => 1 }) })]) {
        const env = setup(source); await rejected(env.adapter.next(), 'protocol'); await env.adapter.closed;
    }
});

test('cancellation is prompt publicly, serializes return, forwards safe reasons and awaits actual cleanup', async () => {
    const next = deferred(), close = deferred(); let returning = 0, active = 0, localSignal;
    const reason = { noncloneable: () => {} };
    const env = setup((_input, signal) => { localSignal = signal; return { [Symbol.asyncIterator]() { return {
        next() { active++; return next.promise.finally(() => { active--; }); },
        return() { assert.equal(active, 0); returning++; return close.promise; },
    }; } }; }, { grace: 100000 });
    const read = env.adapter.next(); await turn(); env.adapter.dispose(reason);
    assert.deepEqual(await read, { kind: 'cancelled', reason }); await turn(); assert.equal(returning, 0);
    assert.equal(localSignal.aborted, true); assert.deepEqual(localSignal.reason, { kind: 'cancel', message: null });
    let closed = false; env.adapter.closed.then(() => { closed = true; });
    next.resolve({ done: false, value: 'late discarded' }); await turn(); assert.equal(returning, 1); assert.equal(closed, false);
    close.resolve({ done: true }); const report = await env.adapter.closed;
    assert.equal(report.kind, 'disposed'); assert.equal(report.reason, reason); assert.equal(report.lateReadError, null);
    assert.equal((await env.session.closed).termination.kind, 'acknowledged'); assert.equal(env.link.terminations, 1);
});

test('remote abort and return failures reach one outer return cleanup error, not merely lateReadError', async () => {
    const gate = deferred();
    const env = setup((_input, signal) => {
        signal.subscribe(() => { throw new Error('abort'); });
        return { [Symbol.asyncIterator]() { return { next: () => gate.promise, return() { throw new Error('return'); } }; } };
    });
    const read = env.adapter.next(); await turn(); env.adapter.dispose(); await read;
    gate.resolve({ done: false, value: 1 });
    const report = await env.adapter.closed, transportReport = await env.session.closed;
    assert.equal(report.kind, 'disposed'); assert.equal(report.cleanupErrors.length, 1);
    assert.equal(report.cleanupErrors[0].phase, 'return'); assert.equal(report.cleanupErrors[0].error.cleanup.count, 2);
    assert.equal(transportReport.cleanup.count, 2); assert.equal(transportReport.cleanup.first.phase, 'abort-listener');
    assert.equal(transportReport.lateReadError, null); assert.equal(report.lateReadError.error, report.cleanupErrors[0].error);
});

test('genuine late read rejection is diagnostic and does not become a cleanup failure', async () => {
    const gate = deferred();
    const env = setup(() => ({ [Symbol.asyncIterator]: () => ({ next: () => gate.promise, return: () => ({ done: true }) }) }));
    const read = env.adapter.next(); await turn(); env.adapter.dispose('player:restart'); await read;
    gate.reject(new Error('late next'));
    const report = await env.session.closed; assert.equal(report.kind, 'disposed'); assert.equal(report.cleanup.count, 0);
    assert.equal(report.lateReadError.error.remote.message, 'late next');
    assert.equal((await env.adapter.closed).cleanupErrors.length, 0);
});

test('forced deadline is finite, non-extendable, defaulted, and does not falsely confirm acknowledgement', async () => {
    const clock = fakeClock();
    try {
        let link, session;
        const factory = createWorkerSourceFactory({ worker: () => (link = transport(null, { endpoint: false })).worker, input: () => undefined });
        const adapter = createAsyncSource(signal => (session = factory(signal)));
        const read = adapter.next(); adapter.dispose('stop'); await read;
        assert.deepEqual(clock.delays, [1000]); clock.advance(999); assert.equal(link.terminations, 0);
        adapter.dispose('ignored'); clock.advance(1);
        const report = await session.closed; assert.equal(report.termination.kind, 'forced'); assert.equal(report.termination.terminate, 'requested'); assert.equal(report.cleanup.count, 0);
        await adapter.closed; assert.equal(link.terminations, 1); assert.equal(clock.count, 0);
    } finally { clock.restore(); }
});

test('zero/custom/large grace, never-settling return, and termination/teardown failures settle without false success', async () => {
    const clock = fakeClock();
    try {
        for (const grace of [0, 1.5, 3e9]) {
            const env = setup(null, { endpoint: false, grace }); const read = env.adapter.next(); env.adapter.dispose(); await read;
            if (grace > 2147483647) { assert.deepEqual(clock.delays, [2147483647]); clock.advance(2147483647); assert.equal(env.link.terminations, 0); clock.advance(grace - 2147483647); }
            else clock.advance(Math.ceil(grace));
            assert.equal((await env.session.closed).termination.kind, 'forced'); await env.adapter.closed;
        }
        const env = setup(function* () { yield 1; }, { grace: 2, terminateThrows: 'terminate', removeHostThrows: 'remove' });
        await env.adapter.next(); env.adapter.dispose(); await turn();
        const report = await env.session.closed; assert.equal(report.termination.terminate, 'failed'); assert.equal(report.cleanup.count, 4);
        assert.equal(report.cleanup.first.phase, 'terminate'); assert.equal((await env.adapter.closed).cleanupErrors.length, 1);
    } finally { clock.restore(); }
});

test('reentrant owner cancellation during Worker creation still takes and releases the returned handle', async () => {
    const control = controller(); let link, inputs = 0;
    const factory = createWorkerSourceFactory({ worker() { control.abort('during creation'); return (link = transport(null, { endpoint: false })).worker; }, input() { inputs++; }, shutdown: { gracePeriodMs: 0 } });
    const session = factory(control.signal); await session[Symbol.asyncIterator]().next();
    assert.equal((await session.closed).kind, 'disposed'); assert.equal(link.terminations, 1); assert.equal(inputs, 0); assert.equal(control.listeners, 0);
});

test('live protocol validation rejects versions/IDs/duplicates; foreign sessions and namespaces are ignored', async () => {
    for (const mode of ['version', 'request', 'duplicate', 'unsolicited']) {
        const env = setup(null, { endpoint: false }); const read = env.adapter.next();
        const init = env.link.sent[0];
        env.link.reply({ ...init, channel: 'other', type: 'ready' }); env.link.reply({ ...init, session: 'foreign', version: 99 });
        if (mode === 'version') env.link.reply({ ...init, type: 'ready', version: 99 });
        else {
            env.link.reply({ ...init, type: 'ready' }); await turn();
            const reply = { channel: init.channel, version: init.version, session: init.session, type: 'value', request: mode === 'request' ? 2 : 1, value: 1 };
            if (mode === 'unsolicited') reply.type = 'nonsense';
            env.link.reply(reply);
            if (mode === 'duplicate') { await read; env.link.reply(reply); await turn(); }
        }
        if (mode !== 'duplicate') await rejected(read, 'protocol');
        else await rejected(env.adapter.next(), 'protocol');
        await env.adapter.closed; assert.equal(env.link.terminations, 1);
    }
});

test('native errors while idle latch until next pull; load/messageerror fail pending reads', async () => {
    const idle = setup(function* () { yield 1; yield 2; }); await idle.adapter.next(); idle.link.error('idle failure'); await turn();
    await rejected(idle.adapter.next(), 'transport', 'worker'); await idle.adapter.closed;
    const startup = setup(null, { endpoint: false }); const read = startup.adapter.next(); startup.link.error('load failure');
    await rejected(read, 'startup', 'init'); await startup.adapter.closed;
    const broken = setup(null, { endpoint: false }); const other = broken.adapter.next(); broken.link.messageError();
    await rejected(other, 'transport', 'messageerror'); await broken.adapter.closed;
});

test('endpoint installation and public error metadata validate/snapshot without platform side effects', async () => {
    const link = transport(function* () { yield 1; }); const before = link.workerListeners;
    assert.throws(() => exposeWorkerSource({ scope: link.scope, source: () => [] }), /already installed/); assert.equal(link.workerListeners, before);
    for (const grace of [-1, NaN, Infinity]) assert.throws(() => createWorkerSourceFactory({ worker() {}, input() {}, shutdown: { gracePeriodMs: grace } }), RangeError);
    assert.throws(() => createWorkerSourceFactory({ worker() {}, input() {}, shutdown: { gracePeriodMs: '1' } }), TypeError);
    assert.throws(() => createWorkerSourceFactory({ worker() {}, input() {}, shutdown: { gracePeriodMs: null } }), TypeError);
    const descriptor = { phase: 'next', thrownKind: 'undefined', name: 'x', message: 'm', stack: null };
    const error = new WorkerSourceError('remote', { code: 'remote', origin: 'worker', phase: 'next', remote: descriptor }); descriptor.message = 'changed';
    assert.equal(error.remote.message, 'm'); assert.ok(Object.isFrozen(error.remote)); assert.throws(() => { error.phase = 'return'; }, TypeError);
    assert.throws(() => new WorkerSourceError('bad', { code: 'remote', origin: 'host', phase: 'next' }), TypeError);
    assert.throws(() => new WorkerSourceError('bad', { code: 'cleanup', origin: 'host', phase: 'return', cleanup: { count: -1, first: null } }), RangeError);
    const control = controller(); control.abort(undefined);
    const session = createWorkerSourceFactory({ worker() { throw 1; }, input() {} })(control.signal);
    assert.equal((await session.closed).termination.kind, 'not-created');
});

test('an uncooperative return is force-terminated, and subsequent late messages cannot reopen closed', async () => {
    const clock = fakeClock();
    try {
        let returns = 0;
        const env = setup(() => ({ [Symbol.iterator]: () => ({ next: () => ({ done: false, value: 1 }), return() { returns++; return new Promise(() => {}); } }) }), { grace: 4 });
        await env.adapter.next(); env.adapter.dispose(); await turn(); assert.equal(returns, 1);
        let settled = false; env.adapter.closed.then(() => { settled = true; }); await turn(); assert.equal(settled, false);
        clock.advance(4); await env.adapter.closed;
        const report = await env.session.closed; assert.equal(report.termination.kind, 'forced'); assert.equal(report.cleanup.count, 0);
        env.link.reply({ ...env.link.sent[0], type: 'closed', cleanup: { count: 0, first: null } }); await turn();
        assert.equal(await env.session.closed, report); assert.equal(env.link.terminations, 1); assert.equal(clock.count, 0);
    } finally { clock.restore(); }
});

test('nonterminal return and worker-side teardown errors are actual cleanup failures even after acknowledgement', async () => {
    for (const mode of ['return', 'teardown']) {
        const env = setup(() => ({ [Symbol.iterator]: () => ({ next: () => ({ done: false, value: 1 }), return: () => ({ done: false, value: 2 }) }) }),
            mode === 'teardown' ? { removeWorkerThrows: 'worker teardown' } : {});
        await env.adapter.next(); env.adapter.dispose();
        const report = await env.session.closed;
        assert.equal(report.termination.kind, 'acknowledged'); assert.equal(report.cleanup.count, mode === 'teardown' ? 3 : 1);
        assert.equal(report.cleanup.first.error.code, 'protocol');
        assert.equal((await env.adapter.closed).cleanupErrors.length, 1);
    }
});

test('owner cancellation before a queued natural EOF preserves disposed while still accepting the release acknowledgement', async () => {
    const gate = deferred(); let returns = 0;
    const env = setup(() => ({ [Symbol.asyncIterator]: () => ({ next: () => gate.promise, return() { returns++; return { done: true }; } }) }));
    const read = env.adapter.next(); await turn();
    gate.resolve({ done: true }); env.adapter.dispose('cancel wins');
    assert.deepEqual(await read, { kind: 'cancelled', reason: 'cancel wins' });
    const report = await env.session.closed;
    assert.equal(report.kind, 'disposed'); assert.equal(report.termination.kind, 'acknowledged'); assert.equal(returns, 0);
    assert.equal((await env.adapter.closed).cleanupErrors.length, 0);
});

test('acknowledged cleanup clears its deadline permanently and cannot cause a second termination', async () => {
    const clock = fakeClock();
    try {
        const env = setup(function* () { yield 1; }, { grace: 1000 });
        await env.adapter.next(); env.adapter.dispose(); await env.adapter.closed;
        assert.equal(clock.count, 0); clock.advance(10000);
        assert.equal(env.link.terminations, 1); assert.equal((await env.session.closed).termination.kind, 'acknowledged');
    } finally { clock.restore(); }
});

test('per-session inputs/workers are fresh and configuration is snapshotted', async () => {
    const links = []; let inputs = 0;
    const options = { worker: () => { const link = transport(function* (input) { yield input; }); links.push(link); return link.worker; }, input: () => ++inputs, shutdown: { gracePeriodMs: 10 } };
    const factory = createWorkerSourceFactory(options);
    options.worker = () => { throw new Error('mutated'); }; options.input = () => 99; options.shutdown.gracePeriodMs = Infinity;
    const first = createAsyncSource(factory), second = createAsyncSource(factory);
    assert.equal((await first.next()).value, 1); assert.equal((await second.next()).value, 2);
    first.dispose(); second.dispose(); await Promise.all([first.closed, second.closed]);
    assert.equal(links.length, 2); assert.deepEqual(links.map(l => l.terminations), [1, 1]);
});

test('direct iterator rejects concurrent/input-free misuse without queued work and has mandatory idempotent return', async () => {
    const gate = deferred(), control = controller(); let link;
    const factory = createWorkerSourceFactory({ worker: () => (link = transport(() => ({ [Symbol.asyncIterator]: () => ({ next: () => gate.promise, return: () => ({ done: true }) }) }))).worker, input() {} });
    const session = factory(control.signal), iterator = session[Symbol.asyncIterator]();
    const read = iterator.next(); await turn(); await rejected(iterator.next(), 'protocol', 'next');
    assert.equal(link.sent.filter(p => p.type === 'pull').length, 1); assert.equal('throw' in iterator, false);
    control.abort(); gate.resolve({ done: false, value: 1 }); await read; await iterator.return(); await iterator.return();
    assert.equal(link.terminations, 1);
});
