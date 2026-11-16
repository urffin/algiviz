import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAsyncSource } from '@grundyjs/algiviz/playback';
import { createWorkerSourceFactory, WorkerSourceError } from '@grundyjs/algiviz/worker';
import { Player } from '@grundyjs/algiviz/player';
import { controller, deferred, fakeClock, transport, turn } from './worker-test-transport.mjs';
import { dom, shell } from './player-test-dom.mjs';

// Box rejections: returning the thrown object from a promise callback could
// assimilate its `then`, and assert.rejects itself inspects some thrown values.
const outcome = promise => promise.then(value => ({ value }), error => ({ error }));
async function rejectsSame(promise, expected) {
    const box = await outcome(promise);
    assert.ok(Object.hasOwn(box, 'error'), 'Expected rejection');
    assert.ok(Object.is(box.error, expected), 'Original thrown value must be preserved');
}
async function pending(promise) {
    let settled = false; promise.then(() => { settled = true; }, () => { settled = true; });
    await turn(); assert.equal(settled, false, 'Cleanup must still be pending');
}
function errorValues() {
    const record = { inspections: 0 };
    const hostile = () => { record.inspections++; throw new Error('Do not inspect the thrown value'); };
    return [
        ['Error', new Error('post')], ['DOMException', new DOMException('post', 'InvalidStateError')],
        ['DataCloneError', new DOMException('post', 'DataCloneError')], ['AbortError', new DOMException('post', 'AbortError')],
        ['undefined', undefined], ['null', null], ['false', false], ['zero', 0], ['negative zero', -0],
        ['NaN', NaN], ['empty string', ''], ['symbol', Symbol('post')], ['bigint', 1n],
        ['frozen object', Object.freeze({ application: true })],
        ['hostile object', new Proxy({}, { get: hostile, getPrototypeOf: hostile, ownKeys: hostile, set: hostile, defineProperty: hostile }), record],
        ['WorkerSourceError', new WorkerSourceError('application tag', { code: 'protocol', origin: 'worker', phase: 'next' })],
    ];
}

function fixture(options = {}) {
    const clock = fakeClock(), control = controller(), cleanupGate = deferred(), readGate = deferred();
    const faults = { ...options.faults }, attempts = [];
    const stats = { factories: 0, inputs: 0, reads: 0, returns: 0, aborts: 0 };
    const f = { clock, control, cleanupGate, readGate, faults, attempts, stats, getterFault: null };
    const factory = createWorkerSourceFactory({
        worker() {
            stats.factories++;
            if (Object.hasOwn(options, 'workerError')) throw options.workerError;
            const source = options.source ?? ((_input, signal) => {
                signal.subscribe(() => { stats.aborts++; });
                return { [Symbol.asyncIterator]() { return {
                    next() {
                        stats.reads++;
                        if (options.wait && stats.reads > (options.firstReady ? 1 : 0)) return readGate.promise;
                        return stats.reads <= 2 ? { value: stats.reads, done: false } : { done: true };
                    },
                    return() { stats.returns++; return options.deferCleanup ? cleanupGate.promise : { done: true }; },
                }; } };
            });
            const link = f.link = transport(source, options.transport);
            const listeners = new Map(), add = link.worker.addEventListener;
            link.worker.addEventListener = (type, listener) => {
                if (!listeners.has(type)) listeners.set(type, []);
                listeners.get(type).push(listener); add(type, listener);
            };
            f.dispatch = (type, event) => { for (const listener of listeners.get(type) ?? []) listener(event); };
            const original = link.worker.postMessage;
            const post = (packet, list) => {
                attempts.push(packet.type);
                options.beforePost?.(packet, f);
                if (Object.hasOwn(faults, packet.type)) throw faults[packet.type];
                const result = original(packet, list);
                options.afterPost?.(packet, f);
                return result;
            };
            Object.defineProperty(link.worker, 'postMessage', { configurable: true, get() {
                if (f.getterFault) { const fault = f.getterFault; f.getterFault = null; throw fault.error; }
                return post;
            } });
            if (Object.hasOwn(options, 'createGetterError')) f.getterFault = { error: options.createGetterError };
            return link.worker;
        },
        input() {
            stats.inputs++;
            if (Object.hasOwn(options, 'inputError')) throw options.inputError;
            if (Object.hasOwn(options, 'initGetterError')) f.getterFault = { error: options.initGetterError };
            return Object.hasOwn(options, 'input') ? options.input : null;
        },
        shutdown: { gracePeriodMs: 10 },
    });
    const wrap = signal => {
        f.session = factory(signal); f.iterator = f.session[Symbol.asyncIterator](); return f.session;
    };
    f.wrap = wrap;
    f.adapter = options.direct || options.externalOwner ? null : createAsyncSource(wrap);
    if (options.direct) wrap(control.signal);
    f.next = () => (f.adapter ?? f.iterator).next();
    f.cancel = reason => f.adapter ? f.adapter.dispose(reason) : control.abort(reason);
    f.finish = async () => { clock.advance(20); await turn(); return f.session.closed; };
    f.close = async () => {
        f.adapter?.dispose(); control.abort();
        const returned = f.iterator ? outcome(f.iterator.return()) : null;
        readGate.resolve({ done: true }); cleanupGate.resolve({ done: true });
        clock.advance(100); await turn();
        if (returned) await returned;
        if (f.adapter) await f.adapter.closed;
        clock.restore();
    };
    return f;
}
async function run(options, action) {
    const f = fixture(options);
    try { await action(f); } finally { await f.close(); }
}
function primary(report, error, phase = 'post') {
    assert.equal(report.kind, 'failed'); assert.ok(Object.is(report.error, error));
    assert.equal(report.origin, 'host'); assert.equal(report.phase, phase);
}
function released(f, report) {
    assert.ok(Object.isFrozen(report)); assert.ok(Object.isFrozen(report.cleanup));
    assert.equal(f.link.terminations, 1); assert.equal(f.link.hostListeners, 0);
    assert.equal(f.link.workerListeners, 0); assert.equal(f.control.listeners, 0); assert.equal(f.clock.count, 0);
    assert.equal(f.stats.factories, 1);
}

