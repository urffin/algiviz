import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Player } from '@grundyjs/algiviz/player';
import { createWorkerSourceFactory } from '@grundyjs/algiviz/worker';
import { dom, panel } from './player-test-dom.mjs';
import { deferred, transport, turn } from './worker-test-transport.mjs';

const kinds = ['source', 'history', 'asyncSource', 'worker'];
const asynchronous = kind => kind === 'asyncSource' || kind === 'worker';
const configurations = [
    ['source', {}], ['source', { rewindCapacity: 4 }], ['source', { maxStepsPerFrame: 2 }],
    ['source', { manual: true, rewindCapacity: 4, maxStepsPerFrame: 2 }], ['history', {}],
    ['asyncSource', {}], ['asyncSource', { rewindCapacity: 4, maxStepsPerFrame: 2 }],
    ['asyncSource', { manual: true }], ['worker', {}],
    ['worker', { rewindCapacity: 4, maxStepsPerFrame: 2 }], ['worker', { manual: true }],
];

function fixture(kind, { manual = false, count = 50, ...options } = {}) {
    const env = dom(), host = env.container(), hooks = {}, generations = [];
    const stats = { factories: 0, reads: 0, returns: 0, aborts: 0, renders: 0, statuses: 0,
        errors: 0, requests: 0, cancels: 0, domWrites: 0, inputs: 0, transfers: 0 };
    const errors = [];
    const create = env.doc.createElement;
    env.doc.createElement = tag => {
        const element = create(tag);
        for (const key of ['textContent', 'value', 'disabled', 'hidden', 'className', 'title']) {
            let value = element[key];
            Object.defineProperty(element, key, { configurable: true, get: () => value,
                set(next) { stats.domWrites++; value = next; } });
        }
        const attribute = element.setAttribute;
        element.setAttribute = (...args) => { stats.domWrites++; return attribute.apply(element, args); };
        return element;
    };
    const request = env.scheduler.request, cancel = env.scheduler.cancel;
    env.scheduler.request = callback => { stats.requests++; return request(callback); };
    env.scheduler.cancel = id => { stats.cancels++; return cancel(id); };
    function iterator(generation) {
        let position = 0;
        const owned = {
            next() {
                stats.reads++; hooks.next?.();
                if (generation.failure) throw generation.failure;
                if (!asynchronous(kind)) return position < count ? { value: position++, done: false } : { done: true };
                const gate = deferred(); generation.reads.push(gate); return gate.promise;
            },
            return() {
                stats.returns++; hooks.return?.();
                return generation.holdCleanup ? generation.cleanup.promise : { done: true };
            },
        };
        return owned;
    }
    function generation(signal) {
        stats.factories++; hooks.factory?.();
        const item = { reads: [], cleanup: deferred(), holdCleanup: false, signal };
        signal?.subscribe(() => { stats.aborts++; });
        generations.push(item); return item;
    }
    let settings;
    if (kind === 'source') settings = { source() {
        const item = generation();
        return { [Symbol.iterator]() { hooks.acquire?.(); return iterator(item); } };
    } };
    else if (kind === 'history') settings = { history() { generation(); return Array.from({ length: count }, (_, n) => n); } };
    else if (kind === 'asyncSource') settings = { asyncSource(signal) {
        const item = generation(signal);
        return { [Symbol.asyncIterator]() { hooks.acquire?.(); return iterator(item); } };
    } };
    else {
        const factory = createWorkerSourceFactory({
            worker() {
                hooks.worker?.();
                const item = generations.at(-1);
                item.link = transport(() => ({ [Symbol.asyncIterator]: () => iterator(item) }),
                    { transfer() { stats.transfers++; return []; } });
                return item.link.worker;
            },
            input() { stats.inputs++; hooks.input?.(); return null; }, shutdown: { gracePeriodMs: 10000 },
        });
        settings = { asyncSource(signal) { generation(signal); return factory(signal); } };
    }
    const ui = new Player(host, { ...settings, ...(!manual ? { stepDurationMs: 100 } : {}), ...options,
        render(frame) { stats.renders++; hooks.render?.(frame); },
        onStatus(status) { stats.statuses++; hooks.status?.(status); },
        onError(error) { stats.errors++; errors.push(error); hooks.error?.(error); },
    });
    return { ui, env, host, stats, hooks, generations, errors, kind,
        async settle(value, item = generations.at(-1)) {
            await turn();
            const gate = item.reads.find(read => !read.settled);
            assert.ok(gate, 'One pending source read must exist'); gate.settled = true;
            gate.resolve(value); await turn();
        },
        async start() { ui.start(); if (asynchronous(kind)) await this.settle({ value: 0 }); },
        async next(value) { ui.next(); if (asynchronous(kind) && ui.status.waiting) await this.settle({ value }); },
        async restart() {
            const previous = [...generations];
            ui.restart();
            if (asynchronous(kind)) {
                await this.settle({ value: 0 });
                for (const item of previous) for (const read of item.reads) if (!read.settled) {
                    read.settled = true; read.resolve({ done: true });
                }
                await turn(); await turn();
            }
        },
        async close() {
            for (const key of Object.keys(hooks)) delete hooks[key];
            ui.dispose();
            for (let pass = 0; pass < 4; pass++) {
                for (const item of generations) {
                    for (const read of item.reads) if (!read.settled) { read.settled = true; read.resolve({ done: true }); }
                    item.cleanup.resolve({ done: true });
                }
                await turn();
            }
            return ui.closed;
        },
    };
}

