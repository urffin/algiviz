import { test } from 'node:test';
import assert from 'node:assert/strict';
import { graphSteps, graphExamples, sampleGraph } from '../examples/graph-algorithm.mjs';
import { graphScene, graphLayout, createGraphRenderer } from '../examples/graph-scene.mjs';
import { createPlayer, createTimeline } from '@grundyjs/algiviz/playback';

function oracle(graph) {
    const ids = graph.nodes.map(node => node.id), index = new Map(ids.map((id, i) => [id, i]));
    const matrix = ids.map((_, i) => ids.map((_, j) => i === j ? 0 : Infinity));
    for (const edge of graph.edges) if (edge.from !== edge.to) {
        const a = index.get(edge.from), b = index.get(edge.to); matrix[a][b] = matrix[b][a] = 1;
    }
    for (let k = 0; k < ids.length; k++) for (let i = 0; i < ids.length; i++) for (let j = 0; j < ids.length; j++)
        matrix[i][j] = Math.min(matrix[i][j], matrix[i][k] + matrix[k][j]);
    return (a, b) => matrix[index.get(a)][index.get(b)];
}
function verify(graph, start, target, expected = oracle(graph)) {
    const steps = [...graphSteps(graph, start, target)], s = steps.at(-1).state;
    const distances = new Map(s.distances.map(item => [item.id, item.distance]));
    const parents = new Map(s.parents.map(item => [item.id, item]));
    const reached = graph.nodes.filter(node => Number.isFinite(expected(start, node.id)));
    assert.equal(s.phase, 'finished');
    assert.equal(s.current, null); assert.equal(s.activeEdge, null);
    assert.deepEqual(s.queue, []);
    assert.equal(s.discoveredCount, reached.length); assert.equal(s.processedCount, reached.length);
    const checks = graph.edges.reduce((total, edge) => total + (distances.get(edge.from) === null ? 0 : edge.from === edge.to ? 1 : 2), 0);
    assert.equal(s.edgeChecks, checks);
    for (const node of graph.nodes) {
        const d = expected(start, node.id), p = parents.get(node.id);
        assert.equal(distances.get(node.id), Number.isFinite(d) ? d : null);
        if (node.id === start || !Number.isFinite(d)) { assert.equal(p.parent, null); assert.equal(p.edge, null); }
        else {
            assert.equal(distances.get(p.parent) + 1, d);
            const edge = graph.edges.find(edge => edge.id === p.edge);
            assert.ok(edge && ((edge.from === node.id && edge.to === p.parent) || (edge.to === node.id && edge.from === p.parent)));
        }
    }
    if (target === null || !Number.isFinite(expected(start, target))) {
        assert.deepEqual(s.path, []); assert.ok(!steps.some(step => step.event.kind === 'path'));
    } else {
        assert.equal(s.path[0], start); assert.equal(s.path.at(-1), target);
        assert.equal(s.path.length - 1, expected(start, target));
        assert.equal(new Set(s.path).size, s.path.length);
        for (let i = 1; i < s.path.length; i++) assert.equal(parents.get(s.path[i]).parent, s.path[i - 1]);
        const restoring = steps.filter(step => step.event.kind === 'path');
        assert.deepEqual(restoring.map(step => step.event.target), s.path.toReversed());
        for (const [i, step] of restoring.entries()) assert.deepEqual(step.state.path, s.path.toReversed().slice(0, i + 1));
    }
    let maxQueue = 0, examined = 0, discovered = 1, processed = 0;
    for (const [i, step] of steps.entries()) {
        const state = step.state;
        assert.equal(step.index, i);
        assert.ok(Object.isFrozen(state) && Object.isFrozen(step.event));
        assert.equal(state.graph, steps[0].state.graph);
        for (const value of [state.queue, state.visited, state.parents, state.path, state.distances]) assert.ok(Object.isFrozen(value));
        assert.ok(state.parents.every(Object.isFrozen) && state.distances.every(Object.isFrozen));
        assert.equal(new Set(state.queue).size, state.queue.length);
        assert.ok(!state.queue.includes(state.current));
        assert.ok(state.queue.every(id => !state.visited.includes(id)));
        assert.ok(!state.visited.includes(state.current));
        const d = new Map(state.distances.map(item => [item.id, item.distance]));
        for (let j = 1; j < state.queue.length; j++) assert.ok(d.get(state.queue[j - 1]) <= d.get(state.queue[j]));
        maxQueue = Math.max(maxQueue, state.queue.length);
        if (step.event.kind === 'examine') examined++;
        if (step.event.kind === 'discover') discovered++;
        if (step.event.kind === 'settle') processed++;
        assert.equal(state.edgeChecks, examined); assert.equal(state.discoveredCount, discovered);
        assert.equal(state.processedCount, processed); assert.equal(state.maxQueueSize, maxQueue);
        assert.equal(state.discoveredCount, state.queue.length + state.visited.length + (state.current === null ? 0 : 1));
        if (step.event.kind === 'examine') assert.equal(step.event.source, state.current);
        if (i) {
            const previous = new Map(steps[i - 1].state.parents.map(item => [item.id, item]));
            for (const p of state.parents) if (previous.get(p.id).parent !== null) assert.deepEqual(p, previous.get(p.id));
        }
    }
    assert.equal(s.treeEdges.length, reached.length - 1);
    return steps;
}