for (const role of ['init', 'pull']) for (const [label, error, record] of errorValues()) {
    test(`U5 ${role}: preserve ${label} in public rejection, subsequent next and transport/outer reports`, async () => {
        const keys = ['Error', 'DOMException', 'DataCloneError', 'AbortError', 'WorkerSourceError'].includes(label) ? Reflect.ownKeys(error) : null;
        await run({ faults: { [role]: error }, deferCleanup: true }, async f => {
            const read = f.next(), closed = f.session.closed;
            await rejectsSame(read, error);
            if (role === 'pull') await pending(closed);
            assert.equal(f.session.closed, closed); assert.equal(f.attempts.filter(type => type === role).length, 1);
            await rejectsSame(f.iterator.next(), error);
            const report = await f.finish(); primary(report, error);
            assert.equal(report.cleanup.count, 0); assert.equal(report.cleanup.first, null); assert.equal(report.lateReadError, null);
            const outer = await f.adapter.closed; assert.equal(outer.kind, 'failed'); assert.ok(Object.is(outer.error, error));
            assert.deepEqual(outer.cleanupErrors, []); assert.equal(outer.lateReadError, null);
            assert.deepEqual(await f.iterator.return(), { done: true, value: undefined });
            assert.deepEqual(await f.iterator.return(), { done: true, value: undefined });
            released(f, report); if (keys) assert.deepEqual(Reflect.ownKeys(error), keys);
            if (record) assert.equal(record.inspections, 0);
        });
    });
}

