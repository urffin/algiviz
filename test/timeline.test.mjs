import assert from "node:assert/strict";
import { test } from "node:test";
import { createArrayPlayer as createSortPlayer, createArrayTimeline as createSortTimeline } from "@grundyjs/algiviz/array";
import { createTimeline, mapFrame } from "@grundyjs/algiviz/playback";
import { insertion } from "../examples/algorithms.mjs";
const insertionSortSteps = input => insertion.steps(input);
const iterateInsertionSortSteps = input => insertion.iterate(input);
import { createSortRenderer } from "../dist/canvas/index.js";

test("timeline boundaries, interpolation, clamping and final hold", () => {
    const steps = insertionSortSteps([2, 1]);
    const timeline = createSortTimeline(steps, { stepDurationMs: 100, finalHoldMs: 200 });
    assert.equal(timeline.durationMs, (steps.length - 1) * 100 + 200);
    assert.equal(timeline.sample(-50).current, steps[0].state);
    for (let i = 1; i < steps.length; i++) {
        const middle = timeline.sample((i - 0.5) * 100);
        assert.equal(middle.previous, steps[i - 1].state);
        assert.equal(middle.current, steps[i].state);
        assert.equal(middle.progress, 0.5);
        assert.equal(timeline.sample(i * 100).current, steps[i].state);
        assert.equal(timeline.sample(i * 100).progress, 1);
    }
    const end = timeline.sample(timeline.durationMs + 1000);
    assert.equal(end.previous, steps.at(-1).state);
    assert.equal(end.current, steps.at(-1).state);
    assert.equal(end.progress, 1);
    assert.deepEqual(timeline.sample(50), timeline.sample(50));
    assert.equal(timeline.sample(0).current, steps[0].state);
});

test("invalid times and options", () => {
    const steps = insertionSortSteps([]);
    assert.throws(() => createSortTimeline([], { stepDurationMs: 100, finalHoldMs: 0 }), RangeError);
    for (const stepDurationMs of [0, -1, NaN, Infinity]) {
        assert.throws(() => createSortTimeline(steps, { stepDurationMs, finalHoldMs: 0 }), RangeError);
    }
    const timeline = createSortTimeline(steps, { stepDurationMs: 100, finalHoldMs: 0 });
    for (const time of [NaN, Infinity, -Infinity]) assert.throws(() => timeline.sample(time), TypeError);
});

test("mapFrame projects both endpoints and keeps the destination metadata on seek", () => {
    const first = Object.freeze({ panel: { value: 1 } });
    const second = Object.freeze({ panel: { value: 2 } });
    const event = Object.freeze({ type: "change" });
    const timeline = createTimeline([
        { index: -3, state: first, event: undefined },
        { index: 42, state: second, event },
    ], { stepDurationMs: 100, finalHoldMs: 50 });
    const frame = timeline.sample(25);
    const mapped = mapFrame(frame, state => state.panel);
    assert.equal(mapped.previous, first.panel);
    assert.equal(mapped.current, second.panel);
    assert.equal(mapped.progress, .25);
    assert.equal(mapped.stepIndex, 42);
    assert.equal(mapped.event, event);
    assert.ok(Object.isFrozen(mapped));
    assert.equal(frame.previous, first);
    assert.equal(frame.current, second);

    const rewind = mapFrame(timeline.sample(0), state => state.panel.value);
    assert.deepEqual(rewind, { previous: 1, current: 1, progress: 1, stepIndex: -3, event: undefined });
    assert.deepEqual(mapFrame(timeline.sample(25), state => state.panel), mapped);
});

test("renderer emits finite geometry for empty, signed and extreme inputs", () => {
    for (const values of [[], [-3, 0, 2], [Number.MAX_VALUE, -Number.MAX_VALUE]]) {
        const steps = insertionSortSteps(values);
        const timeline = createSortTimeline(steps, { stepDurationMs: 100, finalHoldMs: 100 });
        for (const width of [320, 1920]) {
            let saves = 0;
            const ctx = { canvas: { width, height: 600 }, save() { saves++; }, restore() { saves--; },
                setTransform() {}, fillRect(...args) { assert.ok(args.every(Number.isFinite)); },
                fillText(text, ...args) { assert.ok(args.every(Number.isFinite)); } };
            for (let time = 0; time <= timeline.durationMs; time += 50) {
                createSortRenderer({ theme: "dark" }).render(ctx, timeline.sample(time));
                assert.equal(saves, 0);
            }
        }
    }
});