function observation(f) {
    return { status: f.ui.status, frame: f.ui.frame, stats: { ...f.stats }, raf: f.env.scheduler.size,
        timers: [...f.env.timers], generations: f.generations.map(item => ({
            reads: item.reads.length, aborted: item.signal?.aborted,
            sent: item.link?.sent.length, replies: item.link?.replies.length,
            terminations: item.link?.terminations, transfers: f.stats.transfers,
        })) };
}
function invalidValues() {
    const conversion = () => { throw new Error('Speed must not invoke coercion'); };
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    return [0, -0, -1, -Number.MIN_VALUE, NaN, Infinity, -Infinity, undefined, null,
        '', '2', true, false, new Number(2), {}, [], [2], () => 2, 2n, Symbol('speed'),
        { [Symbol.toPrimitive]: conversion, valueOf: conversion, toString: conversion }, revoked.proxy];
}
function rejected(f, values = invalidValues()) {
    const before = observation(f);
    for (const value of values) {
        assert.throws(() => f.ui.setSpeed(value), error => error.constructor === RangeError);
        assert.deepEqual(observation(f), before, 'Invalid speed must have no observable effects');
    }
}
function speedPicker(f) { return panel(f.host).children.find(child => child.tag === 'label').children.find(child => child.tag === 'select'); }
function valid(f, speed) {
    const before = observation(f), result = f.ui.setSpeed(speed), after = observation(f);
    assert.equal(result.speed, speed); assert.deepEqual(result, f.ui.status); assert.ok(Object.isFrozen(result));
    assert.deepEqual({ ...after.status, speed: before.status.speed }, before.status);
    assert.equal(after.frame, before.frame);
    for (const key of ['factories', 'reads', 'returns', 'aborts', 'renders', 'errors', 'requests', 'cancels', 'inputs', 'transfers'])
        assert.equal(after.stats[key], before.stats[key], key);
    assert.equal(after.stats.statuses, before.stats.statuses + 1);
    assert.deepEqual(after.generations, before.generations); assert.equal(after.raf, before.raf);
    assert.equal(speedPicker(f).value, String(speed));
    return result;
}

