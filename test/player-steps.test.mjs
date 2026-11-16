import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Player } from '@grundyjs/algiviz/player';
import { dom } from './player-test-dom.mjs';

const step = (index, terminal = false) => ({ index, state: { value: index }, event: { terminal } });
function fixture(values = [step(10), step(-2.5), step(10, true)], options = {}) {
    const env = dom(), container = env.container();
    let reads = 0, returns = 0, factories = 0, predicates = 0;
    const frames = [], errors = [];
    const player = new Player(container, {
        stepSource() {
            factories++; let position = 0;
            return { [Symbol.iterator]: () => ({
                next() { reads++; return position < values.length ? { value: values[position++], done: false } : { done: true }; },
                return() { returns++; return { done: true }; },
            }) };
        },
        isTerminal(value) { predicates++; return value.event.terminal; },
        render: frame => frames.push(frame), onError: error => errors.push(error), ...options,
    });
    return { ...env, container, player, frames, errors,
        get counts() { return [factories, reads, predicates, returns]; } };
}

test('steps: lazy manual completion has no EOF click, preserves events and closes once', async () => {
    const f = fixture(); assert.deepEqual(f.counts, [0, 0, 0, 0]);
    f.player.start(); f.player.start(); assert.deepEqual(f.counts, [1, 1, 1, 0]);
    assert.equal(f.player.frame.stepIndex, 10); assert.equal(f.player.frame.current.value, 10);
    f.player.next(); assert.equal(f.player.frame.stepIndex, -2.5);
    assert.equal(f.player.next().phase, 'finished');
    assert.deepEqual(f.counts, [1, 3, 3, 1]);
    f.player.next(); f.player.pause(); assert.deepEqual(f.counts, [1, 3, 3, 1]);
    let closed = false; f.player.closed.then(() => closed = true); await Promise.resolve(); assert.equal(closed, false);
    f.player.dispose(); f.player.dispose();
    assert.deepEqual(await f.player.closed, { sources: [], errorCount: 0, firstError: null });
    assert.deepEqual(f.counts, [1, 3, 3, 1]); assert.equal(f.container.children.length, 0);
});

test('steps: singleton terminal closes on Start; manual Next skips a positive hold', () => {
    for (const hold of [0, 50]) {
        const f = fixture([step(99, true)], { finalHoldMs: hold });
        assert.equal(f.player.start().phase, hold ? 'paused' : 'finished');
        assert.equal(f.player.frame.previous, f.player.frame.current); assert.equal(f.player.frame.progress, 1);
        assert.deepEqual(f.counts, [1, 1, 1, 1]);
        assert.equal(f.player.next().phase, 'finished'); f.player.dispose();
    }
});

test('steps: terminal interpolation, Pause and Previous preserve ownership until endpoint', () => {
    const f = fixture([step(8), step(8, true)], { stepDurationMs: 100, finalHoldMs: 50, rewindCapacity: 3 });
    f.player.start(); f.player.play(); f.scheduler.tick(0); f.scheduler.tick(25);
    assert.equal(f.player.frame.progress, .25); assert.deepEqual(f.counts, [1, 2, 2, 0]);
    f.player.pause(); f.scheduler.tick(100); assert.equal(f.player.frame.progress, .25);
    f.player.previous(); assert.equal(f.player.frame.progress, 1); assert.deepEqual(f.counts, [1, 2, 2, 0]);
    assert.equal(f.player.next().phase, 'paused'); assert.deepEqual(f.counts, [1, 2, 2, 1]);
    f.player.play(); f.scheduler.tick(200); f.scheduler.tick(249); assert.equal(f.player.status.phase, 'playing');
    f.scheduler.tick(250); assert.equal(f.player.status.phase, 'finished');
    f.player.previous(); f.player.next(); assert.equal(f.player.status.phase, 'paused');
    f.player.next(); assert.equal(f.player.status.phase, 'finished'); assert.deepEqual(f.counts, [1, 2, 2, 1]);
    f.player.dispose();
});

