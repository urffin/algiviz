import assert from "node:assert/strict";
import { test } from "node:test";
import { insertionSortSteps, createSortTimeline } from "../dist/core/index.js";
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
