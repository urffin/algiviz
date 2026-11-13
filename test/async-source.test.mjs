import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAsyncSource } from '@grundyjs/algiviz/playback';

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
const turn = () => new Promise(resolve => setImmediate(resolve));
async function stillPending(promise) {
    let settled = false;
    promise.then(() => { settled = true; }, () => { settled = true; });
    await turn();
    assert.equal(settled, false);
}
function tracked(next, finish = () => ({ done: true })) {
    let reads = 0, returns = 0, acquisitions = 0;
    const iterator = {
        next() { assert.equal(this, iterator); reads++; return next(reads); },
        ...(finish === null ? {} : { return() { assert.equal(this, iterator); returns++; return finish(); } }),
    };
    const iterable = { [Symbol.asyncIterator]() { assert.equal(this, iterable); acquisitions++; return iterator; } };
    return { iterable, iterator, get reads() { return reads; }, get returns() { return returns; },
        get acquisitions() { return acquisitions; } };
}

test('async source is lazy, validates its factory and exposes stable readonly handles', async () => {
    for (const value of [undefined, null, 1, {}, [], Promise.resolve(1)])
        assert.throws(() => createAsyncSource(value), TypeError);
    let factories = 0;
    const input = createAsyncSource(() => { factories++; throw new Error('unused'); });
    assert.equal(input.signal, input.signal); assert.equal(input.closed, input.closed);
    assert.equal(input.waiting, false); assert.equal(input.signal.aborted, false);
    assert.equal(input.signal.reason, undefined); assert.ok(Object.isFrozen(input));
    assert.ok(Object.isFrozen(input.signal)); assert.equal(Symbol.asyncIterator in input, false);
    await stillPending(input.closed); assert.equal(factories, 0);
    const reason = { action: 'unmount' };
    input.dispose(reason); input.dispose('ignored');
    assert.equal(factories, 0); assert.equal(input.signal.aborted, true); assert.equal(input.signal.reason, reason);
    assert.deepEqual(await input.next(), { kind: 'cancelled', reason });
    assert.deepEqual(await input.closed, { kind: 'disposed', reason, cleanupErrors: [], lateReadError: null });
});

test('one deferred read is shared without prefetch; EOF is discovered by an additional request', async () => {
    const gate = deferred(), value = { x: 1 };
    const origin = tracked(n => n === 1 ? gate.promise : { done: true, value: 'ignored' });
    let factories = 0;
    const input = createAsyncSource(signal => { factories++; assert.equal(signal, input.signal); return origin.iterable; });
    const first = input.next();
    for (let i = 0; i < 20; i++) assert.equal(input.next(), first);
    assert.equal(input.waiting, true); assert.equal(factories, 1);
    assert.equal(origin.acquisitions, 1); assert.equal(origin.reads, 1);
    await stillPending(first); gate.resolve({ value });
    const result = await first;
    assert.equal(input.waiting, false); assert.equal(result.kind, 'value'); assert.equal(result.value, value);
    assert.equal(Object.isFrozen(value), false); assert.equal(origin.reads, 1);
    await stillPending(input.closed);
    assert.deepEqual(await input.next(), { kind: 'done' });
    assert.deepEqual(await input.next(), { kind: 'done' });
    input.dispose('too late'); assert.equal(input.signal.aborted, false);
    assert.deepEqual(await input.closed, { kind: 'completed', cleanupErrors: [], lateReadError: null });
    assert.equal(origin.reads, 2); assert.equal(origin.returns, 0);
});

test('native async generators preserve arbitrary state references, undefined and natural finally', async () => {
    const values = [undefined, null, NaN, Symbol('state'), { count: 1 }, () => {}];
    let finalized = 0;
    const input = createAsyncSource(async function* () {
        try { yield* values; return 'not a state'; } finally { finalized++; }
    });
    for (const value of values) {
        const item = await input.next(); assert.equal(item.kind, 'value'); assert.equal(item.value, value);
    }
    assert.equal(finalized, 0); assert.deepEqual(await input.next(), { kind: 'done' });
    assert.equal((await input.closed).kind, 'completed'); assert.equal(finalized, 1);
});

test('empty async sources reject with RangeError but do not return an already ended iterator', async () => {
    const origin = tracked(() => ({ done: true }));
    const input = createAsyncSource(() => origin.iterable);
    let error;
    await assert.rejects(input.next(), caught => { error = caught; return caught instanceof RangeError; });
    await assert.rejects(input.next(), caught => caught === error);
    const report = await input.closed;
    assert.equal(report.kind, 'failed'); assert.equal(report.error, error);
    assert.equal(input.signal.reason, error); assert.equal(input.signal.aborted, true);
    assert.equal(origin.reads, 1); assert.equal(origin.returns, 0);
});

