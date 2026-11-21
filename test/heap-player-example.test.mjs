import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createTreeRenderer } from '@grundyjs/algiviz/canvas/tree';
import { Player } from '@grundyjs/algiviz/player';
import { createSceneFrame } from '@grundyjs/algiviz/scene';
import { treeScene } from '@grundyjs/algiviz/tree';
import { iterateHeapSort } from '../examples/heap-algorithm.mjs';
import { createHeapArrayRenderer } from '../examples/heap-player-array.mjs';
import { heapPanelSteps, prepareHeapPanelSession } from '../examples/heap-player-session.mjs';
import { timing } from '../examples/player-settings.mjs';
import { recording } from './graph-canvas-context.mjs';
import { dom } from './player-test-dom.mjs';

const labels = state => state.array.slots.map(item => state.labelById[item.id]);
const projectTree = state => treeScene(state.tree, { namespace: 'heap' });

test('the heap and array use the same immutable identities through the original 18 steps', () => {
    const original = [...iterateHeapSort([2, 2, 1])], steps = [...heapPanelSteps()];
    const first = steps[0].state;
    const sourceIds = new Map(original[0].state.main.map((item, index) => [item.id, first.array.slots[index]]));
    assert.equal(steps.length, 18);
    for (const [index, step] of steps.entries()) {
        const { array, tree } = step.state;
        const expected = original[index];
        assert.deepEqual([step.index, step.event], [expected.index, expected.event]);
        assert.deepEqual(tree.tree.nodes.map(node => node.id),
            array.slots.slice(0, expected.state.heapSize).map(item => item.id));
        assert.equal(array.sortedSuffixLength, 3 - expected.state.heapSize);
        assert.ok(Object.isFrozen(step) && Object.isFrozen(step.state)
            && Object.isFrozen(array) && Object.isFrozen(tree));
        expected.state.main.forEach((item, index) => assert.equal(array.slots[index], sourceIds.get(item.id)));
    }

    const swap = steps[6].state, shrunk = steps[7].state, sifted = steps[10].state;
    const a = first.array.slots[0], b = first.array.slots[1], one = first.array.slots[2];
    assert.deepEqual(labels(swap), ['1', '2b', '2a']);
    assert.equal(swap.tree.tree.rootId, one.id);
    assert.equal(swap.tree.tree.links.find(link => link.slot === 'right').childId, a.id);
    assert.equal(shrunk.array.slots[2], a);
    assert.ok(!shrunk.tree.tree.nodes.some(node => node.id === a.id));
    assert.deepEqual(labels(sifted), ['2b', '1', '2a']);
    assert.equal(sifted.tree.tree.rootId, b.id);
    assert.deepEqual(labels(steps.at(-1).state), ['1', '2b', '2a']);
    assert.deepEqual(steps.at(-1).state.tree.tree, { kind: 'binary', rootId: null, nodes: [], links: [] });
    assert.deepEqual(labels(first), ['2a', '2b', '1']);

    const transition = (previous, current) => createSceneFrame({
        previous: projectTree(previous), current: projectTree(current), progress: .5, stepIndex: 0, event: undefined,
    }).objects;
    const moving = transition(steps[5].state, swap);
    assert.ok(moving.every(item => item.phase === 'update' && item.previous.id === item.current.id));
    const exits = transition(swap, shrunk).filter(item => item.phase === 'exit');
    assert.deepEqual(exits.map(item => item.previous.data.link?.id ?? item.previous.data.node.id), ['heap-slot-2', a.id]);
});

test('the stream starts fresh after early return and reproduces the complete history', () => {
    const stream = prepareHeapPanelSession('generator'), history = prepareHeapPanelSession('history');
    const iterator = stream.stepSource(), start = iterator.next().value;
    iterator.return();
    assert.equal(iterator.next().done, true);
    const steps = [...stream.stepSource()];
    assert.deepEqual(steps[0], start);
    assert.notEqual(steps[0].state, start.state);
    assert.deepEqual(history.history(), steps.map(step => step.state));
    assert.deepEqual(steps.filter(stream.isTerminal), [steps.at(-1)]);
    assert.throws(() => prepareHeapPanelSession('invalid'), RangeError);
});

