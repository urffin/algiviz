import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { Player } from '@grundyjs/algiviz/player';
import { createGridRenderer } from '@grundyjs/algiviz/canvas/grid';
import { createGridBfsSource, gridBfsPresets } from '../examples/grid-player-algorithm.mjs';
import { prepareGridSession, gridRewindCapacity } from '../examples/grid-player-session.mjs';
import { timing, limits } from '../examples/player-settings.mjs';
import { recording } from './tree-canvas-context.mjs';
import { dom } from './player-test-dom.mjs';

const point = (row, column) => ({ row, column });
const all = input => [...createGridBfsSource(input)()];
function frozen(value) {
    if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); for (const item of Object.values(value)) frozen(item); }
}
// Independent shortest-distance oracle: relax every open-cell edge repeatedly,
// without the example's queue, parents, or neighbor enumeration.
function distance(input) {
    const width = input.cells[0].length, count = width * input.cells.length;
    const d = Array(count).fill(Infinity); d[input.start.row * width + input.start.column] = 0;
    for (let pass = 0; pass < count; pass++) for (let a = 0; a < count; a++) for (let b = 0; b < count; b++) {
        const ar = Math.floor(a / width), ac = a % width, br = Math.floor(b / width), bc = b % width;
        if (input.cells[ar][ac] !== '#' && input.cells[br][bc] !== '#' && Math.abs(ar - br) + Math.abs(ac - bc) === 1)
            d[b] = Math.min(d[b], d[a] + 1);
    }
    return d[input.target.row * width + input.target.column];
}
function paint(frame, drawing = createGridRenderer({ theme: 'dark', presentCell: ({ value }) => ({ label: value, color: value === '#' ? '#0b1220' : undefined }) })) {
    const env = recording(390, 280);
    drawing.render(env.ctx, { ...frame, previous: frame.previous.visual, current: frame.current.visual }, { width: 390, height: 280 });
    assert.equal(env.stack.length, 0); return env;
}
const endpoint = state => ({ previous: state, current: state, progress: 1 });
const selected = env => env.calls('fillRect').filter(c => c.state.fillStyle === '#34d399');

test('grid BFS example: deterministic shortest path, persistent distances and distinct outcomes', () => {
    const steps = all(gridBfsPresets.passages), final = steps.at(-1).state;
    assert.equal(steps.length, 68); assert.equal(final.found, true); assert.equal(final.path.length - 1, 10);
    assert.deepEqual(final.path, [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 3], [2, 4], [3, 4], [4, 4], [4, 5], [4, 6]].map(([r, c]) => point(r, c)));
    assert.deepEqual(final.counters, { discovered: 23, dequeued: 22 });
    assert.equal(final.queue.length, 1, 'Stop at the target, not after the remaining frontier');
    assert.deepEqual(final.visual.result, { cells: [], path: final.path });
    for (const [i, step] of steps.entries()) {
        assert.equal(step.index, i); frozen(step); assert.equal(step.event.type === 'done', i === steps.length - 1);
        assert.equal(new Set(step.state.queue.map(c => c.row * 7 + c.column)).size, step.state.queue.length);
        for (const caption of step.state.visual.cellCaptions) assert.equal(caption.text, `d=${step.state.distances[caption.row * 7 + caption.column]}`);
        if (i < steps.length - 1) { assert.equal(step.state.found, null); assert.equal(step.state.visual.result, null); }
    }
    const no = all(gridBfsPresets.blocked).at(-1).state, same = all(gridBfsPresets.same).at(-1).state;
    assert.equal(no.found, false); assert.deepEqual(no.path, []); assert.equal(no.queue.length, 0); assert.deepEqual(no.visual.result, { cells: [], path: [] });
    assert.equal(same.found, true); assert.deepEqual(same.path, [point(0, 0)]); assert.equal(same.visual.grid.values[0], 'S=T');
    assert.deepEqual(same.counters, { discovered: 1, dequeued: 1 });
});

