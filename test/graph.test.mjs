import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGraphTrace, graphScene } from '@grundyjs/algiviz/graph';
import { createTimeline, createPlayer, createRewindBuffer, createAsyncSource } from '@grundyjs/algiviz/playback';
import { createSceneProjector, createSceneFrame, createSceneRenderer } from '@grundyjs/algiviz/scene';
import { Player } from '@grundyjs/algiviz/player';
import { dom } from './player-test-dom.mjs';

const input = () => ({ nodes: [{ id: 'A' }, { id: 'B', label: '' }, { id: '__proto__' }], edges: [
    { id: 'A', from: 'A', to: 'B', directed: true, weight: -1 },
    { id: 'back', from: 'B', to: 'A', directed: true, weight: 0 },
    { id: 'parallel', from: 'A', to: 'B' },
    { id: 'loop', from: 'A', to: 'A' }, { id: 'loop2', from: 'A', to: 'A', directed: true },
] });
const positions = () => [{ nodeId: 'A', x: -1, y: 0 }, { nodeId: 'B', x: 1, y: 2 }, { nodeId: '__proto__', x: 2, y: 2 }];
const trace = () => createGraphTrace(input(), { layout: positions() });
const project = state => graphScene(state, { namespace: 'main' });
const endpoint = (state, event = undefined) => ({ previous: state, current: state, event, stepIndex: 0, progress: 1 });
const errorIs = Type => error => error.constructor === Type;
function accessor(key, base = {}) { return Object.defineProperty(base, key, { get() { assert.fail('Getter invoked: ' + key); }, enumerable: true }); }
const badArray = () => [null, {}, 'A', new Set(['A']), new Uint8Array([1]), new Array(1), accessor('0', [1]),
    Object.setPrototypeOf(new Array(1), Object.assign(Object.create(Array.prototype), { 0: 1 }))];
function assertOwned(value) {
    assert.ok(Object.isFrozen(value));
    if (value && typeof value === 'object') for (const key of Object.keys(value)) {
        if (key !== 'data' && value[key] !== null && typeof value[key] === 'object') assertOwned(value[key]);
    }
}

test('graph: captures topology/layout now, owns structural output but not opaque payload', () => {
    const payload = { value: 1 }, graph = input(), layout = positions();
    graph.nodes[0].data = payload; graph.edges[0].data = payload;
    Object.defineProperty(graph.nodes[0], 'ignored', { get() { assert.fail('Unknown field inspected'); } });
    const t = createGraphTrace(graph, { layout }), initial = t.state;
    graph.nodes[0].id = 'changed'; graph.edges[0].from = 'changed'; graph.nodes.push({ id: 'new' }); layout[0].x = 100;
    assert.equal(initial.graph.nodes[0].id, 'A'); assert.equal(initial.graph.edges[0].from, 'A');
    assert.equal(initial.graph.nodes.length, 3); assert.equal(initial.layout[0].x, -1);
    assert.equal(initial.graph.nodes[0].data, payload); assert.equal(initial.graph.edges[0].data, payload);
    assert.equal(Object.isFrozen(payload), false); assert.equal(Object.hasOwn(initial.graph.nodes[0], 'ignored'), false);
    assert.equal(initial.graph.nodes[1].label, ''); assert.equal(Object.hasOwn(initial.graph.edges[2], 'directed'), false);
    const start = t.start(); assert.equal(start.state, initial); assertOwned(start); assert.ok(Object.isFrozen(t));
    const next = t.mark({ nodes: [{ id: 'A', role: 'active' }] }); assert.equal(next.state.graph, initial.graph);
    assert.deepEqual(initial.nodeMarks, []); assert.deepEqual(next.state.nodeMarks, [{ id: 'A', role: 'active' }]);
});

