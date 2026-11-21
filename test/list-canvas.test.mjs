import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createListRenderer } from '@grundyjs/algiviz/canvas/list';
import { createListTrace } from '@grundyjs/algiviz/list';
import { Player } from '@grundyjs/algiviz/player';
import { dom } from './player-test-dom.mjs';
import { recording } from './tree-canvas-context.mjs';
import { input, slot, throwsSame } from './list-test-fixtures.mjs';

const size = { width: 480, height: 270 };
const pair = (previous, current = previous, progress = 1) => ({ previous, current, progress });
const renderer = options => createListRenderer({ theme: 'light', ...options });
const presentNode = ({ node }) => ({ label: String(node.value) });
const trace = (draw, chain = ['A', 'B']) => {
    const list = input(chain);
    return createListTrace(list, { layout: draw.layout(list) });
};
function frames(draw) {
    const list = trace(draw);
    const start = list.start().state;
    const candidate = input(['A', 'X', 'B']);
    const inserted = list.edit({ ...candidate, layout: draw.layout(candidate) }).state;
    const removed = list.edit({ nodes: input(['A', 'X']).nodes }).state;
    const done = list.done({ result: { nodeIds: ['X'], pointerIds: [slot('A'), slot('X')] } }).state;
    return { start, inserted, removed, done };
}
function render(draw, frame, ratio = 1) {
    const env = recording(size.width * ratio, size.height * ratio);
    draw.render(env.ctx, frame, size);
    return env;
}
function lines(env, color) {
    const paths = [];
    let points = [];
    for (const command of env.commands) {
        if (command.name === 'beginPath') points = [];
        if (command.name === 'moveTo' || command.name === 'lineTo') points.push(command.args);
        if (command.name === 'stroke' && command.state.strokeStyle === color) {
            paths.push({ points, alpha: command.state.globalAlpha });
        }
    }
    return paths;
}

test('list Canvas layout follows chain rank and returns frozen positions in storage order', () => {
    const draw = renderer({ nodeGap: 3 });
    const list = input(['A', 'B', 'C']);
    list.nodes.reverse();
    assert.deepEqual(draw.layout(list), [{ nodeId: 'C', x: 6, y: 0 }, { nodeId: 'B', x: 3, y: 0 }, { nodeId: 'A', x: 0, y: 0 }]);
    assert.ok(Object.isFrozen(draw) && Object.isFrozen(draw.layout(list)) && Object.isFrozen(draw.layout(list)[0]));
    assert.deepEqual(draw.layout(input([])), []);
    assert.deepEqual(Object.keys(draw), ['layout', 'render']);
    assert.throws(() => draw.layout({ ...list, headId: 'B' }), RangeError);
    assert.throws(() => renderer({ nodeGap: Number.MAX_VALUE }).layout(list), RangeError);
});

