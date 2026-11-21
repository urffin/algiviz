import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createListRenderer } from '@grundyjs/algiviz/canvas/list';
import { listScene } from '@grundyjs/algiviz/list';
import { createSceneFrame } from '@grundyjs/algiviz/scene';
import { Player } from '@grundyjs/algiviz/player';
import { listEditSteps, prepareListSession } from '../examples/list-player-algorithm.mjs';
import { timing } from '../examples/player-settings.mjs';
import { dom } from './player-test-dom.mjs';

const drawing = createListRenderer({ theme: 'dark' });
const project = step => listScene(step.state.visual, { namespace: 'example' });
const chain = ({ list }) => {
    const byId = new Map(list.nodes.map(node => [node.id, node]));
    const values = [];
    for (let id = list.headId; id !== null;) {
        const node = byId.get(id);
        values.push(node.value);
        id = node.nextId;
    }
    return values;
};

test('list example emits valid atomic edits with stable slots and independent final selections', () => {
    const source = listEditSteps(drawing.layout);
    const first = source.next().value;
    const original = JSON.stringify(first);
    const steps = [first, ...source];
    assert.equal(JSON.stringify(first), original);
    assert.deepEqual(steps.map(step => step.index), [0, 1, 2, 3, 4]);
    assert.deepEqual(steps.map(step => step.state.phase), ['start', 'insert', 'remove', 'reverse', 'done']);
    assert.deepEqual(steps.map(step => step.event.type), ['start', 'edit', 'edit', 'edit', 'done']);
    assert.deepEqual(steps.map(step => chain(step.state.visual)), [
        [7, 3, 9], [7, 5, 3, 9], [7, 5, 9], [9, 5, 7], [9, 5, 7],
    ]);
    assert.ok(steps.every(step => Object.isFrozen(step.state) && Object.isFrozen(step.state.visual)));
    assert.ok(steps.slice(0, -1).every(step => step.state.visual.result === null));
    const finalScene = project(steps.at(-1));
    assert.equal(finalScene.objects.length, 7);
    assert.ok(finalScene.objects.every(object => object.data.result));
    assert.equal(finalScene.objects.filter(object => object.type === 'listPointer' && object.data.to === null).length, 1);

    const transition = (i, p = 0.5) => createSceneFrame({
        previous: project(steps[i - 1]), current: project(steps[i]), progress: p, event: steps[i].event, stepIndex: i,
    });
    const headId = JSON.stringify(['example', 'list', 'pointer', 'head']);
    const nextId = id => JSON.stringify(['example', 'list', 'pointer', 'next', id]);
    const inserted = transition(1).get(nextId('a'));
    assert.equal(inserted.phase, 'update');
    assert.notEqual(inserted.previous.data.to, inserted.current.data.to);
    assert.equal(transition(2).get(nextId('b')).phase, 'exit');
    const head = transition(3).get(headId);
    assert.equal(head.phase, 'update');
    assert.notEqual(head.previous.data.to, head.current.data.to);
    assert.equal(transition(3).get(nextId('a')).current.data.to, null);
});

test('list example prepares both modes lazily and rejects an invalid mode before layout', () => {
    let calls = 0;
    const layout = list => { calls++; return drawing.layout(list); };
    assert.throws(() => prepareListSession('stream', layout), RangeError);
    const stream = prepareListSession('generator', layout);
    const history = prepareListSession('history', layout);
    const source = stream.stepSource();
    assert.equal(calls, 0);
    assert.equal(source.next().value.state.phase, 'start');
    assert.equal(calls, 1);
    source.return();
    assert.equal(source.next().done, true);
    assert.equal(calls, 1);
    const states = history.history();
    const steps = [...stream.stepSource()];
    assert.deepEqual(states, steps.map(step => step.state));
    assert.notEqual(states[0], steps[0].state);
    assert.ok(Object.isFrozen(states));
    assert.equal(calls, 9);
});

for (const mode of ['generator', 'history']) {
    test(`list example ${mode}: rewind, replay and Restart restore recorded states`, async () => {
        const env = dom(), host = env.container();
        let calls = 0;
        const player = new Player(host, {
            ...prepareListSession(mode, list => { calls++; return drawing.layout(list); }),
            render() {},
        });
        try {
            player.start();
            const initial = player.frame.current;
            assert.equal(initial.phase, 'start');
            for (let i = 0; i < 8 && player.status.phase !== 'finished'; i++) player.next();
            assert.equal(player.status.phase, 'finished');
            assert.equal(calls, 4);
            const final = player.frame.current;
            assert.equal(final.message, 'Result: 9 → 5 → 7 → null.');
            for (let i = 0; i < 3 && player.frame.current === final; i++) player.previous();
            assert.equal(player.frame.current.visual.result, null);
            player.next();
            assert.equal(player.frame.current, final);
            assert.equal(calls, 4);
            if (mode === 'history') {
                player.seek(2.5 * timing.stepDurationMs);
                assert.equal(player.frame.current.phase, 'reverse');
                assert.equal(player.frame.progress, 0.5);
            } else {
                assert.equal(player.status.canSeek, false);
            }
            player.restart();
            assert.deepEqual(player.frame.current, initial);
            assert.notEqual(player.frame.current, initial);
            assert.equal(player.frame.current.visual.result, null);
            assert.equal(calls, mode === 'history' ? 8 : 5);
        } finally {
            player.dispose();
            assert.equal((await player.closed).errorCount, 0);
        }
        assert.equal(env.scheduler.size, 0);
        assert.equal(env.timers.size, 0);
    });
}

test('list example resolves its public entries from the local build', async () => {
    const html = await readFile(new URL('../examples/list-player.html', import.meta.url), 'utf8');
    const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    for (const entry of ['list', 'canvas/list', 'player', 'canvas/viewport']) {
        assert.equal(map['@grundyjs/algiviz/' + entry], '.' + pkg.exports['./' + entry].import);
    }
    assert.match(html, /src="\.\/list-player-demo\.mjs"/);
});