test('graph: empty/singleton/default circle, negative positions and supplied layout normalization', () => {
    const empty = createGraphTrace({ nodes: [], edges: [] });
    assert.deepEqual(empty.state.layout, []); assert.equal(empty.start().index, 0);
    assert.equal(empty.mark({}).index, 1); assert.equal(empty.setLayout([]).index, 2);
    assert.deepEqual(empty.done({ result: {} }).state.result, { nodeIds: [], edgeIds: [] });
    assert.deepEqual(project(empty.state).objects, []);
    const single = createGraphTrace({ nodes: [{ id: 'only' }], edges: [] });
    assert.deepEqual(single.state.layout, [{ nodeId: 'only', x: .5, y: .5 }]);
    const t = createGraphTrace(input());
    t.state.layout.forEach((p, i) => {
        const angle = -Math.PI / 2 + 2 * Math.PI * i / 3;
        assert.equal(p.x, .5 + .4 * Math.cos(angle)); assert.equal(p.y, .5 + .4 * Math.sin(angle));
    });
    const normalized = createGraphTrace(input(), { layout: positions().reverse() });
    assert.deepEqual(normalized.state.layout, positions());
    const nullPrototype = Object.assign(Object.create(null), { nodes: [Object.assign(Object.create(null), { id: 'A' })], edges: [] });
    assert.equal(createGraphTrace(nullPrototype).state.graph.nodes[0].id, 'A');
});

test('graph: marks patch atomically in supplied event order, snapshot order is topology, null clears', () => {
    const t = trace(); t.start();
    const nodes = [{ id: 'B', role: 'app:frontier' }, { id: 'A', role: 'visited' }];
    const marked = t.mark({ nodes, edges: [{ id: 'A', role: 'result' }] });
    assert.deepEqual(marked.event, { type: 'mark', nodes, edges: [{ id: 'A', role: 'result' }], nodeCaptions: [] });
    assert.deepEqual(marked.state.nodeMarks, [nodes[1], nodes[0]]); assert.equal(marked.state.result, null);
    nodes[0].role = 'changed'; nodes.push({ id: '__proto__', role: 'active' });
    assert.equal(marked.event.nodes[0].role, 'app:frontier'); assert.equal(marked.state.nodeMarks.length, 2); assertOwned(marked);
    const clear = t.mark({ nodes: [{ id: 'A', role: null }] });
    assert.deepEqual(clear.state.nodeMarks, [{ id: 'B', role: 'app:frontier' }]); assert.deepEqual(clear.state.edgeMarks, marked.state.edgeMarks);
    const noop = t.mark({ nodes: [], edges: undefined }); assert.equal(noop.index, clear.index + 1);
    assert.deepEqual(noop.event, { type: 'mark', nodes: [], edges: [], nodeCaptions: [] }); assert.deepEqual(noop.state, clear.state);
    const moved = t.setLayout(positions().map(p => ({ ...p, x: p.x + 5 })));
    assert.deepEqual(moved.event, { type: 'layout' }); assert.deepEqual(moved.state.nodeMarks, clear.state.nodeMarks);
    assert.equal(marked.state.layout[0].x, -1); assert.equal(moved.state.layout[0].x, 4);
});

test('graph: done preserves marks and owns independent result selections, no path inference', () => {
    const t = trace(); t.start(); const old = t.mark({ nodes: [{ id: 'A', role: 'active' }], edges: [{ id: 'loop', role: 'visited' }] });
    const nodeIds = ['B', 'A', 'B'], edgeIds = ['loop2', 'loop', 'loop2'];
    const done = t.done({ result: { nodeIds, edgeIds } });
    assert.deepEqual(done.event, { type: 'done' }); assert.equal(done.state, t.state); assert.equal(old.state.result, null);
    assert.deepEqual(done.state.result, { nodeIds: ['B', 'A'], edgeIds: ['loop2', 'loop'] });
    assert.deepEqual(done.state.nodeMarks, old.state.nodeMarks); assert.deepEqual(done.state.edgeMarks, old.state.edgeMarks);
    nodeIds.fill('__proto__'); edgeIds.length = 0; assert.deepEqual(done.state.result.nodeIds, ['B', 'A']); assertOwned(done);
    const scene = project(done.state), a = scene.objects.find(o => o.type === 'graphNode' && o.data.node.id === 'A');
    assert.equal(a.data.result, true); assert.equal(a.data.role, 'active');
    assert.equal(scene.objects.find(o => o.type === 'graphNode' && o.data.node.id === '__proto__').data.result, false);
    for (const options of [undefined, {}, { result: undefined }, { result: {} }, { result: { nodeIds: undefined } }]) {
        const t = trace(); t.start(); const result = t.done(options).state.result;
        assert.deepEqual(result, options?.result === undefined ? null : { nodeIds: [], edgeIds: [] });
    }
    const edgeOnly = trace(); edgeOnly.start(); assert.deepEqual(edgeOnly.done({ result: { edgeIds: ['A'] } }).state.result, { nodeIds: [], edgeIds: ['A'] });
});