for (const [index, [kind, options]] of configurations.entries()) {
    const name = `${kind} configuration ${index + 1}`;
    test(`U2 ${name}: invalid values have no effects before Start, paused, playing, finished and disposed`, async () => {
        const f = fixture(kind, options);
        try {
            rejected(f); assert.equal(f.stats.factories, 0); await f.start(); rejected(f);
            await f.next(1); rejected(f);
            if (!options.manual) { f.ui.play(); f.env.scheduler.tick(0); rejected(f); f.ui.pause(); }
            if (kind === 'history') f.ui.seek(1e6);
            else if (asynchronous(kind)) { f.ui.next(); await f.settle({ done: true }); }
            else for (let i = 0; i < 51 && f.ui.status.phase !== 'finished'; i++) f.ui.next();
            assert.equal(f.ui.status.phase, 'finished'); rejected(f);
            valid(f, 1.5); assert.equal(f.ui.status.phase, 'finished');
            await f.close(); rejected(f);
            assert.throws(() => f.ui.setSpeed(2), error => error.constructor === Error && /disposed/.test(error.message));
            assert.equal((await f.ui.closed).errorCount, 0);
        } finally { await f.close(); }
    });
    test(`U2 ${name}: finite positive boundaries, custom values and settings survive navigation/restart`, async () => {
        const f = fixture(kind, options);
        try {
            for (const speed of [Number.MIN_VALUE, Number.MAX_VALUE, 0.125, 1.5, 16, 1.5]) valid(f, speed);
            assert.equal(f.stats.factories, 0); await f.start(); assert.equal(f.ui.status.speed, 1.5);
            valid(f, 2.5); await f.next(1); assert.equal(f.ui.status.speed, 2.5);
            assert.equal(f.ui.frame.stepIndex, 1); assert.equal(f.ui.frame.progress, 1);
            if (options.manual) assert.throws(() => f.ui.play(), /stepDurationMs/);
            else { f.ui.play(); f.ui.pause(); assert.equal(f.ui.status.speed, 2.5); }
            if (options.rewindCapacity || kind === 'history') { f.ui.previous(); assert.equal(f.ui.status.speed, 2.5); }
            if (kind === 'history') { f.ui.seek(25); assert.equal(f.ui.status.speed, 2.5); }
            await f.restart(); assert.equal(f.ui.frame.stepIndex, 0); assert.equal(f.ui.status.speed, 2.5);
            assert.equal(f.ui.status.phase, 'paused');
        } finally { await f.close(); }
    });
}

for (const kind of kinds) {
    test(`U2 ${kind}: validation precedes guarded render/status/source calls and disposal notification`, async () => {
        const f = fixture(kind); let checks = 0;
        const check = () => {
            checks++; rejected(f, [0, NaN, '2']);
            const before = observation(f);
            assert.throws(() => f.ui.setSpeed(2), error => error.constructor === Error);
            assert.deepEqual(observation(f), before);
        };
        try {
            f.hooks.factory = check;
            if (kind !== 'history' && kind !== 'worker') { f.hooks.acquire = check; f.hooks.next = check; }
            if (kind === 'worker') { f.hooks.worker = check; f.hooks.input = check; }
            f.hooks.render = check; f.hooks.status = check;
            await f.start(); assert.ok(checks >= 3); assert.equal(f.ui.status.phase, 'paused');
            for (const key of Object.keys(f.hooks)) delete f.hooks[key];
            valid(f, 1.5);
            let disposalChecks = 0;
            f.hooks.status = status => { if (status.phase === 'disposed') { check(); disposalChecks++; } };
            f.ui.dispose(); assert.equal(disposalChecks, 1); rejected(f);
            assert.equal((await f.close()).errorCount, 0);
        } finally { await f.close(); }
    });
    for (const context of ['render', 'status', 'factory']) {
        test(`U2 ${kind}: uncaught validation from ${context} follows the outer failure path`, async () => {
            const f = fixture(kind); let primary;
            f.hooks[context] = () => {
                delete f.hooks[context];
                try { f.ui.setSpeed(0); } catch (error) { primary = error; throw error; }
            };
            try {
                f.ui.start(); await turn(); await turn();
                if (asynchronous(kind) && context === 'render') await f.settle({ value: 0 });
                if (asynchronous(kind) && context === 'status') {
                    for (const item of f.generations) for (const read of item.reads) if (!read.settled) {
                        read.settled = true; read.resolve({ done: true });
                    }
                    await turn(); await turn();
                }
                assert.equal(primary?.constructor, RangeError); assert.equal(f.errors[0], primary);
                assert.equal(f.ui.status.hasError, true); assert.equal(f.ui.status.speed, 1);
                assert.equal(f.env.scheduler.size, 0);
                for (const key of Object.keys(f.hooks)) delete f.hooks[key];
                rejected(f); valid(f, 2); assert.equal(f.ui.status.hasError, true);
                assert.equal(f.ui.status.error, primary); assert.equal(f.stats.errors, 1);
                await f.restart(); assert.equal(f.ui.status.phase, 'paused'); assert.equal(f.ui.status.speed, 2);
            } finally { await f.close(); }
        });
    }
}

