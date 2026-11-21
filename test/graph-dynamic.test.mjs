import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDynamicGraphTrace, createGraphTrace, graphScene } from '@grundyjs/algiviz/graph';
import { createSceneFrame, createSceneProjector } from '@grundyjs/algiviz/scene';
import { Player } from '@grundyjs/algiviz/player';
import { dom } from './player-test-dom.mjs';

const nodes = (...ids) => ids.map(id => ({ id }));
const edge = (id, from, to) => ({ id, from, to, directed: true });
const layout = (...ids) => ids.map((nodeId, x) => ({ nodeId, x, y: 0 }));
const input = () => ({ nodes: nodes('A', 'B'), edges: [edge('B', 'B', 'A'), edge('e', 'A', 'B')] });
const replaceB = () => ({
    nodes: nodes('C', 'A'), edges: [edge('e', 'A', 'C'), edge('q', 'C', 'A')], layout: layout('A', 'C'),
});
const project = state => graphScene(state, { namespace: 'dynamic' });

test('dynamic graph: one edit replaces topology, prunes annotations and captures its inputs', () => {
    const graph = input(), trace = createDynamicGraphTrace(graph, {
        layout: layout('A', 'B'),
        nodeCaptions: [{ id: 'B', text: 'removed' }, { id: 'A', text: 'kept' }],
    });
    const initial = trace.state;
    assert.ok(Object.isFrozen(trace));
    assert.equal(trace.start().state, initial);
    const marked = trace.mark({
        nodes: [{ id: 'B', role: 'visited' }, { id: 'A', role: 'active' }],
        edges: [{ id: 'B', role: 'visited' }, { id: 'e', role: 'kept' }],
    });
    const payload = { source: 'app' };
    const next = replaceB();
    next.edges[0].data = payload;
    next.marks = { nodes: [{ id: 'C', role: 'queued' }], nodeCaptions: [{ id: 'C', text: 'new' }] };
    const edit = trace.edit(next), state = edit.state;
    assert.equal(edit.index, marked.index + 1);
    assert.equal(state, trace.state);
    assert.deepEqual(edit.event, { type: 'edit' });
    assert.deepEqual(state.graph.nodes.map(node => node.id), ['C', 'A']);
    assert.deepEqual(state.layout.map(position => position.nodeId), ['C', 'A']);
    assert.deepEqual(state.nodeMarks, [{ id: 'C', role: 'queued' }, { id: 'A', role: 'active' }]);
    assert.deepEqual(state.edgeMarks, [{ id: 'e', role: 'kept' }]);
    assert.deepEqual(state.nodeCaptions, [{ id: 'C', text: 'new' }, { id: 'A', text: 'kept' }]);
    assert.equal(state.result, null);
    assert.equal(state.graph.edges[0].data, payload);
    assert.equal(Object.isFrozen(payload), false);
    assert.ok([edit, edit.event, state, state.graph, state.graph.edges, state.graph.edges[0],
        state.layout, state.layout[0], state.nodeMarks, state.nodeCaptions[0]].every(Object.isFrozen));

    next.edges[0].to = 'A';
    next.nodes.pop();
    next.layout[0].x = 20;
    next.marks.nodes[0].role = 'changed';
    assert.equal(state.graph.edges[0].to, 'C');
    assert.equal(state.graph.nodes.length, 2);
    assert.equal(state.layout[1].x, 0);
    assert.equal(state.nodeMarks[0].role, 'queued');
    assert.equal(marked.state.graph.edges[1].to, 'B');
    assert.equal(marked.state.nodeCaptions[1].text, 'removed');
    assert.deepEqual(initial.graph, graph);

    assert.throws(() => trace.mark({ edges: [{ id: 'B', role: 'active' }] }), RangeError);
    assert.throws(() => trace.done({ result: { nodeIds: ['B'] } }), RangeError);
    const moved = trace.setLayout(layout('A', 'C'));
    assert.equal(moved.index, edit.index + 1);
    const done = trace.done({ result: { edgeIds: ['e', 'e'] } });
    assert.deepEqual(done.state.result, { nodeIds: [], edgeIds: ['e'] });
    assert.deepEqual(done.state.edgeMarks, state.edgeMarks);
});

