import assert from 'node:assert/strict';
import { test } from 'node:test';
import { quickSort } from '../examples/quick-algorithm.mjs';
import { threeWayQuickSort } from '../examples/quick-three-way.mjs';
import { quickScene, createQuickRenderer, quickItemLabel } from '../examples/quick-scene.mjs';
import { createPlayer, createTimeline } from '@grundyjs/algiviz/playback';

const variants = [quickSort, threeWayQuickSort];
test('both quick sort variants preserve inputs, items, final positions and partition invariants', () => {
    let seed = 7391;
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
    const cases = [
        [],
        [1],
        [2, 2],
        [2, 2, 1],
        [-2, 0, -2],
        [0, -0],
        Array(64).fill(1),
        Array.from({ length: 64 }, (_, i) => i),
        Array.from({ length: 64 }, (_, i) => 64 - i),
    ];
    for (let i = 0; i < 300; i++) cases.push(Array.from({ length: random() % 25 }, () => (random() % 11) - 5));
    for (const algorithm of variants)
        for (const input of cases) {
            const copy = [...input],
                steps = algorithm.steps(input),
                first = steps[0].state;
            assert.deepEqual(input, copy);
            const sorted = [...input].sort((a, b) => a - b).map((x) => (x === 0 ? 0 : x));
            assert.deepEqual(
                steps.at(-1).state.main.map((x) => (x.value === 0 ? 0 : x.value)),
                sorted,
            );
            assert.equal(steps.at(-1).event.type, 'done');
            assert.equal(new Set(steps.at(-1).state.fixed).size, input.length);
            let previous = first;
            for (const step of steps) {
                const { state, event } = step;
                for (const obj of [step, state, event, state.main, state.fixed, ...state.main])
                    assert.ok(Object.isFrozen(obj));
                if (state.bands) assert.ok(Object.isFrozen(state.bands));
                if (state.range) assert.ok(Object.isFrozen(state.range));
                assert.deepEqual(
                    [...state.main].sort((a, b) => a.id.localeCompare(b.id)),
                    [...first.main].sort((a, b) => a.id.localeCompare(b.id)),
                );
                for (const i of previous.fixed) assert.equal(state.main[i].id, previous.main[i].id);
                assert.equal(
                    state.comparisons - previous.comparisons,
                    ['compare', 'classify'].includes(event.type) ? 1 : 0,
                );
                assert.equal(state.swaps - previous.swaps, event.type === 'swap' ? 1 : 0);
                if (state.bands) {
                    const { less, scan, greater, value } = state.bands,
                        { start, end } = state.range;
                    assert.ok(start <= less && less <= scan && scan <= greater && greater <= end);
                    assert.ok(state.main.slice(start, less).every((x) => x.value < value));
                    assert.ok(state.main.slice(less, scan).every((x) => x.value === value));
                    assert.ok(state.main.slice(greater, end).every((x) => x.value > value));
                    assert.equal(state.main[state.pivot].value, value);
                } else if (event.type === 'compare') {
                    const { start, end } = state.range,
                        p = state.main[end - 1].value;
                    assert.ok(state.main.slice(start, state.boundary).every((x) => x.value < p));
                    assert.ok(state.main.slice(state.boundary, state.scan).every((x) => x.value >= p));
                }
                previous = state;
            }
        }
    for (const algorithm of variants)
        for (const bad of [[NaN], [Infinity], Array(2)]) assert.throws(() => algorithm.steps(bad), TypeError);
    assert.deepEqual(
        quickSort
            .steps([2, 2])
            .at(-1)
            .state.main.map((x) => x.id),
        ['item-1', 'item-0'],
    );
    assert.deepEqual(
        threeWayQuickSort
            .steps([2, 2, 1])
            .at(-1)
            .state.main.map((x) => x.id),
        ['item-2', 'item-1', 'item-0'],
    );
    const equal = Array(64).fill(4),
        steps = threeWayQuickSort.steps(equal);
    assert.equal(steps.at(-1).state.comparisons, 128);
    assert.equal(steps.at(-1).state.swaps, 0);
    assert.equal(steps.filter((x) => x.event.type === 'partition').length, 1);
    assert.equal(quickSort.steps(equal).at(-1).state.comparisons, (64 * 63) / 2);
});

test('history and generator frames agree and both scenes render finite coordinates', () => {
    for (const algorithm of variants)
        for (const input of [[], [2, 2, 1], [-2, 0, 5, -2], Array(24).fill(1)]) {
            const steps = algorithm.steps(input),
                options = { stepDurationMs: 650, finalHoldMs: 1000 };
            const timeline = createTimeline(steps, options);
            const player = createPlayer(algorithm.iterate(input), {
                ...options,
                isTerminal: (step) => step.event.type === 'done',
            });
            for (let i = 1; i < steps.length; i++) {
                player.advance(650);
                assert.deepEqual(player.frame.current, timeline.sample(i * 650).current);
                assert.deepEqual(player.frame.event, timeline.sample(i * 650).event);
            }
            player.advance(1000);
            assert.equal(player.finished, true);
            player.dispose();
            for (const [width, height] of [
                [320, 380],
                [960, 624],
                [1080, 1920],
                [1920, 1080],
            ]) {
                const ctx = new Proxy(
                    { canvas: { width, height } },
                    {
                        get(target, key) {
                            if (key in target) return target[key];
                            return (...args) => {
                                for (const x of args) if (typeof x === 'number') assert.ok(Number.isFinite(x));
                            };
                        },
                    },
                );
                const renderer = createQuickRenderer(true, steps[0].state.main);
                for (const step of steps) {
                    assert.equal(new Set(quickScene(step.state).objects.map((x) => x.id)).size, input.length);
                    renderer.render(ctx, timeline.sample(step.index * 650));
                    renderer.render(ctx, timeline.sample(step.index * 650 + 325));
                }
            }
        }
});