for (const [label, error, record] of errorValues()) {
    test(`U5 cancel: preserve ${label} as cleanup for direct transport and outer cancellation`, async () => {
        for (const direct of [true, false]) await run({ direct, wait: true, faults: { cancel: error } }, async f => {
            const read = outcome(f.next()); await turn(); const reason = { owner: 'dispose' };
            f.cancel(reason); if (!direct) assert.deepEqual((await read).value, { kind: 'cancelled', reason });
            await pending(f.session.closed);
            const returning = outcome(f.iterator.return()); f.cancel('ignored');
            const report = await f.finish(); assert.equal(report.kind, 'disposed'); assert.equal(report.reason, reason);
            assert.equal(report.cleanup.count, 1); assert.equal(report.cleanup.first.origin, 'host');
            assert.equal(report.cleanup.first.phase, 'post'); assert.ok(Object.is(report.cleanup.first.error, error));
            assert.ok(Object.isFrozen(report.cleanup.first)); assert.equal(report.lateReadError, null);
            const wrapper = (await returning).error; assert.ok(wrapper instanceof WorkerSourceError);
            assert.equal(wrapper.code, 'cleanup'); assert.equal(wrapper.origin, 'host'); assert.equal(wrapper.phase, 'post');
            assert.equal(wrapper.remote, null); assert.ok(Object.is(wrapper.cleanup.first.error, error));
            if (direct) assert.equal((await read).error, wrapper);
            else {
                const outer = await f.adapter.closed; assert.equal(outer.kind, 'disposed'); assert.equal(outer.reason, reason);
                assert.equal(outer.cleanupErrors.length, 1); assert.equal(outer.cleanupErrors[0].phase, 'return');
                assert.equal(outer.cleanupErrors[0].error, wrapper); assert.equal(outer.lateReadError.error, wrapper);
            }
            await rejectsSame(f.iterator.return(), wrapper); assert.equal(f.attempts.filter(type => type === 'cancel').length, 1);
            assert.equal(report.termination.kind, 'forced'); released(f, report);
            if (record) assert.equal(record.inspections, 0);
        });
    });
}

for (const role of ['init', 'pull']) for (const value of ['undefined', 'Error', 'same object']) {
    test(`U5 ${role}: primary ${value} survives cancel, terminate and listener teardown failures`, async () => {
        const error = value === 'undefined' ? undefined : new Error('primary');
        const cancel = value === 'same object' ? error : new Error('cancel');
        const terminate = new Error('terminate'), teardown = new Error('remove listener');
        await run({ faults: { [role]: error, cancel }, transport: { terminateThrows: terminate, removeHostThrows: teardown } }, async f => {
            await rejectsSame(f.next(), error); const report = await f.finish(); primary(report, error);
            assert.equal(report.cleanup.count, 5); assert.ok(Object.is(report.cleanup.first.error, cancel));
            assert.equal(report.cleanup.first.phase, 'post'); assert.equal(report.termination.terminate, 'failed');
            const outer = await f.adapter.closed; assert.ok(Object.is(outer.error, error));
            assert.equal(outer.cleanupErrors.length, 1); const wrapper = outer.cleanupErrors[0].error;
            assert.equal(wrapper.code, 'cleanup'); assert.equal(wrapper.cleanup.count, 5);
            assert.ok(Object.is(wrapper.cleanup.first.error, cancel)); await rejectsSame(f.iterator.return(), wrapper);
            assert.equal(f.link.terminations, 1); assert.equal(f.clock.count, 0);
        });
    });
}

for (const role of ['init', 'pull']) for (const cancellation of ['abort', 'return']) {
    test(`U5 ${role}: ${cancellation} observed before undefined throw wins and records one late issue`, async () => {
        const reason = { cancel: true }; let returning;
        await run({ direct: true, deferCleanup: true, beforePost(packet, f) {
            if (packet.type === role) {
                if (cancellation === 'abort') f.control.abort(reason); else returning = outcome(f.iterator.return());
                throw undefined;
            }
        } }, async f => {
            const read = outcome(f.next()); await turn(); const report = await f.finish();
            assert.equal(report.kind, 'disposed'); assert.equal(report.reason, cancellation === 'abort' ? reason : undefined);
            assert.notEqual(report.lateReadError, null); assert.equal(report.lateReadError.origin, 'host');
            assert.equal(report.lateReadError.phase, 'post'); assert.equal(report.lateReadError.error, undefined);
            assert.equal(report.cleanup.count, 0); assert.deepEqual((await read).value, { done: true, value: undefined });
            if (returning) assert.ok(Object.hasOwn(await returning, 'value')); released(f, report);
        });
    });
}

