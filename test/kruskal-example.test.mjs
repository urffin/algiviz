import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { mapFrame } from '@grundyjs/algiviz/playback';
import { createGraphRenderer } from '@grundyjs/algiviz/canvas/graph';
import { Player } from '@grundyjs/algiviz/player';
import { kruskalSteps, prepareKruskalSession } from '../examples/kruskal.mjs';
import { timing } from '../examples/player-settings.mjs';
import { recording } from './graph-canvas-context.mjs';
import { dom } from './player-test-dom.mjs';

const chosen = ['AC', 'BC', 'BD', 'CE'];
const edgeIds = snapshot => snapshot.graph.edges.map(edge => edge.id);
const accepted = snapshot => snapshot.edgeMarks.filter(mark => mark.role === 'accepted').map(mark => mark.id);

test('Kruskal adds edges in weight order, rejects cycles and keeps both snapshots in sync', () => {
    const source = kruskalSteps(), first = source.next().value;
    const before = JSON.stringify(first);
    const steps = [first, ...source], states = steps.map(step => step.state);
    assert.deepEqual(steps.map(step => step.index), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(states.map(state => state.totalWeight), [0, 1, 3, 3, 7, 7, 13, 13]);
    assert.deepEqual(states.map(state => edgeIds(state.forest)), [
        [], ['AC'], ['AC', 'BC'], ['AC', 'BC'], ['AC', 'BC', 'BD'],
        ['AC', 'BC', 'BD'], chosen, chosen,
    ]);
    assert.equal(JSON.stringify(first), before);
    for (const [index, id] of [[3, 'AB'], [5, 'CD']]) {
        assert.equal(states[index].forest, states[index - 1].forest);
        assert.deepEqual(states[index].graph.edgeMarks.find(mark => mark.id === id), { id, role: 'rejected' });
        assert.match(states[index].message, /would form a cycle/);
    }
    for (const state of states) {
        assert.equal(state.graph.graph, first.state.graph.graph);
        assert.deepEqual(accepted(state.graph), edgeIds(state.forest));
        assert.deepEqual(state.graph.layout, state.forest.layout);
        assert.ok(Object.isFrozen(state) && Object.isFrozen(state.graph) && Object.isFrozen(state.forest));
    }
    const final = states.at(-1), result = { nodeIds: [], edgeIds: chosen };
    assert.deepEqual(final.graph.result, result);
    assert.deepEqual(final.forest.result, result);
    assert.equal(steps.at(-1).event.type, 'done');
    assert.deepEqual(source.next(), { value: undefined, done: true });
});

test('Kruskal sessions use the same states and a fresh generator starts with an empty forest', () => {
    const stream = prepareKruskalSession('generator'), history = prepareKruskalSession('history');
    const generator = stream.stepSource(), first = generator.next().value;
    generator.return();
    assert.equal(generator.next().done, true);
    const replay = [...stream.stepSource()];
    assert.deepEqual(replay[0], first);
    assert.notEqual(replay[0].state, first.state);
    assert.deepEqual(history.history(), replay.map(step => step.state));
    assert.deepEqual(replay.map(stream.isTerminal), [false, false, false, false, false, false, false, true]);
    assert.throws(() => prepareKruskalSession('invalid'), RangeError);
});

for (const mode of ['generator', 'history']) {
    test(`Kruskal ${mode} Player rewinds both draw calls, selects the same result and restarts`, async () => {
        const env = dom(), size = { width: 390, height: 230 };
        const keys = ['graph', 'forest'];
        const renderers = keys.map(() => createGraphRenderer({
            theme: 'dark', topologyTransitions: true, roleColors: { accepted: '#60a5fa', rejected: '#f87171' },
        }));
        let drawings;
        const player = new Player(env.container(), {
            ...prepareKruskalSession(mode),
            render(frame) {
                drawings = keys.map((key, index) => {
                    const target = recording(size.width, size.height);
                    renderers[index].render(target.ctx, mapFrame(frame, state => state[key]), size);
                    return target;
                });
            },
        });
        const commands = () => drawings.map(target => target.commands);
        try {
            player.start();
            const start = player.frame.current, before = commands();
            assert.deepEqual(drawings.map(target => target.calls('stroke').length), [7, 0]);
            player.next();
            const first = player.frame.current, firstDrawings = commands();
            assert.deepEqual(drawings.map(target => target.calls('stroke').filter(call => call.state.strokeStyle === '#60a5fa').length), [1, 1]);
            player.previous();
            assert.equal(player.frame.current, start);
            assert.deepEqual(commands(), before);
            player.next();
            assert.equal(player.frame.current, first);
            assert.deepEqual(commands(), firstDrawings);

            player.next();
            const afterTwoEdges = commands();
            player.next();
            assert.match(player.frame.current.message, /^Skip A–B/);
            assert.notDeepEqual(commands()[0], afterTwoEdges[0]);
            assert.deepEqual(commands()[1], afterTwoEdges[1]);
            for (let count = 0; count <= 5 && player.status.phase !== 'finished'; count++) player.next();
            assert.equal(player.status.phase, 'finished');
            assert.deepEqual(drawings.map(target => target.calls('stroke').filter(call => call.state.strokeStyle === '#34d399').length), [4, 4]);
            assert.equal(player.frame.current.totalWeight, 13);

            if (mode === 'history') {
                player.seek(.5 * timing.stepDurationMs);
                assert.equal(player.frame.progress, .5);
                assert.equal(player.frame.previous, start);
                assert.equal(player.frame.current, first);
                assert.deepEqual(drawings[1].calls('stroke').map(call => call.state.globalAlpha), [.5]);
            }
            player.restart();
            assert.deepEqual(player.frame.current, start);
            assert.deepEqual(commands(), before);
        } finally {
            player.dispose();
            assert.equal((await player.closed).errorCount, 0);
        }
        assert.equal(env.scheduler.size, 0);
        assert.equal(env.timers.size, 0);
    });
}

test('Kruskal page maps its public imports to the local build', async () => {
    const html = await readFile(new URL('../examples/kruskal.html', import.meta.url), 'utf8');
    const { imports } = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const expected = Object.fromEntries(['graph', 'canvas/graph', 'canvas/viewport', 'playback', 'player'].map(entry => [
        pkg.name + '/' + entry, '.' + pkg.exports['./' + entry].import,
    ]));
    assert.deepEqual(imports, expected);
    assert.match(html, /src="\.\/kruskal-demo\.mjs"/);
});