test('graph: lifecycle checks precede any argument inspection; done is terminal and state remains readable', () => {
    const t = trace(), poison = new Proxy({}, { getPrototypeOf() { assert.fail('Inspected after lifecycle failure'); } });
    for (const [method, value] of [['mark', poison], ['setLayout', poison], ['done', poison]]) assert.throws(() => t[method](value), errorIs(Error));
    assert.equal(t.start().index, 0); assert.throws(() => t.start(), errorIs(Error));
    assert.equal(t.mark({}).index, 1); assert.equal(t.done().index, 2); const old = t.state;
    for (const [method, value] of [['start', undefined], ['mark', poison], ['setLayout', poison], ['done', poison]]) assert.throws(() => t[method](value), errorIs(Error));
    assert.equal(t.state, old);
});

test('graph: malformed constructor envelopes, records, arrays and scalars fail without coercion/getters', () => {
    const disguisedArray = Object.assign(Object.setPrototypeOf([], Object.prototype), { nodes: [], edges: [] });
    assert.throws(() => createGraphTrace(disguisedArray), errorIs(TypeError));
    const disguisedNode = Object.assign(Object.setPrototypeOf([], Object.prototype), { id: 'A' });
    assert.throws(() => createGraphTrace({ nodes: [disguisedNode], edges: [] }), errorIs(TypeError));
    for (const value of [null, undefined, [], new Map(), new Date(), 1, 'graph', {}, accessor('nodes', { edges: [] })]) assert.throws(() => createGraphTrace(value), errorIs(TypeError));
    for (const nodes of badArray()) assert.throws(() => createGraphTrace({ nodes, edges: [] }), errorIs(TypeError));
    for (const edges of badArray()) assert.throws(() => createGraphTrace({ nodes: [], edges }), errorIs(TypeError));
    for (const node of [null, {}, [], new Date(), { id: '' }, { id: 1 }, { id: new String('A') }, { id: 'A', label: null }, accessor('id'), accessor('data', { id: 'A' })]) {
        assert.throws(() => createGraphTrace({ nodes: [node], edges: [] }), errorIs(TypeError));
    }
    for (const [key, value, Type] of [['id', '', TypeError], ['from', false, TypeError], ['to', {}, TypeError], ['directed', 1, TypeError],
        ['label', false, TypeError], ['weight', '1', TypeError], ['weight', NaN, RangeError], ['weight', Infinity, RangeError], ['from', 'missing', RangeError]]) {
        const graph = input(); graph.edges[0][key] = value; assert.throws(() => createGraphTrace(graph), errorIs(Type));
    }
    const duplicateNode = input(); duplicateNode.nodes.push({ id: 'A' }); assert.throws(() => createGraphTrace(duplicateNode), errorIs(RangeError));
    const duplicateEdge = input(); duplicateEdge.edges.push({ ...duplicateEdge.edges[0] }); assert.throws(() => createGraphTrace(duplicateEdge), errorIs(RangeError));
    const inheritedRequired = Object.assign(Object.create(null), { edges: [] }); assert.throws(() => createGraphTrace(inheritedRequired), errorIs(TypeError));
    for (const options of [null, [], accessor('layout')]) assert.throws(() => createGraphTrace(input(), options), errorIs(TypeError));
    const data = accessor('anything'); assert.equal(createGraphTrace({ nodes: [{ id: 'A', data }], edges: [] }).state.graph.nodes[0].data, data);
});