test('steps: rewind bounds are ordinal, capacity evicts and replay never reclassifies', () => {
    for (const capacity of [1, 2, 4]) {
        const f = fixture([step(-10), step(.5), step(.5), step(900, true)], { rewindCapacity: capacity });
        f.player.start(); f.player.next(); f.player.next(); f.player.next();
        assert.deepEqual([f.player.status.rewindStartIndex, f.player.status.rewindEndIndex], [4 - capacity, 3]);
        for (let i = 0; i < 6; i++) f.player.previous();
        assert.equal(f.player.status.canPrevious, false);
        for (let i = 1; i < capacity; i++) f.player.next();
        assert.equal(f.player.status.phase, 'finished'); assert.deepEqual(f.counts, [1, 4, 4, 1]); f.player.dispose();
    }
});

test('steps: RAF budget counts buffered replay and new reads; Pause resets debt', () => {
    const f = fixture(Array.from({ length: 20 }, (_, i) => step(i, i === 19)),
        { stepDurationMs: 1, rewindCapacity: 20, maxStepsPerFrame: 2 });
    f.player.start(); f.player.play(); f.scheduler.tick(0); f.scheduler.tick(100);
    assert.equal(f.player.frame.stepIndex, 2); assert.deepEqual(f.counts, [1, 3, 3, 0]);
    f.scheduler.tick(100); assert.equal(f.player.frame.stepIndex, 4);
    f.player.previous(); f.player.previous(); f.player.play(); f.scheduler.tick(100); f.scheduler.tick(200);
    assert.equal(f.player.frame.stepIndex, 4); assert.deepEqual(f.counts, [1, 5, 5, 0]);
    f.player.pause(); f.player.play(); f.scheduler.tick(500); assert.equal(f.player.frame.stepIndex, 4);
    f.player.dispose();
});

test('steps: frozen captured envelopes retain references and classify each position exactly once', () => {
    const order = [], state = {}, event = {};
    const envelope = { get index() { order.push('index'); return -1.5; }, get state() { order.push('state'); return state; }, get event() { order.push('event'); return event; } };
    let classified = 0;
    const f = fixture([envelope, envelope], { rewindCapacity: 2, isTerminal(value) {
        order.push('predicate'); assert.ok(Object.isFrozen(value)); assert.notEqual(value, envelope);
        assert.equal(value.state, state); assert.equal(value.event, event); return ++classified === 2;
    } });
    f.player.start(); f.player.next(); f.player.previous(); f.player.next(); void f.player.frame;
    assert.equal(classified, 2); assert.deepEqual(order, ['index', 'state', 'event', 'predicate', 'index', 'state', 'event', 'predicate']);
    f.player.dispose();
});

test('steps: producer may reuse and mutate its envelope between admissions', () => {
    const envelope = { index: 1, state: 'first', event: false };
    const f = fixture([], { stepSource: function* () { yield envelope; Object.assign(envelope, { index: 2, state: 'last', event: true }); yield envelope; },
        isTerminal: value => value.event, rewindCapacity: 2 });
    f.player.start(); f.player.next(); f.player.previous();
    assert.equal(f.player.frame.current, 'first'); assert.equal(f.player.frame.event, false); f.player.dispose();
});

test('steps: malformed admission, empty/early EOF and nonboolean predicates fail and close', () => {
    for (const [values, options, ErrorType] of [
        [[], {}, RangeError], [[step(0)], {}, RangeError], [[null], {}, TypeError],
        [[{ index: '0' }], {}, TypeError], [[{ index: NaN }], {}, RangeError], [[{ index: Infinity }], {}, RangeError],
        [[step(0)], { isTerminal: () => 1 }, TypeError], [[step(0)], { isTerminal: () => Promise.resolve(true) }, TypeError],
    ]) {
        const f = fixture(values, options); f.player.start();
        if (!f.player.status.hasError) f.player.next();
        assert.ok(f.player.status.error instanceof ErrorType); assert.equal(f.counts[3], 1);
        assert.equal(f.errors.length, 1); f.player.dispose();
    }
});

test('steps: invalid index is rejected before state/event getters', () => {
    const value = { index: NaN, get state() { assert.fail('state accessed'); }, get event() { assert.fail('event accessed'); } };
    const f = fixture([value]); assert.ok(f.player.start().error instanceof RangeError); f.player.dispose();
});

