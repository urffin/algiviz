import test from 'node:test';
import assert from 'node:assert/strict';
import { graphSteps } from '../examples/graph-algorithm.mjs';
import { graphScene } from '../examples/graph-scene.mjs';
import { createPlayer } from '@grundyjs/algiviz/playback';
import { createArrayPlayer } from '@grundyjs/algiviz/array';

test('manual graph playback needs no timing and rejects timed advancement without consuming', () => {
    let reads = 0, renders = 0;
    function* source() {
        for (const step of graphSteps(graph, 'A')) { reads++; yield step; }
    }
    const player = createPlayer(source(), {
        isTerminal: step => step.event.kind === 'finished', render() { renders++; },
    });
    assert.equal(player.frame.progress, 1);
    assert.throws(() => player.advance(1), /stepDurationMs/);
    assert.equal(reads, 1);
    assert.equal(renders, 1);
    player.advance(0);
    assert.equal(renders, 2);
    for (const step of [...graphSteps(graph, 'A')].slice(1)) {
        assert.deepEqual(player.nextStep().current, step.state);
        assert.equal(player.frame.progress, 1);
    }
    assert.equal(player.finished, true);
    assert.equal(reads, [...graphSteps(graph, 'A')].length);
});

test('timed playback defaults final hold to zero; array adapter accepts omitted options', () => {
    const steps = [{ index: 0, state: {}, event: { type: 'start' } },
        { index: 1, state: {}, event: { type: 'done' } }];
    const timed = createPlayer(steps, { stepDurationMs: 50, isTerminal: s => s.event.type === 'done' });
    timed.advance(50);
    assert.equal(timed.finished, true);
    for (const options of [undefined, { stepDurationMs: undefined, finalHoldMs: undefined }]) {
        const player = createArrayPlayer(steps, options);
        assert.equal(player.nextStep().progress, 1);
        assert.equal(player.finished, true);
    }
});

test('manual final hold and invalid explicit timing remain well defined', () => {
    const steps = [{ index: 0, state: {}, event: 'done' }];
    const player = createPlayer(steps, { finalHoldMs: 20, isTerminal: () => true });
    assert.equal(player.finished, false);
    player.nextStep();
    assert.equal(player.finished, true);
    for (const stepDurationMs of [0, -1, NaN, Infinity, null]) {
        assert.throws(() => createPlayer(steps, { stepDurationMs, isTerminal: () => true }), RangeError);
    }
    for (const finalHoldMs of [-1, NaN, Infinity, null]) {
        assert.throws(() => createPlayer(steps, { finalHoldMs, isTerminal: () => true }), RangeError);
    }
});

const graph = {
    nodes: ['A', 'B', 'C'].map(id => ({ id })),
    edges: [{ id: 'AB', from: 'A', to: 'B' }, { id: 'AC', from: 'A', to: 'C' }],
};

test('nextStep handles a single terminal snapshot and hold', () => {
    for (const finalHoldMs of [0, 123.4]) {
        let renders = 0;
        const player = createPlayer([{ index: 42, state: 'only', event: 'done' }], {
            stepDurationMs: 0.7, finalHoldMs, isTerminal: () => true,
            render() { renders++; },
        });
        assert.equal(player.finished, finalHoldMs === 0);
        const frame = player.nextStep();
        assert.equal(frame.stepIndex, 42);
        assert.equal(frame.progress, 1);
        assert.equal(player.finished, true);
        assert.equal(renders, 2);
    }
});