for (const phase of ['create', 'init', 'pull', 'cancel']) {
    test(`U5 ${phase}: postMessage getter failure keeps the acquisition/send phase boundary`, async () => {
        const error = undefined;
        const options = phase === 'create' ? { createGetterError: error } : phase === 'init' ? { initGetterError: error } : {};
        await run({ ...options, deferCleanup: true }, async f => {
            if (phase === 'pull' || phase === 'cancel') {
                assert.equal((await f.next()).value, 1); f.getterFault = { error };
            }
            if (phase === 'cancel') f.cancel('stop'); else await rejectsSame(f.next(), error);
            const report = await f.finish();
            if (phase === 'cancel') { assert.equal(report.kind, 'disposed'); assert.equal(report.cleanup.count, 1); assert.equal(report.cleanup.first.phase, 'post'); assert.equal(report.cleanup.first.error, error); }
            else primary(report, error, phase === 'create' ? 'create' : 'post');
            assert.equal(f.link.terminations, 1);
        });
    });
}

for (const phase of ['create', 'input', 'serialize']) {
    test(`U5 controls: ${phase} errors retain their pre-post classification`, async () => {
        const error = new Error(phase);
        const options = phase === 'create' ? { workerError: error } : phase === 'input' ? { inputError: error } : { input: () => {} };
        await run(options, async f => {
            const box = await outcome(f.next()); assert.ok(Object.hasOwn(box, 'error'));
            if (phase === 'serialize') { assert.ok(box.error instanceof WorkerSourceError); assert.equal(box.error.code, 'serialization'); }
            else assert.equal(box.error, error);
            const report = await f.finish(); primary(report, box.error, phase);
            assert.equal(f.attempts.includes('init'), false);
            if (phase === 'create') assert.deepEqual(report.termination, { kind: 'not-created' });
        });
    });
}

test('U5 cleanup summary uses the first issue even when cancel posting is a later issue', async () => {
    const earlier = new WorkerSourceError('earlier diagnostic', { code: 'protocol', origin: 'host', phase: 'protocol' });
    const cancel = new Error('cancel');
    await run({ direct: true, wait: true, beforePost(packet, f) {
        if (packet.type === 'cancel') {
            // During closing, reentrant data access reports a protocol cleanup
            // issue before this same post call throws.
            const event = { get data() { throw earlier; } };
            f.dispatch('message', event);
        }
    }, faults: { cancel } }, async f => {
        const read = outcome(f.next()); await turn(); f.cancel();
        const report = await f.finish();
        assert.equal(report.cleanup.count, 2); assert.equal(report.cleanup.first.phase, 'protocol');
        assert.equal(report.cleanup.first.error.code, 'protocol');
        const wrapper = (await read).error;
        assert.equal(wrapper.code, 'cleanup'); assert.equal(wrapper.phase, 'protocol');
        assert.equal(wrapper.cleanup.count, 2); assert.equal(wrapper.cleanup.first.error, report.cleanup.first.error);
    });
});

test('U5 successful copied/transferred states and EOF need no cancel and keep completed reports frozen', async () => {
    const buffer = new Uint8Array([3, 7]).buffer;
    await run({ source: function* () { yield { copied: new Uint8Array([9]).buffer }; yield { buffer }; },
        transport: { transfer: state => state.buffer ? [state.buffer] : [] } }, async f => {
        const first = await f.next(); assert.equal(first.kind, 'value'); assert.deepEqual([...new Uint8Array(first.value.copied)], [9]);
        const second = await f.next(); assert.deepEqual([...new Uint8Array(second.value.buffer)], [3, 7]); assert.equal(buffer.byteLength, 0);
        assert.deepEqual(await f.next(), { kind: 'done' }); const report = await f.session.closed;
        assert.equal(report.kind, 'completed'); assert.equal(report.cleanup.count, 0); assert.equal(report.lateReadError, null);
        assert.equal(f.attempts.includes('cancel'), false); assert.equal(report.termination.kind, 'acknowledged');
        const attempts = [...f.attempts]; await f.iterator.return(); f.cancel('late');
        f.link.reply({ ...f.link.sent[0], type: 'error' }); f.clock.advance(100); await turn();
        assert.equal(await f.session.closed, report); assert.deepEqual(f.attempts, attempts); released(f, report);
    });
});

