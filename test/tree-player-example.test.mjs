import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createTreeRenderer } from '@grundyjs/algiviz/canvas/tree';
import { treeScene } from '@grundyjs/algiviz/tree';
import { Player } from '@grundyjs/algiviz/player';
import { treeInsertionSteps } from '../examples/tree-player-algorithm.mjs';
import { prepareTreeSession, treeRewindCapacity } from '../examples/tree-player-session.mjs';
import { timing } from '../examples/player-settings.mjs';
import { recording } from './tree-canvas-context.mjs';
import { dom } from './player-test-dom.mjs';

const renderer = () => createTreeRenderer({ theme: 'dark', emptySlots: 'visible' });
const phases = ['start', 'compare', 'compare', 'insert', 'pivot', 'rotate', 'check', 'done'];
function inorder(input, id = input.rootId) {
    if (id === null) return [];
    const node = input.nodes.find(n => n.id === id);
    const child = slot => input.links.find(l => l.parentId === id && l.slot === slot)?.childId ?? null;
    return [...inorder(input, child('left')), node.data, ...inorder(input, child('right'))];
}
function paint(drawing, frame) {
    const env = recording(960, 440);
    drawing.render(env.ctx, { ...frame, previous: frame.previous.visual, current: frame.current.visual }, { width: 960, height: 440 });
    assert.equal(env.stack.length, 0); return env;
}
const endpoint = step => ({ previous: step.state, current: step.state, progress: 1, event: undefined, stepIndex: step.index });

test('tree Player example: real BST insertion, one right rotation, stable IDs and immutable snapshots', () => {
    const drawing = renderer(), source = treeInsertionSteps(drawing.layout), start = source.next().value;
    const original = JSON.stringify(start), steps = [start, ...source];
    assert.equal(JSON.stringify(start), original);
    assert.deepEqual(steps.map(s => s.index), phases.map((_, i) => i));
    assert.deepEqual(steps.map(s => s.state.phase), phases);
    for (const [i, step] of steps.entries()) {
        const state = step.state.visual, input = state.tree;
        assert.ok(Object.isFrozen(step) && Object.isFrozen(step.state) && Object.isFrozen(state) && Object.isFrozen(input.nodes));
        assert.deepEqual(inorder(input), i < 3 ? [2, 3] : [1, 2, 3]);
        assert.equal(input.rootId, i < 5 ? 'n3' : 'n2');
        assert.deepEqual(input.nodes.map(n => n.id), i < 3 ? ['n3', 'n2'] : ['n3', 'n2', 'n1']);
        assert.equal(treeScene(state, { namespace: 'example' }).objects.length, i < 3 ? 3 : 5);
        if (i >= 3) assert.deepEqual(input.links.find(l => l.id === 'inserted'), { id: 'inserted', parentId: 'n2', childId: 'n1', slot: 'left' });
    }
    const rotations = steps.slice(1).filter((step, i) => step.state.visual.tree.rootId !== steps[i].state.visual.tree.rootId);
    assert.equal(rotations.length, 1); assert.equal(rotations[0].state.phase, 'rotate');
    assert.deepEqual(steps[5].state.visual.tree.links.find(l => l.id === 'upper'), { id: 'upper', parentId: 'n2', childId: 'n3', slot: 'right' });
    assert.deepEqual(steps.at(-1).state.visual.result, { nodeIds: ['n1', 'n2', 'n3'], linkIds: ['upper', 'inserted'] });
});

test('tree Player example: generation is lazy, early return stops work, new runs reset IDs and steps', () => {
    const drawing = renderer(); let layouts = 0;
    const layout = input => { layouts++; return drawing.layout(input); };
    const source = treeInsertionSteps(layout); assert.equal(layouts, 0);
    const first = source.next().value; assert.equal(layouts, 1); source.next();
    assert.deepEqual(source.return(), { done: true, value: undefined }); assert.equal(layouts, 1);
    assert.equal(source.next().done, true);
    const a = [...treeInsertionSteps(layout)], b = [...treeInsertionSteps(layout)];
    assert.equal(layouts, 7); assert.deepEqual(a, b); assert.notEqual(a[0].state.visual, b[0].state.visual);
    assert.deepEqual(first, a[0]);
});

