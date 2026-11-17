import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGraphTrace } from '@grundyjs/algiviz/graph';
import { createGraphRenderer } from '@grundyjs/algiviz/canvas/graph';
import { graphFrames, size } from './graph-canvas-fixtures.mjs';
import { recording } from './graph-canvas-context.mjs';

const renderer = (options = {}) => createGraphRenderer({ theme: 'light', ...options });
const frame = state => ({ previous: state, current: state, progress: 1, event: undefined, stepIndex: 0 });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function draw(f, r = renderer(), width = 640, height = 400, logical = size) { const env = recording(width, height); r.render(env.ctx, f, logical); return env; }
function nodeFills(env) { return env.calls('fill').filter(command => command.state.fillStyle !== undefined).slice(-env.calls('arc').length); }
function accessor(key, base = {}) { return Object.defineProperty(base, key, { get() { assert.fail('Accessor invoked: ' + key); } }); }

test('graph Canvas: imports without DOM, captures palette/roles once and result wins over all marks', () => {
    assert.equal(typeof globalThis.document, 'undefined');
    const f = graphFrames(), colors = { result: '#123456', queued: 'purple' }, roleColors = { active: 'red', visited: 'orange' };
    const r = renderer({ colors, roleColors }); colors.result = 'pink'; roleColors.visited = 'blue';
    const env = draw(f.endpoint(f.done), r);
    assert.equal(env.calls('stroke')[0].state.strokeStyle, '#123456');
    assert.equal(env.calls('fill')[0].state.fillStyle, '#123456');
    assert.deepEqual(nodeFills(env).map(c => c.state.fillStyle), ['red', '#123456', '#e2e8f0', '#e2e8f0']);
    const dark = draw(f.endpoint(f.done), renderer({ theme: 'dark' }));
    assert.equal(dark.calls('stroke')[0].state.strokeStyle, '#34d399'); assert.equal(nodeFills(dark)[1].state.fillStyle, '#34d399');
    const light = draw(f.endpoint(f.done)); assert.equal(nodeFills(light)[1].state.fillStyle, '#047857');
    assert.equal(light.calls('stroke')[1].state.strokeStyle, '#475569', 'Result must not select other incident edges');
});

test('graph Canvas: validates options/data descriptors, open roles safely include prototype-like names', () => {
    for (const options of [undefined, null, [], {}, { theme: 'sepia' }, accessor('theme'), { theme: 'light', colors: [] },
        { theme: 'light', colors: { result: '' } }, { theme: 'light', colors: accessor('node') },
        { theme: 'light', roleColors: { active: undefined } }, { theme: 'light', roleColors: { '': 'red' } },
        { theme: 'light', roleColors: accessor('x') }]) assert.throws(() => createGraphRenderer(options), TypeError);
    const colors = accessor('ignored', { result: undefined }), roles = JSON.parse('{"__proto__":"orange","constructor":"red","toString":"blue"}');
    const r = renderer({ colors, roleColors: roles });
    const t = createGraphTrace({ nodes: ['__proto__', 'constructor', 'toString', 'unknown'].map(id => ({ id })), edges: [] });
    t.start(); const marked = t.mark({ nodes: ['__proto__', 'constructor', 'toString', 'unknown'].map(id => ({ id, role: id })) });
    assert.deepEqual(nodeFills(draw(frame(marked.state), r)).map(c => c.state.fillStyle), ['orange', 'red', 'blue', '#e2e8f0']);
});

test('graph Canvas: edges precede nodes; arrows follow to, antiparallel/parallel lanes and loops remain distinct', () => {
    const f = graphFrames(), env = draw(f.endpoint(f.start));
    assert.equal(env.calls('bezierCurveTo').length, 5); assert.equal(env.calls('closePath').length, 3);
    assert.equal(env.calls('arc').length, 4);
    assert.ok(env.commands.findIndex(c => c.name === 'arc') > env.commands.findLastIndex(c => c.name === 'stroke'));
    const paths = env.calls('bezierCurveTo').map(c => c.args), arcs = env.calls('arc').map(c => c.args);
    const ends = paths.slice(0, 3).map(p => [p[4], p[5]]);
    for (const [i, target] of [1, 0, 1].entries()) close(Math.hypot(ends[i][0] - arcs[target][0], ends[i][1] - arcs[target][1]), arcs[target][2]);
    assert.notDeepEqual(paths[0].slice(0, 4), paths[2].slice(0, 4));
    // Compare curve midpoints in a common orientation, not simply reversed endpoints.
    const move = env.calls('moveTo').filter(c => c.args.length === 2);
    assert.notDeepEqual(paths[3], paths[4]); assert.ok(paths[3][1] < arcs[0][1] && paths[4][1] < paths[3][1]);
    const triangles = env.calls('lineTo'); assert.equal(triangles.length, 6);
    const tip = move[1].args, baseA = triangles[0].args, baseB = triangles[1].args;
    assert.ok((tip[0] - (baseA[0] + baseB[0]) / 2) * (arcs[1][0] - tip[0]) +
        (tip[1] - (baseA[1] + baseB[1]) / 2) * (arcs[1][1] - tip[1]) > 0);
    assert.deepEqual(env.calls('fillText').slice(0, 3).map(c => c.args[0]), ['-1', '0', '<edge>']);
    assert.ok(!env.calls('fillText').some(c => c.args[0] === 'C')); assert.ok(env.calls('fillText').some(c => c.args[0] === '<node>'));
});

