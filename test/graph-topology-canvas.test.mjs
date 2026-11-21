import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDynamicGraphTrace, createGraphTrace } from '@grundyjs/algiviz/graph';
import { createGraphRenderer } from '@grundyjs/algiviz/canvas/graph';
import { Player } from '@grundyjs/algiviz/player';
import { graphTopologySteps } from './graph-topology-fixture.mjs';
import { recording } from './graph-canvas-context.mjs';
import { dom } from './player-test-dom.mjs';

const size = { width: 640, height: 400 };
const frame = (previous, current, progress = 1) => ({ previous, current, progress });
const enabled = options => createGraphRenderer({ theme: 'dark', topologyTransitions: true, ...options });
const [initial, edited, done] = [...graphTopologySteps()].map(step => step.state);

function draw(value, renderer = enabled()) {
    const host = recording();
    const saved = structuredClone(host.state);
    renderer.render(host.ctx, value, size);
    assert.deepEqual(host.state, saved);
    return host;
}

function routes(host) {
    return host.commands.flatMap((command, index) => command.name === 'bezierCurveTo'
        ? [{ from: host.commands[index - 1].args, to: command.args.slice(-2), controls: command.args.slice(0, 4),
            alpha: command.state.globalAlpha, color: command.state.strokeStyle }]
        : []);
}

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const attached = (point, [x, y, radius]) => near(Math.hypot(point[0] - x, point[1] - y), radius);
const labels = host => host.calls('fillText').filter(call => call.args[0].endsWith('target'))
    .map(call => [call.args[0], call.state.globalAlpha]);

test('graph topology Canvas: explicit boolean opt-in, capture, validation order and default parity', () => {
    const pair = frame(initial, edited, .5);
    const standard = draw(pair, createGraphRenderer({ theme: 'dark' }));
    assert.deepEqual(routes(standard).map(route => route.alpha), [1, .5, .5]);
    assert.deepEqual(labels(standard), [['new target', 1]]);
    for (const topologyTransitions of [undefined, false]) {
        const host = draw(pair, createGraphRenderer({ theme: 'dark', topologyTransitions }));
        assert.deepEqual(host.commands, standard.commands);
    }
    const options = { theme: 'dark', topologyTransitions: true };
    const renderer = createGraphRenderer(options);
    options.topologyTransitions = false;
    assert.deepEqual(routes(draw(pair, renderer)).map(route => route.alpha), [.5, .5, .5, .5]);
    for (const value of [null, 0, 'true', [], new Boolean(true)]) {
        assert.throws(() => createGraphRenderer({ theme: 'dark', topologyTransitions: value }), TypeError);
    }
    const withAccessor = { theme: 'dark', get topologyTransitions() { assert.fail('Read the getter'); } };
    assert.throws(() => createGraphRenderer(withAccessor), TypeError);
    const thrown = {};
    for (const input of [{ theme: 'invalid' }, { theme: 'dark', nodeCaptions: 'invalid' }, { theme: 'dark', nodeCaptions: 'hidden' }]) {
        const proxy = new Proxy(input, {
            getOwnPropertyDescriptor(target, key) {
                if (key === 'topologyTransitions') throw thrown;
                return Reflect.getOwnPropertyDescriptor(target, key);
            },
        });
        if (input.nodeCaptions === 'hidden') assert.throws(() => createGraphRenderer(proxy), error => error === thrown);
        else assert.throws(() => createGraphRenderer(proxy), TypeError);
    }
});

test('graph topology Canvas: two same-ID paths stay attached and carry their own arrows, colors and one label', () => {
    const at = p => draw(frame(initial, edited, p));
    const first = at(0), part = at(.25), mid = at(.5), last = at(1);
    assert.deepEqual(routes(first).map(route => route.alpha), [1, 1]);
    assert.deepEqual(routes(part).map(route => route.alpha), [.75, .25, .25, .75]);
    assert.deepEqual(routes(last).map(route => route.alpha), [1, 1]);
    const [old, next] = routes(mid);
    assert.deepEqual([old.color, next.color], ['#94a3b8', '#a78bfa']);
    const [a, c, b] = mid.calls('arc').map(call => call.args);
    attached(old.from, a);
    attached(next.from, a);
    attached(old.to, b);
    attached(next.to, c);
    const arrows = mid.commands.flatMap((call, index) => call.name === 'moveTo' && mid.commands[index + 1]?.name === 'lineTo' ? [call.args] : []);
    assert.deepEqual(arrows, [old.to, next.to]);
    near(a[0], (first.calls('arc')[0].args[0] + last.calls('arc')[0].args[0]) / 2);
    assert.deepEqual(mid.calls('arc').map(call => call.state.globalAlpha), [1, .5, .5]);
    assert.deepEqual(first.calls('arc').map(call => call.state.globalAlpha), [1, 1]);
    assert.deepEqual(last.calls('arc').map(call => call.state.globalAlpha), [1, 1]);
    assert.deepEqual(labels(first), [['old target', 1]]);
    assert.deepEqual(labels(part), [['old target', .75]]);
    assert.deepEqual(labels(mid), [['new target', .5]]);
    assert.deepEqual(labels(last), [['new target', 1]]);
});

