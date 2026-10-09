import assert from "node:assert/strict";
import { test } from "node:test";
import { createSortPlayer, createSortTimeline, insertionSortSteps, iterateInsertionSortSteps } from "../dist/core/index.js";

test("sequential frames match the seekable timeline, including boundaries and final hold", () => {
    for (const input of [[], [1], [3, 1, 2, 1]]) {
        for (const finalHoldMs of [0, 75]) {
            const options = { stepDurationMs: 100, finalHoldMs };
            const timeline = createSortTimeline(insertionSortSteps(input), options);
            const player = createSortPlayer(iterateInsertionSortSteps(input), options);
            assert.deepEqual(player.frame, timeline.sample(0));
            let time = 0;
            for (const delta of [0, 25, 75, 0, 50, 350, 25, 100_000]) {
                time += delta;
                assert.deepEqual(player.advance(delta), timeline.sample(time));
                assert.equal(player.finished, time >= timeline.durationMs);
            }
            assert.deepEqual(player.advance(500), timeline.sample(timeline.durationMs));
        }
    }
});

test("consumes on demand, supports pause and closes early exactly once", () => {
    let reads = 0;
    let closes = 0;
    function* source() {
        try {
            for (const step of iterateInsertionSortSteps(Array.from({ length: 10_000 }, (_, i) => 10_000 - i))) {
                reads++;
                yield step;
            }
        } finally { closes++; }
    }
    const player = createSortPlayer(source(), { stepDurationMs: 100, finalHoldMs: 0 });
    assert.equal(reads, 1);
    const initial = player.frame;
    assert.deepEqual(player.advance(0), initial);
    assert.equal(reads, 1);
    player.advance(50);
    assert.equal(reads, 2);
    assert.equal(player.frame.progress, 0.5);
    player.advance(50);
    assert.equal(reads, 2);
    assert.ok(Object.isFrozen(player.frame));
    assert.equal(initial.event.type, "start");
    player.dispose();
    player.dispose();
    assert.equal(closes, 1);
    assert.throws(() => player.advance(1), /disposed/);
});

test("closes the generator at the final frame and waits through the hold", () => {
    let closed = false;
    function* source() {
        try { yield* iterateInsertionSortSteps([]); }
        finally { closed = true; }
    }
    const player = createSortPlayer(source(), { stepDurationMs: 100, finalHoldMs: 50 });
    player.advance(100);
    assert.equal(closed, true);
    assert.equal(player.finished, false);
    player.advance(49);
    assert.equal(player.finished, false);
    player.advance(1);
    assert.equal(player.finished, true);
});

test("rejects invalid options and deltas without consuming additional steps", () => {
    const options = { stepDurationMs: 100, finalHoldMs: 0 };
    for (const stepDurationMs of [0, -1, NaN, Infinity]) {
        assert.throws(() => createSortPlayer([], { ...options, stepDurationMs }), RangeError);
    }
    for (const finalHoldMs of [-1, NaN, Infinity]) {
        assert.throws(() => createSortPlayer([], { ...options, finalHoldMs }), RangeError);
    }
    assert.throws(() => createSortPlayer([], options), RangeError);
    const player = createSortPlayer(iterateInsertionSortSteps([2, 1]), options);
    for (const delta of [-1, NaN, Infinity, -Infinity]) {
        assert.throws(() => player.advance(delta), RangeError);
    }
    assert.equal(player.advance(50).stepIndex, 1);
});

test("reports a truncated or failing source and closes it", () => {
    const start = insertionSortSteps([])[0];
    for (const fails of [false, true]) {
        let closed = false;
        function* source() {
            try {
                yield start;
                if (fails) throw new Error("source failure");
            } finally { closed = true; }
        }
        const player = createSortPlayer(source(), { stepDurationMs: 100, finalHoldMs: 0 });
        assert.throws(() => player.advance(1), fails ? /source failure/ : /without a terminal/);
        assert.equal(closed, true);
        assert.throws(() => player.advance(1), /disposed/);
    }
});