for (const mode of ['generator', 'history']) {
    test(`one ${mode} Player restores the same array and heap through extraction, rewind and Restart`, async () => {
        const env = dom(), size = { width: 390, height: 180 };
        const drawArray = createHeapArrayRenderer(), treeRenderer = createTreeRenderer({ theme: 'dark' });
        const options = prepareHeapPanelSession(mode);
        let array, tree;
        const player = new Player(env.container(), {
            ...options,
            render(frame) {
                array = recording(size.width, size.height);
                tree = recording(size.width, size.height);
                drawArray(array.ctx, frame, size);
                treeRenderer.render(tree.ctx, { ...frame, previous: frame.previous.tree, current: frame.current.tree }, size);
            },
        });
        const commands = () => [array.commands, tree.commands];
        const drawnLabels = () => array.calls('fillText').slice(3);
        try {
            player.start();
            const start = player.frame.current, initial = commands();
            assert.deepEqual(drawnLabels().map(call => call.args[0]), ['2a', '2b', '1']);
            for (let i = 0; i < 6; i++) player.next();
            const swap = player.frame.current, swapped = commands();
            assert.deepEqual(drawnLabels().map(call => call.args[0]), ['1', '2b', '2a']);
            player.next();
            const shrunk = player.frame.current, afterShrink = commands();
            assert.equal(tree.calls('arc').length, 2);
            assert.equal(array.calls('fillRect').filter(call => call.state.fillStyle === '#34d399').length, 1);
            player.previous();
            assert.equal(player.frame.current, swap);
            assert.deepEqual(commands(), swapped);
            player.next();
            assert.equal(player.frame.current, shrunk);
            assert.deepEqual(commands(), afterShrink);

            for (let i = 0; i <= 11 && player.status.phase !== 'finished'; i++) player.next();
            assert.equal(player.status.phase, 'finished');
            assert.deepEqual(drawnLabels().map(call => call.args[0]), ['1', '2b', '2a']);
            assert.equal(array.calls('fillRect').filter(call => call.state.fillStyle === '#34d399').length, 3);
            assert.equal(tree.calls('arc').length, 0);

            if (mode === 'history') {
                player.seek(5.5 * timing.stepDurationMs);
                assert.equal(player.frame.progress, .5);
                assert.equal(player.frame.event, undefined);
                const byLabel = new Map(drawnLabels().map(call => [call.args[0], call.args.slice(1)]));
                const [a, b, one] = ['2a', '2b', '1'].map(label => byLabel.get(label));
                assert.equal(a[0], b[0]);
                assert.equal(b[0], one[0]);
                assert.ok(one[1] < b[1] && b[1] < a[1]);
                assert.equal(array.calls('fillRect').filter(call => call.state.fillStyle === '#fbbf24').length, 2);
            }
            player.restart();
            assert.deepEqual(player.frame.current, start);
            assert.deepEqual(commands(), initial);
        } finally {
            player.dispose();
            assert.equal((await player.closed).errorCount, 0);
        }
        assert.equal(env.scheduler.size, 0);
        assert.equal(env.timers.size, 0);
    });
}

test('the new page uses public entries and links back to the editable heap demo', async () => {
    const html = await readFile(new URL('../examples/heap-player.html', import.meta.url), 'utf8');
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const { imports } = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
    const paths = ['array', 'tree', 'canvas', 'canvas/tree', 'canvas/viewport', 'playback', 'player', 'scene'];
    assert.deepEqual(imports, Object.fromEntries(paths.map(entry => [
        pkg.name + '/' + entry, '.' + pkg.exports['./' + entry].import,
    ])));
    assert.match(html, /href="\.\/heap\.html"/);
    assert.match(html, /src="\.\/heap-player-demo\.mjs"/);
});
