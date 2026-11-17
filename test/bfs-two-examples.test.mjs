import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '@grundyjs/algiviz/player';
import { graphSteps, graphExamples } from '../examples/graph-algorithm.mjs';
import { prepareGraphSession } from '../examples/graph-session.mjs';
import { createDetailedGraphView } from '../examples/graph-view.mjs';
import { createStockGraphView } from '../examples/graph-player-view.mjs';
import { describeGraphStep } from '../examples/graph-page.mjs';
import { recording } from './graph-canvas-context.mjs';
import { dom } from './player-test-dom.mjs';

const main = graphExamples[0];
function paint(view, frame, width = 960) {
    const height = view.height(width, frame.current), env = recording(width * 2, height * 2);
    view.render(env.ctx, frame, { width, height });
    assert.equal(env.stack.length, 0);
    return env;
}
const endpoint = step => ({ previous: step.state, current: step.state, progress: 1, stepIndex: step.index, event: undefined });

test('BFS detailed view restores the animated queue, vertex distances, start/target markers and examination dot with state-only history', () => {
    const steps = [...graphSteps(main.graph, 'A', 'G')], view = createDetailedGraphView(main.id);
    const discover = steps.find(step => step.event.kind === 'discover' && step.event.target === 'E');
    const queue = paint(view, endpoint(discover), 390);
    assert.equal(queue.calls('fillRect').filter(c => c.state.fillStyle === '#c4b5fd').length, discover.state.queue.length);
    const labels = queue.calls('fillText').map(c => c.args[0]);
    for (const text of ['QUEUE', 'Front', 'Back', 'start', 'target', 'd = 0', 'd = 2']) assert.ok(labels.includes(text), text);
    const examined = steps.find(step => step.event.kind === 'examine');
    const frame = { ...endpoint(examined), previous: steps[examined.index - 1].state, progress: .5 };
    const image = paint(view, frame);
    assert.ok(image.calls('arc').some(c => c.args[2] === 5), 'moving examination dot survives history Frame.event=undefined');
    assert.match(describeGraphStep(frame), /Inspect neighbor B of A/);
    assert.deepEqual(image.state.transform, [3, 0, 0, 4, 5, 6], 'custom view preserves caller transform');
});

test('Both BFS views follow the same Player through history/stream end, green result, backward replay, Restart and disposal', async () => {
    for (const createView of [createDetailedGraphView, createStockGraphView]) for (const mode of ['history', 'generator']) {
        const view = createView(main.id), env = dom();
        const p = new Player(env.container(), { ...prepareGraphSession(main.graph, 'A', 'G', main.id, mode), render(frame) {
            assert.equal(typeof describeGraphStep(frame), 'string');
            paint(view, frame);
        } });
        p.start(); let guard = 0;
        while (p.status.phase !== 'finished' && guard++ < 150) p.next();
        assert.equal(p.status.phase, 'finished'); assert.deepEqual(p.frame.current.path, [...'ABDG']);
        const final = p.frame.current, result = paint(view, p.frame);
        assert.equal(result.calls('fill').filter(c => c.state.fillStyle === '#34d399').length, 4);
        for (let i = 0; i < 3 && p.frame.current === final; i++) p.previous();
        assert.notEqual(p.frame.current, final);
        for (let i = 0; i < 3 && p.frame.current !== final; i++) p.next();
        assert.equal(p.frame.current, final);
        if (mode === 'history') p.seek(0);
        p.restart(); assert.deepEqual(p.frame.current.queue, ['A']); assert.deepEqual(p.frame.current.path, []);
        assert.ok(!paint(view, p.frame).calls('fill').some(c => c.state.fillStyle === '#34d399'));
        p.dispose(); p.dispose(); await p.closed; assert.equal(env.scheduler.size, 0);
    }
});
