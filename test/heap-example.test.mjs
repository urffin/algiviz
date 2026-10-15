import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTimeline, createPlayer } from '@grundyjs/algiviz/playback';
import { heapSort } from '../examples/heap-algorithm.mjs';
import { heapScene, heapLayout, createHeapRenderer, heapItemLabel } from '../examples/heap-scene.mjs';
import { timing } from '../examples/player-settings.mjs';
const normalize = a => a.map(x => (x === 0 ? 0 : x));
function heap(a, n, root = 0) {
    const todo = root < n ? [root] : [];
    while (todo.length) {
        const p = todo.pop();
        for (const c of [2 * p + 1, 2 * p + 2])
            if (c < n) {
                assert.ok(a[p].value >= a[c].value);
                todo.push(c);
            }
    }
}
const cases = [
    [],
    [1],
    [2, 2, 1],
    [0, -0],
    [-3.5, 2, -3.5, 0.25],
    [Number.MAX_VALUE, -Number.MAX_VALUE, Number.MIN_VALUE, 0],
    Array(15).fill(4),
    Array.from({ length: 15 }, (_, i) => i),
    Array.from({ length: 15 }, (_, i) => 15 - i),
    [8, 3, 6, 2, 5, 3, 9, 1, 6, 4]
];
for (let n = 0; n <= 6; n++)
    for (let mask = 0; mask < 3 ** n; mask++) {
        let v = mask;
        cases.push(
            Array.from({ length: n }, () => {
                const x = (v % 3) - 1;
                v = Math.floor(v / 3);
                return x;
            })
        );
    }