test('nextStep preserves primary errors and closes the iterator once', () => {
    for (const mode of ['render', 'predicate', 'return', 'exhaustion']) {
        const primary = new Error(mode);
        let reads = 0, closes = 0;
        const source = {
            [Symbol.iterator]() { return this; },
            next() { return { done: mode === 'exhaustion' && reads > 0,
                value: { index: reads++, state: {}, event: 'step' } }; },
            return() { closes++; throw mode === 'return' ? primary : new Error('cleanup'); },
        };
        const player = createPlayer(source, {
            stepDurationMs: 650, finalHoldMs: 0,
            isTerminal(step) {
                if (step.index > 0 && mode === 'predicate') throw primary;
                return step.index > 0 && mode === 'return';
            },
            render(frame) { if (frame.stepIndex > 0 && mode === 'render') throw primary; },
        });
        assert.throws(() => player.nextStep(), error => mode === 'exhaustion'
            ? /without a terminal/.test(error.message) : error === primary);
        assert.equal(closes, 1);
        assert.throws(() => player.nextStep(), /disposed/);
        player.dispose();
        assert.equal(closes, 1);
    }
});
function setup(finalHoldMs = 0) {
    let reads = 0, closes = 0, renders = 0;
    function* source() {
        try { for (const step of graphSteps(graph, 'A')) { reads++; yield step; } }
        finally { closes++; }
    }
    const player = createPlayer(source(), {
        stepDurationMs: 1000, finalHoldMs,
        isTerminal: step => step.event.kind === 'finished',
        render() { renders++; },
    });
    return { player, counts: () => ({ reads, closes, renders }) };
}

test('nextStep: graph yields and projected nodes/edges match history, one render per call', () => {
    const expected = [...graphSteps(graph, 'A')];
    const { player, counts } = setup();
    assert.deepEqual(counts(), { reads: 1, closes: 0, renders: 1 });
    assert.deepEqual(player.frame.current, expected[0].state);
    for (const step of expected.slice(1)) {
        const frame = player.nextStep();
        assert.equal(frame.progress, 1);
        assert.equal(frame.stepIndex, step.index);
        assert.deepEqual(graphScene(frame.current), graphScene(step.state));
        assert.equal(counts().reads, step.index + 1);
        assert.equal(counts().renders, step.index + 1);
    }
    assert.equal(player.finished, true);
    assert.equal(counts().closes, 1);
    player.nextStep();
    assert.equal(counts().reads, expected.length);
    assert.equal(counts().renders, expected.length + 1);
});

test('nextStep: partial graph transition finishes without another source read', () => {
    const { player, counts } = setup();
    player.advance(400);
    const before = counts();
    const frame = player.nextStep();
    assert.equal(frame.stepIndex, 1);
    assert.equal(frame.current.current, 'A');
    assert.equal(frame.progress, 1);
    assert.deepEqual(counts(), { ...before, renders: before.renders + 1 });
    player.dispose();
    assert.equal(counts().closes, 1);
    assert.throws(() => player.nextStep(), /disposed/);
});

test('nextStep: terminal hold is completed separately without reading a new state', () => {
    const { player, counts } = setup(2500);
    while (player.frame.event.kind !== 'finished') player.nextStep();
    assert.equal(player.finished, false);
    player.advance(200);
    const before = counts();
    player.nextStep();
    assert.equal(player.finished, true);
    assert.deepEqual(counts(), { ...before, renders: before.renders + 1 });
});

test('nextStep preserves source errors and cleanup', () => {
    const failure = new Error('source failed');
    let closed = 0;
    function* source() {
        try { yield { index: 0, state: {}, event: 'start' }; throw failure; }
        finally { closed++; }
    }
    const player = createPlayer(source(), {
        stepDurationMs: 1000, finalHoldMs: 0, isTerminal: () => false,
    });
    assert.throws(() => player.nextStep(), error => error === failure);
    assert.equal(closed, 1);
    assert.throws(() => player.nextStep(), /disposed/);
});

test('nextStep reaches exact boundaries after fractional advancement', () => {
    const player = createPlayer(graphSteps(graph, 'A'), {
        stepDurationMs: 650, finalHoldMs: 0,
        isTerminal: step => step.event.kind === 'finished',
    });
    player.advance(0.3);
    const frame = player.nextStep();
    assert.equal(frame.stepIndex, 1);
    assert.equal(frame.progress, 1);
    const next = player.nextStep();
    assert.equal(next.stepIndex, 2);
    assert.equal(next.progress, 1);
    player.dispose();
});
