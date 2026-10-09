import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createArrayTrace, defineArrayAlgorithm, createArrayPlayer, createArrayTimeline } from '@grundyjs/algiviz/array';
import { createPlayer, createTimeline } from '@grundyjs/algiviz/playback';
import { insertion, bubble } from '../examples/algorithms.mjs';

test('external examples preserve all 2186 original traces exactly', () => {
    const hash = createHash('sha256');
    for (let n = 0; n <= 6; n++) for (let code = 0; code < 3 ** n; code++) {
        let c = code;
        const values = Array.from({ length: n }, () => { const v = c % 3 - 1; c = Math.floor(c / 3); return v; });
        for (const algorithm of [insertion, bubble]) hash.update(JSON.stringify(algorithm.steps(values)));
    }
    assert.equal(hash.digest('hex'), '5ac5461744c13eed490e537a109236a199de04bee68967ccc83b0f3d7d2c0d07');
});

test('a user-owned reverse algorithm needs no library registration or sorting', () => {
    const reverse = defineArrayAlgorithm(function* (a) {
        yield a.start();
        for (let i = 0; i < Math.floor(a.length / 2); i++) yield a.swap(i, a.length - 1 - i);
        yield a.done();
    });
    const values = [1, 2, 3, 4];
    const iterator = reverse.iterate(values);
    values[0] = 5;
    const first = iterator.next().value;
    values[0] = 9;
    const tail = [...iterator];
    assert.deepEqual(first.state.slots.map(x => x.value), [5, 2, 3, 4]);
    assert.deepEqual(tail.at(-1).state.slots.map(x => x.value), [4, 3, 2, 5]);
    assert.equal(tail.at(-1).state.writes, 4);
    assert.ok(Object.isFrozen(tail.at(-1).state.slots));
    const opts = { stepDurationMs: 100, finalHoldMs: 50 };
    const timeline = createArrayTimeline(reverse.steps([1, 2, 3]), opts);
    const rendered = [];
    const player = createArrayPlayer(reverse.iterate([1, 2, 3]), { ...opts, render: frame => rendered.push(frame) });
    assert.equal(rendered.length, 1);
    assert.deepEqual(player.advance(50), timeline.sample(50));
    assert.deepEqual(rendered.at(-1), player.frame);
    player.advance(1000);
    assert.equal(player.finished, true);
});

test('invalid array operations are atomic and do not change snapshots or counters', () => {
    const a = createArrayTrace([3, 1, 2]);
    assert.throws(() => a.swap(0, 1), /start/);
    const start = a.start();
    assert.throws(() => a.start(), /already/);
    for (const invalid of [-1, 3, 0.5, NaN]) assert.throws(() => a.at(invalid), RangeError);
    assert.throws(() => a.swap(0, 0), RangeError);
    assert.throws(() => a.swap(0, 1, { sortedPrefixLength: 2, sortedSuffixLength: 9 }), RangeError);
    assert.throws(() => a.insert(0), /No item/);
    assert.throws(() => a.shift(0, 1), /empty/);
    const selected = a.select(0);
    assert.throws(() => a.select(1), /already held/);
    assert.throws(() => a.compare(0, 1), /No item/);
    assert.throws(() => a.done(), /held/);
    assert.throws(() => a.insert(1), /empty/);
    a.shift(1, 0);
    const done = a.insert(1);
    assert.equal(done.index, 3);
    assert.equal(done.state.writes, 2);
    assert.equal(done.state.sortedPrefixLength, 0);
    assert.deepEqual(start.state.slots.map(x => x.value), [3, 1, 2]);
    assert.equal(selected.state.slots[0], null);
    a.done();
    assert.throws(() => a.compare(0, 1), /after done/);
    assert.throws(() => a.done(), /after done/);
});

test('generic playback accepts unrelated states, events, termination and rendering', () => {
    const steps = [
        { index: 0, state: { node: 'A' }, event: 'visit' },
        { index: 1, state: { node: 'B' }, event: 'visit' },
        { index: 2, state: { node: 'B' }, event: 'stop' }
    ];
    let closed = false;
    function* walk() { try { yield* steps; } finally { closed = true; } }
    const options = { stepDurationMs: 100, finalHoldMs: 25 };
    const timeline = createTimeline(steps, options);
    const frames = [];
    const player = createPlayer(walk(), { ...options, isTerminal: step => step.event === 'stop', render: f => frames.push(f) });
    for (let t = 25; t <= 250; t += 25) assert.deepEqual(player.advance(25), timeline.sample(t));
    assert.equal(player.finished, true);
    assert.equal(closed, true);
    assert.equal(frames.length, 11);
    assert.equal(frames.at(-1).current.node, 'B');
});

test('highlight freezes its IDs without changing the array or operation counters', () => {
    const a = createArrayTrace([2, 1]);
    const start = a.start();
    const positions = [0, 1];
    const step = a.highlight(positions);
    positions.pop();
    assert.deepEqual(step.event.itemIds, ['item-0', 'item-1']);
    assert.ok(Object.isFrozen(step.event.itemIds));
    assert.deepEqual(step.state, start.state);
    assert.throws(() => a.highlight([2]), RangeError);
    assert.equal(a.done().index, 2);
});

test('renderer failure closes the generic source on construction and advance', () => {
    for (const failAt of [1, 2]) {
        let closed = 0, renders = 0;
        function* source() { try { yield { index: 0, state: 0, event: 'a' }; yield { index: 1, state: 1, event: 'z' }; } finally { closed++; } }
        const options = { stepDurationMs: 100, finalHoldMs: 0, isTerminal: s => s.event === 'z', render() { if (++renders === failAt) throw new Error('render failed'); } };
        if (failAt === 1) assert.throws(() => createPlayer(source(), options), /render failed/);
        else { const player = createPlayer(source(), options); assert.throws(() => player.advance(50), /render failed/); assert.throws(() => player.advance(1), /disposed/); }
        assert.equal(closed, 1);
    }
});

test('new entry points do not import any bundled algorithms', () => {
    const visited = new Set();
    function visit(url) {
        if (visited.has(url.href)) return;
        visited.add(url.href);
        assert.ok(!/compat|insertion-sort|bubble-sort/.test(url.pathname), url.pathname);
        const text = readFileSync(url, 'utf8');
        for (const match of text.matchAll(/from\s+["'](\.[^"']+)["']/g)) visit(new URL(match[1], url));
    }
    visit(new URL('../dist/array/index.js', import.meta.url));
    visit(new URL('../dist/playback/index.js', import.meta.url));
});
