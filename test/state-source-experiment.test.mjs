import test from 'node:test';
import assert from 'node:assert/strict';
import { createStatePlayer as createStateExperiment } from '@grundyjs/algiviz/playback';
function* circleStates() { for (const x of [40, 200, 360, 560]) yield { x }; }

test('timed state playback detects exhaustion at the boundary and respects final hold', () => {
    let reads = 0;
    function* states() { reads++; yield 10; reads++; yield 20; reads++; }
    const p = createStateExperiment(states(), { stepDurationMs: 100, finalHoldMs: 50 });
    p.advance(40);
    assert.equal(reads, 2);
    assert.equal(p.frame.progress, .4);
    p.nextStep();
    assert.equal(reads, 2);
    assert.equal(p.finished, false);
    p.advance(25);
    assert.equal(reads, 3);
    assert.equal(p.frame.current, 20);
    assert.equal(p.frame.previous, 20);
    assert.equal(p.frame.stepIndex, 1);
    assert.equal(p.frame.event, undefined);
    assert.equal(p.finished, false);
    p.advance(25);
    assert.equal(p.finished, true);
});
import { graphSteps } from '../examples/graph-algorithm.mjs';
import { graphScene } from '../examples/graph-scene.mjs';

const graph = { nodes: ['A', 'B', 'C'].map(id => ({ id })),
    edges: [{ id: 'AB', from: 'A', to: 'B' }, { id: 'AC', from: 'A', to: 'C' }] };
function* graphStates() { for (const step of graphSteps(graph, 'A')) yield step.state; }

test('effects and exhaustion happen only when requested; redraw does not resume source', () => {
    const effects = [];
    function* source() {
        effects.push('first'); yield { x: 40 };
        effects.push('second'); yield { x: 200 };
        effects.push('end');
    }
    const p = createStateExperiment(source());
    assert.deepEqual(effects, ['first']);
    p.advance(0);
    assert.deepEqual(effects, ['first']);
    p.nextStep();
    assert.deepEqual(effects, ['first', 'second']);
    const last = p.frame.current;
    assert.equal(p.finished, false);
    p.nextStep();
    assert.deepEqual(effects, ['first', 'second', 'end']);
    assert.equal(p.frame.current, last);
    assert.equal(p.frame.stepIndex, 1);
    assert.equal(p.finished, true);
    p.nextStep();
    assert.deepEqual(effects, ['first', 'second', 'end']);
});

{
    test(`state adapter parity for circle and graph`, () => {
        for (const source of [circleStates, graphStates]) {
            const expected = [...source()];
            let renders = 0;
            const player = createStateExperiment(source(), { render() { renders++; } });
            assert.deepEqual(player.frame.current, expected[0]);
            for (let i = 1; i < expected.length; i++) {
                const frame = player.nextStep();
                assert.deepEqual(frame.current, expected[i]);
                assert.equal(frame.stepIndex, i);
                assert.equal(frame.progress, 1);
                if (source === graphStates) assert.deepEqual(graphScene(frame.current), graphScene(expected[i]));
            }
            assert.equal(player.finished, false);
            if (!player.finished) {
                assert.equal(player.nextStep().current, player.frame.previous);
                assert.equal(player.frame.stepIndex, expected.length - 1);
            }
            assert.equal(player.finished, true);
            assert.equal(renders, expected.length + 1);
        }
    });

    test(`empty, singleton, infinite, disposal`, () => {
        assert.throws(() => createStateExperiment([]), /at least one/);
        const single = createStateExperiment([undefined]);
        assert.equal(single.finished, false);
        single.nextStep();
        assert.equal(single.finished, true);
        let reads = 0, closed = 0;
        function* infinite() { try { while (true) yield { n: reads++ }; } finally { closed++; } }
        const p = createStateExperiment(infinite());
        assert.equal(reads, 1);
        for (let i = 0; i < 10000; i++) p.nextStep();
        assert.equal(reads, 10001);
        assert.equal(p.frame.current.n, 10000);
        p.dispose(); p.dispose();
        assert.equal(closed, 1);
        assert.throws(() => p.nextStep(), /disposed/);
    });

    test(`source and render errors preserve primary error`, () => {
        const primary = new Error('source');
        let closed = 0, calls = 0;
        const source = { [Symbol.iterator]() { return this; },
            next() { if (calls++ === 1) throw primary; return { value: {}, done: false }; },
            return() { closed++; throw new Error('cleanup'); } };

        {
            const p = createStateExperiment(source);
            assert.throws(() => p.nextStep(), e => e === primary);
        }
        assert.equal(closed, 1);
        let disposed = 0;
        function* values() { try { while (true) yield {}; } finally { disposed++; } }
        assert.throws(() => createStateExperiment(values(), { render() { throw primary; } }), e => e === primary);
        assert.equal(disposed, 1);
    });
}

test('state-shaped step objects remain raw states; generator return values are ignored', () => {
    const state = { index: 7, state: 'user data', event: 'user event' };
    function* source() { yield state; return { extra: true }; }
    const p = createStateExperiment(source());
    assert.equal(p.frame.current, state);
    assert.equal(p.frame.stepIndex, 0);
    assert.equal(p.finished, false);
    p.nextStep();
    assert.equal(p.finished, true);
});