test('steps: invalid iterator/result and getter throws preserve primary values including undefined', () => {
    for (const source of [() => ({ [Symbol.iterator]: () => null }), () => ({ [Symbol.iterator]: () => ({ next: () => 1 }) })]) {
        const f = fixture([], { stepSource: source }); assert.ok(f.player.start().error instanceof TypeError); f.player.dispose();
    }
    for (const primary of [undefined, null, 0, 'failure']) {
        const f = fixture([{ get index() { throw primary; } }]);
        const status = f.player.start(); assert.equal(status.hasError, true); assert.equal(status.error, primary);
        assert.equal(f.errors[0], primary); assert.equal(f.counts[3], 1); f.player.dispose();
    }
});

test('steps: restart prepares before retiring; rejected candidate preserves old frame/window', () => {
    let attempt = 0, closes = 0;
    const f = fixture([], { rewindCapacity: 3, stepSource: function* () {
        try { if (++attempt === 2) throw undefined; yield step(0); yield step(1); yield step(2, true); }
        finally { closes++; }
    } });
    f.player.start(); f.player.next(); const old = f.player.frame;
    assert.equal(f.player.restart().hasError, true); assert.equal(f.player.frame, old);
    assert.equal(f.player.status.phase, 'paused'); assert.equal(f.player.status.canPrevious, true); assert.equal(closes, 1);
    f.player.next(); assert.equal(f.player.status.phase, 'finished'); assert.equal(closes, 2);
    assert.equal(f.player.restart().phase, 'paused'); assert.equal(f.player.frame.stepIndex, 0);
    assert.deepEqual([f.player.status.rewindStartIndex, f.player.status.rewindEndIndex], [0, 0]);
    f.player.dispose(); assert.equal(closes, 3);
});

test('steps: return failure blocks replacement, closes candidate and retains readable old frame', async () => {
    const primary = {}, events = []; let attempt = 0;
    const f = fixture([], { stepSource() {
        const id = ++attempt; return { [Symbol.iterator]: () => ({ next: () => ({ value: step(id) }), return() { events.push(id); if (id === 1) throw primary; } }) };
    } });
    f.player.start(); const old = f.player.frame;
    assert.equal(f.player.restart().error, primary); assert.equal(f.player.status.phase, 'error');
    assert.equal(f.player.frame, old); assert.deepEqual(events, [1, 2]); f.player.dispose();
    assert.equal((await f.player.closed).firstError.error, primary);
});

test('steps: source/predicate/render failure wins over cleanup; standalone disposal reports cleanup', async () => {
    for (const stage of ['predicate', 'render', 'return']) {
        let closes = 0; const primary = {}, secondary = {};
        const f = fixture([], { stepSource: () => ({ [Symbol.iterator]: () => ({ next: () => ({ value: step(1) }), return() { closes++; throw secondary; } }) }),
            isTerminal() { if (stage === 'predicate') throw primary; return false; },
            render() { if (stage === 'render') throw primary; } });
        f.player.start();
        if (stage === 'return') { assert.throws(() => f.player.dispose(), error => error === secondary); assert.equal((await f.player.closed).firstError.phase, 'dispose'); }
        else { assert.equal(f.player.status.error, primary); f.player.dispose(); }
        assert.equal(closes, 1); f.player.dispose();
    }
});

test('steps: callbacks reject reentrant mutation and U2 invalid speed still wins', () => {
    let player; const observations = [];
    const guarded = () => {
        if (!player) return;
        for (const action of ['start', 'next', 'pause', 'restart', 'dispose']) assert.throws(() => player[action](), /callback/);
        assert.throws(() => player.setSpeed(NaN), RangeError); observations.push(player.status.phase); void player.frame;
    };
    const f = fixture([], { stepSource: function* () { guarded(); yield { get index() { guarded(); return 0; }, state: 1, event: undefined }; yield step(1, true); },
        isTerminal(value) { guarded(); return value.index === 1; }, render: guarded,
        onStatus(status) { if (status.phase !== 'disposed') guarded(); } });
    player = f.player; player.start(); player.next(); player.dispose(); assert.ok(observations.length > 6);
});