test('graph: every malformed update is atomic, permits retry and preserves index', () => {
    const cases = [];
    cases.push(['mark', Object.setPrototypeOf([], Object.prototype), TypeError]);
    cases.push(['done', Object.setPrototypeOf([], Object.prototype), TypeError]);
    for (const value of [null, [], accessor('nodes')]) cases.push(['mark', value, TypeError]);
    for (const value of badArray()) cases.push(['mark', { nodes: value }, TypeError], ['done', { result: { nodeIds: value } }, TypeError], ['setLayout', value, TypeError]);
    for (const [patch, Type] of [[{ id: 'A', role: undefined }, TypeError], [{ id: 'A', role: '' }, TypeError],
        [{ id: 'missing', role: 'x' }, RangeError], [accessor('role', { id: 'A' }), TypeError]]) cases.push(['mark', { nodes: [patch] }, Type]);
    cases.push(['mark', { nodes: [{ id: 'A', role: 'x' }, { id: 'A', role: null }] }, RangeError]);
    cases.push(['mark', { nodes: [{ id: 'B', role: 'changed' }], edges: [{ id: 'missing', role: 'x' }] }, RangeError]);
    for (const value of [null, [], accessor('result'), { result: null }, { result: accessor('nodeIds') }]) cases.push(['done', value, TypeError]);
    cases.push(['done', { result: { nodeIds: ['B'], edgeIds: ['missing'] } }, RangeError], ['done', { result: { nodeIds: [0] } }, TypeError]);
    cases.push(['setLayout', [], RangeError], ['setLayout', [...positions(), positions()[0]], RangeError]);
    for (const [key, value, Type] of [['x', '1', TypeError], ['x', NaN, RangeError], ['y', Infinity, RangeError], ['nodeId', 'missing', RangeError]]) {
        const layout = positions(); layout[1][key] = value; cases.push(['setLayout', layout, Type]);
    }
    for (const [method, value, Type] of cases) {
        const t = trace(); t.start(); const old = t.mark({ nodes: [{ id: 'A', role: 'visited' }] }).state;
        assert.throws(() => t[method](value), errorIs(Type), method); assert.equal(t.state, old, method);
        const retry = t.mark({}); assert.equal(retry.index, 2); assert.deepEqual(retry.state, old);
        assert.equal(t.done({ result: { nodeIds: ['A'] } }).index, 3);
    }
});

test('graph: validation precedence is envelope/array shape, records then nodes before edges and layout/result', () => {
    assert.throws(() => createGraphTrace({ nodes: [{ id: '' }], edges: 'invalid' }, null), errorIs(TypeError));
    const denseFirst = [{ id: '' }, ,]; assert.throws(() => createGraphTrace({ nodes: denseFirst, edges: [] }), /own data elements/);
    assert.throws(() => createGraphTrace({ nodes: [{ id: 'A' }, { id: 'A' }], edges: null }), errorIs(RangeError));
    const graph = input(); graph.edges[0].from = 'missing'; graph.edges[0].weight = Infinity;
    assert.throws(() => createGraphTrace(graph, null), /finite/);
    graph.edges[0].weight = -1; assert.throws(() => createGraphTrace(graph, null), /Unknown/);
    const t = trace(); t.start();
    assert.throws(() => t.mark({ nodes: [{ id: 'missing', role: '' }], edges: null }), errorIs(TypeError));
    assert.throws(() => t.mark({ nodes: [{ id: 'missing', role: 'x' }], edges: null }), errorIs(RangeError));
    assert.throws(() => t.done({ result: { nodeIds: ['missing'], edgeIds: null } }), errorIs(RangeError));
    const bad = positions(); bad[1] = { nodeId: 'missing', x: Infinity, y: 0 }; assert.throws(() => t.setLayout(bad), /finite/);
    assert.throws(() => graphScene({ ...t.state, graph: null }, { namespace: '' }), errorIs(TypeError));
});

