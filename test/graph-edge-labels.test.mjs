import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGraphRenderer } from '@grundyjs/algiviz/canvas/graph';
import { createGraphTrace } from '@grundyjs/algiviz/graph';
import { createTimeline } from '@grundyjs/algiviz/playback';
import { recording } from './graph-canvas-context.mjs';
import { ahoLabelFrames } from './graph-edge-label-fixtures.mjs';
import { graphTopologySteps } from './graph-topology-fixture.mjs';

const labelCalls = target => target.calls('fillText').filter(call => call.args.length === 3);
function draw(renderer, frame, width = 390, height = 310) {
    const target = recording(width, height);
    renderer.render(target.ctx, frame, { width, height });
    return target;
}

test('Aho–Corasick labels stay visible and at the same positions across fallback highlighting and seek', () => {
    for (const { name, start, fallback, labelCount } of ahoLabelFrames()) {
        const renderer = createGraphRenderer({ theme: 'light', edgeLabels: { placement: 'auto' } });
        const timeline = createTimeline([start, fallback], { stepDurationMs: 100, finalHoldMs: 50 });
        for (const [width, height] of [[390, 310], [960, 509]]) {
            const initial = labelCalls(draw(renderer, timeline.sample(0), width, height));
            const middle = labelCalls(draw(renderer, timeline.sample(45), width, height));
            assert.equal(initial.length, labelCount, name);
            assert.deepEqual(middle.map(call => call.args[0]), initial.map(call => call.args[0]), name);
            for (const [index, call] of middle.entries()) {
                assert.ok(call.args.slice(1).every((value, i) => Math.abs(value - initial[index].args[i + 1]) < 1e-8), name);
            }
            assert.deepEqual(labelCalls(draw(renderer, timeline.sample(0), width, height)), initial);
            assert.deepEqual(labelCalls(draw(renderer, timeline.sample(45), width, height)), middle);
        }
    }
});

test('drawEdge uses the stock curves and arrows for dashed Aho–Corasick links through seek', () => {
    const options = { theme: 'light', edgeLabels: { placement: 'auto' }, roleColors: { active: '#d97706' } };
    const stock = createGraphRenderer(options);
    const delegated = createGraphRenderer({ ...options, drawEdge({ drawStroke, drawArrow }) {
        drawStroke();
        drawArrow();
    } });
    const dashed = createGraphRenderer({ ...options, drawEdge({ ctx, view, curve, arrow, drawStroke, drawArrow }) {
        assert.equal(curve.length, 4);
        assert.equal(arrow.length, 3);
        drawStroke(view.edge.data.kind === 'failure' ? { dash: [5, 4] } : undefined);
        drawArrow();
        ctx.translate(50, 50);
        ctx.setLineDash([9, 9]);
        ctx.textAlign = 'left';
    } });
    const pixels = target => target.commands.filter(call => ['stroke', 'fill', 'fillText', 'fillRect'].includes(call.name));
    for (const { start, fallback, labelCount } of ahoLabelFrames()) {
        const timeline = createTimeline([start, fallback], { stepDurationMs: 100, finalHoldMs: 50 });
        for (const [width, height] of [[390, 310], [960, 509]]) {
            for (const time of [0, 45, 0, 45]) {
                const frame = timeline.sample(time);
                const normal = draw(stock, frame, width, height);
                const custom = draw(dashed, frame, width, height);
                assert.deepEqual(pixels(draw(delegated, frame, width, height)), pixels(normal));
                assert.deepEqual(labelCalls(custom), labelCalls(normal));
                assert.equal(labelCalls(custom).length, labelCount);
                assert.deepEqual(custom.calls('bezierCurveTo').map(call => call.args), normal.calls('bezierCurveTo').map(call => call.args));
                const strokes = custom.calls('stroke');
                for (const [i, edge] of start.state.graph.edges.entries()) {
                    assert.deepEqual(strokes[i].state.dash, edge.data.kind === 'failure' ? [5, 4] : []);
                    if (edge.id === 'fail:3' && time > 0) assert.equal(strokes[i].state.strokeStyle, '#d97706');
                }
                assert.equal(custom.calls('fill').length, normal.calls('fill').length);
                assert.equal(custom.stack.length, 0);
            }
        }
    }
});

// Invert the quadratic-to-cubic conversion to inspect the actual bend.
function signedBend(curve, from, to) {
    const [start, control] = curve;
    const x = control.x + (control.x - start.x) / 2 - (from[0] + to[0]) / 2;
    const y = control.y + (control.y - start.y) / 2 - (from[1] + to[1]) / 2;
    const dx = to[0] - from[0], dy = to[1] - from[1];
    return (-x * dy + y * dx) / Math.hypot(dx, dy);
}