let seed = 7821;
const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
for (let i = 0; i < 300; i++) cases.push(Array.from({ length: random() % 33 }, () => (random() % 31) - 15));
for (const values of cases) {
    const original = [...values],
        steps = heapSort.steps(values);
    assert.deepEqual(values, original);
    assert.equal(steps[0].event.type, "start");
    assert.equal(steps.at(-1).event.type, "done");
    assert.equal(steps.at(-1).state.heapSize, 0);
    assert.deepEqual(
        normalize(steps.at(-1).state.main.map(x => x.value)),
        normalize([...values].sort((a, b) => a - b))
    );
    const identities = steps[0].state.main;
    let previous = steps[0].state,
        comparisons = 0,
        swaps = 0;
    for (const [index, { state: s, event: e, index: stepIndex }] of steps.entries()) {
        assert.equal(stepIndex, index);
        for (const obj of [steps[index], s, e, s.main, ...s.main]) assert.ok(Object.isFrozen(obj));
        assert.equal(s.main.length, values.length);
        assert.equal(new Set(s.main.map(x => x.id)).size, values.length);
        for (const item of s.main) assert.strictEqual(item, identities[Number(item.id.slice(5))]);
        assert.ok(s.heapSize >= 0 && s.heapSize <= values.length);
        for (const p of [s.parent, s.left, s.right, s.candidate, s.buildRoot])
            if (p !== null) assert.ok(Number.isInteger(p) && p >= 0 && p < s.heapSize);
        const suffix = s.main.slice(s.heapSize).map(x => x.value);
        assert.deepEqual(normalize(suffix), normalize([...suffix].sort((a, b) => a - b)));
        if (suffix.length) for (const x of s.main.slice(0, s.heapSize)) assert.ok(x.value <= suffix[0]);
        assert.deepEqual(s.main.slice(previous.heapSize), previous.main.slice(previous.heapSize));
        if (e.type === "shrink-heap") {
            assert.equal(s.heapSize, previous.heapSize - 1);
            assert.equal(e.index, s.heapSize);
            assert.ok(previous.heapSize === 1 || steps[index - 1].event.type === "extract-swap");
        } else assert.equal(s.heapSize, previous.heapSize);
        if (e.type === "compare-children") {
            comparisons++;
            assert.equal(e.left, 2 * s.parent + 1);
            assert.equal(e.right, e.left + 1);
            assert.ok(e.right < s.heapSize);
            assert.equal(s.candidate, s.main[e.right].value > s.main[e.left].value ? e.right : e.left);
        }
        if (e.type === "compare-parent") {
            comparisons++;
            assert.equal(e.parent, s.parent);
            assert.equal(e.child, s.candidate);
            assert.ok(e.child === 2 * e.parent + 1 || e.child === 2 * e.parent + 2);
            assert.ok(e.child < s.heapSize);
            assert.equal(
                steps[index + 1].event.type,
                s.main[e.child].value > s.main[e.parent].value ? "swap" : "sift-done"
            );
        }
        if (e.type === "swap" || e.type === "extract-swap") {
            swaps++;
            assert.notEqual(e.left, e.right);
            assert.ok(e.left >= 0 && e.right < s.heapSize);
            const expected = [...previous.main];
            [expected[e.left], expected[e.right]] = [expected[e.right], expected[e.left]];
            assert.deepEqual(s.main, expected);
            if (e.type === "extract-swap") {
                heap(previous.main, previous.heapSize);
                assert.equal(e.left, 0);
                assert.equal(e.right, previous.heapSize - 1);
                assert.equal(s.phase, "extract");
            }
        } else assert.deepEqual(s.main, previous.main);
        assert.equal(s.comparisons, comparisons);
        assert.equal(s.swaps, swaps);
        if (e.type === "heap-built") heap(s.main, s.heapSize);
        if (e.type === "sift-done") {
            heap(s.main, s.heapSize, e.root);
            assert.equal(s.parent, null);
            if (s.phase === "restore") heap(s.main, s.heapSize);
        }
        previous = s;
    }
}
// Independently hand-counted comparisons and exchanges, including equal-value extraction.
for (const [a, c, w] of [
    [[], 0, 0],
    [[1], 0, 0],
    [[1, 2], 1, 2],
    [[2, 1], 1, 1],
    [[2, 2, 1], 3, 3],
    [[3, 1, 2], 3, 2]
]) {
    const s = heapSort.steps(a).at(-1).state;
    assert.equal(s.comparisons, c);
    assert.equal(s.swaps, w);
}
assert.deepEqual(
    heapSort
        .steps([2, 2, 1])
        .at(-1)
        .state.main.map(x => x.id),
    ["item-2", "item-1", "item-0"]
);
const equal = heapSort.steps(Array(15).fill(4));
assert.equal(equal.filter(x => x.event.type === "swap").length, 0);
assert.equal(equal.at(-1).state.swaps, 14);
for (const bad of [[NaN], [Infinity], [-Infinity], Array(3), ["2"]])
    assert.throws(() => heapSort.steps(bad), TypeError);
const iterator = heapSort.iterate([5, 1, 3, 2]),
    first = iterator.next().value,
    saved = structuredClone(first);
