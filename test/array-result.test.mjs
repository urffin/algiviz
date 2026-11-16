import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createArrayTrace, createArrayPlayer, createArrayTimeline, defineArrayAlgorithm } from '@grundyjs/algiviz/array';
import { createArrayRenderer, createSortRenderer, arrayScene } from '@grundyjs/algiviz/canvas';
import { Player } from '@grundyjs/algiviz/player';
import { dom } from './player-test-dom.mjs';

function draw(renderer, frame, width = 720) {
    const bars = [], texts = [];
    renderer.render({ canvas: { width, height: 300 }, save() {}, restore() {}, setTransform() {},
        fillRect(x, y, w, h) { if (w !== width) bars.push(this.fillStyle); },
        fillText(text) { texts.push(text); } }, frame);
    return { bars, texts };
}
const frame = step => ({ previous: step.state, current: step.state, event: step.event, stepIndex: step.index, progress: 1 });
function terminal(values = [7, 3, 2], result = [2]) {
    const trace = createArrayTrace(values); trace.start(); return trace.done({ result });
}
const algorithm = defineArrayAlgorithm(function* (array) {
    yield array.start(); yield array.highlight([0]); yield array.done({ result: [0] });
});

test('result: legacy calls and nonterminal snapshots omit metadata; explicit [] is owned and frozen', () => {
    for (const options of [undefined, {}, { result: undefined }]) {
        const trace = createArrayTrace([2, 1]);
        assert.equal(Object.hasOwn(trace.start().state, 'resultItemIds'), false);
        assert.equal(Object.hasOwn(trace.highlight([1]).state, 'resultItemIds'), false);
        const done = trace.done(options); assert.deepEqual(done.event, { type: 'done' });
        assert.equal(Object.hasOwn(done.state, 'resultItemIds'), false);
    }
    const input = [], trace = createArrayTrace([]); trace.start();
    const done = trace.done({ result: input });
    assert.deepEqual(done.state.resultItemIds, []); assert.notEqual(done.state.resultItemIds, input);
    assert.ok(Object.isFrozen(done.state.resultItemIds)); assert.equal(done.state.writes, 0);
    assert.throws(() => trace.done(), Error);
});

test('result: completion positions resolve stable IDs after reordering, deduplicated in selection order', () => {
    const trace = createArrayTrace([2, 2, 1]); const first = trace.start();
    trace.swap(0, 2); trace.select(1); trace.shift(0, 1); const before = trace.insert(0);
    const input = [2, 0, 2, 1]; const done = trace.done({ result: input, sortedPrefixLength: 1, sortedSuffixLength: 1 });
    assert.deepEqual(done.state.resultItemIds, ['item-0', 'item-1', 'item-2']);
    assert.equal(done.index, before.index + 1); assert.equal(done.state.writes, before.state.writes);
    assert.equal(done.state.comparisons, before.state.comparisons);
    assert.deepEqual(done.state.slots, before.state.slots); assert.equal(first.state.resultItemIds, undefined);
    assert.equal(done.state.sortedPrefixLength, 1); assert.equal(done.state.sortedSuffixLength, 1);
    input.fill(0); assert.deepEqual(done.state.resultItemIds, ['item-0', 'item-1', 'item-2']);
    for (const value of [done, done.state, done.event, done.state.slots, done.state.resultItemIds]) assert.ok(Object.isFrozen(value));
});

test('result: wrong collections, sparse and inherited entries reject atomically and can be retried', () => {
    const inherited = new Array(1); Object.setPrototypeOf(inherited, Object.assign(Object.create(Array.prototype), { 0: 0 }));
    const invalidLengths = [NaN, -1, Infinity, '1', 1.5, 0x100000000,
        { valueOf() { assert.fail('Array length coerced'); } }].map(length => new Proxy([0], {
            get(target, key, receiver) { return key === 'length' ? length : Reflect.get(target, key, receiver); },
        }));
    for (const result of [null, 0, '0', {}, { 0: 0, length: 1 }, new Set([0]), new Uint8Array([0]), new Array(1), [-1, ,], inherited, ...invalidLengths]) {
        const trace = createArrayTrace([3, 1]); const start = trace.start({ sortedPrefixLength: 1 });
        assert.throws(() => trace.done({ result, sortedPrefixLength: 2, sortedSuffixLength: 2 }), TypeError);
        const checkpoint = trace.highlight([]); assert.equal(checkpoint.index, 1); assert.deepEqual(checkpoint.state, start.state);
        assert.deepEqual(trace.done({ result: [1] }).state.resultItemIds, ['item-1']);
    }
});