test('Aho–Corasick edgeBend uses the same curves for drawing, arrows and labels through seek', () => {
    const options = { theme: 'light', nodeRadius: 19, topologyTransitions: true, edgeLabels: { placement: 'auto' } };
    const edgeBend = ({ edge }) => edge.data.kind === 'failure' ? 24 : undefined;
    const stock = createGraphRenderer(options);
    const defaults = createGraphRenderer({ ...options, edgeBend: () => undefined });
    const automatic = createGraphRenderer({ ...options, edgeBend });
    const paths = [];
    const decorated = createGraphRenderer({ ...options, edgeBend, drawEdge({ view, curve, arrow, drawStroke, drawArrow }) {
        paths.push({ edge: view.edge, curve, arrow });
        drawStroke(view.edge.data.kind === 'failure' ? { dash: [5, 4] } : undefined);
        drawArrow();
    } });
    for (const { name, start, fallback, labelCount } of ahoLabelFrames()) {
        const timeline = createTimeline([start, fallback], { stepDurationMs: 100, finalHoldMs: 50 });
        for (const [width, height] of [[390, 310], [960, 509]]) {
            const at = time => {
                paths.length = 0;
                const frame = timeline.sample(time);
                const raster = draw(decorated, frame, width, height);
                const plain = draw(automatic, frame, width, height);
                const plainLabels = labelCalls(plain);
                assert.equal(plainLabels.length, labelCount, name);
                assert.deepEqual(labelCalls(raster), plainLabels);
                assert.deepEqual(draw(defaults, frame, width, height).commands, draw(stock, frame, width, height).commands);
                const centers = new Map(plain.calls('fillText').filter(c => c.args.length === 4)
                    .map(c => [c.args[0], c.args.slice(1, 3)]));
                const nodes = new Map(frame.current.graph.nodes.map(node => [node.id, centers.get(node.label)]));
                const strokes = raster.calls('bezierCurveTo');
                for (const [i, { edge, curve, arrow }] of paths.entries()) {
                    assert.deepEqual(strokes[i].args, curve.slice(1).flatMap(({ x, y }) => [x, y]));
                    assert.deepEqual(arrow[0], curve[3]);
                    if (edge.data.kind === 'failure') {
                        const from = nodes.get(edge.from), to = nodes.get(edge.to);
                        const expected = Math.min(24, Math.hypot(to[0] - from[0], to[1] - from[1]) / 4);
                        assert.ok(Math.abs(signedBend(curve, from, to) - expected) < 1e-8, name);
                    }
                }
                return raster.commands;
            };
            const initial = at(0), active = at(45);
            assert.deepEqual(at(0), initial);
            assert.deepEqual(at(45), active);
        }
    }
});

test('edgeBend clamps short chords, preserves loops and validates before drawing', () => {
    const trace = createGraphTrace({
        nodes: [{ id: 'a' }, { id: 'b' }],
        edges: [{ id: 'ab', from: 'a', to: 'b' }, { id: 'ba', from: 'b', to: 'a' }, { id: 'loop', from: 'a', to: 'a' }],
    }, { layout: [{ nodeId: 'a', x: 0, y: 0 }, { nodeId: 'b', x: 2, y: 0 }] });
    const start = trace.start(), marked = trace.mark({ edges: [{ id: 'ab', role: 'active' }] });
    const timeline = createTimeline([start, marked], { stepDurationMs: 100, finalHoldMs: 0 });
    const options = { theme: 'light', topologyTransitions: true };
    const paths = new Map();
    const renderer = createGraphRenderer({ ...options, edgeBend(view) {
        assert.notEqual(view.edge.id, 'loop');
        return view.edge.id === 'ba' ? 0 : view.role === 'active' ? -24 : 24;
    }, drawEdge({ view, curve, drawStroke }) {
        paths.set(view.edge.id, curve);
        drawStroke();
    } });
    const at = time => {
        const target = draw(renderer, timeline.sample(time), 108, 108);
        const [from, to] = target.calls('fillText').map(c => c.args.slice(1, 3));
        const limit = Math.abs(to[0] - from[0]) / 4;
        assert.ok(limit < 24);
        assert.ok(Math.abs(signedBend(paths.get('ba'), to, from)) < 1e-8);
        assert.deepEqual(target.calls('bezierCurveTo').at(-1).args,
            draw(createGraphRenderer(options), timeline.sample(time), 108, 108).calls('bezierCurveTo').at(-1).args);
        return [signedBend(paths.get('ab'), from, to), limit];
    };
    for (const [time, fraction] of [[0, 1], [25, .5], [50, 0], [100, -1], [0, 1]]) {
        const [bend, limit] = at(time);
        assert.ok(Math.abs(bend - fraction * limit) < 1e-8);
    }
    assert.throws(() => createGraphRenderer({ ...options, edgeBend: 24 }), TypeError);
    for (const [bad, ErrorType] of [['24', TypeError], [Infinity, RangeError], [NaN, RangeError]]) {
        const invalid = createGraphRenderer({ ...options, edgeBend: () => bad });
        const target = recording(390, 310);
        assert.throws(() => invalid.render(target.ctx, timeline.sample(0), { width: 390, height: 310 }), ErrorType);
        assert.deepEqual(target.commands, []);
    }
});

