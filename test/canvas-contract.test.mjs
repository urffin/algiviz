import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createArrayTrace } from '@grundyjs/algiviz/array';
import { arrayScene, createArrayRenderer, createSortRenderer } from '@grundyjs/algiviz/canvas';

const trace = createArrayTrace([3, 2, 1]);
const start = trace.start();
const select = trace.select(0, { sortedPrefixLength: 3 });
const highlight = trace.highlight(['held', 1]);
const frame = (step = start, progress = 1) => ({
    previous: start.state, current: step.state, event: step.event, progress, stepIndex: step.index
});

// A stateful Canvas double: save/restore must preserve settings, not just balance calls.
function recordingContext(overrides = {}, throwAt = Infinity) {
    const defaults = {
        globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none',
        shadowColor: 'rgba(0, 0, 0, 0)', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
        fillStyle: '#000000', font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
        transform: [1, 0, 0, 1, 0, 0]
    };
    const keys = Object.keys(defaults), stack = [], calls = [], draws = [];
    const failure = new Error('Canvas draw failed');
    const settings = () => structuredClone(Object.fromEntries(keys.map(key => [key, ctx[key]])));
    const draw = (kind, args) => {
        calls.push(kind);
        const paint = settings();
        // Text settings do not affect rectangle pixels.
        if (kind === 'rect') for (const key of ['font', 'textAlign', 'textBaseline']) delete paint[key];
        draws.push({ kind, args, settings: paint });
        if (draws.length === throwAt) throw failure;
    };
    const ctx = {
        canvas: { width: 800, height: 450 }, ...defaults, ...overrides,
        save() { calls.push('save'); stack.push(settings()); },
        restore() { calls.push('restore'); assert.ok(stack.length); Object.assign(this, stack.pop()); },
        setTransform(...matrix) { calls.push('setTransform'); this.transform = matrix; },
        fillRect(...args) { draw('rect', args); },
        fillText(...args) { draw('text', args); }
    };
    return { ctx, settings, calls, draws, stack, failure };
}

test('large valid array renders without an argument-count limit and retains finite scaling', () => {
    const count = 150_000;
    const values = Array.from({ length: count }, (_, i) => i === count - 1 ? -Number.MAX_VALUE : i % 7 - 3);
    const step = createArrayTrace(values).start();
    let rects = 0, texts = 0, tallest = 0, depth = 0;
    const ctx = {
        canvas: { width: 800, height: 450 },
        save() { depth++; }, restore() { depth--; }, setTransform() {},
        fillRect(...args) {
            assert.ok(args.every(Number.isFinite));
            if (rects++) tallest = Math.max(tallest, args[3]);
        },
        fillText(text, ...args) { texts++; assert.ok(args.every(Number.isFinite)); }
    };
    createArrayRenderer({ theme: 'dark' }).render(ctx, { ...frame(step), previous: step.state });
    assert.equal(rects, count + 1); // Background plus one rectangle per original item.
    assert.equal(texts, 2); // Header/footer remain; dense item labels are omitted.
    assert.equal(tallest, 450 * 0.48);
    assert.equal(depth, 0);
});

const inherited = {
    globalAlpha: 0.25, globalCompositeOperation: 'destination-in', filter: 'opacity(50%)',
    shadowColor: 'red', shadowBlur: 12, shadowOffsetX: 7, shadowOffsetY: -4,
    fillStyle: 'purple', font: '32px serif', textAlign: 'right', textBaseline: 'top',
    transform: [2, 0, 0, 2, 20, 30]
};

test('drawing isolates documented paint settings and restores the caller context', () => {
    const clean = recordingContext(), dirty = recordingContext(inherited);
    const before = dirty.settings();
    const renderer = createArrayRenderer({ theme: 'dark' });
    renderer.render(clean.ctx, frame(highlight));
    renderer.render(dirty.ctx, frame(highlight));
    assert.deepEqual(dirty.draws, clean.draws);
    assert.deepEqual(dirty.settings(), before);
    assert.equal(dirty.stack.length, 0);
    assert.equal(dirty.calls.filter(call => call === 'restore').length, 1);
});

test('drawing errors propagate unchanged while caller settings are restored', () => {
    for (const throwAt of [1, 2, 4]) {
        const recording = recordingContext(inherited, throwAt), before = recording.settings();
        assert.throws(() => createArrayRenderer({ theme: 'light' }).render(recording.ctx, frame()),
            error => error === recording.failure);
        assert.deepEqual(recording.settings(), before);
        assert.equal(recording.stack.length, 0);
        assert.equal(recording.calls.filter(call => call === 'restore').length, 1);
    }
});

test('invalid progress fails before drawing or changing context, and renderer remains usable', () => {
    const renderer = createArrayRenderer({ theme: 'dark' });
    const recording = recordingContext(inherited), before = recording.settings();
    for (const progress of [-1, 2, NaN, Infinity, -Infinity, undefined, '0.5']) {
        assert.throws(() => renderer.render(recording.ctx, { ...frame(), progress }), RangeError);
        assert.deepEqual(recording.calls, []);
        assert.deepEqual(recording.settings(), before);
    }
    renderer.render(recording.ctx, frame());
    const fresh = recordingContext(inherited);
    createArrayRenderer({ theme: 'dark' }).render(fresh.ctx, frame());
    assert.deepEqual(recording.draws, fresh.draws);
});

