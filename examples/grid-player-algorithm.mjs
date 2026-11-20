import { createGridTrace } from '@grundyjs/algiviz/grid';
import { limits } from './player-settings.mjs';

const coordinate = (row, column) => Object.freeze({ row, column });
const passages = Object.freeze(['...#...', '.#.#.#.', '.#...#.', '.###.#.', '.......']);
const preset = (label, cells, target) => Object.freeze({ label, cells, start: coordinate(0, 0), target });
export const gridBfsPresets = Object.freeze({
    passages: preset('Passages · shortest path', passages, coordinate(4, 6)),
    blocked: preset('Divided grid · no path', Object.freeze(['...#...', '...#...', '...#...', '...#...', '...#...']), coordinate(4, 6)),
    same: preset('Start is the target · zero moves', passages, coordinate(0, 0))
});
export const describeCell = cell => `(${cell.row + 1},${cell.column + 1})`;

function validateMode(mode, count) {
    if (mode !== 'history' && mode !== 'generator') throw new RangeError('Choose a playback mode');
    if (count > limits[mode]) throw new RangeError(`This example allows at most ${limits[mode]} cells in ${mode} mode`);
}
// Validate and own inputs before replacing a playback session. Each call of the
// returned factory starts a fresh lazy search; no history is collected here.
export function createGridBfsSource(input, mode = 'generator') {
    validateMode(mode, 0);
    if (!input || !Array.isArray(input.cells) || input.cells.length === 0) throw new TypeError('Provide a nonempty array of grid rows');
    const cells = [...input.cells], rows = cells.length, columns = typeof cells[0] === 'string' ? cells[0].length : 0;
    if (!columns || cells.some(row => typeof row !== 'string' || row.length !== columns || !/^[.#]+$/.test(row)))
        throw new TypeError('Grid rows must be equally long strings containing only . and #');
    validateMode(mode, rows * columns);
    const capture = (cell, name) => {
        if (!cell || !Number.isInteger(cell.row) || !Number.isInteger(cell.column)
            || cell.row < 0 || cell.row >= rows || cell.column < 0 || cell.column >= columns)
            throw new RangeError(`${name} must be inside the grid`);
        if (cells[cell.row][cell.column] === '#') throw new RangeError(`${name} must be an open cell`);
        return coordinate(cell.row, cell.column);
    };
    const problem = Object.freeze({ cells: Object.freeze(cells), rows, columns, start: capture(input.start, 'Start'), target: capture(input.target, 'Target') });
    return (playbackMode = mode) => { validateMode(playbackMode, rows * columns); return search(problem); };
}

// Application-owned, unweighted BFS. Discover on enqueue; stop when T is dequeued.
function* search({ cells, rows, columns, start, target }) {
    const id = cell => cell.row * columns + cell.column;
    const points = Array.from({ length: rows * columns }, (_, i) => coordinate(Math.floor(i / columns), i % columns));
    const startId = id(start), targetId = id(target);
    const values = points.map((p, i) => cells[p.row][p.column] === '#' ? '#'
        : i === startId ? i === targetId ? 'S=T' : 'S' : i === targetId ? 'T' : '');
    const grid = createGridTrace({ rows, columns, values });
    const queue = [], distances = Array(values.length).fill(-1), parents = Array(values.length).fill(-1);
    let head = 0;
    function snapshot(step, phase, message, found = null, path = []) {
        return Object.freeze({ ...step, state: Object.freeze({ visual: step.state, phase, message, start, target, found,
            path: Object.freeze([...path]), queue: Object.freeze(queue.slice(head).map(i => points[i])),
            distances: Object.freeze([...distances]), counters: Object.freeze({ discovered: queue.length, dequeued: head }) }) });
    }
    yield snapshot(grid.start(), 'start', `Find a shortest path from ${describeCell(start)} to ${describeCell(target)}.`);
    distances[startId] = 0; queue.push(startId);
    yield snapshot(grid.mark({ cells: [{ ...start, role: 'queued' }], cellCaptions: [{ ...start, text: 'd=0' }] }),
        'enqueue', `Enqueue the start ${describeCell(start)} at distance 0.`);
    while (head < queue.length) {
        const currentId = queue[head++], current = points[currentId];
        yield snapshot(grid.mark({ cells: [{ ...current, role: 'active' }] }), 'visit', `Dequeue ${describeCell(current)} at distance ${distances[currentId]}.`);
        if (currentId === targetId) {
            const path = [];
            for (let at = targetId; at !== -1; at = parents[at]) path.push(points[at]);
            path.reverse();
            yield snapshot(grid.done({ result: { path } }), 'done',
                `Found a shortest path: ${path.length - 1} moves. The path stays green.`, true, path);
            return;
        }
        // Fixed tie-breaking: north, east, south, west. Every move costs one.
        for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]]) {
            const row = current.row + dr, column = current.column + dc, next = row * columns + column;
            if (row < 0 || row >= rows || column < 0 || column >= columns || cells[row][column] === '#' || distances[next] !== -1) continue;
            distances[next] = distances[currentId] + 1; parents[next] = currentId; queue.push(next);
            const cell = points[next];
            yield snapshot(grid.mark({ cells: [{ ...cell, role: 'queued' }], cellCaptions: [{ ...cell, text: `d=${distances[next]}` }] }),
                'discover', `Discover ${describeCell(cell)} from ${describeCell(current)}; distance ${distances[next]}.`);
        }
        yield snapshot(grid.mark({ cells: [{ ...current, role: 'visited' }] }), 'finish', `Finish ${describeCell(current)}; take the next queued cell.`);
    }
    yield snapshot(grid.done({ result: { path: [] } }), 'done', 'No path: the queue is empty and the target is unreachable.', false);
}