while (!iterator.next().done) {}
assert.deepEqual(first, saved);
assert.deepEqual(heapSort.steps([5, 1, 3]), [...heapSort.iterate([5, 1, 3])]);
const stopped = heapSort.iterate([5, 1, 3]);
stopped.next();
assert.equal(stopped.return().done, true);
assert.equal(stopped.next().done, true);
assert.equal(heapSort.iterate([1]).next().value.index, 0);
console.log(
    `Heap sort: ${cases.length} inputs passed; heaps, suffixes, identities, immutable history, counters, instability and generator lifecycle verified.`
);
for (let n = 0; n <= 15; n++) {
    const values = Array.from({ length: n }, (_, i) => ((i * 7) % 11) - 5);
    const steps = heapSort.steps(values);
    const original = steps[0].state.main;
    for (const step of steps) {
        const objects = heapScene(step.state).objects;
        assert.equal(new Set(objects.map(x => x.id)).size, objects.length);
        assert.equal(objects.filter(x => x.type === "edge").length, Math.max(0, step.state.heapSize - 1));
        assert.equal(objects.filter(x => x.type === "item" && x.data.view === "tree").length, step.state.heapSize);
        assert.equal(objects.filter(x => x.type === "item" && x.data.view === "array").length, n);
        for (const item of objects.filter(x => x.type === "item"))
            assert.equal(item.data.item.id, step.state.main[item.data.index].id);
    }
    for (const width of [230, 250, 300, 390, 960]) {
        const layout = heapLayout(width, n);
        assert.ok(layout.radius > 0);
        for (let i = 0; i < n; i++) {
            for (const view of ["tree", "array"]) {
                const point = layout[view](i),
                    radius = view === "tree" ? layout.radius : 21;
                assert.ok(point.x - radius >= 0 && point.x + radius <= width);
                assert.ok(point.y - radius >= 0 && point.y + radius < layout.height);
            }
        }
        const ctx = new Proxy(
            { canvas: { width, height: layout.height } },
            {
                get(target, key) {
                    if (key in target) return target[key];
                    return (...args) => {
                        for (const arg of args)
                            if (typeof arg === "number") assert.ok(Number.isFinite(arg), String(key));
                    };
                }
            }
        );
        const renderer = createHeapRenderer(true, original);
        const timeline = createTimeline(steps, { stepDurationMs: 650, finalHoldMs: 1000 });
        // Forward, intermediate and backwards seeking, including disappearing nodes.
        const times = steps.flatMap(step => [step.index * 650, step.index * 650 + 325]);
        for (const time of [...times, ...times.reverse()]) renderer.render(ctx, timeline.sample(time));
    }
}
const duplicateItems = heapSort.steps([2, 2, 1])[0].state.main;
assert.equal(heapItemLabel(duplicateItems[0], duplicateItems), "2a");
assert.equal(heapItemLabel(duplicateItems[1], duplicateItems), "2b");
console.log(
    "Scene identities, active edges, 0–15-item layouts and bidirectional rendering passed."
);


test('heap generator matches history frames and closes on disposal', () => {
    for (const values of [[], [1], [2,2,1], [8,3,6,2,5,3,9,1,6,4]]) {
        const timeline = createTimeline(heapSort.steps(values), timing);
        const player = createPlayer(heapSort.iterate(values), {...timing, isTerminal: step => step.event.type === 'done'});
        let time = 0;
        for (let i=0; i<1000 && !player.finished; i++) {
            const delta = [100,550,325,650][i%4]; time += delta; player.advance(delta);
            const expected = timeline.sample(Math.min(time,timeline.durationMs));
            assert.deepEqual(player.frame.current, expected.current);
            assert.deepEqual(player.frame.event, expected.event);
        }
        assert.ok(player.finished); player.dispose();
    }
    let calls=0, closed=false;
    function* tracked() { try { for (const step of heapSort.iterate(Array.from({length:2000},(_,i)=>2000-i))) { calls++; yield step; } } finally { closed=true; } }
    const player = createPlayer(tracked(), {...timing, isTerminal: step => step.event.type === 'done'});
    assert.ok(calls <= 2, 'must not materialize generator history');
    player.advance(650); assert.ok(calls < 6); player.dispose(); assert.ok(closed);
});

test('dense heap geometry stays bounded and hides unreadable labels', () => {
    for (const count of [64, 2000]) for (const width of [240,960]) {
        const first=heapSort.iterate(Array.from({length:count},(_,i)=>i)).next().value;
        const layout=heapLayout(width,count);
        const labels=[];
        const ctx=new Proxy({canvas:{width,height:layout.height}}, {get(target,key) {
            if (key in target) return target[key];
            return (...args)=> { for(const arg of args) if(typeof arg==='number') assert.ok(Number.isFinite(arg)); if(key==='fillText') labels.push(args[0]); if(key==='arc') assert.ok(args[2]>0); };
        }});
        createHeapRenderer(true,first.state.main).render(ctx,{previous:first.state,current:first.state,event:first.event,stepIndex:0,progress:1});
        assert.ok(layout.height < 1000);
        assert.equal(labels.length,2,'dense cells must not render overlapping labels');
        assert.equal(heapScene(first.state).objects.length, count*3-1);
    }
});