test('graph Canvas: raw progress uses one joint-bounds transform and attached endpoints move with nodes', () => {
    const f = graphFrames(), r = renderer(), frames = [0, .25, .5, 1].map(p => draw(f.motion(p), r));
    for (let i = 0; i < 4; i++) {
        const a = frames[0].calls('arc')[i].args, b = frames[3].calls('arc')[i].args;
        const quarter = frames[1].calls('arc')[i].args, half = frames[2].calls('arc')[i].args;
        close(quarter[0], a[0] * .75 + b[0] * .25); close(half[0], (a[0] + b[0]) / 2);
        close(quarter[1], a[1] * .75 + b[1] * .25); assert.equal(quarter[2], a[2]);
    }
    for (let edge = 0; edge < 5; edge++) {
        const a = frames[0].calls('bezierCurveTo')[edge].args, b = frames[3].calls('bezierCurveTo')[edge].args;
        frames[1].calls('bezierCurveTo')[edge].args.forEach((v, i) => close(v, a[i] * .75 + b[i] * .25));
    }
    // Current annotations are used already at p=0, and Event/stepIndex are never read.
    const transition = f.frame(f.start, f.done, 0);
    Object.defineProperty(transition, 'event', { get() { assert.fail('Event read'); } });
    Object.defineProperty(transition, 'stepIndex', { get() { assert.fail('stepIndex read'); } });
    assert.equal(nodeFills(draw(transition))[1].state.fillStyle, '#047857');
});

test('graph Canvas: logical geometry is DPR-independent, uses rounded bitmap ratios and never resizes', () => {
    const f = graphFrames(), logical = { width: 301.25, height: 173.5 }, logs = [];
    for (const dpr of [1, 1.25, 2, 3]) {
        const w = Math.round(logical.width * dpr), h = Math.round(logical.height * dpr), env = recording(w, h);
        const original = structuredClone(env.state), canvas = env.ctx.canvas;
        Object.defineProperty(canvas, 'width', { get: () => w, set() { assert.fail('Renderer resized bitmap'); } });
        Object.defineProperty(canvas, 'height', { get: () => h, set() { assert.fail('Renderer resized bitmap'); } });
        renderer().render(env.ctx, f.motion(.25), logical);
        assert.deepEqual(env.calls('setTransform')[0].args, [w / logical.width, 0, 0, h / logical.height, 0, 0]);
        assert.deepEqual(env.state, original); assert.equal(env.stack.length, 0);
        logs.push(env.commands.filter(c => ['arc', 'bezierCurveTo', 'lineTo', 'moveTo', 'fillRect', 'fillText'].includes(c.name)).map(c => [c.name, c.args]));
    }
    for (const log of logs.slice(1)) assert.deepEqual(log, logs[0]);
});

test('graph Canvas: context styles, text spacing, dash, compositing and transform are neutralized/restored', () => {
    const f = graphFrames(), env = recording(), original = structuredClone(env.state);
    renderer().render(env.ctx, f.endpoint(f.done), size);
    assert.deepEqual(env.state, original); assert.equal(env.stack.length, 0);
    const state = env.calls('fillRect')[0].state;
    assert.equal(state.globalAlpha, 1); assert.equal(state.globalCompositeOperation, 'source-over'); assert.equal(state.filter, 'none');
    assert.equal(state.shadowBlur, 0); assert.deepEqual(state.dash, []); assert.equal(state.lineDashOffset, 0); assert.equal(state.letterSpacing, '0px');
    assert.equal(state.direction, 'ltr'); assert.equal(state.fontKerning, 'none');
});

test('graph Canvas: invalid input/progress/snapshots/derived geometry fail before Canvas, including zero-size calls', () => {
    const f = graphFrames(), valid = f.endpoint(f.done), bad = { ...valid.current, nodeMarks: [{ id: 'missing', role: 'x' }] };
    const cases = [
        [valid, null, TypeError], [valid, { width: '640', height: 400 }, TypeError], [valid, { width: -1, height: 400 }, RangeError],
        [valid, { width: Infinity, height: 400 }, RangeError], [{ ...valid, progress: '1' }, size, TypeError],
        [{ ...valid, progress: NaN }, size, RangeError], [{ ...valid, progress: -1 }, size, RangeError], [{ ...valid, progress: 1.01 }, size, RangeError],
        [{ ...valid, previous: bad }, size, RangeError], [{ ...valid, current: bad }, { width: 0, height: 0 }, RangeError],
    ];
    const extremes = createGraphTrace({ nodes: [{ id: 'a' }, { id: 'b' }], edges: [] },
        { layout: [{ nodeId: 'a', x: -Number.MAX_VALUE, y: 0 }, { nodeId: 'b', x: Number.MAX_VALUE, y: 0 }] });
    cases.push([frame(extremes.state), size, RangeError]);
    for (const [value, dimensions, Type] of cases) {
        const env = recording(); assert.throws(() => renderer().render(env.ctx, value, dimensions), Type); assert.deepEqual(env.commands, []);
    }
    const poisoned = accessor('previous', { progress: NaN });
    assert.throws(() => renderer().render(recording().ctx, poisoned, size), RangeError);
    const previousBad = accessor('current', { previous: bad, progress: 1 });
    assert.throws(() => renderer().render(recording().ctx, previousBad, size), RangeError);
});