test('drawEdge may omit stock drawing; a thrown value restores Canvas and expires the helpers', () => {
    const { start } = ahoLabelFrames()[0];
    const frame = createTimeline([start], { stepDurationMs: 100, finalHoldMs: 0 }).sample(0);
    const failure = {};
    let captured, shouldThrow = true;
    const renderer = createGraphRenderer({ theme: 'light', drawEdge({ ctx, drawArrow, drawStroke }) {
        captured = drawStroke;
        if (shouldThrow) {
            ctx.setLineDash([1, 2]);
            throw failure;
        }
        drawArrow();
    } });
    const target = recording(390, 310), saved = structuredClone(target.state);
    assert.throws(() => renderer.render(target.ctx, frame, { width: 390, height: 310 }), error => error === failure);
    assert.deepEqual(target.state, saved);
    assert.throws(() => captured(), /only be used during/);
    shouldThrow = false;
    const arrowsOnly = draw(renderer, frame);
    assert.equal(arrowsOnly.calls('stroke').length, 0);
    assert.ok(labelCalls(arrowsOnly).length > 0);
    assert.throws(() => createGraphRenderer({ theme: 'light', drawEdge: true }), TypeError);
});

test('side is relative to the directed curve and labels are skipped if they cannot fit', () => {
    const state = createGraphTrace({
        nodes: [{ id: 'a' }, { id: 'b' }],
        edges: [{ id: 'ab', from: 'a', to: 'b', label: 'x', directed: true }],
    }, { layout: [{ nodeId: 'a', x: 0, y: 0 }, { nodeId: 'b', x: 0, y: 2 }] }).state;
    const frame = { previous: state, current: state, progress: 1, stepIndex: 0, event: undefined };
    const options = { placement: 'auto', preferredSide: 'left' };
    const left = createGraphRenderer({ theme: 'light', edgeLabels: options });
    options.preferredSide = 'right';
    const right = createGraphRenderer({ theme: 'light', edgeLabels: options });
    assert.ok(labelCalls(draw(left, frame))[0].args[1] > 195);
    assert.ok(labelCalls(draw(right, frame))[0].args[1] < 195);
    assert.equal(labelCalls(draw(left, frame, 10, 10)).length, 0);
    const legacy = draw(createGraphRenderer({ theme: 'light' }), frame);
    assert.equal(labelCalls(legacy)[0].args[1], 195);
    assert.deepEqual(draw(createGraphRenderer({ theme: 'light', edgeLabels: undefined }), frame).commands, legacy.commands);
    assert.throws(() => createGraphRenderer({ theme: 'light', edgeLabels: {} }), TypeError);
    assert.throws(() => createGraphRenderer({ theme: 'light', edgeLabels: { placement: 'auto', preferredSide: 'top' } }), TypeError);
    assert.throws(() => createGraphRenderer({ theme: 'light', get edgeLabels() { throw Error('Must not run'); } }), TypeError);
});

test('auto placement follows loops, parallel lanes and the selected topology route', () => {
    const renderer = createGraphRenderer({
        theme: 'light', topologyTransitions: true, edgeLabels: { placement: 'auto' },
    });
    const state = createGraphTrace({
        nodes: [{ id: 'a' }, { id: 'b' }],
        edges: [
            { id: 'loop', from: 'a', to: 'a', label: 'loop', directed: true },
            { id: 'ab', from: 'a', to: 'b', label: 'go', directed: true },
            { id: 'ba', from: 'b', to: 'a', weight: 5, directed: true },
        ],
    }, { layout: [{ nodeId: 'a', x: 0, y: 0 }, { nodeId: 'b', x: 2, y: 0 }] }).state;
    const fixed = { previous: state, current: state, progress: 1, stepIndex: 0, event: undefined };
    const drawn = labelCalls(draw(renderer, fixed, 640, 400));
    assert.deepEqual(drawn.map(call => call.args[0]), ['loop', 'go', '5']);
    assert.equal(new Set(drawn.map(call => String(call.args.slice(1)))).size, 3);

    const [start, edited] = graphTopologySteps();
    const timeline = createTimeline([start, edited], { stepDurationMs: 100, finalHoldMs: 10 });
    const at = time => labelCalls(draw(renderer, timeline.sample(time), 640, 400))
        .map(call => [call.args[0], call.state.globalAlpha]);
    assert.deepEqual(at(25), [['old target', .75]]);
    assert.deepEqual(at(50), [['new target', .5]]);
    assert.deepEqual(at(25), [['old target', .75]]);

    const routes = [];
    const custom = createGraphRenderer({ theme: 'light', topologyTransitions: true, drawEdge({ ctx, view, drawStroke }) {
        if (view.edge.id === 'e') routes.push([view.edge.to, ctx.globalAlpha, view.role]);
        drawStroke();
    } });
    draw(custom, timeline.sample(25), 640, 400);
    assert.deepEqual(routes, [['B', .75, null], ['C', .25, 'queued']]);
});