test('every simple graph on 1–5 vertices, every start and optional target matches Floyd–Warshall', () => {
    let graphs = 0, runs = 0;
    for (let n = 1; n <= 5; n++) {
        const nodes = Array.from({ length: n }, (_, i) => ({ id: String(i) })), possible = [];
        for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) possible.push({ id: `${a}:${b}`, from: String(a), to: String(b) });
        for (let mask = 0; mask < 2 ** possible.length; mask++) {
            const graph = { nodes, edges: possible.filter((_, bit) => mask & (1 << bit)) }, expected = oracle(graph);
            const before = structuredClone(graph);
            for (const start of nodes) for (const target of [null, ...nodes.map(node => node.id)]) {
                verify(graph, start.id, target, expected); runs++;
            }
            assert.deepEqual(graph, before); graphs++;
        }
    }
    assert.equal(graphs, 1099); assert.equal(runs, 32110);
    console.log(`BFS paths: ${graphs} graphs, ${runs} start/target combinations`);
});

test('default scene counters, ties, multigraph parent edges and immutable input', () => {
    const main = graphExamples[0].graph, steps = verify(main, 'A', 'G'), final = steps.at(-1).state;
    assert.deepEqual(final.path, [...'ABDG']); assert.equal(final.edgeChecks, 18); assert.equal(final.maxQueueSize, 3);
    assert.deepEqual(final.visited, [...'ABCDEFG']);
    const foundE = steps.find(step => step.event.kind === 'discover' && step.event.target === 'E').state;
    assert.deepEqual(foundE.queue, [...'CDE']); assert.equal(foundE.current, 'B'); assert.equal(foundE.edgeChecks, 5);
    const flipped = verify({ nodes: main.nodes, edges: main.edges.toReversed() }, 'A', 'G');
    assert.deepEqual(flipped.at(-1).state.path, [...'ACFG']);
    assert.deepEqual(flipped.at(-1).state.distances, final.distances);
    for (const example of graphExamples) for (const node of example.graph.nodes) {
        verify(example.graph, node.id, node.id); verify(example.graph, node.id, null); verify(example.graph, node.id, example.target);
    }
    const multigraph = { nodes: ['__proto__', 'constructor', 'toString', 'isolated'].map(id => ({ id })), edges: [
        { id: 'loop', from: '__proto__', to: '__proto__' },
        { id: 'first', from: '__proto__', to: 'constructor' }, { id: 'parallel', from: 'constructor', to: '__proto__' },
        { id: 'tail', from: 'constructor', to: 'toString' },
    ] };
    const multiSteps = verify(multigraph, '__proto__', 'toString');
    assert.equal(multiSteps.at(-1).state.edgeChecks, 7);
    assert.equal(multiSteps.at(-1).state.parents.find(item => item.id === 'constructor').edge, 'first');
    const scene = graphScene(multiSteps.at(-1).state);
    assert.deepEqual(scene.objects.filter(object => object.type === 'connection' && object.data.path).map(object => object.id), ['connection:first', 'connection:tail']);
    const mutable = { nodes: [{ id: 'A' }, { id: 'B' }], edges: [{ id: 'ab', from: 'A', to: 'B' }] };
    const iterator = graphSteps(mutable, 'A', 'B'), first = iterator.next().value, saved = structuredClone(first);
    mutable.edges[0].to = 'missing'; mutable.nodes[0].id = 'changed';
    assert.deepEqual([...iterator].at(-1).state.path, ['A', 'B']); assert.deepEqual(first, saved);
    assert.throws(() => graphSteps(main, 'A', 'missing').next(), RangeError);
    assert.throws(() => graphSteps(main, 'A', 1).next(), RangeError);
    assert.throws(() => graphSteps({ nodes: [], edges: [] }, 'A', null).next(), RangeError);
});