test('factory/acquisition/read failures preserve the original error including undefined', async () => {
    for (const error of [new Error('source'), undefined, null, 'failure']) {
        for (const stage of ['factory', 'acquire', 'next-getter', 'next-call', 'next-reject']) {
            let returns = 0;
            const iterator = { return() { returns++; throw new Error('secondary'); } };
            Object.defineProperty(iterator, 'next', { get() {
                if (stage === 'next-getter') throw error;
                return () => { if (stage === 'next-call') throw error; return Promise.reject(error); };
            } });
            const input = createAsyncSource(() => {
                if (stage === 'factory') throw error;
                return { [Symbol.asyncIterator]() { if (stage === 'acquire') throw error; return iterator; } };
            });
            await assert.rejects(input.next(), caught => Object.is(caught, error));
            input.dispose('cannot replace failure');
            const report = await input.closed;
            assert.equal(report.kind, 'failed'); assert.equal(report.error, error);
            assert.equal(input.signal.aborted, true); assert.equal(input.signal.reason, error);
            assert.equal(returns, stage.startsWith('next') ? 1 : 0);
            assert.equal(report.cleanupErrors.length, returns);
            await assert.rejects(input.next(), caught => Object.is(caught, error));
        }
    }
});

test('invalid async protocols fail the read and clean up an acquired iterator', async () => {
    const cases = [
        () => null, () => [1], () => Promise.resolve([1]),
        () => ({ [Symbol.asyncIterator]: 1 }),
        () => ({ [Symbol.asyncIterator]() { return null; } }),
    ];
    for (const factory of cases) {
        const input = createAsyncSource(factory);
        await assert.rejects(input.next(), TypeError);
        assert.equal((await input.closed).kind, 'failed');
    }
    for (const next of [null, () => null, () => 1, () => ({ get done() { throw new TypeError('done'); } }),
        () => ({ done: false, get value() { throw new TypeError('value'); } })]) {
        let returns = 0;
        const input = createAsyncSource(() => ({ [Symbol.asyncIterator]() {
            return { next, return() { returns++; return { done: true }; } };
        } }));
        await assert.rejects(input.next(), TypeError);
        assert.equal((await input.closed).kind, 'failed'); assert.equal(returns, 1);
    }
});

test('an active AbortError is a source failure, not evidence of owner cancellation', async () => {
    const error = Object.assign(new Error('external abort'), { name: 'AbortError' });
    const origin = tracked(() => Promise.reject(error));
    const input = createAsyncSource(() => origin.iterable);
    await assert.rejects(input.next(), caught => caught === error);
    assert.equal((await input.closed).kind, 'failed'); assert.equal(origin.returns, 1);
});

test('dispose promptly cancels the shared public read and waits for serialized next/return cleanup', async () => {
    const reading = deferred(), finishing = deferred();
    const origin = tracked(() => reading.promise, () => finishing.promise);
    const input = createAsyncSource(() => origin.iterable);
    const request = input.next(); const shared = input.next();
    input.dispose('restart'); input.dispose('ignored');
    assert.equal(input.waiting, false); assert.equal(input.signal.aborted, true);
    assert.deepEqual(await request, { kind: 'cancelled', reason: 'restart' });
    assert.equal(request, shared); assert.equal(origin.returns, 0);
    assert.deepEqual(await input.next(), { kind: 'cancelled', reason: 'restart' });
    await stillPending(input.closed);
    reading.resolve({ done: false, get value() { assert.fail('late values must not be read'); } });
    await turn(); assert.equal(origin.returns, 1); await stillPending(input.closed);
    finishing.resolve({ done: true });
    assert.deepEqual(await input.closed, { kind: 'disposed', reason: 'restart', cleanupErrors: [], lateReadError: null });
    assert.equal(origin.reads, 1); assert.equal(origin.returns, 1);
});

test('late read rejections are boxed diagnostics, distinct from actual cleanup failures', async () => {
    for (const error of [undefined, new Error('late'), Object.assign(new Error('abort'), { name: 'AbortError' })]) {
        const reading = deferred(), cleanup = new Error('return');
        const origin = tracked(() => reading.promise, () => Promise.reject(cleanup));
        const input = createAsyncSource(() => origin.iterable);
        const request = input.next(); input.dispose();
        assert.deepEqual(await request, { kind: 'cancelled', reason: undefined });
        reading.reject(error);
        const report = await input.closed;
        assert.equal(report.kind, 'disposed'); assert.deepEqual(report.lateReadError, { error });
        assert.deepEqual(report.cleanupErrors, [{ phase: 'return', error: cleanup }]);
        assert.equal(origin.returns, 1);
    }
});

