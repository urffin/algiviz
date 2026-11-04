import assert from 'node:assert/strict';
import test from 'node:test';
import { createArrayTrace } from '@grundyjs/algiviz/array';

function conserved(snapshot, original) {
    const items = snapshot.slots.filter(item => item !== null).concat(snapshot.held ?? []);
    assert.deepEqual(items.map(item => item.id).sort(), original.map(item => item.id).sort());
    assert.equal(new Set(items.map(item => item.id)).size, original.length);
    assert.equal(snapshot.slots.filter(item => item === null).length, Number(snapshot.held !== null));
    assert.equal(snapshot.slots.length, original.length);
    for (const item of items) assert.equal(item, original.find(old => old.id === item.id));
}

test('swap/shift reject non-numeric and invalid positions atomically, including held', () => {
    const invalid = ['held', '1', null, undefined, true, {}, [], -1, 3, .5, NaN, Infinity, -Infinity];
    for (const value of invalid) for (const operation of ['swap-left', 'swap-right', 'shift-from', 'shift-to']) {
        const trace = createArrayTrace([7, 7, 1]);
        const start = trace.start({ sortedPrefixLength: 1, sortedSuffixLength: 1 });
        const original = start.state.slots;
        const selected = trace.select(0);
        const before = JSON.stringify([start, selected]);
        const regions = { sortedPrefixLength: 2, sortedSuffixLength: 2 };
        const act = {
            'swap-left': () => trace.swap(value, 1, regions),
            'swap-right': () => trace.swap(1, value, regions),
            'shift-from': () => trace.shift(value, 0, regions),
            'shift-to': () => trace.shift(1, value, regions),
        }[operation];
        assert.throws(act, RangeError, `${operation}: ${String(value)}`);
        const checkpoint = trace.highlight([]);
        assert.equal(checkpoint.index, 2);
        assert.deepEqual(checkpoint.state, selected.state);
        assert.equal(checkpoint.state.comparisons, 0);
        assert.equal(checkpoint.state.writes, 0);
        assert.equal(trace.held, selected.state.held);
        assert.equal(JSON.stringify([start, selected]), before);
        conserved(checkpoint.state, original);
        // A rejected operation must leave the workspace usable through completion.
        const moved = trace.shift(1, 0);
        assert.equal(moved.index, 3); assert.equal(moved.state.writes, 1);
        conserved(moved.state, original);
        const inserted = trace.insert(1);
        assert.equal(inserted.index, 4); assert.equal(inserted.state.writes, 2);
        conserved(inserted.state, original);
        const done = trace.done();
        assert.equal(done.index, 5); assert.equal(done.state.writes, 2);
        conserved(done.state, original);
        assert.equal(JSON.stringify([start, selected]), before);
    }
});

test('both numeric arguments are validated before looking up a hole or changing regions', () => {
    for (const operation of ['swap', 'shift']) {
        const trace = createArrayTrace([2, 1]); trace.start(); trace.select(0);
        // First position is a hole. The invalid second position still gets RangeError.
        assert.throws(() => trace[operation](0, 'held', { sortedPrefixLength: 2 }), RangeError);
        const step = trace.insert(0);
        assert.equal(step.index, 2);
        assert.equal(step.state.sortedPrefixLength, 0);
        assert.deepEqual(step.state.slots.map(item => item.value), [2, 1]);
    }
});

test('compare/highlight still accept held and valid swaps preserve counters and identities', () => {
    const trace = createArrayTrace([4, 4, 2]);
    const first = trace.start(), original = first.state.slots;
    trace.select(0);
    const compare = trace.compare('held', 1);
    assert.equal(compare.state.comparisons, 1);
    assert.deepEqual([compare.event.leftId, compare.event.rightId], ['item-0', 'item-1']);
    const reverseCompare = trace.compare(2, 'held');
    assert.equal(reverseCompare.state.comparisons, 2);
    const highlight = trace.highlight(['held', 1, 2]);
    assert.deepEqual(highlight.event.itemIds, ['item-0', 'item-1', 'item-2']);
    assert.ok(Object.isFrozen(highlight.event.itemIds));
    assert.deepEqual(highlight.state, reverseCompare.state);
    const swapped = trace.swap(1, 2);
    assert.equal(swapped.state.writes, 2); assert.equal(swapped.state.comparisons, 2);
    conserved(swapped.state, original);
    conserved(trace.insert(0).state, original);
});

test('explicit undefined SortedRegions preserve markers through all operations', () => {
    const trace = createArrayTrace([3, 2, 1]);
    const omitted = { sortedPrefixLength: undefined, sortedSuffixLength: undefined };
    const steps = [trace.start(omitted), trace.swap(0, 2, { sortedPrefixLength: 1, sortedSuffixLength: 1 }),
        trace.select(1, omitted), trace.shift(0, 1, omitted), trace.insert(0, omitted),
        trace.pass(2, omitted), trace.done(omitted)];
    assert.equal(steps[0].state.sortedPrefixLength, 0);
    assert.equal(Object.hasOwn(steps[0].state, 'sortedSuffixLength'), false);
    for (const step of steps.slice(1)) {
        assert.equal(step.state.sortedPrefixLength, 1);
        assert.equal(step.state.sortedSuffixLength, 1);
    }
    assert.equal(steps.at(-1).state.writes, 4);
});