test('graph Canvas: empty/singleton/coincident/tiny views and zero dimensions do not create nonfinite commands', () => {
    for (const state of [createGraphTrace({ nodes: [], edges: [] }).state,
        createGraphTrace({ nodes: [{ id: 'a' }], edges: [{ id: 'loop', from: 'a', to: 'a', directed: true }] }).state,
        createGraphTrace({ nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ id: 'e', from: 'a', to: 'b', directed: true }] },
            { layout: [{ nodeId: 'a', x: 0, y: 0 }, { nodeId: 'b', x: 0, y: 0 }] }).state]) {
        for (const logical of [size, { width: 1, height: 1 }]) {
            const env = draw(frame(state), renderer(), 640, 400, logical);
            for (const command of env.commands) for (const arg of command.args.flat()) if (typeof arg === 'number') assert.ok(Number.isFinite(arg));
        }
    }
    const f = graphFrames();
    for (const [w, h, logical] of [[0, 400, size], [640, 0, size], [640, 400, { width: 0, height: 400 }]]) assert.equal(draw(f.endpoint(f.done), renderer(), w, h, logical).commands.length, 0);
});

test('graph Canvas: draw/restore throws preserve primary including undefined, release guard and leave later calls usable', () => {
    const f = graphFrames(), valid = f.endpoint(f.done);
    for (const primary of [undefined, null, 0, 'canvas', {}]) {
        const r = renderer(), env = recording(), old = structuredClone(env.state);
        const ctx = new Proxy(env.ctx, { get(target, key) { if (key === 'stroke') return () => { throw primary; }; return target[key]; } });
        let caught = false; try { r.render(ctx, valid, size); } catch (error) { caught = true; assert.equal(error, primary); }
        assert.ok(caught); assert.equal(env.stack.length, 0); assert.deepEqual(env.state, old);
        assert.ok(draw(valid, r).calls('arc').length);
        const both = new Proxy(env.ctx, { get(target, key) { if (key === 'stroke') return () => { throw primary; };
            if (key === 'restore') return () => { target.restore(); throw 'cleanup'; }; return target[key]; } });
        caught = false; try { r.render(both, valid, size); } catch (error) { caught = true; assert.equal(error, primary); } assert.ok(caught);
    }
    const r = renderer(), env = recording(), primary = {};
    const restore = new Proxy(env.ctx, { get(target, key) { return key === 'restore' ? () => { target.restore(); throw primary; } : target[key]; } });
    assert.throws(() => r.render(restore, valid, size), error => error === primary); assert.ok(draw(valid, r).calls('arc').length);
});

test('graph Canvas: same-renderer recursion is rejected before validation, other instances are independent', () => {
    const f = graphFrames(), r = renderer(), other = renderer({ theme: 'dark' }), env = recording(), nested = recording();
    const expected = draw(f.endpoint(f.done), renderer()); let called = false;
    const ctx = new Proxy(env.ctx, { get(target, key) {
        if (key !== 'fillRect') return target[key]; return (...args) => {
            if (!called) { called = true; assert.throws(() => r.render(nested.ctx, null, null), error => error.constructor === Error);
                other.render(nested.ctx, f.endpoint(f.start), size); }
            target.fillRect(...args);
        };
    } });
    r.render(ctx, f.endpoint(f.done), size); assert.ok(called); assert.deepEqual(env.commands, expected.commands);
    assert.equal(env.stack.length, 0); assert.equal(nested.stack.length, 0);
});

test('graph Canvas: failed projection/geometry cannot poison the retained pair; cache holds at most two endpoints', () => {
    const f = graphFrames(), r = renderer(), counts = new Map();
    function watched(state) { const proxy = new Proxy(state, { getOwnPropertyDescriptor(target, key) { counts.set(proxy, (counts.get(proxy) ?? 0) + 1); return Reflect.getOwnPropertyDescriptor(target, key); } }); return proxy; }
    const a = watched(f.start.state), b = watched(f.marked.state), c = watched(f.done.state);
    const render = (previous, current) => r.render(recording().ctx, { previous, current, progress: 1 }, size);
    render(a, b); const saved = [counts.get(a), counts.get(b)];
    assert.throws(() => render(c, { ...f.done.state, result: { nodeIds: ['missing'], edgeIds: [] } }), RangeError);
    render(a, b); assert.deepEqual([counts.get(a), counts.get(b)], saved);
    render(b, c); const before = counts.get(a); render(a, b); assert.ok(counts.get(a) > before);
    const replay = draw(f.endpoint(f.done), r), clean = draw(f.endpoint(f.done)); assert.deepEqual(replay.commands, clean.commands);
});
