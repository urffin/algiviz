import assert from "node:assert/strict";
import { test } from "node:test";
import { bubbleSortSteps, iterateBubbleSortSteps, createSortPlayer, createSortTimeline } from "../dist/core/index.js";
import { createSortRenderer } from "../dist/canvas/index.js";

function verify(input) {
    const original = [...input];
    const steps = bubbleSortSteps(Object.freeze(input));
    assert.deepEqual(input, original);
    assert.deepEqual(steps, [...iterateBubbleSortSteps(original)]);
    assert.equal(steps[0].event.type, "start");
    assert.equal(steps.at(-1).event.type, "done");
    const expected = original.map((value, i) => ({ id: `item-${i}`, value })).sort((a, b) => a.value - b.value);
    let slots = original.map((value, i) => ({ id: `item-${i}`, value }));
    let comparisons = 0, writes = 0, suffix = 0;
    assert.ok(Object.isFrozen(steps));
    for (const [index, step] of steps.entries()) {
        const { event, state } = step;
        assert.equal(step.index, index);
        for (const object of [step, event, state, state.slots, ...state.slots]) assert.ok(Object.isFrozen(object));
        if (event.type === "compare") {
            const left = slots.findIndex(item => item.id === event.leftId);
            assert.equal(slots[left + 1]?.id, event.rightId);
            comparisons++;
        } else if (event.type === "swap") {
            assert.equal(event.right, event.left + 1);
            assert.equal(slots[event.left].id, event.leftId);
            assert.equal(slots[event.right].id, event.rightId);
            assert.ok(slots[event.left].value > slots[event.right].value);
            assert.deepEqual(steps[index - 1].event, { type: "compare", leftId: event.leftId, rightId: event.rightId });
            [slots[event.left], slots[event.right]] = [slots[event.right], slots[event.left]];
            writes += 2;
        } else if (event.type === "pass") {
            assert.ok(event.end > 0 && event.end < input.length);
            assert.ok(state.sortedSuffixLength >= input.length - event.end);
        } else assert.ok(["start", "done"].includes(event.type));
        assert.deepEqual(state.slots, slots);
        assert.equal(state.held, null);
        assert.equal(state.sortedPrefixLength, 0);
        assert.equal(state.comparisons, comparisons);
        assert.equal(state.writes, writes);
        assert.ok(state.sortedSuffixLength >= suffix && state.sortedSuffixLength <= input.length);
        suffix = state.sortedSuffixLength;
        assert.deepEqual(state.slots.slice(input.length - suffix), expected.slice(input.length - suffix));
    }
    assert.deepEqual(slots, expected);
    assert.equal(suffix, input.length);
}

test("bubble traces replay correctly and stably for exhaustive inputs of length 0–6", () => {
    for (let length = 0; length <= 6; length++) {
        for (let code = 0; code < 3 ** length; code++) {
            let remaining = code;
            const input = Array.from({ length }, () => { const value = remaining % 3 - 1; remaining = Math.floor(remaining / 3); return value; });
            verify(input);
        }
    }
    verify([Number.MAX_VALUE, -Number.MAX_VALUE, 0, -0, 2.5]);
});

test("bubble stops after a pass without swaps and counts two writes per swap", () => {
    const sorted = bubbleSortSteps([1, 2, 2, 3]);
    assert.equal(sorted.at(-1).state.comparisons, 3);
    assert.equal(sorted.at(-1).state.writes, 0);
    assert.equal(sorted.filter(step => step.event.type === "pass").length, 1);
    const reversed = bubbleSortSteps([4, 3, 2, 1]);
    assert.equal(reversed.at(-1).state.comparisons, 6);
    assert.equal(reversed.at(-1).state.writes, 12);
});

test("bubble generator validates lazily, copies input and permits early cancellation", () => {
    for (const invalid of [[NaN], [Infinity], [undefined], new Array(1)]) {
        const iterator = iterateBubbleSortSteps(invalid);
        assert.throws(() => iterator.next(), TypeError);
        assert.throws(() => bubbleSortSteps(invalid), TypeError);
    }
    const values = [2, 1];
    const iterator = iterateBubbleSortSteps(values);
    values[0] = 3;
    const start = iterator.next().value;
    values[0] = 99;
    assert.equal(start.state.slots[0].value, 3);
    assert.deepEqual([...iterator].at(-1).state.slots.map(item => item.value), [1, 3]);
    const large = iterateBubbleSortSteps(Array.from({ length: 10000 }, (_, i) => 10000 - i));
    assert.equal(large.next().value.event.type, "start");
    assert.equal(large.next().value.event.type, "compare");
    assert.equal(large.next().value.event.type, "swap");
    large.return();
    assert.equal(large.next().done, true);
});

test("bubble sequential playback matches history through swaps, passes and final hold", () => {
    for (const input of [[], [1], [3, 1, 2, 1]]) {
        const options = { stepDurationMs: 100, finalHoldMs: 75 };
        const timeline = createSortTimeline(bubbleSortSteps(input), options);
        const player = createSortPlayer(iterateBubbleSortSteps(input), options);
        assert.deepEqual(player.frame, timeline.sample(0));
        for (let time = 25; time <= timeline.durationMs + 100; time += 25) {
            assert.deepEqual(player.advance(25), timeline.sample(time));
            assert.equal(player.finished, time >= timeline.durationMs);
        }
    }
});

test("renderer moves both swapped items, highlights them and marks the final suffix", () => {
    const steps = bubbleSortSteps([2, 1]);
    const timeline = createSortTimeline(steps, { stepDurationMs: 100, finalHoldMs: 0 });
    const renderer = createSortRenderer({ theme: "dark" });
    const bars = [];
    const ctx = { canvas: { width: 400, height: 300 }, save() {}, restore() {}, setTransform() {},
        fillText() {}, fillRect(x, y, w, h) { if (w < 400) bars.push({ x, color: this.fillStyle }); } };
    const swapIndex = steps.findIndex(step => step.event.type === "swap");
    renderer.render(ctx, timeline.sample((swapIndex - 0.75) * 100));
    assert.equal(bars.length, 2);
    assert.ok(bars.every(bar => bar.color === "#fbbf24"));
    assert.ok(bars[0].x > bars[1].x); // Slots already swapped, but both bars are still in transit.
    bars.length = 0;
    renderer.render(ctx, timeline.sample(timeline.durationMs));
    assert.ok(bars.every(bar => bar.color === "#34d399"));
});