test('result: every invalid position is RangeError without coercion or partial marker changes', () => {
    const poison = { valueOf() { assert.fail('Position coerced'); } };
    for (const value of ['held', '1', null, undefined, true, poison, new Number(1), -1, 2, .5, NaN, Infinity, -Infinity]) {
        const trace = createArrayTrace([0, -3]); const start = trace.start();
        assert.throws(() => trace.done({ result: [0, value], sortedSuffixLength: 2 }), RangeError);
        const checkpoint = trace.highlight([]); assert.equal(checkpoint.index, 1); assert.deepEqual(checkpoint.state, start.state);
        assert.equal(trace.done({ result: [1] }).index, 2);
    }
    const empty = createArrayTrace([]); empty.start(); assert.throws(() => empty.done({ result: [0] }), RangeError);
    assert.deepEqual(empty.done({ result: [] }).state.resultItemIds, []);
});

test('result: options, length and entries are captured once in documented order', () => {
    const reads = [], trace = createArrayTrace([4, 1]); trace.start();
    const positions = new Proxy([1, 1], { get(target, key, receiver) { reads.push(String(key)); return Reflect.get(target, key, receiver); } });
    const done = trace.done({ get sortedPrefixLength() { reads.push('prefix'); return 1; },
        get sortedSuffixLength() { reads.push('suffix'); return undefined; }, get result() { reads.push('result'); return positions; } });
    assert.deepEqual(reads, ['prefix', 'suffix', 'result', 'length', '0', '1']);
    assert.deepEqual(done.state.resultItemIds, ['item-1']);
});

test('result: lifecycle/held/sorted errors precede reading result', () => {
    const unread = { get result() { assert.fail('Result read before prior validation'); } };
    const trace = createArrayTrace([2]); assert.throws(() => trace.done(unread), Error);
    trace.start(); trace.select(0); assert.throws(() => trace.done(unread), Error); trace.insert(0);
    assert.throws(() => trace.done(Object.defineProperty({ sortedPrefixLength: 3 }, 'result', Object.getOwnPropertyDescriptor(unread, 'result'))), RangeError);
    assert.throws(() => trace.done(Object.defineProperty({ sortedSuffixLength: 2 }, 'result', Object.getOwnPropertyDescriptor(unread, 'result'))), RangeError);
    assert.throws(() => trace.done({ sortedPrefixLength: -1, get sortedSuffixLength() { assert.fail('Suffix read'); } }), RangeError);
    trace.done({ result: [0] }); assert.throws(() => trace.done(unread), Error);
});

test('result: getters/proxy throws preserve falsy primaries and leave completion retryable', () => {
    for (const primary of [undefined, null, false, 0, 'failure']) for (const stage of ['prefix', 'suffix', 'result', 'length', 'entry', 'own']) {
        const trace = createArrayTrace([2, 1]); const start = trace.start();
        const fail = () => { throw primary; };
        const options = { sortedPrefixLength: 2, result: [1] };
        if (stage === 'prefix' || stage === 'suffix' || stage === 'result') Object.defineProperty(options,
            { prefix: 'sortedPrefixLength', suffix: 'sortedSuffixLength', result: 'result' }[stage], { get: fail });
        else options.result = new Proxy([1], { get(target, key, receiver) {
            if (key === (stage === 'length' ? 'length' : '0')) throw primary; return Reflect.get(target, key, receiver);
        }, getOwnPropertyDescriptor(target, key) { if (stage === 'own') throw primary; return Reflect.getOwnPropertyDescriptor(target, key); } });
        let caught = false; try { trace.done(options); } catch (error) { caught = true; assert.equal(error, primary); }
        assert.ok(caught); const checkpoint = trace.highlight([]); assert.equal(checkpoint.index, 1); assert.deepEqual(checkpoint.state, start.state);
        assert.deepEqual(trace.done({ result: [1] }).state.resultItemIds, ['item-1']);
    }
});

