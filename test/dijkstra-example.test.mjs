import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dijkstraSteps } from '../examples/dijkstra.mjs';

test('Dijkstra improves a pending vertex and preserves previous snapshots', () => {
    const steps = [...dijkstraSteps()];
    const improvement = steps.find(step => step.event.edgeId === 'CB');
    const before = steps[improvement.index - 1].state;
    const after = improvement.state;
    const rowB = state => state.distances.find(row => row.vertex === 'B');
    const queue = state => state.queue.map(({ vertex, distance }) => [vertex, distance]);
    const role = (state, edgeId) => state.graph.edgeMarks.find(mark => mark.id === edgeId)?.role;

    assert.deepEqual(improvement.event, { type: 'improve', edgeId: 'CB', vertex: 'B', previous: 8, candidate: 5 });
    assert.deepEqual([rowB(before), rowB(after)], [
        { vertex: 'B', distance: 8, predecessor: 'A', settled: false },
        { vertex: 'B', distance: 5, predecessor: 'C', settled: false },
    ]);
    assert.deepEqual(queue(before), [['D', 6], ['B', 8]]);
    assert.deepEqual(queue(after), [['B', 5], ['D', 6]]);
    assert.deepEqual([role(before, 'AB'), role(after, 'AB'), role(after, 'CB')], ['predecessor', undefined, 'improved']);
    assert.throws(() => { rowB(after).distance = 100; }, TypeError);
    assert.throws(() => { after.queue.shift(); }, TypeError);
    assert.ok(Object.isFrozen(improvement.event));

    const rejected = steps.find(step => step.event.edgeId === 'BD');
    assert.equal(rejected.event.type, 'keep');
    assert.deepEqual(queue(rejected.state), [['D', 6]]);
    assert.deepEqual(steps.filter(step => step.event.type === 'settle').map(step => step.event.vertex), ['A', 'C', 'B', 'D']);
    const last = steps.at(-1);
    assert.equal(last.event.type, 'done');
    assert.deepEqual(last.state.distances.map(row => row.distance), [0, 5, 2, 6]);
    assert.ok(last.state.distances.every(row => row.settled));
    assert.deepEqual(last.state.queue, []);
    assert.deepEqual(new Set(last.state.graph.result.edgeIds), new Set(['AC', 'CB', 'AD']));
    assert.deepEqual([...dijkstraSteps()], steps);
});
