import assert from 'node:assert/strict';
import { mergeSort } from '../examples/merge-algorithm.mjs';
import { mergeScene, mergeSceneSteps, createMergeRenderer } from '../examples/merge-scene.mjs';
// Independent reference uses fresh sliced halves; it has no trace, buffer or pointers.
function reference(items) {
    if (items.length < 2) return { items, comparisons: 0, writes: 0 };
    const middle = Math.floor(items.length / 2);
    const a = reference(items.slice(0, middle));
    const b = reference(items.slice(middle));
    const left = [...a.items];
    const right = [...b.items];
    const result = [];
    let comparisons = a.comparisons + b.comparisons;
    while (left.length && right.length) {
        comparisons++;
        result.push(left[0].value <= right[0].value ? left.shift() : right.shift());
    }
    result.push(...left, ...right);
    return { items: result, comparisons, writes: a.writes + b.writes + items.length };
}

let seed = 123456;
function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
}
const cases = [[], [1], [5, 2, 4, 2, 1], [2, 2, 1], [1, 2, 3, 4], [4, 3, 2, 1], [-1, 0, -1], [0, -0]];
for (let i = 0; i < 300; i++) cases.push(Array.from({ length: random() % 25 }, () => (random() % 11) - 5));
for (const input of cases) {
    const original = [...input];
    const expected = reference(input.map((value, index) => ({ id: `item-${index}`, value })));
    const iterator = mergeSort.iterate(input);
    const first = iterator.next().value;
    const initialJson = JSON.stringify(first);
    const steps = [first, ...iterator];
    assert.equal(JSON.stringify(first), initialJson, "initial snapshot changed during iteration");
    assert.deepEqual(input, original);
    assert.equal(steps[0].event.type, "start");
    assert.equal(steps.at(-1).event.type, "done");
    const final = steps.at(-1).state;
    assert.deepEqual(final.main, expected.items, "sorted identities or stability mismatch");
    assert.equal(final.comparisons, expected.comparisons);
    assert.equal(final.bufferWrites, expected.writes);
    assert.equal(final.mainWrites, expected.writes);
    let previous = { comparisons: 0, bufferWrites: 0, mainWrites: 0 };
    for (const [index, step] of steps.entries()) {
        const { state, event } = step;
        assert.equal(step.index, index);
        for (const object of [
            step,
            event,
            state,
            state.main,
            state.buffer,
            ...state.main,
            ...state.buffer.filter(Boolean)
        ]) {
            assert.ok(Object.isFrozen(object));
        }
        if (state.range) assert.ok(Object.isFrozen(state.range));
        assert.equal(state.comparisons - previous.comparisons, event.type === "compare" ? 1 : 0);
        assert.equal(state.bufferWrites - previous.bufferWrites, event.type === "buffer-write" ? 1 : 0);
        assert.equal(state.mainWrites - previous.mainWrites, event.type === "main-write" ? 1 : 0);
        previous = state;
        if (!state.range) continue;
        const { start, middle, end } = state.range;
        assert.ok(start >= 0 && start <= middle && middle <= end && end <= input.length);
        const sorted = items => items.every((item, i) => !i || items[i - 1].value <= item.value);
        if (event.type === "merge") {
            assert.ok(sorted(state.main.slice(start, middle)));
            assert.ok(sorted(state.main.slice(middle, end)));
        }
        if (event.type === "compare") {
            assert.ok(event.left >= start && event.left < middle);
            assert.ok(event.right >= middle && event.right < end);
        }
        if (event.type === "buffer-write") {
            assert.ok(event.to >= start && event.to < end);
            assert.equal(state.buffer[event.to].id, event.itemId);
            const prefix = state.buffer.slice(start, state.output);
            assert.ok(prefix.every(Boolean) && sorted(prefix));
            assert.equal(new Set(prefix.map(item => item.id)).size, prefix.length);
        }
        if (event.type === "merged") assert.ok(sorted(state.main.slice(start, end)));
    }
}
for (const invalid of [[NaN], [Infinity], [-Infinity], Array(2)]) {
    assert.throws(() => mergeSort.steps(invalid), TypeError);
}
const immutable = mergeSort.steps([3, 2, 1]);
assert.throws(() => immutable[0].state.main.push({ id: "invalid", value: 0 }), TypeError);
assert.throws(() => {
    immutable[0].state.main[0].value = 99;
}, TypeError);
console.log(`Merge sort: ${cases.length} inputs passed; stability, counters, snapshots and ranges verified.`);

const { createTimeline } = await import("@grundyjs/algiviz/playback");
for (const input of [[5, 2, 4, 2, 1], [-2, 0, 3, -2], [], Array(24).fill(1)]) {
    const steps = mergeSort.steps(input);
    const sceneSteps = mergeSceneSteps(steps);
    const timeline = createTimeline(steps, { stepDurationMs: 650, finalHoldMs: 1000 });
    for (const size of [[320, 380], [960, 624], [1080, 1920], [1920, 1080]]) {
        const ctx = new Proxy({ canvas: { width: size[0], height: size[1] } }, {
            get(target, key) {
                if (key in target) return target[key];
                return (...args) => {
                    for (const argument of args) if (typeof argument === "number") assert.ok(Number.isFinite(argument), `Invalid canvas coordinate in ${String(key)}`);
                };
            }
        });
        const renderer = createMergeRenderer(false, steps[0].state.main);
        for (const [index, step] of steps.entries()) {
            const scene = mergeScene(step.state);
            assert.equal(scene.objects.length, input.length * 2);
            assert.equal(new Set(scene.objects.map(object => object.id)).size, scene.objects.length);
            assert.deepEqual(sceneSteps[index].state, scene);
            renderer.render(ctx, timeline.sample(index * 650));
            renderer.render(ctx, timeline.sample(index * 650 + 325));
        }
        renderer.render(ctx, timeline.sample(timeline.durationMs));
    }
}
console.log("Merge scene: unique cell identities and finite rendering at step boundaries and transitions in four sizes verified.");