test('result: default green, unchanged done caption, several results, empty and unknown IDs in both themes', () => {
    for (const [theme, green, ordinary] of [['light', '#047857', '#475569'], ['dark', '#34d399', '#94a3b8']]) {
        const renderer = createArrayRenderer({ theme }), done = terminal();
        assert.deepEqual(draw(renderer, frame(done)).bars, [ordinary, ordinary, green]);
        assert.ok(draw(renderer, frame(done)).texts.includes('AlgiViz · done · 1'));
        assert.deepEqual(draw(renderer, frame(terminal([7, 3, 2], [0, 2]))).bars, [green, ordinary, green]);
        assert.deepEqual(draw(renderer, frame(terminal([], []))).bars, []);
        assert.deepEqual(draw(renderer, { ...frame(done), current: { ...done.state, resultItemIds: ['unknown'] } }).bars, [ordinary, ordinary, ordinary]);
        assert.deepEqual(draw(renderer, { ...frame(done), current: { ...done.state, resultItemIds: undefined } }).bars, [ordinary, ordinary, ordinary]);
        assert.deepEqual(draw(createSortRenderer({ theme }), frame(done)), draw(renderer, frame(done)));
    }
    assert.equal(createSortRenderer, createArrayRenderer);
});

test('result: palette capture is independent and priority is held > active > result > sorted > bar', () => {
    const colors = { result: 'green', sorted: 'blue', active: 'orange', held: 'purple', bar: 'gray' };
    const renderer = createArrayRenderer({ theme: 'light', colors }); colors.result = 'red';
    const done = terminal([4, 3, 2, 1], [0, 1, 2]);
    const current = { ...done.state, sortedPrefixLength: 4, slots: [null, ...done.state.slots.slice(1)], held: done.state.slots[0] };
    const f = { ...frame(done), current, event: { type: 'highlight', itemIds: [done.state.slots[1].id] } };
    assert.deepEqual(draw(renderer, f).bars, ['orange', 'green', 'blue', 'purple']);
    assert.deepEqual(draw(createArrayRenderer({ theme: 'light', colors: { active: 'red', sorted: 'blue', result: undefined } }), frame(done)).bars,
        ['#047857', '#047857', '#047857', '#475569']);
    assert.deepEqual(arrayScene(done.state).objects.map(o => Object.keys(o.data)), Array(4).fill(['item', 'index', 'held']));
});

test('result: timeline seeking, hold, resize and repeated render derive markers only from current', () => {
    const steps = algorithm.steps([1, 3]), timeline = createArrayTimeline(steps, { stepDurationMs: 100, finalHoldMs: 200 });
    const renderer = createArrayRenderer({ theme: 'light' });
    for (const time of [200, 400, 0, 200, 100, 201, 0]) {
        const f = timeline.sample(time), expected = f.event.type === 'done' ? 1 : 0;
        assert.equal(draw(renderer, f).bars.filter(c => c === '#047857').length, expected);
        assert.equal(draw(renderer, f, 900).bars.filter(c => c === '#047857').length, expected);
    }
    const player = createArrayPlayer(algorithm.iterate([1, 3]), { finalHoldMs: 100 });
    player.nextStep(); player.nextStep(); assert.equal(player.finished, false);
    assert.equal(draw(renderer, player.frame).bars[0], '#047857'); player.nextStep(); assert.ok(player.finished); player.dispose();
});

test('result: bounded Player rewind replays done without source reads, Restart clears selection, dispose closes once', async () => {
    const env = dom(), renderer = createArrayRenderer({ theme: 'light' }); let reads = 0, closes = 0, last;
    function* source() { try { for (const step of algorithm.iterate([1, 3])) { reads++; yield step; } } finally { closes++; } }
    const player = new Player(env.container(), { stepSource: source, isTerminal: s => s.event.type === 'done', rewindCapacity: 3,
        render(f) { last = draw(renderer, f); } });
    player.start(); player.next(); assert.equal(player.next().phase, 'finished');
    assert.deepEqual(last.bars, ['#047857', '#475569']); assert.equal(closes, 1);
    player.previous(); assert.deepEqual(last.bars, ['#b45309', '#475569']);
    player.next(); assert.equal(reads, 3); assert.equal(closes, 1); assert.deepEqual(last.bars, ['#047857', '#475569']);
    player.restart(); assert.deepEqual(last.bars, ['#475569', '#475569']); assert.equal(player.frame.current.resultItemIds, undefined);
    player.dispose(); player.dispose(); assert.equal(closes, 2); assert.equal((await player.closed).errorCount, 0);
});
