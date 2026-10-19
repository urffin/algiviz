import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlayer, createTimeline } from '@grundyjs/algiviz/playback';
import { binarySearch } from '../examples/binary-search-algorithm.mjs';
import { binarySearchScene, binarySearchLayout, createBinarySearchRenderer } from '../examples/binary-search-scene.mjs';
import { timing } from '../examples/player-settings.mjs';

test('first occurrence, closed-interval invariants, counters and immutable snapshots', () => {
    const cases = [[], [0], [-0, 0], [-Number.MAX_VALUE, 0, Number.MAX_VALUE], [-3.5, 0.25, 2.5], Array(2000).fill(4)];
    for (let n = 0; n <= 6; n++) for (let mask = 0; mask < 3 ** n; mask++) {
        let code = mask;
        cases.push(Array.from({ length: n }, () => { const value = code % 3 - 1; code = Math.floor(code / 3); return value; }).sort((a, b) => a - b));
    }
    for (const values of cases) for (const target of [-Number.MAX_VALUE, -3.5, -2, -1, 0, 1, 2, 2.5, 4, 5, Number.MAX_VALUE]) {
        const original = [...values], steps = binarySearch.steps(values, target), expected = values.indexOf(target);
        assert.deepEqual(values, original);
        assert.equal(steps.at(-1).state.result, expected);
        assert.equal(steps.at(-1).state.probes, steps.filter(step => step.event.type === 'probe').length);
        assert.ok(steps.at(-1).state.probes <= (values.length ? Math.floor(Math.log2(values.length)) + 1 : 0));
        for (const [index, step] of steps.entries()) {
            const s = step.state;
            for (const object of [step, s, s.values, step.event]) assert.ok(Object.isFrozen(object));
            assert.equal(index, step.index);
            assert.equal(s.values, steps[0].state.values);
            assert.ok(s.low >= 0 && s.low <= values.length && s.high >= -1 && s.high < values.length);
            if (s.mid !== null) assert.ok(s.mid >= s.low && s.mid <= s.high);
            assert.ok(values.slice(0, s.low).every(value => value < target));
            if (s.candidate !== null) assert.ok(values[s.candidate] === target);
            if (expected !== -1) assert.ok(expected === s.candidate || expected >= s.low && expected <= s.high);
        }
    }
    for (const input of [[NaN], [Infinity], ['2'], Array(3)]) assert.throws(() => binarySearch.iterate(input, 2), TypeError);
    assert.throws(() => binarySearch.iterate([], NaN), TypeError);
    assert.throws(() => binarySearch.iterate([2, 1], 1), RangeError);
    const input = [1, 2, 2], iterator = binarySearch.iterate(input, 2);
    input[0] = 99;
    assert.equal(iterator.next().value.state.values[0], 1);
});
test('generator/history parity, lazy consumption, restart and early disposal', () => {
    for (const values of [[], [1], [2, 2, 2], [-4, 0, 3, 3, 7], Array.from({ length: 2000 }, (_, i) => i)]) {
        for (const target of [0, 3, 2001]) {
            const steps = binarySearch.steps(values, target), timeline = createTimeline(steps, timing);
            let consumed = 0, closed = 0;
            function* tracked() { try { for (const step of binarySearch.iterate(values, target)) { consumed++; yield step; } } finally { closed++; } }
            const player = createPlayer(tracked(), { ...timing, isTerminal: step => step.event.type === 'done' });
            assert.equal(consumed, 1);
            assert.deepEqual(player.frame, timeline.sample(0));
            let time = 0;
            while (!player.finished) {
                time += 137;
                assert.deepEqual(player.advance(137), timeline.sample(time));
            }
            assert.equal(closed, 1);
            assert.equal(consumed, steps.length);
            player.dispose();
            assert.equal(closed, 1);
            assert.deepEqual(binarySearch.steps(values, target), [...binarySearch.iterate(values, target)]);
            const restarted = binarySearch.iterate(values, target);
            assert.equal(restarted.next().value.index, 0);
            assert.equal(restarted.return().done, true);
            assert.equal(restarted.next().done, true);
            const early = createPlayer(tracked(), { ...timing, isTerminal: step => step.event.type === 'done' });
            const before = consumed; early.dispose();
            assert.equal(consumed, before);
            assert.equal(closed, 2);
        }
    }
});
test('scene identities, viewport geometry, dense labels and bidirectional seeking', () => {
    for (const n of [0, 1, 16, 32, 64, 2000]) for (const width of [200, 320, 375, 960]) {
        const values = Array.from({ length: n }, (_, i) => Math.floor(i / 2)), steps = binarySearch.steps(values, 3);
        const layout = binarySearchLayout(width, n);
        if (n === 2000) assert.equal(layout.labels, false);
        for (let i = 0; i < n; i++) {
            const p = layout.position(i);
            assert.ok(Number.isFinite(p.x + p.y + p.width + layout.height));
            assert.ok(p.x >= 0 && p.x + p.width <= width && p.y + 78 < layout.height);
        }
        const text = [];
        const ctx = new Proxy({ canvas: { width, height: layout.height } }, { get(object, key) {
            if (key in object) return object[key];
            return (...args) => { if (key === 'fillText') text.push(args[0]); for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg)); };
        } });
        const renderer = createBinarySearchRenderer(), timeline = createTimeline(steps, timing);
        for (const step of [...steps, ...steps.toReversed()]) {
            const scene = binarySearchScene(step.state);
            assert.equal(new Set(scene.objects.map(object => object.id)).size, n);
            assert.deepEqual(scene.objects.map(object => object.data.value), values);
            renderer.render(ctx, timeline.sample(step.index * timing.stepDurationMs), width);
        }
        if (n === 2000) assert.equal(text.length, 0);
    }
});