test('dynamic graph: retired IDs are per domain and omissions preserve values', () => {
    const trace = createDynamicGraphTrace({ nodes: nodes('A', 'B'), edges: [edge('p', 'A', 'B')] }, { layout: layout('A', 'B') });
    trace.start();
    assert.throws(() => trace.edit({ nodes: nodes('A') }), RangeError);
    const removed = trace.edit({ nodes: nodes('A'), edges: [] });
    assert.deepEqual(removed.state.layout, layout('A'));
    assert.throws(() => trace.edit({ nodes: nodes('A', 'B'), layout: layout('A', 'B') }), RangeError);
    assert.throws(() => trace.edit({ edges: [edge('p', 'A', 'A')] }), RangeError);
    const exchanged = trace.edit({
        nodes: nodes('A', 'p'), edges: [edge('B', 'A', 'p')], layout: layout('A', 'p'),
    });
    assert.equal(exchanged.index, 2);
    const noop = trace.edit({ nodes: undefined, edges: undefined, layout: undefined, marks: undefined });
    assert.deepEqual(noop.state, exchanged.state);
    assert.notEqual(noop.state, exchanged.state);
    assert.equal(noop.index, 3);
    const clear = trace.edit({ nodes: [], edges: [] });
    assert.deepEqual(clear.state.graph, { nodes: [], edges: [] });
    assert.deepEqual(clear.state.layout, []);
    assert.deepEqual(project(clear.state).objects, []);
    const fresh = createDynamicGraphTrace(input());
    assert.equal(fresh.start().index, 0);
    assert.equal(fresh.state.graph.nodes[1].id, 'B');
    assert.equal(Object.hasOwn(createGraphTrace(input()), 'edit'), false);
});

test('dynamic graph: late failures preserve snapshot, index, retirement and original throws', () => {
    const trace = createDynamicGraphTrace(input()), before = trace.start().state;
    const event = { from: 'proxy' };
    const failingMarks = new Proxy({ nodeCaptions: [] }, {
        getOwnPropertyDescriptor(target, key) {
            if (key === 'nodeCaptions') {
                assert.equal(trace.state, before);
                assert.throws(() => trace.edit({}), error => error.constructor === Error);
                throw event;
            }
            return Reflect.getOwnPropertyDescriptor(target, key);
        },
    });
    assert.throws(() => trace.edit({ ...replaceB(), layout: undefined }), RangeError);
    assert.equal(trace.state, before);
    assert.throws(() => trace.edit({ ...replaceB(), marks: { nodes: [{ id: 'B', role: null }] } }), RangeError);
    assert.equal(trace.state, before);
    assert.throws(() => trace.edit({ ...replaceB(), marks: failingMarks }), error => error === event);
    assert.equal(trace.state, before);

    const kept = trace.edit({
        nodes: nodes('A', 'B', 'C'), edges: [...input().edges, edge('q', 'C', 'A')], layout: layout('A', 'B', 'C'),
    });
    assert.equal(kept.index, 1);
    assert.deepEqual(kept.state.graph.edges.map(item => item.id), ['B', 'e', 'q']);
    assert.equal(trace.edit(replaceB()).index, 2);
});

test('dynamic graph: lifecycle, topology, retirement, layout and marks retain error precedence', () => {
    const trace = createDynamicGraphTrace(input());
    const poison = new Proxy({}, { getPrototypeOf() { assert.fail('Read after lifecycle error'); } });
    assert.throws(() => trace.edit(poison), error => error.constructor === Error);
    trace.start();
    assert.throws(() => trace.edit(), TypeError);
    assert.throws(() => trace.edit({ nodes: null }), TypeError);
    assert.throws(() => trace.edit({ edges: Array(1) }), TypeError);
    assert.throws(() => trace.edit({ nodes: nodes('A'), get layout() { assert.fail('Invoked accessor'); } }), TypeError);
    assert.throws(() => trace.edit({ nodes: nodes('A'), marks: null }), RangeError);
    trace.edit(replaceB());
    assert.throws(() => trace.edit({ nodes: nodes('B'), edges: null }), TypeError);
    assert.throws(() => trace.edit({ nodes: nodes('B'), edges: [], layout: null }), RangeError);
    assert.throws(() => trace.edit({ layout: [], marks: null }), RangeError);
    assert.throws(() => trace.edit({ marks: null }), TypeError);
    assert.equal(trace.done().index, 2);
    assert.throws(() => trace.edit(poison), error => error.constructor === Error);
});