test('U5 a native-like send that posts then throws is not retried and late data cannot replace its failure', async () => {
    const error = new Error('after posting');
    await run({ afterPost(packet) { if (packet.type === 'pull') throw error; } }, async f => {
        await rejectsSame(f.next(), error); await turn(); const report = await f.finish(); primary(report, error);
        assert.equal(f.attempts.filter(type => type === 'pull').length, 1);
        assert.equal(f.link.sent.filter(packet => packet.type === 'pull').length, 1);
        assert.equal((await f.adapter.closed).error, error); assert.equal(f.link.terminations, 1);
    });
});

for (const role of ['init', 'pull']) {
    test(`U5 ${role}: an earlier observed Worker failure wins over a later raw post throw`, async () => {
        await run({ deferCleanup: true, beforePost(packet, f) {
            if (packet.type === role) { f.dispatch('error', { message: 'earlier Worker event' }); throw undefined; }
        } }, async f => {
            const box = await outcome(f.next()); const error = box.error;
            assert.ok(error instanceof WorkerSourceError); assert.equal(error.origin, 'worker');
            assert.equal(error.code, role === 'init' ? 'startup' : 'transport');
            const report = await f.finish(); assert.equal(report.kind, 'failed'); assert.equal(report.error, error);
            assert.equal(report.origin, 'worker'); assert.equal(report.lateReadError.error, undefined);
            assert.equal(report.lateReadError.origin, 'host'); assert.equal(report.lateReadError.phase, 'post');
            assert.equal(report.cleanup.count, 0); assert.equal((await f.adapter.closed).error, error);
            let reads = 0; f.dispatch('message', { get data() { reads++; throw new Error('late'); } });
            assert.equal(reads, 0); assert.equal(await f.session.closed, report); released(f, report);
        });
    });
}

test('U5 Player: init throw undefined is reported once and Start retries with a fresh Worker after cleanup', async () => {
    await run({ externalOwner: true, faults: { init: undefined } }, async f => {
        const env = dom(), errors = [];
        const ui = new Player(env.container(), { asyncSource: f.wrap, render() {}, onError: error => errors.push(error) });
        try {
            ui.start(); await turn(); assert.equal(ui.status.hasError, true); assert.equal(ui.status.error, undefined);
            assert.deepEqual(errors, [undefined]); const old = f.session, link = f.link;
            f.clock.advance(20); await turn(); primary(await old.closed, undefined);
            delete f.faults.init; ui.start(); await turn();
            assert.equal(ui.status.phase, 'paused'); assert.equal(ui.frame.stepIndex, 0);
            assert.equal(f.stats.factories, 2); assert.equal(errors.length, 1); assert.equal(link.terminations, 1);
        } finally { ui.dispose(); f.clock.advance(20); await ui.closed; }
    });
});

test('U5 Player: pull primary survives cancel cleanup without a second onError and remains in source reports', async () => {
    await run({ externalOwner: true }, async f => {
        const env = dom(), errors = [], primaryError = undefined, secondary = new Error('cancel');
        const ui = new Player(env.container(), { asyncSource: f.wrap, render() {}, onError: error => errors.push(error) });
        try {
            ui.start(); await turn(); const frame = ui.frame;
            f.faults.pull = primaryError; f.faults.cancel = secondary;
            ui.next(); await turn(); assert.equal(ui.status.phase, 'error'); assert.equal(ui.frame, frame);
            assert.equal(ui.status.hasError, true); assert.equal(ui.status.error, primaryError); assert.deepEqual(errors, [primaryError]);
            const transportReport = await f.finish(); primary(transportReport, primaryError);
            assert.equal(transportReport.cleanup.first.error, secondary);
            ui.dispose(); const report = await ui.closed;
            assert.equal(report.sources.length, 0); assert.equal(report.errorCount, 1);
            assert.equal(report.firstError.phase, 'return'); assert.equal(report.firstError.error.code, 'cleanup');
            assert.equal(report.firstError.error.cleanup.first.error, secondary); assert.equal(errors.length, 1);
        } finally { ui.dispose(); f.clock.advance(20); await ui.closed; }
    });
});