test('history and lazy generator agree through reconstruction, final hold, restart and disposal', () => {
    const options = { stepDurationMs: 3, finalHoldMs: 2 };
    for (const example of graphExamples) for (const target of [null, example.start, example.target]) {
        const history = [...graphSteps(example.graph, example.start, target)];
        const timeline = createTimeline(history, options);
        let consumed = 0, closed = 0;
        function* source() { try { for (const step of graphSteps(example.graph, example.start, target)) { consumed++; yield step; } } finally { closed++; } }
        const player = createPlayer(source(), { ...options, isTerminal: step => step.event.kind === 'finished' });
        assert.equal(consumed, 1, 'generator must not collect history on construction');
        for (let time = 0; time <= timeline.durationMs; time++) {
            const frame = time ? player.advance(1) : player.frame;
            assert.deepEqual(frame, timeline.sample(time));
        }
        assert.ok(player.finished); assert.equal(closed, 1); assert.equal(consumed, history.length);
        player.dispose(); assert.equal(closed, 1);
        const restarted = createPlayer(source(), { ...options, isTerminal: step => step.event.kind === 'finished' });
        assert.equal(restarted.frame.stepIndex, 0); restarted.dispose(); assert.equal(closed, 2);
        assert.deepEqual([...graphSteps(example.graph, example.start, target)], history);
    }
    const early = graphSteps(graphExamples[0].graph, 'A', 'G');
    while (early.next().value.event.kind !== 'path') {}
    assert.equal(early.return().done, true); assert.equal(early.next().done, true);
});

test('scene IDs, paths, wrapped queues, logical DPR geometry and backwards seeking', () => {
    const star = { id: 'layers', start: 'A', target: 'H', graph: { nodes: [...'ABCDEFGH'].map(id => ({ id })), edges: [...'BCDEFGH'].map(id => ({ id: 'A' + id, from: 'A', to: id })) } };
    let frames = 0;
    for (const example of [...graphExamples, star]) {
        const steps = [...graphSteps(example.graph, example.start, example.target)], timeline = createTimeline(steps, { stepDurationMs: 10, finalHoldMs: 7 });
        for (const width of [240, 272, 320, 390, 699, 700, 960]) {
            const layout = graphLayout(width, example.graph.nodes.length, example.id);
            for (const [index, node] of example.graph.nodes.entries()) {
                const p = layout.node(node.id, index);
                assert.ok(p.x - 25 >= 0 && p.x + 25 <= layout.graphWidth);
                assert.ok(p.y - 35 >= 0 && p.y + 41 <= layout.graphHeight + 1);
            }
            for (let i = 0; i < Math.max(1, example.graph.nodes.length - 1); i++) {
                const p = layout.queue(i); assert.ok(p.x >= 0 && p.x + p.width <= width); assert.ok(p.y + 40 <= layout.height);
            }
            const fills = [], calls = [];
            const ctx = new Proxy({ canvas: { width: width * 2, height: layout.height * 2 } }, {
                get(target, key) { return key in target ? target[key] : (...args) => {
                    for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), String(key));
                    if (key === 'fillRect') fills.push(args);
                    calls.push(key);
                }; },
            });
            const renderer = createGraphRenderer({ layout: example.id });
            const times = steps.flatMap(step => [step.index * 10, step.index * 10 + 5]);
            for (const time of [...times, ...times.toReversed()]) {
                const frame = timeline.sample(time), objects = graphScene(frame.current).objects;
                assert.equal(new Set(objects.map(object => object.id)).size, objects.length);
                assert.equal(objects.filter(object => object.type === 'queueEntry').length, frame.current.queue.length);
                for (const edge of objects.filter(object => object.type === 'connection')) {
                    assert.ok(objects.some(object => object.id === edge.data.from));
                    assert.ok(objects.some(object => object.id === edge.data.to));
                }
                renderer.render(ctx, frame, width, layout.height); frames++;
            }
            assert.deepEqual(fills[0], [0, 0, width, layout.height]);
            assert.ok(!calls.includes('setTransform'), 'renderer must preserve the caller DPR transform');
        }
    }
    console.log(`BFS scene: ${frames} frames, bidirectional seeks and wrapped queue geometry`);
});