test('steps: configuration rejected before factory calls or viewport movement', () => {
    for (const config of [{ stepSource: () => [] }, { source: () => [1], isTerminal: () => true },
        { stepSource: () => [], source: () => [1], isTerminal: () => true }, { stepSource: 1, isTerminal: () => true },
        { stepSource: () => [], isTerminal: () => true, rewindCapacity: 0 }]) {
        const env = dom(), host = env.container(), viewport = env.doc.createElement('canvas'); host.append(viewport);
        assert.throws(() => new Player(host, { viewport, render() {}, ...config })); assert.deepEqual(host.children, [viewport]);
    }
});

test('steps: Next completes a partial transition without reading; reduced motion preserves logical time', () => {
    const f = fixture([step(0), step(1, true)], { stepDurationMs: 100 });
    f.player.start(); f.media.matches = true; f.media.emit('change', { matches: true });
    f.player.play(); f.scheduler.tick(0); f.scheduler.tick(25);
    assert.equal(f.player.frame.progress, .25); assert.equal(f.frames.at(-1).progress, 1);
    assert.equal(f.frames.at(-1).previous, f.frames.at(-1).current);
    assert.equal(f.counts[3], 0); assert.equal(f.player.next().phase, 'finished');
    assert.deepEqual(f.counts, [1, 2, 2, 1]); f.player.dispose();
});

test('steps: terminal return failure is operational and not retried on dispose', () => {
    let returns = 0; const primary = {};
    const f = fixture([], { stepSource: function* () { try { yield step(0); yield step(1, true); } finally { returns++; throw primary; } } });
    f.player.start(); assert.equal(f.player.next().error, primary); assert.equal(f.player.status.phase, 'error');
    assert.equal(f.player.frame.stepIndex, 1); assert.equal(f.errors[0], primary);
    f.player.dispose(); assert.equal(returns, 1);
});

test('steps: dispose before terminal endpoint closes without further render/read/predicate calls', () => {
    const f = fixture([step(0), step(1, true)], { stepDurationMs: 100, rewindCapacity: 2 });
    f.player.start(); f.player.play(); f.scheduler.tick(0); f.scheduler.tick(20);
    const renders = f.frames.length; f.player.dispose(); f.scheduler.tick(1000); f.player.dispose();
    assert.deepEqual(f.counts, [1, 2, 2, 1]); assert.equal(f.frames.length, renders); assert.equal(f.scheduler.size, 0);
});

test('steps: undefined state/event and truthy done use iterator semantics without shape guessing', () => {
    const f = fixture([{ index: 0, state: undefined, event: undefined }], { isTerminal: () => true });
    assert.equal(f.player.start().phase, 'finished'); assert.equal(f.player.frame.current, undefined);
    assert.equal(f.player.frame.event, undefined); f.player.dispose();
    const ended = fixture([], { stepSource: () => ({ [Symbol.iterator]: () => ({ next: () => ({ done: 'yes', get value() { assert.fail('EOF value read'); } }) }) }) });
    assert.ok(ended.player.start().error instanceof RangeError); ended.player.dispose();
    const env = dom(), state = step(0, true);
    const old = new Player(env.container(), { source: () => [state], render() {} }); old.start();
    assert.equal(old.frame.current, state); assert.equal(old.frame.event, undefined); assert.equal(old.status.phase, 'paused'); old.dispose();
});

test('steps: initial preparation failure is retryable and option callbacks are captured', () => {
    const env = dom(); let attempts = 0, calls = 0;
    const options = { stepSource: function* () { if (++attempts === 1) throw undefined; yield step(0, true); },
        isTerminal(value) { calls++; return value.event.terminal; }, render() {} };
    const player = new Player(env.container(), options);
    options.stepSource = () => { assert.fail('mutated factory called'); };
    options.isTerminal = () => { assert.fail('mutated predicate called'); };
    assert.equal(player.start().hasError, true); assert.equal(player.status.canStart, true);
    assert.equal(player.frame, null); assert.equal(player.start().phase, 'finished');
    assert.equal(calls, 1); assert.equal(attempts, 2); player.dispose();
});
