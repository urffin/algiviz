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
});
