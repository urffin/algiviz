import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, createTimeline } from '@grundyjs/algiviz/playback';
import { createSceneFrame } from '@grundyjs/algiviz/scene';
import { createSand, advanceSand, analyzeSand, createSandSource, sandSteps, sandWorld, sandLimits,
    sandTiming, presetWalls, sandPresets, paintSand, sandBrush, gateCells, EMPTY, WALL } from '../examples/sand-algorithm.mjs';
import { sandScene, createSandRenderer } from '../examples/sand-scene.mjs';
const C = sandWorld.columns;
const at = (x, y) => y * C + x;
function custom(grains, walls = [], seed = 42) {
    const cells = presetWalls('empty');
    for (const [x, y] of walls) cells[at(x, y)] = WALL;
    grains.forEach(([x, y], id) => { cells[at(x, y)] = id; });
    return createSand({ cells, preset: 'empty', seed, ticks: 5 });
}
test('down, diagonal, side wall and rest rules match inspection', () => {
    const fall = custom([[10, 10]]);
    assert.equal(analyzeSand(fall, 0).to, at(10, 11));
    assert.equal(advanceSand(fall).cells[at(10, 11)], 0);
    const slide = custom([[10, 10]], [[10, 11], [9, 11]]);
    assert.equal(analyzeSand(slide, 0).rule, 'slide');
    assert.equal(analyzeSand(slide, 0).to, at(11, 11));
    const blocked = custom([[10, 10]], [[10, 11], [9, 10], [11, 10]]);
    assert.equal(analyzeSand(blocked, 0).rule, 'rest');
    assert.equal(advanceSand(blocked).cells[at(10, 10)], 0);
    assert.equal(analyzeSand(custom([[10, sandWorld.rows - 2]]), 0).rule, 'rest');
});
test('two proposals for one cell conserve both identities and expose the winner', () => {
    for (const seed of [0, 1, 2, 42, 0xffffffff]) {
        const before = custom([[10, 10], [12, 10]], [[9, 11], [10, 11], [12, 11], [13, 11]], seed);
        const after = advanceSand(before), analyses = [analyzeSand(before, 0), analyzeSand(before, 1)];
        assert.equal(analyses.filter(a => a.moved).length, 1);
        assert.equal(after.moved, 1);
        for (const a of analyses) { assert.equal(a.proposed, at(11, 11)); assert.equal(after.cells[a.to], a.id); }
        assert.equal(after.cells[at(11, 11)], analyses[0].winnerId);
        assert.deepEqual(after.cells.filter(v => v >= 0).sort(), [0, 1]);
    }
});
test('all presets conserve mass, IDs and walls; every inspected prediction equals the synchronous next tick', () => {
    for (const preset of Object.keys(sandPresets)) {
        let state = createSand({ preset, count: 45, ticks: 120, seed: 38 });
        const first = state, saved = [...first.cells], walls = state.cells.flatMap((v, i) => v === WALL ? [i] : []);
        for (let tick = 0; tick < 120; tick++) {
            const next = advanceSand(state);
            assert.ok(Object.isFrozen(next) && Object.isFrozen(next.cells) && Object.isFrozen(next.config));
            assert.notEqual(next.cells, state.cells);
            assert.deepEqual(next.cells.filter(v => v >= 0).sort((a, b) => a - b), Array.from({length: 45}, (_, i) => i));
            for (const index of walls) assert.equal(next.cells[index], WALL);
            for (let id = 0; id < 45; id += 7) {
                const a = analyzeSand(state, id);
                assert.equal(next.cells[a.to], id);
                assert.ok(a.to === a.from || Math.floor(a.to / C) === Math.floor(a.from / C) + 1);
            }
            state = next;
        }
        assert.deepEqual(first.cells, saved);
    }
});
test('seeded replay, edits and gate removal preserve independent initial snapshots', () => {
    const a = [...sandSteps({count: 20, ticks: 6})], b = [...sandSteps({count: 20, ticks: 6})];
    assert.deepEqual(a, b);
    const first = createSand({count: 20});
    assert.ok(gateCells.every(index => first.cells[index] === WALL));
    const opened = paintSand(first, gateCells, 'erase');
    assert.ok(gateCells.every(index => opened.cells[index] === EMPTY));
    assert.equal(opened.config.count, first.config.count);
    assert.ok(gateCells.every(index => first.cells[index] === WALL));
    const empty = createSand({preset: 'empty', count: 0});
    const added = paintSand(empty, [0, at(8, 8), at(8, 8)], 'sand');
    assert.equal(added.config.count, 1); assert.equal(added.cells[0], WALL);
    const wall = paintSand(added, [at(8, 8), at(9, 8)], 'wall');
    assert.equal(wall.cells[at(8, 8)], 0); assert.equal(wall.cells[at(9, 8)], WALL);
    const erased = paintSand(wall, [at(8, 8)], 'erase');
    assert.equal(erased.config.count, 0);
    assert.equal(paintSand(erased, [at(8, 8)], 'sand').cells[at(8, 8)], 1);
});
test('validation captures drafts, enforces mode budgets and rejects duplicate IDs or broken boundaries', () => {
    for (const input of [{count: -1}, {count: sandLimits.history + 1}, {seed: NaN}, {seed: -1}, {seed: 2 ** 32},
        {ticks: 0}, {ticks: 361}, {preset: 'toString'}, {cells: []}]) assert.throws(() => createSandSource(input));
    assert.throws(() => createSand({}, 'ticks'));
    const large = createSandSource({count: sandLimits.history + 1}, 'generator');
    assert.throws(() => large('history'));
    const state = custom([[8, 8]]), cells = [...state.cells];
    const source = createSandSource({...state.config, cells}); cells[at(8, 8)] = EMPTY;
    assert.equal(source().next().value.state.cells[at(8, 8)], 0);
    cells[0] = EMPTY; assert.throws(() => createSand({cells}));
    const duplicate = [...state.cells]; duplicate[at(9, 9)] = 0; assert.throws(() => createSand({cells: duplicate}));
});
test('closed hopper retains the entire default reservoir and the opened gate drains it without loss', () => {
    let state = createSand();
    for (let i = 0; i < 280; i++) state = advanceSand(state);
    assert.equal(state.cells.filter((v, i) => v >= 0 && Math.floor(i / C) > 34).length, 0);
    state = paintSand(state, gateCells, 'erase');
    for (let i = 0; i < 280; i++) state = advanceSand(state);
    assert.equal(state.cells.filter((v, i) => v >= 0 && Math.floor(i / C) > 34).length, 320);
    assert.equal(state.config.count, 320);
});
test('fast brush strokes fill their entire path and clipping never edits the boundary', () => {
    const indices = sandBrush(at(3, 4), at(20, 4), 0);
    assert.deepEqual(indices, Array.from({length: 18}, (_, i) => at(3 + i, 4)));
    const state = paintSand(createSand({count: 0, preset: 'empty'}), sandBrush(0, at(4, 4), 2), 'wall');
    assert.ok(state.cells[at(2, 2)] === WALL && state.cells[at(4, 4)] === WALL);
    const erased = paintSand(state, sandBrush(0, at(4, 4), 2), 'erase');
    assert.equal(erased.cells[0], WALL); assert.equal(erased.cells[at(4, 4)], EMPTY);
});
test('history/generator frames agree, seeking is repeatable and disposal closes a lazy source', () => {
    const input = {count: 8, ticks: 4, seed: 1}, options = {...sandTiming, finalHoldMs: 15};
    const timeline = createTimeline([...sandSteps(input)], options);
    let consumed = 0, closed = false;
    function* source() { try { for (const step of sandSteps(input)) { consumed++; yield step; } } finally { closed = true; } }
    const player = createPlayer(source(), {...options, isTerminal: step => step.event.kind === 'finished'});
    assert.equal(consumed, 1);
    let previous = 0;
    for (const time of [0, 1, 32, 65, 66, 130, 195, timeline.durationMs]) {
        const frame = player.advance(time - previous); previous = time;
        assert.deepEqual(frame, timeline.sample(time));
    }
    assert.ok(closed); assert.ok(player.finished); player.dispose();
    assert.deepEqual(timeline.sample(65), timeline.sample(65));
    closed = false; const early = createPlayer(source(), {...options, isTerminal: step => step.event.kind === 'finished'}); early.dispose(); assert.ok(closed);
    const factory = createSandSource(input); assert.deepEqual([...factory()], [...factory()]);
});
test('custom scenes preserve grain IDs and render through public AlgiViz projection in either geometry', () => {
    const before = custom([[10, 10]]), after = advanceSand(before);
    const a = sandScene(before), b = sandScene(after);
    const frame = {previous: a, current: b, progress: .5, stepIndex: 1, event: 'move'};
    const sceneFrame = createSceneFrame(frame);
    assert.ok(sceneFrame);
    assert.deepEqual(a.objects.map(o => o.id).sort(), b.objects.map(o => o.id).sort());
    const draws = [];
    const context = {canvas: {width: 640, height: 540}, fillRect(...args) {draws.push(args);},
        strokeRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}};
    const renderer = createSandRenderer();
    renderer.render(context, {previous: before, current: after, progress: .5, stepIndex: 1, event: 'move'});
    assert.ok(draws.some(row => Math.abs(row[1] - 105.4) < .01));
    context.canvas = {width: 320, height: 300};
    renderer.render(context, {previous: after, current: before, progress: 1, stepIndex: 0, event: 'move'}, {analysis: analyzeSand(before, 0)});
    assert.ok(draws.every(row => row.every(Number.isFinite)));
});