test('late natural EOF skips return while malformed late results remain diagnostic', async () => {
    const cases = [{ result: { done: true }, ended: true }, { result: null, ended: false },
        { result: { get done() { throw undefined; } }, ended: false }];
    for (const { result, ended } of cases) {
        const reading = deferred(), origin = tracked(() => reading.promise);
        const input = createAsyncSource(() => origin.iterable);
        const request = input.next(); input.dispose('leave'); await request;
        reading.resolve(result);
        const report = await input.closed;
        assert.equal(report.kind, 'disposed'); assert.deepEqual(report.cleanupErrors, []);
        if (ended) { assert.equal(origin.returns, 0); assert.equal(report.lateReadError, null); }
        else { assert.equal(origin.returns, 1); assert.notEqual(report.lateReadError, null); }
    }
});

test('disposal cannot recall settled values; disposing before processing a result wins cancellation', async () => {
    const origin = tracked(() => ({ value: 7 }));
    const input = createAsyncSource(() => origin.iterable);
    const request = input.next(); assert.deepEqual(await request, { kind: 'value', value: 7 });
    input.dispose('after'); assert.deepEqual(await request, { kind: 'value', value: 7 });
    assert.equal((await input.closed).kind, 'disposed');
    const gate = deferred(), other = createAsyncSource(() => tracked(() => gate.promise).iterable);
    const pending = other.next(); gate.resolve({ value: 9 }); other.dispose('before');
    assert.deepEqual(await pending, { kind: 'cancelled', reason: 'before' }); await other.closed;
});

test('failure rejects promptly while return is pending and later dispose cannot change the outcome', async () => {
    const finishing = deferred(), error = new Error('primary');
    const origin = tracked(() => { throw error; }, () => finishing.promise);
    const input = createAsyncSource(() => origin.iterable);
    await assert.rejects(input.next(), caught => caught === error);
    await stillPending(input.closed); input.dispose('ignored');
    assert.equal(input.signal.reason, error); finishing.resolve({ done: true });
    assert.equal((await input.closed).kind, 'failed');
});

test('return failures and invalid/nonterminal returns are cleanup errors, not new source failures', async () => {
    const failure = new Error('return getter');
    for (const finish of [() => { throw failure; }, () => Promise.reject(failure), () => null,
        () => ({}), () => ({ done: false, value: 1 }), () => ({ get done() { throw failure; } })]) {
        const origin = tracked(() => ({ value: 1 }), finish);
        const input = createAsyncSource(() => origin.iterable); await input.next();
        assert.doesNotThrow(() => input.dispose('stop'));
        const report = await input.closed;
        assert.equal(report.kind, 'disposed'); assert.equal(report.cleanupErrors.length, 1);
        assert.equal(report.cleanupErrors[0].phase, 'return'); assert.equal(origin.reads, 1);
        assert.equal(origin.returns, 1); input.dispose(); assert.equal(origin.returns, 1);
    }
    for (const value of ['getter', 1]) {
        const origin = tracked(() => ({ value: 1 }));
        Object.defineProperty(origin.iterator, 'return', { get() { if (value === 'getter') throw failure; return value; } });
        const input = createAsyncSource(() => origin.iterable); await input.next(); input.dispose();
        assert.equal((await input.closed).cleanupErrors[0].phase, 'return');
    }
});

test('absence of return is supported and native generator cleanup runs once on early disposal', async () => {
    const origin = tracked(() => ({ value: 1 }), null);
    const input = createAsyncSource(() => origin.iterable); await input.next(); input.dispose();
    assert.deepEqual((await input.closed).cleanupErrors, []);
    let finalized = 0;
    const generator = createAsyncSource(async function* () {
        try { while (true) yield 1; } finally { finalized++; }
    });
    await generator.next(); generator.dispose(); generator.dispose();
    await generator.closed; assert.equal(finalized, 1);
});