test('grid BFS example: shortest paths agree with independent relaxation for every 3×2 obstacle map and open endpoint pair', () => {
    let cases = 0;
    for (let mask = 0; mask < 64; mask++) for (let start = 0; start < 6; start++) for (let target = 0; target < 6; target++) {
        if ((mask & (1 << start)) || (mask & (1 << target))) continue;
        const cells = [0, 1].map(r => [0, 1, 2].map(c => mask & (1 << (r * 3 + c)) ? '#' : '.').join(''));
        const input = { cells, start: point(Math.floor(start / 3), start % 3), target: point(Math.floor(target / 3), target % 3) };
        const result = all(input).at(-1).state, expected = distance(input); cases++;
        assert.equal(result.found, Number.isFinite(expected));
        if (!result.found) { assert.deepEqual(result.path, []); continue; }
        assert.equal(result.path.length - 1, expected); assert.deepEqual(result.path[0], input.start); assert.deepEqual(result.path.at(-1), input.target);
        assert.equal(new Set(result.path.map(c => c.row * 3 + c.column)).size, result.path.length);
        result.path.forEach((cell, i) => {
            assert.equal(cells[cell.row][cell.column], '.'); assert.equal(result.distances[cell.row * 3 + cell.column], i);
            if (i) assert.equal(Math.abs(cell.row - result.path[i - 1].row) + Math.abs(cell.column - result.path[i - 1].column), 1);
        });
    }
    assert.equal(cases, 672);
});

test('grid BFS example: factory owns mutable inputs, independent snapshots and fresh lazy runs; early return terminates', () => {
    const input = { cells: ['...', '...'], start: point(0, 0), target: point(1, 2) }, source = createGridBfsSource(input);
    input.cells.fill('###'); input.start.row = 1; input.target.column = 0;
    const iterator = source(), first = iterator.next().value, serialized = JSON.stringify(first);
    assert.equal(first.state.counters.discovered, 0); assert.equal(first.state.phase, 'start'); iterator.next();
    assert.deepEqual(iterator.return(), { done: true, value: undefined }); assert.equal(iterator.next().done, true);
    const a = [...source()], b = [...source()]; assert.deepEqual(a, b); assert.notEqual(a[0].state.visual, b[0].state.visual);
    assert.equal(a.at(-1).state.path.length - 1, 3); assert.equal(JSON.stringify(first), serialized); frozen(first);
});

test('grid BFS example: stock Canvas paints precisely the final path green, hides it on rewind, and handles no/zero-move paths', () => {
    const steps = all(gridBfsPresets.passages), drawing = createGridRenderer({ theme: 'dark', presentCell: ({ value }) => ({ label: value }) });
    const final = steps.at(-1).state;
    assert.equal(selected(paint(endpoint(final), drawing)).length, 11);
    const middle = paint({ previous: steps.at(-2).state, current: final, progress: .5 }, drawing);
    assert.deepEqual(middle.calls('stroke').filter(c => c.state.strokeStyle === '#fbbf24').map(c => c.state.globalAlpha), [.5]);
    for (const step of steps.slice(0, -1).reverse()) assert.equal(selected(paint(endpoint(step.state), drawing)).length, 0);
    for (const [preset, count] of [[gridBfsPresets.blocked, 0], [gridBfsPresets.same, 1]]) {
        const env = paint(endpoint(all(preset).at(-1).state), drawing);
        assert.equal(selected(env).length, count); assert.equal(env.calls('stroke').length, 0);
    }
});

test('grid BFS example: real Player Pause, bounded replay/history seek, Restart, consumption and cleanup', async () => {
    for (const mode of ['generator', 'history']) {
        const env = dom(), host = env.container(), options = prepareGridSession(mode, gridBfsPresets.passages);
        let runs = 0, reads = 0, closes = 0, rendered;
        if (mode === 'generator') {
            const original = options.stepSource;
            options.stepSource = function* () { runs++; try { for (const step of original()) { reads++; yield step; } } finally { closes++; } };
        } else {
            const original = options.history;
            options.history = () => { runs++; const states = original(); reads += states.length; closes++; return states; };
        }
        const player = new Player(host, { ...options, render: frame => { rendered = paint(frame); } });
        assert.equal(runs, 0); player.start(); const initial = player.frame.current;
        assert.equal(reads, mode === 'generator' ? 1 : 68);
        player.play(); env.scheduler.tick(0); env.scheduler.tick(100); player.pause();
        const paused = player.frame; env.scheduler.tick(1000); assert.equal(player.frame, paused);
        for (let i = 0; i < 75 && player.status.phase !== 'finished'; i++) player.next();
        assert.equal(player.status.phase, 'finished'); assert.equal(selected(rendered).length, 11);
        assert.equal(reads, 68); assert.equal(closes, 1); const final = player.frame.current;
        // History's first Previous can leave the final hold at the same state.
        for (let i = 0; i < 3 && player.frame.current === final; i++) player.previous();
        assert.equal(player.frame.current.found, null); assert.equal(selected(rendered).length, 0);
        player.next(); assert.equal(player.frame.current, final); assert.equal(selected(rendered).length, 11); assert.equal(reads, 68);
        if (mode === 'history') {
            player.seek(timing.stepDurationMs * 66.5); assert.equal(player.frame.progress, .5);
            assert.deepEqual(rendered.calls('stroke').filter(c => c.state.strokeStyle === '#fbbf24').map(c => c.state.globalAlpha), [.5]);
            player.seek(0); assert.equal(player.frame.current, initial);
        } else {
            assert.equal(player.status.rewindStartIndex, 68 - gridRewindCapacity);
            for (let i = 0; i < 75; i++) player.previous();
            assert.equal(player.frame.stepIndex, 68 - gridRewindCapacity); assert.equal(reads, 68);
        }
        player.restart(); assert.deepEqual(player.frame.current, initial); assert.notEqual(player.frame.current, initial);
        assert.equal(runs, 2); assert.equal(selected(rendered).length, 0);
        player.dispose(); player.dispose(); assert.equal((await player.closed).errorCount, 0); assert.equal(closes, 2);
        assert.equal(env.scheduler.size, 0); assert.equal(env.timers.size, 0); assert.equal(host.children.length, 0);
    }
});

