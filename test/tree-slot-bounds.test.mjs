import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTreeTrace } from '@grundyjs/algiviz/tree';
import { createTreeRenderer } from '@grundyjs/algiviz/canvas/tree';
import { recording } from './tree-canvas-context.mjs';
import { slotBoundsFixture } from './tree-slot-fixtures.mjs';
import { slotBoundsIssues } from './tree-slot-oracle.mjs';

const endpoint = state => ({ previous: state, current: state, progress: 1, event: undefined, stepIndex: 0 });
function draw(fixture, ratio = 1, frame = endpoint(fixture.state), options = fixture.options) {
    const { width, height } = fixture.size, env = recording(Math.round(width * ratio), Math.round(height * ratio));
    createTreeRenderer(options).render(env.ctx, frame, fixture.size); return env;
}
function geometry(env) {
    return { squares: env.calls('strokeRect').map(({ args: [x, y, width, height], state }) => ({ x, y, width, height, lineWidth: state.lineWidth })),
        circles: env.calls('arc').map(({ args: [x, y, radius] }) => ({ x, y, radius })),
        boxes: env.calls('fillRect').slice(1).map(({ args: [x, y, width, height] }) => ({ x, y, width, height })) };
}

test('T1 slots: painted squares keep the 4px viewport margin at every backing-store ratio', () => {
    for (const ratio of [1, 1.25, 2]) for (const name of ['viewport', 'viewport-safe']) {
        const fixture = slotBoundsFixture(name), env = draw(fixture, ratio), painted = geometry(env);
        assert.deepEqual(slotBoundsIssues(painted, fixture.size), []);
        assert.equal(painted.squares.length, name === 'viewport' ? 0 : 2, 'omit only the unsafe boundary squares');
        const hidden = draw(fixture, ratio, endpoint(fixture.state), { ...fixture.options, emptySlots: 'hidden' });
        assert.deepEqual(env.calls('arc').map(c => c.args), hidden.calls('arc').map(c => c.args));
        assert.equal(hidden.calls('strokeRect').length, 0);
    }
});

for (const name of ['node', 'caption', 'slot']) test(`T1 slots: full square stroke keeps 2px separation from ${name} reservations`, () => {
    const fixture = slotBoundsFixture(name);
    for (const ratio of [1, 1.25, 2]) {
        const env = draw(fixture, ratio), painted = geometry(env);
        assert.ok(painted.squares.length > 0, 'retain safe squares instead of hiding all slots');
        assert.equal(painted.circles.length, 3);
        assert.deepEqual(slotBoundsIssues(painted, fixture.size), []);
    }
});

test('T1 slots: boundary safety holds for entering/exiting owners and raw opacity; hidden mode preserves fit', () => {
    const empty = createTreeTrace({ kind: 'binary', rootId: null, nodes: [], links: [] }, { layout: [] }).state;
    for (const name of ['viewport', 'viewport-safe']) for (const entering of [true, false]) for (const p of [0, .25, .5, 1]) {
        const fixture = slotBoundsFixture(name), frame = { ...endpoint(fixture.state), progress: p,
            previous: entering ? empty : fixture.state, current: entering ? fixture.state : empty };
        const env = draw(fixture, 1.25, frame), painted = geometry(env), presence = entering ? p : 1 - p;
        assert.deepEqual(slotBoundsIssues(painted, fixture.size), []);
        assert.equal(painted.squares.length, name === 'viewport-safe' && presence > 0 ? 2 : 0);
        for (const c of env.calls('strokeRect')) assert.equal(c.state.globalAlpha, presence);
        const hidden = draw(fixture, 1.25, frame, { ...fixture.options, emptySlots: 'hidden' });
        assert.deepEqual(env.calls('arc').map(c => c.args), hidden.calls('arc').map(c => c.args));
    }
});