test('quick demo switches partitions, preserves loaded input and uses shared playback controls', async () => {
    const ids = [
        'speed',
        'mode',
        'play',
        'seek',
        'restart',
        'mode-help',
        'previous',
        'next',
        'size',
        'error',
        'values',
        'partition',
        'generate',
        'order',
        'apply',
        'duplicates',
        'equal',
        'legend',
        'status',
    ];
    const elements = Object.fromEntries(
        ids.map((id) => [
            id,
            {
                value: '',
                textContent: '',
                setAttribute(name, value) {
                    this[name] = value;
                },
                click() {
                    this.onclick?.();
                },
            },
        ]),
    );
    elements.values.value = '8,3,6,2,5,3,9,1,6,4';
    elements.speed.value = '1';
    elements.partition.value = 'lomuto';
    elements.size.value = '12';
    elements.order.value = 'random';
    const canvas = { width: 960, height: 624, getBoundingClientRect: () => ({ width: 960 }) };
    const ctx = new Proxy(
        { canvas },
        {
            get(target, key) {
                if (key in target) return target[key];
                return () => {};
            },
        },
    );
    canvas.getContext = () => ctx;
    const keys = [
        'document',
        'window',
        'matchMedia',
        'ResizeObserver',
        'requestAnimationFrame',
        'cancelAnimationFrame',
    ];
    const originals = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const listeners = {};
    let frame;
    Object.assign(globalThis, {
        document: {
            getElementById: (id) => elements[id],
            querySelector: (s) => (s === 'canvas' ? canvas : elements[s.slice(1)]),
            addEventListener: (name, fn) => {
                listeners[name] = fn;
            },
        },
        window: {
            addEventListener: (name, fn) => {
                listeners[name] = fn;
            },
        },
        matchMedia: () => ({ matches: false, addEventListener() {} }),
        ResizeObserver: class {
            constructor(fn) {
                this.fn = fn;
            }
            observe() {
                this.fn();
            }
        },
        requestAnimationFrame: (fn) => {
            frame = fn;
            return 1;
        },
        cancelAnimationFrame: () => {
            frame = null;
        },
    });
    try {
        await import('../examples/quick-demo.mjs');
        assert.match(elements.status.textContent, /Step 0/);
        elements.equal.click();
        const saved = elements.values.value;
        elements.seek.value = elements.seek.max;
        elements.seek.oninput();
        assert.match(elements.status.textContent, /Comparisons: 45/);
        elements.partition.value = 'three-way';
        elements.partition.onchange();
        assert.equal(elements.values.value, saved);
        assert.match(elements.status.textContent, /Step 0/);
        elements.seek.value = elements.seek.max;
        elements.seek.oninput();
        assert.match(elements.status.textContent, /Comparisons: 20/);
        assert.match(elements.status.textContent, /Swaps: 0/);
        elements.mode.value = 'generator';
        elements.mode.onchange();
        assert.equal(elements.seek.disabled, true);
        assert.equal(elements.previous.disabled, true);
        assert.equal(elements.size.max, '2000');
        elements.next.click();
        assert.match(elements.status.textContent, /Step 1/);
        elements.restart.click();
        assert.match(elements.status.textContent, /Step 0/);
        const previous = elements.status.textContent;
        elements.values.value = 'NaN';
        elements.apply.click();
        assert.match(elements.error.textContent, /finite/);
        assert.equal(elements.status.textContent, previous);
        elements.values.value = Array(2001).fill(1).join(',');
        elements.apply.click();
        assert.match(elements.error.textContent, /2000/);
        elements.size.value = '2000';
        elements.generate.click();
        assert.equal(elements.error.textContent, '');
        assert.equal(elements.values.value.split(',').length, 2000);
        elements.mode.value = 'history';
        elements.mode.onchange();
        assert.match(elements.error.textContent, /64/);
        assert.equal(elements.mode.value, 'generator');
        assert.equal(elements.seek.disabled, true);
        elements.play.click();
        assert.equal(typeof frame, 'function');
        globalThis.document.hidden = true;
        listeners.visibilitychange();
        assert.equal(frame, null);
    } finally {
        for (const [key, descriptor] of Object.entries(originals)) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
});

test('duplicate labels remain alphabetic beyond 26 occurrences', () => {
    const items = quickSort.steps(Array(64).fill(4))[0].state.main;
    assert.equal(quickItemLabel(items[26], items), '4aa');
    assert.equal(quickItemLabel(items[63], items), '4bl');
});