test('dynamic graph: retargeting keeps a scene ID and resolves each generation and lane independently', () => {
    const trace = createDynamicGraphTrace(input());
    const before = project(trace.start().state), after = project(trace.edit(replaceB()).state);
    for (const progress of [0, 0.5, 1]) {
        const frame = createSceneFrame({ previous: before, current: after, progress, stepIndex: 1, event: undefined });
        const retained = frame.objects.find(item => item.current?.data.edge?.id === 'e');
        assert.equal(retained.phase, 'update');
        assert.equal(retained.previous.id, retained.current.id);
        assert.deepEqual([retained.previous.data.routeIndex, retained.current.data.routeIndex], [1, 0]);
        const oldTarget = frame.get(retained.previous.data.to), newTarget = frame.get(retained.current.data.to);
        assert.equal(oldTarget.previous.data.node.id, 'B');
        assert.equal(oldTarget.current, null);
        assert.equal(oldTarget.presence, 1 - progress);
        assert.equal(newTarget.current.data.node.id, 'C');
        assert.equal(newTarget.previous, null);
        assert.equal(newTarget.presence, progress);
        assert.equal(frame.objects.find(item => item.previous?.data.edge?.id === 'B').phase, 'exit');
        assert.equal(frame.objects.find(item => item.current?.data.edge?.id === 'q').phase, 'enter');
    }
    const loop = trace.edit({ edges: [edge('e', 'A', 'A'), edge('q', 'C', 'A')] });
    const loopScene = project(loop.state);
    const beforeEdge = after.objects.find(item => item.data.edge?.id === 'e');
    const afterEdge = loopScene.objects.find(item => item.data.edge?.id === 'e');
    assert.equal(afterEdge.id, beforeEdge.id);
    assert.equal(afterEdge.data.from, afterEdge.data.to);
    assert.equal(afterEdge.data.routeCount, 1);
});

for (const mode of ['stream', 'history']) {
    test(`dynamic graph: ${mode} Player restores topology and result on Previous, replay and Restart`, async () => {
        const env = dom(), traces = [];
        const projectFrame = createSceneProjector(project);
        let edits = 0, closed = 0, rendered;
        function* steps() {
            const trace = createDynamicGraphTrace(input());
            traces.push(trace);
            try {
                yield trace.start();
                edits++;
                yield trace.edit(replaceB());
                yield trace.done({ result: { nodeIds: ['C'], edgeIds: ['e'] } });
                assert.fail('Read beyond done');
            } finally { closed++; }
        }
        const source = mode === 'stream'
            ? { stepSource: steps, isTerminal: step => step.event.type === 'done', rewindCapacity: 2 }
            : { history: () => {
                const states = [];
                for (const step of steps()) {
                    states.push(step.state);
                    if (step.event.type === 'done') break;
                }
                return states;
            } };
        const player = new Player(env.container(), {
            ...source, stepDurationMs: 100, finalHoldMs: 25,
            render(frame) { rendered = createSceneFrame(projectFrame(frame)); },
        });
        try {
            player.start();
            const initial = player.frame.current;
            player.next();
            const edited = player.frame.current;
            assert.equal(edited.graph.edges[0].to, 'C');
            assert.equal(rendered.event?.type, mode === 'stream' ? 'edit' : undefined);
            player.previous();
            assert.equal(player.frame.current, initial);
            player.next();
            assert.equal(player.frame.current, edited);
            assert.equal(edits, 1);

            for (let i = 0; i < 3 && player.status.phase !== 'finished'; i++) player.next();
            assert.equal(player.status.phase, 'finished');
            const final = player.frame.current;
            assert.deepEqual(final.result, { nodeIds: ['C'], edgeIds: ['e'] });
            for (let i = 0; i < 3 && player.frame.current === final; i++) player.previous();
            assert.equal(player.frame.current, edited);
            assert.equal(player.frame.current.result, null);
            if (mode === 'stream') {
                assert.equal(player.status.rewindStartIndex, 1);
                assert.equal(player.status.canPrevious, false);
            } else {
                player.seek(0);
                assert.equal(player.frame.current, initial);
                player.seek(50);
                assert.equal(player.frame.progress, 0.5);
                assert.equal(player.frame.previous, initial);
                assert.equal(player.frame.current, edited);
            }
            assert.equal(traces[0].state, final);
            assert.equal(edits, 1);
            assert.equal(closed, 1);
            player.restart();
            assert.deepEqual(player.frame.current, initial);
            if (mode === 'stream') {
                assert.equal(traces.length, 2);
                assert.notEqual(player.frame.current, initial);
            }
        } finally {
            player.dispose();
            assert.equal((await player.closed).errorCount, 0);
        }
        assert.equal(env.scheduler.size, 0);
    });
}
