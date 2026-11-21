import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { graphScene } from '@grundyjs/algiviz/graph';
import { createGraphRenderer } from '@grundyjs/algiviz/canvas/graph';
import { Player } from '@grundyjs/algiviz/player';
import { createSceneFrame } from '@grundyjs/algiviz/scene';
import { contractionSteps, prepareContractionSession } from '../examples/graph-contraction.mjs';
import { timing } from '../examples/player-settings.mjs';
import { recording } from './graph-canvas-context.mjs';
import { dom } from './player-test-dom.mjs';

const project = state => graphScene(state.visual, { namespace: 'contraction' });

test('edge contraction removes B and AB in one step and retains the IDs of both redirected edges', () => {
    const source = contractionSteps(), start = source.next().value;
    const initial = JSON.stringify(start);
    const [selected, edit, done] = [...source];
    assert.equal(JSON.stringify(start), initial);
    assert.deepEqual([start, selected, edit, done].map(step => step.index), [0, 1, 2, 3]);
    assert.deepEqual([start, selected, edit, done].map(step => step.event.type), ['start', 'mark', 'edit', 'done']);
    assert.deepEqual(selected.state.visual.edgeMarks, [{ id: 'AB', role: 'active' }]);
    assert.equal(selected.state.visual.graph, start.state.visual.graph);
    const visual = edit.state.visual;
    assert.deepEqual(visual.graph.nodes.map(node => node.id), ['A', 'C', 'D']);
    assert.deepEqual(visual.graph.edges.map(edge => [edge.id, edge.from, edge.to]), [
        ['AC', 'A', 'C'], ['BC', 'C', 'A'], ['BD', 'A', 'D'],
    ]);
    assert.deepEqual(visual.layout, start.state.visual.layout.filter(position => position.nodeId !== 'B'));
    assert.deepEqual(visual.edgeMarks, [{ id: 'BC', role: 'queued' }, { id: 'BD', role: 'queued' }]);
    assert.deepEqual(visual.nodeMarks, [{ id: 'A', role: 'active' }]);
    assert.equal(visual.result, null);
    assert.deepEqual(done.state.visual.result, { nodeIds: ['A'], edgeIds: ['BC', 'BD'] });
    assert.ok([start, selected, edit, done].every(step => Object.isFrozen(step.state) && Object.isFrozen(step.state.visual)));

    const scene = createSceneFrame({
        previous: project(selected.state), current: project(edit.state), progress: .5, stepIndex: 2, event: edit.event,
    });
    const removed = scene.objects.filter(object => object.phase === 'exit');
    assert.deepEqual(removed.map(object => object.previous.data.edge?.id ?? object.previous.data.node.id), ['AB', 'B']);
    const edge = id => scene.objects.find(object => object.current?.data.edge?.id === id);
    const bc = edge('BC'), bd = edge('BD');
    assert.equal(bc.phase, 'update');
    assert.equal(bd.phase, 'update');
    assert.equal(bc.previous.id, bc.current.id);
    assert.equal(bd.previous.id, bd.current.id);
    assert.equal(scene.get(bc.previous.data.to).previous.data.node.id, 'B');
    assert.equal(scene.get(bc.current.data.to).current.data.node.id, 'A');
    assert.equal(scene.get(bd.previous.data.from).previous.data.node.id, 'B');
    assert.equal(scene.get(bd.current.data.from).current.data.node.id, 'A');
    assert.deepEqual([edge('AC').current.data.routeIndex, bc.current.data.routeIndex], [0, 1]);
    assert.equal(bc.current.data.routeCount, 2);
});

test('edge contraction sessions share snapshots and a fresh generator starts with the original graph', () => {
    assert.throws(() => prepareContractionSession('invalid'), RangeError);
    const stream = prepareContractionSession('generator'), history = prepareContractionSession('history');
    const source = stream.stepSource(), first = source.next().value;
    source.return();
    assert.equal(source.next().done, true);
    const events = [...stream.stepSource()];
    assert.deepEqual(events[0], first);
    assert.notEqual(events[0].state, first.state);
    assert.deepEqual(history.history(), events.map(step => step.state));
    assert.deepEqual(events.map(stream.isTerminal), [false, false, false, true]);
});

for (const mode of ['generator', 'history']) {
    test(`edge contraction ${mode} Player restores the selected graph, parallel edges and the starting frame`, async () => {
        const env = dom(), renderer = createGraphRenderer({ theme: 'dark', topologyTransitions: true });
        let host;
        const player = new Player(env.container(), {
            ...prepareContractionSession(mode),
            render(frame) {
                host = recording(390, 230);
                renderer.render(host.ctx, { ...frame, previous: frame.previous.visual, current: frame.current.visual },
                    { width: 390, height: 230 });
            },
        });
        try {
            player.start();
            const first = player.frame.current, before = host.commands;
            player.next();
            const selected = player.frame.current, marked = host.commands;
            player.next();
            const edit = player.frame.current;
            assert.equal(host.calls('arc').length, 3);
            assert.equal(host.calls('stroke').length, 3);
            player.previous();
            assert.equal(player.frame.current, selected);
            assert.deepEqual(host.commands, marked);
            player.next();
            assert.equal(player.frame.current, edit);
            player.next();
            assert.deepEqual(player.frame.current.visual.result, { nodeIds: ['A'], edgeIds: ['BC', 'BD'] });
            assert.equal(host.calls('arc').filter(call => call.state.fillStyle === '#34d399').length, 1);
            assert.equal(host.calls('stroke').filter(call => call.state.strokeStyle === '#34d399').length, 2);
            player.next();
            assert.equal(player.status.phase, 'finished');
            if (mode === 'history') {
                player.seek(1.5 * timing.stepDurationMs);
                assert.equal(player.frame.progress, .5);
                assert.equal(player.frame.previous, selected);
                assert.equal(player.frame.current, edit);
                assert.deepEqual(host.calls('stroke').map(call => call.state.globalAlpha), [1, .5, .5, .5, .5, .5]);
            }
            player.restart();
            assert.deepEqual(player.frame.current, first);
            assert.deepEqual(host.commands, before);
        } finally {
            player.dispose();
            assert.equal((await player.closed).errorCount, 0);
        }
        assert.equal(env.scheduler.size, 0);
        assert.equal(env.timers.size, 0);
    });
}

test('edge contraction page resolves its four public entries from the local build', async () => {
    const html = await readFile(new URL('../examples/graph-contraction.html', import.meta.url), 'utf8');
    const { imports } = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    for (const entry of ['graph', 'canvas/graph', 'canvas/viewport', 'player']) {
        assert.equal(imports[pkg.name + '/' + entry], '.' + pkg.exports['./' + entry].import);
    }
    assert.match(html, /src="\.\/graph-contraction-demo\.mjs"/);
});