test('graph: proxy throws retain identity, busy guard protects mutations but permits committed reads and other traces', () => {
    for (const primary of [undefined, null, 0, 'failure', {}]) {
        const t = trace(); t.start(); const old = t.state;
        const poison = new Proxy({}, { getPrototypeOf() { throw primary; } });
        let caught = false; try { t.mark(poison); } catch (error) { caught = true; assert.equal(error, primary); }
        assert.ok(caught); assert.equal(t.state, old); assert.equal(t.mark({}).index, 1);
        assert.throws(() => createGraphTrace(poison), error => error === primary);
        assert.throws(() => graphScene(old, poison), error => error === primary);
    }
    for (const stage of ['mark', 'setLayout', 'done']) {
        const t = trace(), other = trace(); t.start(); other.start(); const old = t.state;
        let called = false;
        const guard = () => {
            if (called) return; called = true; assert.equal(t.state, old);
            for (const action of ['start', 'mark', 'setLayout', 'done']) assert.throws(() => t[action](null), errorIs(Error));
            assert.equal(other.mark({}).index, 1);
        };
        const value = stage === 'setLayout' ? new Proxy(positions(), { getOwnPropertyDescriptor(target, key) { guard(); return Reflect.getOwnPropertyDescriptor(target, key); } })
            : new Proxy(stage === 'done' ? { result: {} } : {}, { getPrototypeOf(target) { guard(); return Reflect.getPrototypeOf(target); } });
        assert.equal(t[stage](value).index, 1); assert.ok(called); assert.equal(t.state.result === null, stage !== 'done');
    }
    const t = trace(); t.start();
    assert.throws(() => t.mark(new Proxy({}, { getPrototypeOf() { t.done(); return Object.prototype; } })), errorIs(Error));
    assert.equal(t.done().index, 1);
});

test('graph: projection separates domains/namespaces, preserves refs and stable identity across marks/layout', () => {
    const t = trace(), before = t.start().state, scene = project(before);
    assert.equal(new Set(scene.objects.map(o => o.id)).size, 8); assertOwned(scene);
    const edge = scene.objects.find(o => o.type === 'graphEdge' && o.data.edge.id === 'A');
    const a = scene.objects.find(o => o.type === 'graphNode' && o.data.node.id === 'A');
    assert.notEqual(a.id, edge.id); assert.equal(edge.data.from, a.id); assert.equal(edge.data.edge, before.graph.edges[0]);
    assert.equal(a.data.node, before.graph.nodes[0]); assert.equal(a.data.position, before.layout[0]);
    assert.deepEqual(scene.objects.map(o => o.zIndex), [0, 0, 0, 0, 0, 1, 1, 1]);
    t.mark({ nodes: [{ id: 'A', role: 'x' }] }); t.setLayout(positions().map(p => ({ ...p, x: p.x + 1 })));
    const after = project(t.done({ result: { edgeIds: ['A'] } }).state);
    assert.deepEqual(after.objects.map(o => o.id), scene.objects.map(o => o.id));
    const other = graphScene(before, { namespace: 'other' }); assert.equal(new Set([...scene.objects, ...other.objects].map(o => o.id)).size, 16);
    const hostile = createGraphTrace({ nodes: ['a:b', 'a', 'b:c', '"[]', '__proto__', ' x ', 'é', 'é'].map(id => ({ id })), edges: [{ id: 'a:b', from: 'a:b', to: 'a' }] });
    const s = graphScene(hostile.state, { namespace: '"[]:node' }); assert.equal(new Set(s.objects.map(o => o.id)).size, 9);
});

test('graph: routing groups loops and antiparallel edges in input order independent of view state', () => {
    const t = trace(); t.start();
    const routes = project(t.state).objects.filter(o => o.type === 'graphEdge').map(o => [o.data.routeIndex, o.data.routeCount]);
    assert.deepEqual(routes, [[0, 3], [1, 3], [2, 3], [0, 2], [1, 2]]);
    t.mark({ edges: [{ id: 'parallel', role: 'active' }] }); t.setLayout(positions().reverse());
    assert.deepEqual(project(t.state).objects.filter(o => o.type === 'graphEdge').map(o => [o.data.routeIndex, o.data.routeCount]), routes);
});