test('U5 Player: dispose removes UI immediately; cancel throw reaches closed without late callbacks', async () => {
    await run({ externalOwner: true, firstReady: true, wait: true, faults: { cancel: undefined } }, async f => {
        const env = dom(), host = env.container(), errors = [], frames = [], statuses = [];
        const ui = new Player(host, { asyncSource: f.wrap, render: frame => frames.push(frame),
            onError: error => errors.push(error), onStatus: status => statuses.push(status) });
        try {
            ui.start(); await turn(); ui.next(); await turn(); const frame = ui.frame;
            ui.dispose(); assert.equal(shell(host), undefined); assert.equal(ui.frame, frame); assert.equal(ui.status.phase, 'disposed');
            const counts = [frames.length, statuses.length, errors.length]; await pending(ui.closed);
            await f.finish(); const report = await ui.closed;
            assert.equal(report.sources.length, 1); assert.equal(report.sources[0].kind, 'disposed');
            assert.equal(report.sources[0].reason, 'player:dispose'); assert.equal(report.errorCount, 1);
            const wrapper = report.firstError.error; assert.equal(wrapper.code, 'cleanup');
            assert.equal(wrapper.cleanup.first.phase, 'post'); assert.equal(wrapper.cleanup.first.error, undefined);
            assert.equal(report.sources[0].cleanupErrors[0].error, wrapper);
            assert.deepEqual([frames.length, statuses.length, errors.length], counts); assert.equal(errors.length, 0);
            assert.equal(f.link.terminations, 1); assert.equal(f.clock.count, 0);
        } finally { ui.dispose(); f.clock.advance(20); await ui.closed; }
    });
});

test('U5 a cancel send that posts then throws can acknowledge while preserving its actual cleanup failure', async () => {
    const error = new Error('cancel after posting');
    await run({ afterPost(packet) { if (packet.type === 'cancel') throw error; } }, async f => {
        assert.equal((await f.next()).value, 1); f.cancel('stop');
        const report = await f.session.closed; assert.equal(report.kind, 'disposed');
        assert.equal(report.termination.kind, 'acknowledged'); assert.equal(report.cleanup.count, 1);
        assert.equal(report.cleanup.first.error, error); assert.equal(report.cleanup.first.phase, 'post');
        const outer = await f.adapter.closed; assert.equal(outer.kind, 'disposed'); assert.equal(outer.reason, 'stop');
        assert.equal(outer.cleanupErrors[0].error.cleanup.first.error, error);
        assert.equal(f.attempts.filter(type => type === 'cancel').length, 1);
        assert.equal(f.link.sent.filter(packet => packet.type === 'cancel').length, 1); released(f, report);
    });
});

test('U5 Player: Restart waits old cancel failure, retains its frame and releases the uninstalled candidate', async () => {
    await run({ externalOwner: true }, async f => {
        const env = dom(), errors = [], sessions = [], links = [];
        const ui = new Player(env.container(), { asyncSource(signal) {
            const session = f.wrap(signal); sessions.push(session); return session;
        }, render() {}, onError: error => errors.push(error) });
        try {
            ui.start(); await turn(); const frame = ui.frame; links.push(f.link);
            const error = new Error('cancel old'); f.faults.cancel = error;
            ui.restart(); await turn(); links.push(f.link);
            assert.equal(sessions.length, 2); assert.equal(ui.status.preparing, 'restart');
            assert.equal(ui.status.cleanupPending, true); assert.equal(ui.frame, frame); assert.deepEqual(errors, []);
            f.clock.advance(20); await turn();
            assert.equal(ui.status.phase, 'error'); assert.equal(ui.frame, frame); assert.equal(errors.length, 1);
            const wrapper = errors[0]; assert.equal(wrapper.code, 'cleanup'); assert.equal(wrapper.cleanup.first.error, error);
            assert.equal(wrapper.phase, 'post'); assert.equal(ui.status.error, wrapper);
            f.clock.advance(20); await turn();
            const reports = await Promise.all(sessions.map(session => session.closed));
            for (const report of reports) { assert.equal(report.kind, 'disposed'); assert.equal(report.cleanup.count, 1); assert.equal(report.cleanup.first.error, error); }
            assert.deepEqual(links.map(link => link.terminations), [1, 1]);
            assert.equal(ui.status.preparing, null); assert.equal(ui.status.cleanupPending, false);
            ui.dispose(); const report = await ui.closed; assert.equal(report.errorCount, 2);
            assert.equal(report.firstError.error, wrapper); assert.equal(errors.length, 1);
        } finally { ui.dispose(); f.clock.advance(100); await ui.closed; }
    });
});
