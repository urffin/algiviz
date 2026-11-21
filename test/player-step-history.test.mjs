import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Player } from '@grundyjs/algiviz/player';
import { dom } from './player-test-dom.mjs';

const step = (index, state = index, event = 'step') => ({ index, state, event });

test('stepHistory preserves destination events through seek, navigation and final hold', () => {
    const env = dom(), rendered = [];
    const steps = [step(-3, 'A', 'start'), step(10.5, 'B', 'swap'), step(10.5, 'C', 'done')];
    let reads = 0;
    const player = new Player(env.container(), {
        stepHistory() { reads++; return steps; }, stepDurationMs: 100, finalHoldMs: 50,
        render: frame => rendered.push(frame),
    });
    try {
        assert.equal(reads, 0);
        assert.equal(player.frame, null);
        player.start();
        player.start();
        assert.equal(player.status.mode, 'recording');
        assert.equal(player.status.durationMs, 250);
        const check = (previous, current, progress, stepIndex, event) => {
            assert.deepEqual(player.frame, { previous, current, progress, stepIndex, event });
            assert.equal(rendered.at(-1), player.frame);
        };
        check('A', 'A', 1, -3, 'start');
        player.play();
        assert.equal(env.scheduler.size, 1);
        player.seek(40);
        assert.equal(env.scheduler.size, 0);
        check('A', 'B', .4, 10.5, 'swap');
        player.next();
        check('A', 'B', 1, 10.5, 'swap');
        player.seek(101);
        check('B', 'C', .01, 10.5, 'done');
        player.next();
        assert.equal(player.status.positionMs, 200);
        assert.equal(player.status.phase, 'paused');
        check('C', 'C', 1, 10.5, 'done');
        player.next();
        assert.equal(player.status.phase, 'finished');
        player.previous();
        assert.equal(player.status.positionMs, 200);
        check('C', 'C', 1, 10.5, 'done');
        player.seek(40);
        check('A', 'B', .4, 10.5, 'swap');
        player.seek(-1);
        check('A', 'A', 1, -3, 'start');
        assert.equal(reads, 1);
    } finally { player.dispose(); }
});

test('stepHistory captures every envelope once and keeps state and event references', () => {
    const order = [], state = Object.freeze({ value: 1 }), event = Object.freeze({ type: 'end' });
    const envelope = {
        get index() { order.push('index'); return 7; },
        get state() { order.push('state'); return state; },
        get event() { order.push('event'); return event; },
    };
    const steps = [{ index: 1, state: undefined, event: undefined }, envelope];
    const player = new Player(dom().container(), { stepHistory: () => steps, stepDurationMs: 100, render() {} });
    try {
        player.start();
        assert.deepEqual(order, ['index', 'state', 'event']);
        assert.equal(player.frame.event, undefined);
        steps[0].index = 99;
        steps[0].event = 'replaced';
        steps[1] = step(0, null, null);
        steps.length = 0;
        player.seek(50);
        assert.equal(player.frame.previous, undefined);
        assert.equal(player.frame.current, state);
        assert.equal(player.frame.event, event);
        assert.equal(player.frame.stepIndex, 7);
        assert.deepEqual(order, ['index', 'state', 'event']);
        player.previous();
        assert.equal(player.frame.stepIndex, 1);
        assert.equal(player.frame.event, undefined);
    } finally { player.dispose(); }
});