test('graph topology Canvas: enter and exit from empty paint only visible objects and validate both snapshots', () => {
    const empty = createGraphTrace({ nodes: [], edges: [] }).state;
    const start = draw(frame(empty, initial, 0));
    const end = draw(frame(initial, empty, 1));
    for (const host of [start, end]) {
        assert.deepEqual(host.calls('clearRect')[0].args, [0, 0, size.width, size.height]);
        assert.equal(host.calls('arc').length, 0);
        assert.equal(routes(host).length, 0);
        assert.equal(host.calls('fillText').length, 0);
    }
    for (const value of [frame(empty, initial, .25), frame(initial, empty, .75)]) {
        const host = draw(value);
        assert.deepEqual(routes(host).map(route => route.alpha), [.25, .25]);
        assert.deepEqual(host.calls('arc').map(call => call.state.globalAlpha), [.25, .25]);
    }
    const host = recording();
    const invalid = { ...initial, layout: [] };
    assert.throws(() => enabled().render(host.ctx, frame(invalid, empty, 1), size), RangeError);
    assert.deepEqual(host.commands, []);
});

test('graph topology Canvas: undirected swaps keep one path while reversal, direction toggle and loops use two', () => {
    function swap(beforeEdge, afterEdge) {
        const trace = createDynamicGraphTrace({ nodes: [{ id: 'A' }, { id: 'B' }], edges: [{ id: 'e', ...beforeEdge }] });
        return draw(frame(trace.start().state, trace.edit({ edges: [{ id: 'e', ...afterEdge }] }).state, .5));
    }
    const ab = { from: 'A', to: 'B' }, ba = { from: 'B', to: 'A' };
    const stable = swap(ab, { ...ba, directed: false });
    assert.deepEqual(routes(stable).map(route => route.alpha), [1]);
    assert.equal(stable.calls('closePath').length, 0);
    const reversed = swap({ ...ab, directed: true }, { ...ba, directed: true });
    const [old, next] = routes(reversed);
    const [a, b] = reversed.calls('arc').map(call => call.args);
    attached(old.to, b);
    attached(next.to, a);
    assert.deepEqual(routes(reversed).map(route => route.alpha), [.5, .5]);
    assert.equal(reversed.calls('closePath').length, 2);
    const toggled = swap(ab, { ...ab, directed: true });
    assert.deepEqual(routes(toggled).map(route => route.alpha), [.5, .5]);
    assert.equal(toggled.calls('closePath').length, 1);
    const loop = swap({ ...ab, directed: true }, { from: 'A', to: 'A', directed: true });
    const loopRoute = routes(loop)[1];
    attached(loopRoute.from, loop.calls('arc')[0].args);
    attached(loopRoute.to, loop.calls('arc')[0].args);
});

test('graph topology Canvas: fixed group lanes for fades and smooth retained lanes for parallel links and loops', () => {
    const e = { id: 'e', from: 'A', to: 'B' }, l = { id: 'l', from: 'A', to: 'A' };
    const added = [{ id: 'back', from: 'B', to: 'A', directed: true }, { id: 'loop', from: 'A', to: 'A' }];
    const trace = createDynamicGraphTrace({ nodes: [{ id: 'A' }, { id: 'B' }], edges: [e, l] }, {
        layout: [{ nodeId: 'A', x: 0, y: 0 }, { nodeId: 'B', x: 2, y: 0 }],
    });
    const before = trace.start().state, after = trace.edit({ edges: [...added, e, l] }).state;
    const first = routes(draw(frame(before, after, 0))), middle = routes(draw(frame(before, after, .5)));
    const last = routes(draw(frame(before, after, 1)));
    assert.deepEqual(middle.map(route => route.alpha), [.5, .5, 1, 1]);
    for (const i of [0, 1]) assert.deepEqual(middle[i].controls, last[i].controls);
    assert.ok(first[0].controls[1] < middle[2].controls[1] && middle[2].controls[1] < last[2].controls[1]);
    near(middle[3].controls[1], (first[1].controls[1] + last[3].controls[1]) / 2);
    assert.ok(last[3].controls[1] < last[1].controls[1]);
    const shrink = routes(draw(frame(after, before, .5)));
    assert.deepEqual(shrink.map(route => route.alpha), [1, 1, .5, .5]);
    assert.deepEqual(shrink.map(route => route.controls), [2, 3, 0, 1].map(i => middle[i].controls));
    const [a, b] = draw(frame(before, after, .5)).calls('arc').map(call => call.args);
    attached(middle[2].from, a);
    attached(middle[2].to, b);
});

for (const mode of ['stream', 'history']) {
    test(`graph topology Canvas: ${mode} Replay and Restart render clean frames without source rereads`, async () => {
        const env = dom(), r = enabled({ colors: { background: 'transparent' } });
        let edits = 0, last;
        function* steps() {
            for (const step of graphTopologySteps()) {
                if (step.event.type === 'edit') edits++;
                yield step;
            }
        }
        const source = mode === 'stream'
            ? { stepSource: steps, isTerminal: step => step.event.type === 'done', rewindCapacity: 3 }
            : { history: () => Array.from(steps(), step => step.state) };
        const player = new Player(env.container(), { ...source, stepDurationMs: 100, render(value) { last = draw(value, r); } });
        try {
            player.start();
            const first = last.commands;
            player.next();
            const changed = last.commands;
            player.previous();
            assert.deepEqual(last.commands, first);
            player.next();
            assert.deepEqual(last.commands, changed);
            assert.equal(edits, 1);
            player.next();
            assert.deepEqual(player.frame.current.result, done.result);
            assert.ok(last.calls('arc').some(call => call.state.fillStyle === '#34d399'));
            if (mode === 'history') {
                player.seek(50);
                assert.deepEqual(routes(last).map(route => route.alpha), [.5, .5, .5, .5]);
                player.seek(0);
                assert.deepEqual(last.commands, first);
            }
            player.restart();
            assert.deepEqual(last.commands, first);
            assert.deepEqual(last.calls('clearRect')[0].args, [0, 0, size.width, size.height]);
        } finally {
            player.dispose();
            assert.equal((await player.closed).errorCount, 0);
        }
        assert.equal(env.scheduler.size, 0);
    });
}