test('zero-sized bitmap remains a no-op, including invalid progress', () => {
    for (const [width, height] of [[0, 450], [800, 0], [0, 0]]) {
        const recording = recordingContext({ canvas: { width, height } });
        createArrayRenderer({ theme: 'dark' }).render(recording.ctx, frame(start, NaN));
        assert.deepEqual(recording.calls, []);
    }
});

test('both renderer names require an explicit light/dark theme and accept undefined colors', () => {
    assert.equal(createArrayRenderer, createSortRenderer);
    const invalid = [undefined, null, {}, { theme: undefined }, { theme: null }, { theme: '' },
        { theme: 'DARK' }, { theme: 'toString' }, { theme: '__proto__' }, { theme: 0 }, { theme: [] }];
    for (const factory of [createArrayRenderer, createSortRenderer]) {
        for (const options of invalid) assert.throws(() => factory(options), TypeError);
        for (const theme of ['light', 'dark']) {
            const plain = recordingContext(), fallback = recordingContext();
            factory({ theme }).render(plain.ctx, frame());
            factory({ theme, colors: undefined }).render(fallback.ctx, frame());
            assert.deepEqual(fallback.draws, plain.draws);
        }
    }
});

test('held overrides active and sorted colors; active overrides sorted', () => {
    const recording = recordingContext();
    const colors = { background: '#111111', text: '#222222', bar: '#333333',
        sorted: '#444444', active: '#555555', held: '#666666' };
    createArrayRenderer({ theme: 'dark', colors }).render(recording.ctx, frame(highlight));
    const bars = recording.draws.filter(draw => draw.kind === 'rect').slice(1);
    assert.deepEqual(bars.map(bar => bar.settings.fillStyle), [colors.active, colors.sorted, colors.held]);
});

test('array projection preserves identities, freezes wrappers and places held at the hole', () => {
    const array = createArrayTrace([3, 1, 3]);
    const first = array.start();
    array.select(0);
    const shifted = array.shift(1, 0), scene = arrayScene(shifted.state);
    assert.ok(Object.isFrozen(scene) && Object.isFrozen(scene.objects));
    assert.ok(scene.objects.every(object => Object.isFrozen(object) && Object.isFrozen(object.data)));
    assert.deepEqual(scene.objects.map(object => object.id), ['item-1', 'item-2', 'item-0']);
    const held = scene.objects.find(object => object.data.held);
    assert.equal(held.data.index, 1);
    assert.equal(held.data.item, first.state.slots[0]);
    assert.equal(new Set(scene.objects.map(object => object.id)).size, 3);
    const item = { id: 'manual', value: 1 };
    const manual = { ...first.state, slots: [item], held: null };
    assert.equal(arrayScene(manual).objects[0].data.item, item);
    assert.equal(Object.isFrozen(item), false);
    assert.equal(Object.isFrozen(manual.slots), false);
});

test('repeated and reverse seeks and resized bitmaps agree with a fresh renderer', () => {
    const renderer = createArrayRenderer({ theme: 'dark' });
    const steps = [start, select, highlight];
    for (const width of [800, 40, 800]) for (const i of [2, 0, 1, 2, 0]) {
        const reused = recordingContext({ canvas: { width, height: 450 } });
        const fresh = recordingContext({ canvas: { width, height: 450 } });
        renderer.render(reused.ctx, frame(steps[i], 0.25));
        createArrayRenderer({ theme: 'dark' }).render(fresh.ctx, frame(steps[i], 0.25));
        assert.deepEqual(reused.draws, fresh.draws);
    }
});

test('movement uses smoothstep and item labels disappear in dense bitmaps', () => {
    const array = createArrayTrace([1, 3]);
    const initial = array.start(), swapped = array.swap(0, 1);
    const renderer = createArrayRenderer({ theme: 'dark' });
    const drawAt = (progress, width = 800) => {
        const recording = recordingContext({ canvas: { width, height: 450 } });
        renderer.render(recording.ctx, { previous: initial.state, current: swapped.state,
            event: swapped.event, stepIndex: swapped.index, progress });
        return recording.draws.filter(draw => draw.kind === 'text');
    };
    const valueX = progress => drawAt(progress).find(draw => draw.args[0] === '1' && draw.args.length === 4).args[1];
    const from = valueX(0), to = valueX(1);
    assert.ok(to > from);
    assert.ok(Math.abs(valueX(0.25) - (from + (to - from) * 0.15625)) < 1e-9);
    assert.equal(drawAt(1, 50).length, 2); // Only header/footer at 22.5 pixels per cell.
    assert.equal(drawAt(1, 60).length, 6); // Values and indices also fit at 27 pixels per cell.
});