test('graph: graphScene validates external snapshots, exact order and required normalized fields', () => {
    const state = structuredClone(trace().state); assert.equal(Object.isFrozen(state), false);
    assert.equal(project(state).objects.length, 8); assert.equal(Object.isFrozen(state), false);
    const cases = [
        [null, TypeError], [accessor('graph'), TypeError], [{ ...state, graph: null }, TypeError],
        [{ ...state, layout: state.layout.toReversed() }, RangeError], [{ ...state, layout: [] }, RangeError],
        [{ ...state, nodeMarks: [{ id: 'A', role: null }] }, TypeError],
        [{ ...state, nodeMarks: [{ id: 'B', role: 'x' }, { id: 'A', role: 'y' }] }, RangeError],
        [{ ...state, nodeMarks: [{ id: 'A', role: 'x' }, { id: 'A', role: 'x' }] }, RangeError],
        [{ ...state, edgeMarks: [{ id: 'missing', role: 'x' }] }, RangeError],
        [{ ...state, result: undefined }, TypeError], [{ ...state, result: {} }, TypeError],
        [{ ...state, result: { nodeIds: ['A', 'A'], edgeIds: [] } }, RangeError],
        [{ ...state, result: { nodeIds: [], edgeIds: ['missing'] } }, RangeError],
    ];
    for (const [value, Type] of cases) { assert.throws(() => project(value), errorIs(Type)); assert.equal(project(state).objects.length, 8); }
    for (const options of [undefined, {}, null, [], { namespace: '' }, { namespace: 1 }, accessor('namespace')]) assert.throws(() => graphScene(state, options), errorIs(TypeError));
});

test('graph: generic scene transitions resolve both node endpoints and exits, without Event', () => {
    const t = trace(), old = t.start().state;
    const moved = t.setLayout(positions().map(p => ({ ...p, x: p.x + 10 }))).state;
    const projector = createSceneProjector(project), frame = projector({ previous: old, current: moved, progress: .25, stepIndex: 1, event: undefined });
    assert.equal(frame.previous, projector({ ...endpoint(old), current: moved }).previous);
    const seen = [], renderer = createSceneRenderer({
        graphNode(_context, object) { const a = object.previous.data.position.x, b = object.current.data.position.x; seen.push(a + (b - a) * object.progress); },
        graphEdge(_context, object, scene) { const a = scene.get(object.current.data.from), b = scene.get(object.current.data.to); assert.equal(a.current.type, 'graphNode'); assert.equal(b.current.type, 'graphNode'); assert.equal(a.current.data.position.x - a.previous.data.position.x, 10); }
    });
    renderer.render(null, frame); assert.deepEqual(seen, [1.5, 3.5, 4.5]);
    const empty = project(createGraphTrace({ nodes: [], edges: [] }).state);
    const exits = createSceneFrame({ previous: frame.previous, current: empty, progress: 1, stepIndex: 2, event: undefined });
    const edge = exits.objects.find(o => o.previous.type === 'graphEdge'); assert.equal(exits.get(edge.previous.data.from).presence, 0);
});

function* steps(observe = () => {}) {
    const t = trace(); observe('trace', t);
    try {
        observe('read'); yield t.start();
        observe('read'); yield t.mark({ nodes: [{ id: 'A', role: 'active' }] });
        observe('read'); yield t.setLayout(positions().map(p => ({ ...p, y: p.y + 1 })));
        observe('read'); yield t.done({ result: { nodeIds: ['B'], edgeIds: ['A'] } });
        assert.fail('Player read beyond terminal step');
    } finally { observe('close'); }
}

test('graph: headless steps/timeline and bounded rewind retain immutable answers without rerunning operations', () => {
    // Materializing a generator is separate from a terminal-aware player.
    const t = trace(), recorded = [t.start(), t.mark({ nodes: [{ id: 'A', role: 'active' }] }), t.done({ result: { nodeIds: ['A'] } })];
    const timeline = createTimeline(recorded, { stepDurationMs: 100, finalHoldMs: 25 });
    assert.equal(timeline.sample(225).current.result.nodeIds[0], 'A'); assert.equal(timeline.sample(0).current.result, null);
    assert.deepEqual(timeline.sample(225).current.result, { nodeIds: ['A'], edgeIds: [] });
    const window = createRewindBuffer(recorded, { capacity: 2 });
    window.next(); window.next(); const final = window.next(); assert.equal(final, recorded[2]); assert.equal(window.previous(), recorded[1]);
    assert.equal(window.canPrevious, false); assert.equal(window.next(), final); window.dispose();
    const calls = { read: 0, close: 0 }; const p = createPlayer(steps(kind => { if (kind in calls) calls[kind]++; }), { isTerminal: step => step.event.type === 'done' });
    p.nextStep(); p.nextStep(); p.nextStep(); assert.equal(p.finished, true); assert.deepEqual(calls, { read: 4, close: 1 });
    p.advance(0); assert.equal(p.frame.current.result.nodeIds[0], 'B'); p.dispose(); p.dispose(); assert.equal(calls.close, 1);
});