test('stepHistory validates the complete recording before the first render', () => {
    let consumed = 0, laterFieldsRead = 0;
    const iterable = { *[Symbol.iterator]() { consumed++; yield step(0); } };
    const invalidIndex = index => ({
        index,
        get state() { laterFieldsRead++; },
        get event() { laterFieldsRead++; },
    });
    const inheritedPosition = new Array(1);
    Object.setPrototypeOf(inheritedPosition, Object.assign(Object.create(Array.prototype), { 0: step(0) }));
    for (const [value, ErrorType] of [
        [null, TypeError], [iterable, TypeError], [Promise.resolve([step(0)]), TypeError],
        [[], RangeError], [[step(0), , step(2)], TypeError], [inheritedPosition, TypeError],
        [[step(0), null], TypeError], [[step(0), 2], TypeError],
        [[step(0), invalidIndex('1')], TypeError], [[step(0), invalidIndex(new Number(1))], TypeError],
        [[step(0), invalidIndex(NaN)], RangeError], [[step(0), invalidIndex(Infinity)], RangeError],
        [[step(0), invalidIndex(-Infinity)], RangeError],
    ]) {
        const errors = [];
        let renders = 0;
        const player = new Player(dom().container(), {
            stepHistory: () => value, stepDurationMs: 100,
            render() { renders++; }, onError: error => errors.push(error),
        });
        try {
            const status = player.start();
            assert.equal(status.started, false);
            assert.equal(status.hasError, true);
            assert.equal(player.frame, null);
            assert.equal(renders, 0);
            assert.equal(errors.length, 1);
            assert.ok(errors[0] instanceof ErrorType);
        } finally { player.dispose(); }
    }
    assert.equal(consumed, 0);
    assert.equal(laterFieldsRead, 0);
});

test('stepHistory rejects conflicting sources and stream options before reading or mounting', () => {
    const env = dom(), host = env.container(), viewport = env.doc.createElement('canvas');
    host.append(viewport);
    let reads = 0;
    const options = { viewport, stepHistory() { reads++; return [step(0)]; }, stepDurationMs: 100, render() {} };
    for (const invalid of [
        { source: () => [] }, { asyncSource: () => [] }, { history: () => [] },
        { stepSource: () => [], isTerminal: () => true }, { isTerminal: () => true },
        { rewindCapacity: 2 }, { maxStepsPerFrame: 2 }, { stepDurationMs: undefined }, { stepHistory: null },
    ]) {
        assert.throws(() => new Player(host, { ...options, ...invalid }), TypeError);
        assert.deepEqual(host.children, [viewport]);
    }
    assert.throws(() => new Player(host, { ...options, stepDurationMs: 0 }), RangeError);
    assert.equal(reads, 0);
});

test('failed stepHistory Restart preserves the previous recording, frame and speed', () => {
    const env = dom(), errors = [], frames = [];
    let recording = [step(5, 'A', 'start'), step(12, 'B', 'swap'), step(99, 'C', 'done')];
    let calls = 0;
    const failure = Object.freeze({ message: 'factory failed' });
    const player = new Player(env.container(), {
        source: undefined, history: undefined, isTerminal: undefined, stepDurationMs: 100,
        stepHistory() {
            calls++;
            if (recording === failure) throw failure;
            return recording;
        },
        render: frame => frames.push(frame), onError: error => errors.push(error),
    });
    try {
        player.start();
        player.setSpeed(2);
        player.seek(140);
        const oldFrame = player.frame, count = frames.length;
        player.play();
        recording = [step(0), step(NaN)];
        const rejected = player.restart();
        assert.ok(errors[0] instanceof RangeError);
        assert.equal(rejected.phase, 'paused');
        assert.equal(rejected.positionMs, 140);
        assert.equal(rejected.durationMs, 200);
        assert.equal(rejected.speed, 2);
        assert.equal(player.frame, oldFrame);
        assert.equal(frames.length, count);
        assert.equal(env.scheduler.size, 0);
        recording = failure;
        player.restart();
        assert.deepEqual(errors, [errors[0], failure]);
        assert.equal(player.frame, oldFrame);
        player.previous();
        assert.equal(player.frame.event, 'swap');
        assert.equal(player.status.hasError, false);
        recording = [step(-4, 'fresh', Object.freeze({ type: 'fresh' }))];
        const restarted = player.restart();
        assert.equal(restarted.phase, 'finished');
        assert.equal(restarted.positionMs, 0);
        assert.equal(restarted.speed, 2);
        assert.equal(player.frame.current, 'fresh');
        assert.equal(player.frame.event, recording[0].event);
        assert.equal(calls, 4);
    } finally { player.dispose(); }
});