test('tree Player example: stock drawing shows all final nodes/links green and attached rotation branches', () => {
    const drawing = renderer(), steps = [...treeInsertionSteps(drawing.layout)];
    for (const step of steps.slice(0, -1)) assert.ok(!paint(drawing, endpoint(step)).calls('fill').some(c => c.state.fillStyle === '#34d399'));
    const final = paint(drawing, endpoint(steps.at(-1)));
    assert.equal(final.calls('fill').filter(c => c.state.fillStyle === '#34d399').length, 3);
    assert.equal(final.calls('stroke').filter(c => c.state.strokeStyle === '#34d399').length, 2);
    assert.ok(final.calls('fillText').some(c => c.args[0] === 'root'));
    const moving = paint(drawing, { ...endpoint(steps[5]), previous: steps[4].state, progress: .5 });
    assert.equal(moving.calls('bezierCurveTo').length, 3);
    assert.equal(moving.calls('bezierCurveTo').filter(c => c.state.globalAlpha === .5).length, 2);
});

test('tree Player example: history and bounded stream restore insertion/result, Pause, Restart and cleanup', async () => {
    for (const mode of ['generator', 'history']) {
        const env = dom(), host = env.container(), drawing = renderer(); let layouts = 0, frame;
        const options = prepareTreeSession(mode, input => { layouts++; return drawing.layout(input); });
        const player = new Player(host, { ...options, render(next) { frame = next; paint(drawing, next); } });
        assert.equal(layouts, 0); player.start(); const initial = player.frame.current;
        player.play(); env.scheduler.tick(0); env.scheduler.tick(100); player.pause();
        const paused = frame; env.scheduler.tick(1000); assert.equal(frame, paused);
        for (let i = 0; i < 12 && player.status.phase !== 'finished'; i++) player.next();
        assert.equal(player.status.phase, 'finished'); assert.equal(player.frame.current.phase, 'done'); assert.equal(layouts, 3);
        const final = player.frame.current;
        for (let i = 0; i < 3 && player.frame.current === final; i++) player.previous();
        assert.equal(player.frame.current.visual.result, null);
        for (let i = 0; i < 3 && player.frame.current !== final; i++) player.next();
        assert.equal(player.frame.current, final); assert.equal(layouts, 3);
        if (mode === 'history') {
            player.seek(timing.stepDurationMs * 4.5); assert.equal(player.frame.progress, .5); assert.equal(player.frame.current.phase, 'rotate');
            player.seek(0);
        } else {
            assert.equal(player.status.rewindStartIndex, 0); assert.equal(treeRewindCapacity, phases.length);
            for (let i = 0; i < 10; i++) player.previous();
        }
        assert.equal(player.frame.current, initial); assert.equal(player.frame.current.visual.tree.nodes.length, 2); assert.equal(layouts, 3);
        player.restart(); assert.deepEqual(player.frame.current, initial); assert.notEqual(player.frame.current, initial);
        assert.equal(layouts, mode === 'history' ? 6 : 4);
        player.dispose(); player.dispose(); assert.equal((await player.closed).errorCount, 0);
        assert.equal(env.scheduler.size, 0); assert.equal(env.timers.size, 0); assert.equal(host.children.length, 0);
    }
});

test('tree Player example: validate mode before touching the source or existing playback', () => {
    for (const mode of [null, undefined, 'stream', '', {}, 'History'])
        assert.throws(() => prepareTreeSession(mode, () => assert.fail('Layout called')), RangeError);
});

test('tree Player example: public imports, both tree pages remain discoverable and Canvas has an accessible description', async () => {
    const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
    const [html, index, old, algorithm, page, session] = await Promise.all(['examples/tree-player.html', 'examples/index.html', 'examples/tree.html',
        'examples/tree-player-algorithm.mjs', 'examples/tree-player-page.mjs', 'examples/tree-player-session.mjs'].map(read));
    const map = JSON.parse(html.match(/<script type="importmap">([^<]+)<\/script>/)[1]).imports;
    for (const entry of ['tree', 'canvas/tree', 'player', 'canvas/viewport']) assert.ok(map['@grundyjs/algiviz/' + entry]);
    assert.ok(!/from ['"][^'"]*(?:\/src\/|\/dist\/)/.test(algorithm + page + session));
    assert.match(html, /href="\.\/tree.html"/); assert.match(index, /href="\.\/tree-player.html"/); assert.match(index, /href="\.\/tree.html"/);
    assert.match(old, /tree-demo\.mjs/); assert.match(old, /<svg/); assert.match(html, /canvas[^>]+aria-label=/);
    assert.match(session, /player-settings\.mjs/); assert.match(page, /pagehide/); assert.match(page, /pageshow/);
});
