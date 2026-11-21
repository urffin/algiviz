import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createListRenderer } from '@grundyjs/algiviz/canvas/list';
import { Player } from '@grundyjs/algiviz/player';
import { graphSteps } from '../examples/graph-algorithm.mjs';
import { graphPositions } from '../examples/graph-layout.mjs';
import { graphExamples } from '../examples/graph-presets.mjs';
import { graphQueueSteps, prepareGraphQueueSession } from '../examples/graph-queue-session.mjs';
import { graphRewindCapacity } from '../examples/graph-session.mjs';
import { timing } from '../examples/player-settings.mjs';
import { dom } from './player-test-dom.mjs';

const renderer = createListRenderer({ theme: 'dark' });
const preset = graphExamples[0];
const session = (mode, layout = renderer.layout) =>
    prepareGraphQueueSession(preset.graph, preset.start, preset.target, preset.id, mode, layout);

function assertQueue(state) {
    const snapshot = state.queueVisual;
    const byId = new Map(snapshot.list.nodes.map(node => [node.id, node]));
    assert.equal(byId.size, state.queue.length);
    let head = snapshot.list.headId;
    for (const id of state.queue) {
        assert.equal(head, id);
        assert.equal(byId.get(id).value, id);
        head = byId.get(id).nextId;
    }
    assert.equal(head, null);
    assert.ok(Object.isFrozen(snapshot));
}

test('graph and linked-list queue use the stock BFS events and FIFO order at every step', () => {
    const cases = [
        ...graphExamples.map(example => [example, example.target]),
        ...['H', 'A', null].map(target => [preset, target]),
    ];
    for (const [example, target] of cases) {
        const options = { layout: graphPositions(example.graph, example.id) };
        const baseline = [...graphSteps(example.graph, example.start, target, options)];
        const source = graphQueueSteps(example.graph, example.start, target, options, renderer.layout);
        const first = source.next().value;
        const initial = JSON.stringify(first);
        const composed = [first, ...source];
        assert.equal(JSON.stringify(first), initial);
        assert.equal(composed.length, baseline.length);
        for (const [index, step] of composed.entries()) {
            const { queueVisual, ...stockState } = step.state;
            assert.deepEqual({ ...step, state: stockState }, baseline[index]);
            assertQueue(step.state);
            assert.ok(Object.isFrozen(step) && Object.isFrozen(step.state));
            const previous = composed[index - 1];
            if (previous && !['dequeue', 'discover', 'finished'].includes(step.event.kind)) {
                assert.equal(queueVisual, previous.state.queueVisual);
            }
        }
        assert.deepEqual(composed.at(-1).state.queue, []);
        assert.equal(composed.at(-1).state.queueVisual.result, null);
    }
});

for (const mode of ['generator', 'history']) {
    test(`one ${mode} Player steps, rewinds, seeks when available and restarts both BFS panels`, async () => {
        const env = dom();
        const frames = [];
        const player = new Player(env.container(), { ...session(mode), render: frame => {
            assertQueue(frame.previous);
            assertQueue(frame.current);
            frames.push(frame);
        } });
        try {
            player.start();
            const first = player.frame.current;
            assert.deepEqual(first.queue, ['A']);
            player.next();
            player.next();
            const beforeDiscover = player.frame.current;
            assert.equal(beforeDiscover.event.kind, 'examine');
            assert.deepEqual(beforeDiscover.queue, []);
            player.next();
            const discover = player.frame.current;
            assert.equal(discover.event.kind, 'discover');
            assert.deepEqual(discover.queue, ['B']);
            assert.equal(discover.visual.nodeCaptions.find(caption => caption.id === 'B').text, 'd = 1');
            player.previous();
            assert.equal(player.frame.current, beforeDiscover);
            player.next();
            assert.equal(player.frame.current, discover);
            if (mode === 'history') {
                player.seek(2.5 * timing.stepDurationMs);
                assert.equal(player.frame.previous, beforeDiscover);
                assert.equal(player.frame.current, discover);
                assert.equal(player.frame.progress, 0.5);
            }
            for (let count = 0; count < 100 && player.status.phase !== 'finished'; count++) player.next();
            assert.equal(player.status.phase, 'finished');
            assert.deepEqual(player.frame.current.visual.result.nodeIds, ['A', 'B', 'D', 'G']);
            assert.deepEqual(player.frame.current.queue, []);
            if (mode === 'generator') {
                for (let count = 0; count < 100 && player.status.canPrevious; count++) player.previous();
                assert.equal(player.status.rewindEndIndex - player.status.rewindStartIndex + 1, graphRewindCapacity);
                assert.equal(player.status.canPrevious, false);
            }
            player.restart();
            assert.deepEqual(player.frame.current, first);
            if (mode === 'generator') assert.notEqual(player.frame.current.queueVisual, first.queueVisual);
            assert.ok(frames.length > 10);
        } finally {
            player.dispose();
            assert.equal((await player.closed).errorCount, 0);
        }
        assert.equal(env.scheduler.size, 0);
        assert.equal(env.timers.size, 0);
    });
}

test('the queue generator is lazy and prepares only the first snapshot for validation', () => {
    let calls = 0;
    const options = session('generator', list => { calls++; return renderer.layout(list); });
    assert.equal(calls, 1);
    const source = options.stepSource();
    assert.equal(calls, 1);
    assert.equal(source.next().value.state.event.kind, 'start');
    assert.equal(calls, 2);
    assert.equal(source.next().value.state.event.kind, 'dequeue');
    assert.equal(calls, 3);
    assert.equal(source.next().value.state.event.kind, 'examine');
    assert.equal(calls, 3);
    source.return();
    assert.equal(source.next().done, true);
    assert.equal(calls, 3);
});

test('the new page uses public imports and shares one graph viewport wrapper', async () => {
    const html = await readFile(new URL('../examples/graph-queue.html', import.meta.url), 'utf8');
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const { imports } = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
    for (const entry of ['graph', 'list', 'canvas/graph', 'canvas/list', 'canvas/viewport', 'player', 'playback']) {
        assert.equal(imports[pkg.name + '/' + entry], '.' + pkg.exports['./' + entry].import);
    }
    assert.match(html, /id="player">\s*<div class="panes">/);
    assert.deepEqual([...html.matchAll(/<canvas id="([^"]+)"/g)].map(match => match[1]), ['graph-canvas', 'queue-canvas']);
});