test('graph: Player Next/Previous, bounded replay, Restart and idempotent dispose isolate each trace', async () => {
    for (const capacity of [2, 4]) {
        const env = dom(), host = env.container(), calls = { read: 0, close: 0 }, traces = [], renders = [];
        const p = new Player(host, { stepSource: () => steps((kind, value) => { if (kind === 'trace') traces.push(value); else calls[kind]++; }),
            isTerminal: step => step.event.type === 'done', rewindCapacity: capacity, render(frame) { renders.push(project(frame.current)); } });
        assert.equal(traces.length, 0); p.start(); const initial = p.frame.current;
        p.next(); p.next(); assert.equal(p.next().phase, 'finished'); const final = p.frame.current;
        assert.deepEqual(calls, { read: 4, close: 1 }); assert.deepEqual(final.result, { nodeIds: ['B'], edgeIds: ['A'] });
        p.previous(); assert.equal(p.frame.current.result, null); p.next(); assert.equal(p.frame.current, final);
        assert.deepEqual(calls, { read: 4, close: 1 });
        for (let i = 0; i < 5; i++) p.previous(); assert.equal(p.status.rewindStartIndex, 4 - capacity); assert.equal(p.status.canPrevious, false);
        p.restart(); assert.equal(traces.length, 2); assert.notEqual(p.frame.current, initial); assert.deepEqual(p.frame.current, initial);
        assert.equal(p.frame.current.result, null); assert.deepEqual(p.frame.current.nodeMarks, []);
        assert.deepEqual([p.status.rewindStartIndex, p.status.rewindEndIndex], [0, 0]);
        assert.deepEqual(final.result, { nodeIds: ['B'], edgeIds: ['A'] });
        p.dispose(); p.dispose(); assert.deepEqual(await p.closed, { sources: [], errorCount: 0, firstError: null });
        assert.equal(calls.close, 2); assert.equal(env.scheduler.size, 0); assert.equal(host.children.length, 0); assert.ok(renders.length > 5);
    }
});

test('graph: timed Player Pause/Next and Restart in-flight preserve snapshots and close old source', async () => {
    const env = dom(), calls = { read: 0, close: 0 };
    const p = new Player(env.container(), { stepSource: () => steps(kind => { if (kind in calls) calls[kind]++; }), isTerminal: s => s.event.type === 'done',
        stepDurationMs: 100, finalHoldMs: 50, rewindCapacity: 4, render() {} });
    p.start(); p.play(); env.scheduler.tick(0); env.scheduler.tick(25); assert.equal(p.frame.progress, .25);
    const old = p.frame; p.pause(); env.scheduler.tick(200); assert.equal(p.frame, old);
    p.next(); assert.equal(p.frame.progress, 1); assert.equal(calls.read, 2);
    p.restart(); assert.deepEqual(calls, { read: 3, close: 1 }); assert.equal(p.frame.stepIndex, 0); assert.equal(p.frame.current.result, null);
    p.next(); p.next(); p.next(); assert.equal(p.frame.current.result.nodeIds[0], 'B');
    assert.equal(p.status.phase, 'paused'); p.next(); assert.equal(p.status.phase, 'finished');
    p.dispose(); await p.closed; assert.equal(calls.close, 2); assert.equal(env.scheduler.size, 0);
});

test('graph: async state-only delivery renders with undefined event and keeps normal source cleanup', async () => {
    const t = trace(); t.start(); const state = t.done({ result: { nodeIds: ['A'] } }).state;
    let cleaned = 0;
    const source = createAsyncSource(async function* () { try { yield structuredClone(state); } finally { cleaned++; } });
    const read = await source.next(); assert.equal(read.kind, 'value');
    const projected = createSceneProjector(project)(endpoint(read.value));
    assert.equal(projected.event, undefined); assert.equal(projected.current.objects.find(o => o.type === 'graphNode' && o.data.result).data.node.id, 'A');
    source.dispose(); await source.closed; assert.equal(cleaned, 1);
});