test('list Canvas draws each old/new branch at its own port with stable pair fitting', () => {
    const draw = renderer({ nullPointers: 'hidden', colors: { pointer: '#111222' } });
    const { start, inserted: initial } = frames(draw);
    const inserted = { ...initial, layout: initial.layout.map(p => p.nodeId === 'B' ? { ...p, x: 12 } : p) };
    const draws = [0, 0.5, 1].map(p => render(draw, pair(start, inserted, p)));
    const routes = draws.map(env => lines(env, '#111222'));
    assert.deepEqual(routes[1].map(r => r.alpha), [1, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    const old = routes[1][2].points, next = routes[1][4].points;
    assert.deepEqual(old[0], next[0]);
    assert.ok(old.at(-1)[0] > next.at(-1)[0]);
    assert.deepEqual(routes[0][2].points[0], routes[2][2].points[0]);
    assert.ok(routes[0][2].points.at(-1)[0] < old.at(-1)[0]);
});

test('list Canvas keeps potential null bounds for hidden and moving null branches', () => {
    const visible = renderer(), hidden = renderer({ nullPointers: 'hidden' });
    const { inserted, removed } = frames(visible);
    for (const progress of [0, 0.5, 1]) {
        const frame = pair(inserted, removed, progress);
        const fills = draw => render(draw, frame).calls('fillRect').map(c => c.args);
        assert.deepEqual(fills(visible), fills(hidden));
    }
    const empty = trace(visible, []).state;
    assert.equal(render(visible, pair(empty)).calls('strokeRect').length, 2);
    assert.equal(render(hidden, pair(empty)).calls('strokeRect').length, 1);
});

test('list Canvas preserves the backward gutter and exposes independent result colors', () => {
    const draw = renderer();
    const list = trace(draw);
    list.start();
    list.setLayout([{ nodeId: 'A', x: 4, y: 0 }, { nodeId: 'B', x: 0, y: 0 }]);
    const selected = list.done({ result: { nodeIds: ['B'], pointerIds: [slot('A')] } }).state;
    const env = render(draw, pair(selected));
    const branch = lines(env, '#047857')[0].points;
    assert.equal(branch.length, 6);
    assert.ok(Math.max(...branch.map(p => p[1])) > branch[0][1]);
    const cells = env.calls('fillRect').slice(1, 5);
    assert.deepEqual(cells.map(c => c.state.fillStyle), ['#e2e8f0', '#047857', '#047857', '#e2e8f0']);
});

test('list Canvas uses readable text on selected null outlines in both themes', () => {
    for (const [theme, result, resultText, text] of [
        ['light', '#047857', '#ffffff', '#0f172a'],
        ['dark', '#34d399', '#052e16', '#f1f5f9'],
    ]) {
        const draw = renderer({ theme });
        const list = trace(draw, ['A']);
        list.start();
        const state = list.done({ result: { pointerIds: [slot(), slot('A')] } }).state;
        const env = render(draw, pair(state));
        const labels = env.calls('fillText');
        assert.equal(labels.find(command => command.args[0] === 'head')?.state.fillStyle, resultText);
        assert.equal(labels.find(command => command.args[0] === 'null')?.state.fillStyle, text);
        assert.equal(env.calls('strokeRect').find(command => command.state.strokeStyle === result)?.state.strokeStyle, result);
    }
});

test('list Canvas calls the presenter in current then exit order with captured endpoints', () => {
    const sources = frames(renderer());
    const previous = structuredClone(sources.inserted), current = structuredClone(sources.removed);
    const seen = [], shared = { label: '' };
    const draw = renderer({ presentNode(view, snapshot) {
        assert.equal(this, undefined);
        assert.ok(Object.isFrozen(view) && Object.isFrozen(snapshot) && Object.isFrozen(view.node));
        assert.equal(view.node, snapshot.list.nodes.find(node => node.id === view.node.id));
        seen.push([view.node.id, snapshot.list.nodes.length]);
        current.list.nodes[0].value = 100;
        shared.label = view.node.id;
        return shared;
    } });
    const env = render(draw, pair(previous, current, 1));
    assert.deepEqual(seen, [['A', 2], ['X', 2], ['B', 3]]);
    assert.deepEqual(env.calls('fillText').map(c => c.args[0]).slice(0, 2), ['A', 'X']);
});

test('list Canvas validates hidden data, invalid geometry and presenter output before pixels', () => {
    const draw = renderer({ nullPointers: 'hidden', nodeCaptions: 'hidden', presentNode: () => ({ color: '' }) });
    const state = trace(draw).state, env = recording();
    const host = { get canvas() { throw Error('host read'); } };
    assert.throws(() => draw.render(host, pair(state, { ...state, nodeCaptions: undefined }), size), TypeError);
    assert.throws(() => draw.render(host, pair(state, state, 1.01), size), RangeError);
    const extreme = { ...state, layout: state.layout.map(pos => ({ ...pos, x: 1e100 })) };
    assert.throws(() => draw.render(env.ctx, pair(extreme), size), RangeError);
    assert.throws(() => draw.render(env.ctx, pair(state), size), TypeError);
    assert.equal(env.commands.length, 0);
});

test('list Canvas skips frame metadata, zero sizes and presenters in tiny diagrams', () => {
    let presented = 0;
    const draw = renderer({ presentNode: () => { presented++; } });
    const state = trace(draw).state, env = recording();
    const frame = { ...pair(state), get event() { throw 1; }, get stepIndex() { throw 2; } };
    draw.render(env.ctx, frame, { width: 0, height: 30 });
    assert.equal(env.commands.length, 0);
    draw.render(env.ctx, frame, { width: 24, height: 30 });
    assert.equal(env.calls('fillRect').length, 1);
    assert.equal(env.calls('measureText').length, 0);
    assert.equal(presented, 0);
    draw.render(env.ctx, frame, size);
    assert.equal(presented, 2);
});

test('list Canvas omits unsafe text and plans route clipping before paint', () => {
    const draw = renderer({ presentNode: ({ node }) => ({ label: node.id === 'A' ? 'A' : 'W'.repeat(500) }) });
    const state = trace(draw).state, env = render(draw, pair(state));
    assert.ok(env.calls('fillText').some(c => c.args[0] === 'A'));
    assert.ok(env.calls('fillText').every(c => !String(c.args[0]).includes('WW')));
    assert.ok(env.calls('clip').some(c => c.args[0] === 'evenodd'));
    const lastMeasure = env.commands.findLastIndex(c => c.name === 'measureText');
    assert.ok(lastMeasure >= 0 && lastMeasure < env.commands.findIndex(c => c.name === 'clearRect'));
    const overlap = { ...state, layout: state.layout.map(p => ({ ...p, x: 0 })) };
    assert.ok(render(draw, pair(overlap)).calls('fillText').every(c => c.args[0] !== 'A'));
});

test('list Canvas draws within the painted margin and uses caller bitmap ratios', () => {
    const draw = renderer({ theme: 'dark', presentNode });
    const { inserted, removed } = frames(draw);
    for (const ratio of [1, 1.25, 2]) for (const progress of [0, 0.5, 1]) {
        const env = render(draw, pair(inserted, removed, progress), ratio);
        assert.deepEqual(env.calls('setTransform')[0].args, [ratio, 0, 0, ratio, 0, 0]);
        assert.deepEqual(env.calls('clearRect')[0].args, [0, 0, size.width, size.height]);
        for (const { args: [x, y, w, h], state } of env.calls('strokeRect')) {
            const half = state.lineWidth / 2;
            assert.ok(x - half >= 4 && y - half >= 4 && x + w + half <= size.width - 4 && y + h + half <= size.height - 4);
        }
        assert.equal(env.stack.length, 0);
        assert.deepEqual(env.state.transform, [3, 0, 0, 4, 5, 6]);
    }
});

test('list Canvas preserves falsy primary errors, acquired saves and busy recovery', () => {
    let draw, failure = true, passes = 0;
    const state = trace(renderer()).state, env = recording();
    draw = renderer({ presentNode() {
        assert.throws(() => draw.layout(null), { constructor: Error });
        assert.throws(() => draw.render(null, null, null), { constructor: Error });
        passes++;
        return { label: 'A' };
    } });
    const restore = env.ctx.restore;
    env.ctx.restore = () => { restore(); if (failure) throw Error('restore'); };
    const measure = env.ctx.measureText;
    env.ctx.measureText = text => { if (failure) throw undefined; return measure(text); };
    throwsSame(() => draw.render(env.ctx, pair(state), size), undefined);
    assert.equal(env.calls('clearRect').length, 0);
    assert.equal(env.stack.length, 0);
    failure = false;
    draw.render(env.ctx, pair(state), size);
    assert.equal(passes, 4);
    env.ctx.save = () => { throw false; };
    const before = env.calls('restore').length;
    throwsSame(() => draw.render(env.ctx, pair(state), size), false);
    assert.equal(env.calls('restore').length, before);
});

test('list Canvas follows Player completion, rewind and Restart without retaining prior selection', async () => {
    const draw = renderer({ presentNode }), host = dom(), canvas = recording();
    let sessions = 0;
    const player = new Player(host.container(), {
        *stepSource() {
            sessions++;
            const list = trace(draw);
            yield list.start();
            yield list.done({ result: { pointerIds: [slot('B')] } });
        },
        isTerminal: step => step.event.type === 'done',
        rewindCapacity: 4,
        render: frame => draw.render(canvas.ctx, frame, size),
    });
    const showsGreen = () => canvas.commands.slice(canvas.commands.findLastIndex(c => c.name === 'clearRect'))
        .some(c => c.name === 'fillRect' && c.state.fillStyle === '#047857');
    player.start();
    player.next();
    assert.equal(player.status.phase, 'finished');
    assert.equal(showsGreen(), true);
    player.previous();
    assert.equal(showsGreen(), false);
    player.next();
    assert.equal(showsGreen(), true);
    player.restart();
    assert.equal(sessions, 2);
    assert.equal(showsGreen(), false);
    player.dispose();
    await player.closed;
    assert.equal(host.scheduler.size, 0);
});