test('grid BFS example: validate before session replacement, share size limits and revalidate mode changes', () => {
    const good = { cells: ['..'], start: point(0, 0), target: point(0, 1) };
    for (const mode of [null, '', 'stream', 'History', {}, undefined]) assert.throws(() => prepareGridSession(mode, good), RangeError);
    for (const cells of [[], [''], ['..', '.'], ['x.'], [2], new Array(2)]) assert.throws(() => createGridBfsSource({ ...good, cells }));
    for (const cell of [null, point(-1, 0), point(0, 2), point(.5, 0), point(0, NaN)])
        for (const name of ['start', 'target']) assert.throws(() => createGridBfsSource({ ...good, [name]: cell }), RangeError);
    assert.throws(() => createGridBfsSource({ ...good, cells: ['.#'] }), /open cell/);
    const input = { cells: ['.'.repeat(limits.history + 1)], start: point(0, 0), target: point(0, limits.history) };
    const source = createGridBfsSource(input), active = source(); active.next(); const before = active.next();
    assert.throws(() => source('history'), /at most 64/); assert.throws(() => prepareGridSession('history', input), /at most 64/);
    assert.equal(active.next().value.index, before.value.index + 1); active.return();
    assert.throws(() => createGridBfsSource({ ...input, cells: ['.'.repeat(limits.generator + 1)] }), /at most 2000/);
    assert.equal(prepareGridSession('generator', good).stepDurationMs, timing.stepDurationMs);
});

test('grid BFS example: public imports, accessible Canvas and discoverable old/new examples', async () => {
    const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
    const [html, index, old, algorithm, page, session, en, ru] = await Promise.all(['examples/grid-player.html', 'examples/index.html', 'examples/maze.html',
        'examples/grid-player-algorithm.mjs', 'examples/grid-player-page.mjs', 'examples/grid-player-session.mjs', 'docs/examples.md', 'docs/ru/examples.md'].map(read));
    const map = JSON.parse(html.match(/<script type="importmap">([^<]+)<\/script>/)[1]).imports;
    for (const entry of ['grid', 'canvas/grid', 'player', 'canvas/viewport']) assert.ok(map['@grundyjs/algiviz/' + entry]);
    assert.ok(!/from ['"][^'"]*(?:\/src\/|\/dist\/)/.test(algorithm + page + session));
    assert.match(html, /href="\.\/maze.html"/); assert.match(html, /canvas[^>]+aria-label=/); assert.match(html, /require @grundyjs\/algiviz 1\.3\.0 or newer/);
    assert.match(index, /href="\.\/grid-player.html"/); assert.match(index, /href="\.\/maze.html"/);
    assert.match(old, /maze-demo\.mjs/); assert.match(old, /BFS/); assert.match(old, /DFS/);
    assert.match(session, /player-settings\.mjs/); assert.match(page, /pagehide/); assert.match(page, /pageshow/);
    for (const text of [en, ru]) { assert.match(text, /examples\/grid-player.html/); assert.match(text, /examples\/maze.html/); }
});
