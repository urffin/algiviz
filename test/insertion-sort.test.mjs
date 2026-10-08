import assert from "node:assert/strict";
import { test } from "node:test";
import { insertionSortSteps } from "../dist/core/index.js";

function verifyTrace(input) {
    const source = [...input];
    const trace = insertionSortSteps(Object.freeze(input));
    assert.deepEqual(input, source);
    assert.deepEqual(trace, insertionSortSteps(source));
    assert.equal(trace[0].event.type, "start");
    assert.deepEqual(trace[0].state.slots.map(item => item.value), source);
    assert.equal(trace.at(-1).event.type, "done");
    const expected = source.map((value, index) => ({ id: `item-${index}`, value }))
        .sort((a, b) => a.value - b.value);
    assert.deepEqual(trace.at(-1).state.slots, expected);
    assert.equal(trace.at(-1).state.held, null);
    assert.equal(trace.at(-1).state.sortedPrefixLength, input.length);

    let comparisons = 0;
    let writes = 0;
    for (let index = 0; index < trace.length; index++) {
        const { state, event } = trace[index];
        assert.equal(trace[index].index, index);
        const allItems = state.slots.filter(Boolean).concat(state.held ? [state.held] : []);
        assert.deepEqual(allItems.map(item => item.id).sort(),
            source.map((_, i) => `item-${i}`).sort());
        for (const item of allItems) {
            assert.equal(item.value, source[Number(item.id.slice(5))]);
        }
        assert.equal(state.slots.filter(item => item === null).length, state.held ? 1 : 0);
        const prefix = state.slots.slice(0, state.sortedPrefixLength);
        assert.ok(prefix.every(Boolean));
        assert.ok(prefix.every((item, i) => i === 0 || prefix[i - 1].value <= item.value));
        if (event.type === "compare") comparisons++;
        if (event.type === "shift" || event.type === "insert") writes++;
        assert.equal(state.comparisons, comparisons);
        assert.equal(state.writes, writes);
        if (!index) continue;
        const previous = trace[index - 1].state;
        const slots = [...previous.slots];
        let held = previous.held;
        switch (event.type) {
            case "select":
                assert.equal(held, null);
                assert.equal(slots[event.from].id, event.itemId);
                held = slots[event.from];
                slots[event.from] = null;
                break;
            case "compare":
                assert.equal(held.id, event.rightId);
                assert.ok(slots.some(item => item?.id === event.leftId));
                break;
            case "shift":
                assert.equal(slots[event.to], null);
                assert.equal(event.to, event.from + 1);
                assert.equal(slots[event.from].id, event.itemId);
                assert.ok(slots[event.from].value > held.value);
                slots[event.to] = slots[event.from];
                slots[event.from] = null;
                break;
            case "insert":
                assert.equal(slots[event.to], null);
                assert.equal(held.id, event.itemId);
                slots[event.to] = held;
                held = null;
                break;
            case "done": break;
            default: assert.fail(`Unexpected event ${event.type}`);
        }
        assert.deepEqual(state.slots, slots);
        assert.deepEqual(state.held, held);
    }
    return trace;
}

for (const input of [[], [1], [1, 2, 3], [3, 2, 1], [5, 2, 4, 2, 1],
    [-3, 0, -7, 2.5, -3], [0, -0, 0], [Number.MAX_VALUE, -Number.MAX_VALUE]]) {
    test(`valid trace for ${JSON.stringify(input)}`, () => verifyTrace(input));
}

test("exhaustive arrays with repeated values up to length 6", () => {
    function enumerate(values, remaining) {
        verifyTrace(values);
        if (remaining) for (const value of [-1, 0, 1]) enumerate([...values, value], remaining - 1);
    }
    enumerate([], 6);
});

test("known counters and best-case comparisons", () => {
    assert.equal(insertionSortSteps([3, 2, 1]).at(-1).state.comparisons, 3);
    assert.equal(insertionSortSteps([3, 2, 1]).at(-1).state.writes, 5);
    assert.equal(insertionSortSteps([1, 2, 3, 4]).at(-1).state.comparisons, 3);
    assert.equal(insertionSortSteps([2, 2, 2]).filter(step => step.event.type === "shift").length, 0);
});

test("rejects non-finite numbers, wrong types and sparse inputs", () => {
    for (const input of [[NaN], [Infinity], [-Infinity], [1, "2"], [undefined], Array(2)]) {
        assert.throws(() => insertionSortSteps(input), TypeError);
    }
});

test("snapshots are deeply immutable and independent", () => {
    const steps = insertionSortSteps([3, 1, 2]);
    assert.throws(() => steps.push(steps[0]), TypeError);
    assert.throws(() => { steps[0].index = 10; }, TypeError);
    assert.throws(() => { steps[0].event.type = "done"; }, TypeError);
    assert.throws(() => { steps[0].state.writes = 20; }, TypeError);
    assert.throws(() => { steps[0].state.slots[0] = null; }, TypeError);
    assert.throws(() => { steps[0].state.slots[0].value = 99; }, TypeError);
    const selected = steps.find(step => step.state.held);
    assert.throws(() => { selected.state.held.value = 99; }, TypeError);
    assert.notEqual(steps[0].state.slots, steps[1].state.slots);
    assert.deepEqual(steps[0].state.slots.map(item => item.value), [3, 1, 2]);
});
