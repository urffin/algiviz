import { limits } from './player-settings.mjs';

export const EMPTY = -1, WALL = -2;
export const sandWorld = Object.freeze({ columns: 64, rows: 54 });
// Integer cell snapshots are cheaper than the vector-based examples. Budgets are
// derived from the shared example defaults, not constraints of the library.
export const sandLimits = Object.freeze({ history: limits.history * 8, generator: limits.generator, ticks: 360 });
export const sandTiming = Object.freeze({ stepDurationMs: 65, finalHoldMs: 800 });
export const sandPresets = Object.freeze({ funnel: 'Воронка с затвором', shelves: 'Полки', passages: 'Два прохода', empty: 'Пустая коробка' });
const { columns: C, rows: R } = sandWorld;
export const gateCells = Object.freeze(Array.from({ length: 6 }, (_, x) => 34 * C + 29 + x));
export function sandHash(seed, tick, id, salt = 0) {
    let n = (seed ^ Math.imul(tick + 1, 0x9e3779b1) ^ Math.imul(id + 1, 0x85ebca6b) ^ salt) >>> 0;
    n = Math.imul(n ^ n >>> 16, 0x7feb352d);
    n = Math.imul(n ^ n >>> 15, 0x846ca68b);
    return (n ^ n >>> 16) >>> 0;
}
function boundary(index) {
    const x = index % C, y = Math.floor(index / C);
    return x === 0 || x === C - 1 || y === 0 || y === R - 1;
}
export function presetWalls(preset) {
    if (!Object.hasOwn(sandPresets, preset)) throw new RangeError('Неизвестная сцена.');
    const cells = Array.from({ length: C * R }, (_, index) => boundary(index) ? WALL : EMPTY);
    const wall = (x, y) => { cells[y * C + x] = WALL; };
    if (preset === 'funnel') {
        for (let y = 1; y < 13; y++) { wall(8, y); wall(55, y); }
        for (let i = 0; i <= 20; i++) { wall(8 + i, 13 + i); wall(55 - i, 13 + i); }
        for (const index of gateCells) cells[index] = WALL;
    } else if (preset === 'shelves') {
        for (let x = 1; x <= 43; x++) wall(x, 15);
        for (let x = 20; x < C - 1; x++) wall(x, 27);
    } else if (preset === 'passages') {
        for (let x = 1; x < C - 1; x++) if (!(x >= 17 && x <= 21) && !(x >= 42 && x <= 46)) wall(x, 22);
    }
    return cells;
}
function freezeState(config, cells, nextId, tick = 0, moved = 0) {
    return Object.freeze({ config, cells: Object.freeze(cells), nextId, tick, moved });
}
export function createSand(input = {}, mode = 'history') {
    if (!Object.hasOwn(sandLimits, mode) || !['history', 'generator'].includes(mode)) throw new RangeError('Неизвестный режим.');
    const { seed = 42, ticks = 280, preset = 'funnel' } = input;
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Seed: целое от 0 до 4294967295.');
    if (!Number.isInteger(ticks) || ticks < 1 || ticks > sandLimits.ticks) throw new RangeError(`Такты: от 1 до ${sandLimits.ticks}.`);
    if (!Object.hasOwn(sandPresets, preset)) throw new RangeError('Неизвестная сцена.');
    let cells, count, nextId;
    if (input.cells !== undefined) {
        if (!Array.isArray(input.cells) || input.cells.length !== C * R) throw new RangeError('Неверный размер поля.');
        cells = [...input.cells];
        const ids = new Set();
        for (let i = 0; i < cells.length; i++) {
            const value = cells[i];
            if (!Number.isInteger(value) || value < WALL || value > 0xfffffffe || (boundary(i) && value !== WALL))
                throw new RangeError('Неверная клетка или открытая граница.');
            if (value >= 0) { if (ids.has(value)) throw new RangeError('Повторяется ID песчинки.'); ids.add(value); }
        }
        count = ids.size;
        nextId = input.nextId ?? Math.max(-1, ...ids) + 1;
        if (!Number.isInteger(nextId) || nextId < Math.max(-1, ...ids) + 1 || nextId > 0xffffffff)
            throw new RangeError('Неверный следующий ID.');
    } else {
        count = input.count ?? 320;
        if (!Number.isInteger(count) || count < 0 || count > sandLimits[mode]) throw new RangeError(`Песчинки: от 0 до ${sandLimits[mode]}.`);
        cells = presetWalls(preset);
        const free = cells.flatMap((value, index) => value === EMPTY ? [index] : []);
        if (count > free.length) throw new RangeError('В сцене недостаточно свободных клеток.');
        const reservoir = free.filter(index => Math.floor(index / C) <= 11 && index % C >= 8 && index % C <= 55);
        const pool = count <= reservoir.length ? reservoir : free.slice(0, Math.max(count, Math.min(free.length, (C - 2) * 11)));
        for (let i = pool.length - 1; i > 0; i--) {
            const j = sandHash(seed, 0, i) % (i + 1); [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        for (let id = 0; id < count; id++) cells[pool[id]] = id;
        nextId = count;
    }
    if (count > sandLimits[mode]) throw new RangeError(`В этом режиме максимум ${sandLimits[mode]} песчинок. Сцена сохранена.`);
    return freezeState(Object.freeze({ seed, ticks, preset, count, ...sandWorld }), cells, nextId);
}
function proposal(state, from) {
    const id = state.cells[from], below = from + C;
    const choices = [below, below - 1, below + 1];
    if (state.cells[below] === EMPTY) return { id, from, to: below, rule: 'fall', choices };
    // A diagonal move may not cut through a solid wall at its side.
    const available = [below - 1, below + 1].filter(to => state.cells[to] === EMPTY && state.cells[from + Math.sign(to - below)] !== WALL);
    if (!available.length) return { id, from, to: from, rule: 'rest', choices };
    return { id, from, to: available[sandHash(state.config.seed, state.tick, id) % available.length], rule: 'slide', choices };
}
export function planSandTick(state) {
    const proposals = [], winners = new Map();
    for (let from = 0; from < state.cells.length; from++) if (state.cells[from] >= 0) {
        const p = proposal(state, from); proposals.push(p);
        if (p.to === from) continue;
        const other = winners.get(p.to);
        const priority = sandHash(state.config.seed, state.tick, p.id, p.to);
        const oldPriority = other && sandHash(state.config.seed, state.tick, other.id, other.to);
        if (!other || priority < oldPriority || (priority === oldPriority && p.id < other.id)) winners.set(p.to, p);
    }
    return { proposals, winners };
}
export function advanceSand(state) {
    const { winners } = planSandTick(state), cells = [...state.cells];
    for (const p of winners.values()) cells[p.from] = EMPTY;
    for (const p of winners.values()) cells[p.to] = p.id;
    return freezeState(state.config, cells, state.nextId, state.tick + 1, winners.size);
}
export function analyzeSand(state, id) {
    const { proposals, winners } = planSandTick(state), p = proposals.find(p => p.id === id);
    if (!p) throw new RangeError('Выберите песчинку на поле.');
    const winner = p.to === p.from ? null : winners.get(p.to);
    const moved = winner?.id === id;
    const neighbors = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = p.from % C + dx, y = Math.floor(p.from / C) + dy, index = y * C + x;
        neighbors.push(Object.freeze({ dx, dy, index, value: x < 0 || x >= C || y < 0 || y >= R ? WALL : state.cells[index] }));
    }
    return Object.freeze({ id, from: p.from, proposed: p.to, to: moved ? p.to : p.from,
        rule: p.rule, moved, winnerId: winner?.id ?? null, choices: Object.freeze(p.choices), neighbors: Object.freeze(neighbors) });
}
export function paintSand(state, indices, material) {
    if (!['sand', 'wall', 'erase'].includes(material)) throw new RangeError('Неизвестная кисть.');
    const cells = [...state.cells]; let nextId = state.nextId;
    for (const index of new Set(indices)) {
        if (!Number.isInteger(index) || index < 0 || index >= cells.length || boundary(index)) continue;
        if (material === 'erase') cells[index] = EMPTY;
        else if (cells[index] === EMPTY) cells[index] = material === 'wall' ? WALL : nextId++;
    }
    return createSand({ ...state.config, cells, nextId }, 'generator');
}
export function sandBrush(from, to, radius = 1) {
    if (![from, to].every(i => Number.isInteger(i) && i >= 0 && i < C * R) || ![0, 1, 2].includes(radius))
        throw new RangeError('Неверная кисть.');
    let x = from % C, y = Math.floor(from / C);
    const tx = to % C, ty = Math.floor(to / C), dx = Math.abs(tx - x), dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1, sy = y < ty ? 1 : -1, indices = new Set(); let error = dx + dy;
    while (true) {
        for (let oy = -radius; oy <= radius; oy++) for (let ox = -radius; ox <= radius; ox++)
            if (x + ox >= 0 && x + ox < C && y + oy >= 0 && y + oy < R) indices.add((y + oy) * C + x + ox);
        if (x === tx && y === ty) break;
        const twice = 2 * error;
        if (twice >= dy) { error += dy; x += sx; }
        if (twice <= dx) { error += dx; y += sy; }
    }
    return [...indices];
}
function* stepsFrom(initial) {
    let state = initial;
    yield Object.freeze({ index: 0, state, event: Object.freeze({ kind: 'start' }) });
    for (let index = 1; index <= initial.config.ticks; index++) {
        state = advanceSand(state);
        yield Object.freeze({ index, state, event: Object.freeze({ kind: index === initial.config.ticks ? 'finished' : 'move' }) });
    }
}
export function sandSteps(input = {}, mode = 'history') { return stepsFrom(createSand(input, mode)); }
export function createSandSource(input = {}, mode = 'history') {
    const initial = createSand(input, mode);
    return (nextMode = mode) => {
        if (!['history', 'generator'].includes(nextMode)) throw new RangeError('Неизвестный режим.');
        if (initial.config.count > sandLimits[nextMode]) throw new RangeError(`В этом режиме максимум ${sandLimits[nextMode]} песчинок.`);
        return stepsFrom(initial);
    };
}