test('signal listeners run once in order, support duplicate subscriptions and removal before a turn', async () => {
    const input = createAsyncSource(async function* () { yield 1; });
    const calls = [], reason = { action: 'stop' }, error = new Error('listener');
    const duplicate = value => { assert.equal(value, reason); calls.push('duplicate'); };
    let removeLast;
    input.signal.subscribe(value => {
        assert.equal(input.signal.aborted, true); assert.equal(input.signal.reason, value);
        assert.equal(input.waiting, false); calls.push('first'); removeLast(); input.dispose('ignored'); throw error;
    });
    input.signal.subscribe(duplicate); input.signal.subscribe(duplicate);
    removeLast = input.signal.subscribe(() => calls.push('removed'));
    const remove = input.signal.subscribe(() => calls.push('unsubscribed')); remove(); remove();
    input.dispose(reason); input.dispose();
    assert.deepEqual(calls, ['first', 'duplicate', 'duplicate']);
    const report = await input.closed;
    assert.deepEqual(report.cleanupErrors, [{ phase: 'abort-listener', error }]);
    const late = input.signal.subscribe(value => { assert.equal(value, reason); calls.push('late'); }); late(); late();
    assert.throws(() => input.signal.subscribe(() => { throw error; }), caught => caught === error);
    assert.equal(report.cleanupErrors.length, 1); assert.equal(calls.at(-1), 'late');
    assert.throws(() => input.signal.subscribe(null), TypeError);
});

test('natural closure releases subscriptions without notification; reports and diagnostics are immutable', async () => {
    let calls = 0;
    const input = createAsyncSource(async function* () { yield 1; });
    input.signal.subscribe(() => calls++); await input.next(); await input.next();
    const report = await input.closed; input.signal.subscribe(() => calls++); input.dispose();
    assert.equal(calls, 0); assert.equal(input.signal.aborted, false);
    assert.ok(Object.isFrozen(report)); assert.ok(Object.isFrozen(report.cleanupErrors));
    const gate = deferred(), other = createAsyncSource(() => tracked(() => gate.promise, () => { throw 'cleanup'; }).iterable);
    const request = other.next(); other.dispose(); await request; gate.reject(undefined);
    const errors = await other.closed;
    assert.ok(Object.isFrozen(errors.lateReadError)); assert.ok(Object.isFrozen(errors.cleanupErrors[0]));
    assert.throws(() => errors.cleanupErrors.push({}), TypeError);
    assert.throws(() => { errors.lateReadError.error = 1; }, TypeError);
});

test('reentrant factory/acquisition/next getters and calls cannot overlap reads and cleanup', async () => {
    for (const stage of ['factory', 'acquire', 'next-getter', 'next-call', 'done', 'value']) {
        let returns = 0, reads = 0, depth = 0;
        let input;
        const cancel = () => { input.dispose(stage); assert.equal(returns, 0); };
        const iterator = {
            get next() {
                if (stage === 'next-getter') cancel();
                return function () {
                    depth++; reads++;
                    try {
                        if (stage === 'next-call') cancel();
                        return { get done() { if (stage === 'done') cancel(); return false; },
                            get value() { if (stage === 'value') cancel(); return 1; } };
                    } finally { depth--; }
                };
            },
            return() { assert.equal(depth, 0); returns++; input.dispose(); return { done: true }; },
        };
        input = createAsyncSource(() => {
            if (stage === 'factory') cancel();
            return { [Symbol.asyncIterator]() { if (stage === 'acquire') cancel(); return iterator; } };
        });
        assert.deepEqual(await input.next(), { kind: 'cancelled', reason: stage });
        assert.equal((await input.closed).kind, 'disposed'); assert.equal(returns, 1);
        assert.equal(reads, ['factory', 'acquire', 'next-getter'].includes(stage) ? 0 : 1);
    }
});

test('a source reentering next shares the original request, including during factory acquisition', async () => {
    const gate = deferred(); let reentered, input;
    input = createAsyncSource(() => {
        reentered = input.next();
        return tracked(() => gate.promise).iterable;
    });
    const request = input.next(); assert.equal(request, reentered);
    gate.resolve({ value: 1 }); await request; input.dispose(); await input.closed;
});

test('cooperative cancellation can settle an owned read without detached late rejections', async () => {
    const error = new Error('cancelled read'); let active = false;
    const input = createAsyncSource(signal => {
        const read = deferred();
        signal.subscribe(() => { assert.equal(active, true); read.reject(error); });
        return tracked(() => { active = true; return read.promise; }, () => { active = false; return { done: true }; }).iterable;
    });
    const request = input.next(); input.dispose('owner');
    assert.deepEqual(await request, { kind: 'cancelled', reason: 'owner' });
    const report = await input.closed;
    assert.equal(active, false); assert.deepEqual(report.cleanupErrors, []);
    assert.deepEqual(report.lateReadError, { error }); await turn();
});