for (const kind of ['asyncSource', 'worker']) {
    test(`U2 ${kind}: preparing, waiting Next, ready slot and restart cleanup keep requests and speed`, async () => {
        const f = fixture(kind, { rewindCapacity: 4, maxStepsPerFrame: 2 });
        try {
            f.ui.start(); await turn(); assert.equal(f.ui.status.preparing, 'start');
            rejected(f); valid(f, 1.5); await f.settle({ value: 0 }); assert.equal(f.ui.status.speed, 1.5);
            f.ui.next(); await turn(); rejected(f); valid(f, 2.5);
            assert.equal(f.ui.status.canPause, true); await f.settle({ value: 1 });
            assert.equal(f.ui.frame.stepIndex, 1); assert.equal(f.ui.frame.progress, 1);
            f.ui.next(); await turn(); f.ui.pause(); await f.settle({ value: 2 });
            rejected(f); valid(f, 3.5); const reads = f.stats.reads;
            f.ui.next(); assert.equal(f.ui.frame.current, 2); assert.equal(f.stats.reads, reads);
            const old = f.generations[0]; old.holdCleanup = true;
            f.ui.restart(); await turn(); rejected(f); valid(f, 4.5);
            await f.settle({ value: 100 }); assert.equal(f.ui.status.cleanupPending, true);
            assert.equal(f.ui.frame.current, 2); rejected(f); valid(f, 5.5);
            assert.equal(old.signal.aborted, true); old.cleanup.resolve({ done: true }); await turn(); await turn();
            assert.equal(f.ui.frame.current, 100); assert.equal(f.ui.status.preparing, null);
            assert.equal(f.ui.status.speed, 5.5); assert.equal(f.ui.status.phase, 'paused');
            assert.equal(f.stats.factories, 2); assert.equal(f.stats.reads, 4);
        } finally { await f.close(); }
    });
    test(`U2 ${kind}: Play waits without accumulating time or cancelling its pending read`, async () => {
        const f = fixture(kind);
        try {
            await f.start(); f.ui.play(); await turn();
            assert.equal(f.ui.status.waiting, true); assert.equal(f.env.scheduler.size, 0);
            rejected(f); valid(f, 2); await f.settle({ value: 1 });
            f.env.scheduler.tick(10000); assert.equal(f.ui.frame.progress, 0);
            f.env.scheduler.tick(10025); assert.equal(f.ui.frame.progress, 0.5);
            valid(f, 2); f.env.scheduler.tick(11000); assert.equal(f.ui.frame.progress, 0.5);
            rejected(f); f.env.scheduler.tick(11025); assert.equal(f.ui.frame.progress, 1);
            assert.equal(f.ui.frame.stepIndex, 1); assert.equal(f.ui.status.phase, 'playing');
        } finally { await f.close(); }
    });
    test(`U2 ${kind}: failed-session cleanup and disposed cleanup retain the primary source error`, async () => {
        const f = fixture(kind);
        try {
            await f.start(); const old = f.generations[0]; old.holdCleanup = true;
            f.ui.next(); await turn(); const read = old.reads.at(-1);
            read.settled = true; read.reject(new SyntaxError('Source failed')); await turn(); await turn();
            const primary = f.ui.status.error;
            assert.equal(f.ui.status.phase, 'error'); assert.equal(f.ui.status.cleanupPending, true);
            assert.equal(f.errors[0], primary); rejected(f); valid(f, 2.5);
            assert.equal(f.ui.status.error, primary); assert.equal(f.ui.status.cleanupPending, true);
            assert.equal(f.stats.factories, 1); f.ui.dispose(); rejected(f);
            const before = observation(f);
            assert.throws(() => f.ui.setSpeed(2), error => error.constructor === Error && /disposed/.test(error.message));
            assert.deepEqual(observation(f), before);
            old.cleanup.resolve({ done: true }); const report = await f.ui.closed;
            assert.equal(report.errorCount, 0); assert.equal(f.errors.length, 1);
        } finally { await f.close(); }
    });
}

