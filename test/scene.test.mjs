import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSceneFrame, createSceneRenderer } from '@grundyjs/algiviz/scene';
import { createPlayer, createTimeline } from '@grundyjs/algiviz/playback';
import { treeSteps, treeRenderer } from '../examples/tree-scene.mjs';

const node = (id, x, zIndex = 0) => ({ id, type: 'node', data: { x }, zIndex });
const frame = (before, after, progress = 0.5) => ({ previous: { objects: before }, current: { objects: after }, progress, event: 'move', stepIndex: 1 });

test('scene matches ids, tracks entering/exiting objects and keeps frames stateless', () => {
    const before = [node('a', 0), node('b', 10)];
    const after = [node('c', 30), node('a', 20)];
    const f = createSceneFrame(frame(before, after));
    assert.equal(f.get('a').previous, before[0]);
    assert.equal(f.get('a').current, after[1]);
    assert.equal(f.get('a').phase, 'update');
    assert.equal(f.get('a').presence, 1);
    assert.equal(f.get('b').phase, 'exit');
    assert.equal(f.get('b').current, null);
    assert.equal(f.get('c').phase, 'enter');
    assert.equal(f.get('c').previous, null);
    assert.equal(f.get('c').presence, 0.5);
    assert.equal(f.get('missing'), undefined);
    assert.ok(Object.isFrozen(f) && Object.isFrozen(f.objects) && Object.isFrozen(f.get('a')));
    for (const p of [0, 1, 0.25, 0.75]) {
        const result = createSceneFrame(frame(before, after, p));
        assert.equal(result.get('b').presence, 1 - p);
        assert.equal(result.get('c').presence, p);
    }
    assert.equal(f.get('b').presence, 0.5);
});

test('dispatch respects layers and resolves linked moving objects before nodes are drawn', () => {
    const edge = { id: 'edge', type: 'edge', data: { from: 'a', to: 'b' }, zIndex: -1 };
    const calls = [];
    const visualizations = {
        node(ctx, object) { ctx.push(object.id); },
        edge(ctx, object, scene) {
            const a = scene.get(object.current.data.from);
            assert.equal(a.previous.data.x + (a.current.data.x - a.previous.data.x) * scene.progress, 5);
            ctx.push(object.id);
        }
    };
    const renderer = createSceneRenderer(visualizations);
    visualizations.node = () => { throw new Error('Registry must have been captured'); };
    renderer.render(calls, frame([node('a', 0), node('b', 20), edge], [node('b', 20), edge, node('a', 10)]));
    assert.deepEqual(calls, ['edge', 'b', 'a']);
});

test('invalid scene data and missing visualizations fail before any draw call', () => {
    let draws = 0;
    const renderer = createSceneRenderer({ node() { draws++; } });
    const invalid = [
        frame([], [node('a', 0), node('a', 1)]),
        frame([node('a', 0), node('a', 1)], []),
        frame([node('a', 0)], [{ id: 'a', type: 'edge', data: {} }]),
        frame([], [node('a', 0), { id: 'b', type: 'unknown', data: {} }]),
        frame([], [node('', 0)]),
        frame([], [node('a', 0, Infinity)]),
        frame([], [], NaN), frame([], [], -1), frame([], [], 1.1)
    ];
    for (const f of invalid) assert.throws(() => renderer.render(null, f));
    assert.equal(draws, 0);
});

test('removed objects are dispatched at zero presence so retained backends can remove them', () => {
    const calls = [];
    createSceneRenderer({ node(ctx, object) { ctx.push([object.phase, object.presence]); } })
        .render(calls, frame([node('a', 0)], [], 1));
    assert.deepEqual(calls, [['exit', 0]]);
});

test('scene renderer works with generic history and sequential playback', () => {
    const steps = [
        { index: 0, state: { objects: [] }, event: 'start' },
        { index: 1, state: { objects: [node('a', 0)] }, event: 'add' },
        { index: 2, state: { objects: [node('a', 20)] }, event: 'move' },
        { index: 3, state: { objects: [] }, event: 'remove' },
        { index: 4, state: { objects: [] }, event: 'end' }
    ];
    const renderer = createSceneRenderer({ node(ctx, object) { ctx.push([object.id, object.phase, object.presence]); } });
    const options = { stepDurationMs: 100, finalHoldMs: 50 };
    const timeline = createTimeline(steps, options);
    let calls = [];
    const player = createPlayer(steps, { ...options, isTerminal: step => step.event === 'end', render(f) { calls = []; renderer.render(calls, f); } });
    for (let t = 25; t <= 500; t += 25) {
        player.advance(25);
        const expected = [];
        renderer.render(expected, timeline.sample(t));
        assert.deepEqual(calls, expected);
    }
    assert.equal(player.finished, true);
});

test('application-owned tree traversal renders its own types at all transition boundaries', () => {
    const steps = [...treeSteps()];
    assert.deepEqual(steps.filter(s => s.event.kind === 'visit').map(s => s.event.active), ['a', 'b', 'd', 'e', 'c']);
    assert.equal(steps.at(-1).state.objects.some(o => o.type === 'pointer'), false);
    const timeline = createTimeline(steps, { stepDurationMs: 100, finalHoldMs: 0 });
    let saves = 0, labels = [];
    const finite = (...args) => assert.ok(args.every(Number.isFinite));
    const ctx = { canvas: { width: 960, height: 500 },
        save() { saves++; }, restore() { saves--; }, beginPath() {}, closePath() {}, stroke() {}, fill() {},
        moveTo: finite, lineTo: finite, arc: finite, fillText(text, x, y) { labels.push(text); finite(x, y); } };
    for (let time = 0; time <= timeline.durationMs; time += 25) {
        labels = [];
        treeRenderer.render(ctx, timeline.sample(time));
        assert.equal(saves, 0);
    }
    assert.deepEqual(labels, ['A', 'B', 'C', 'D', 'E']);
});