for (const kind of kinds) {
    test(`U2 ${kind}: invalid speed preserves the clock; valid and equal speeds reset only its baseline`, async () => {
        const f = fixture(kind, kind === 'history' ? {} : { rewindCapacity: 4 });
        try {
            await f.start(); await f.next(1); await f.next(2);
            f.ui.previous(); f.ui.previous(); f.ui.play(); f.env.scheduler.tick(0); f.env.scheduler.tick(25);
            assert.equal(f.ui.frame.progress, 0.25); rejected(f);
            f.env.scheduler.tick(50); assert.equal(f.ui.frame.progress, 0.5);
            valid(f, 2); f.env.scheduler.tick(1000); assert.equal(f.ui.frame.progress, 0.5);
            f.env.scheduler.tick(1010); assert.equal(f.ui.frame.progress, 0.7);
            valid(f, 2); f.env.scheduler.tick(2000); assert.equal(f.ui.frame.progress, 0.7);
            f.env.scheduler.tick(2005); assert.equal(f.ui.frame.progress, 0.8);
        } finally { await f.close(); }
    });
    test(`U2 ${kind}: accepting MAX_VALUE is separate from later playback overflow`, async () => {
        const f = fixture(kind);
        try {
            await f.start(); valid(f, Number.MAX_VALUE); f.ui.play();
            if (asynchronous(kind)) await f.settle({ value: 1 });
            f.env.scheduler.tick(0); assert.equal(f.ui.status.hasError, false);
            f.env.scheduler.tick(100); await turn();
            assert.equal(f.ui.status.phase, 'error'); assert.equal(f.errors[0]?.constructor, RangeError);
            assert.equal(f.ui.status.speed, Number.MAX_VALUE); assert.equal(f.env.scheduler.size, 0);
            rejected(f); valid(f, 1); assert.equal(f.ui.status.phase, 'error');
        } finally { await f.close(); }
    });
}

for (const kind of ['source', 'asyncSource', 'worker']) {
    test(`U2 ${kind}: speed changes preserve bounded-work playback debt without multiplying it again`, async () => {
        const f = fixture(kind, { rewindCapacity: 20, maxStepsPerFrame: 2, stepDurationMs: 10 });
        try {
            await f.start(); for (let i = 1; i < 13; i++) await f.next(i);
            for (let i = 0; i < 12; i++) f.ui.previous();
            f.ui.play(); f.env.scheduler.tick(0); f.env.scheduler.tick(100);
            assert.equal(f.ui.frame.stepIndex, 2); rejected(f); valid(f, 2);
            f.env.scheduler.tick(500); assert.equal(f.ui.frame.stepIndex, 4);
            f.env.scheduler.tick(505); assert.equal(f.ui.frame.stepIndex, 6);
            for (let i = 0; i < 8; i++) f.env.scheduler.tick(505);
            assert.equal(f.ui.frame.stepIndex, 11); assert.equal(f.ui.frame.progress, 1);
        } finally { await f.close(); }
    });
}
