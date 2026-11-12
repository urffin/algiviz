import { limits } from './player-settings.mjs';

// Application-owned simulation, not a built-in AlgiViz algorithm. Units are
// world units per simulation tick, independent of playback speed and viewport.
export const boidsWorld = Object.freeze({ width: 800, height: 500 });
export const boidsTiming = Object.freeze({ stepDurationMs: 50, finalHoldMs: 1000 });
export const boidsLimits = Object.freeze({ history: limits.history, generator: Math.min(limits.generator, 192), ticks: 600 });
export const boidsPhysics = Object.freeze({ neighborRadius: 90, separationRadius: 26, maxForce: 0.045,
    desiredSpeed: 2.3, minSpeed: 1.2, maxSpeed: 2.8, birdRadius: 3 });
const circle = (id, x, y, radius) => Object.freeze({ id, type: 'circle', x, y, radius });
const wall = (id, ax, ay, bx, by, radius) => Object.freeze({ id, type: 'capsule', ax, ay, bx, by, radius });
export const boidsObstacles = Object.freeze({
    none: Object.freeze([]),
    circle: Object.freeze([circle('circle', 400, 250, 58)]),
    islands: Object.freeze([circle('island-a', 270, 160, 38), circle('island-b', 425, 330, 48), circle('island-c', 565, 175, 42)]),
    wall: Object.freeze([wall('wall', 400, 110, 400, 390, 18)]),
    gate: Object.freeze([wall('gate-top', 400, 35, 400, 190, 16), wall('gate-bottom', 400, 310, 400, 465, 16)])
});
const vector = (x = 0, y = 0) => Object.freeze({ x, y });
const wrap = (x, length) => (x % length + length) % length;
export const boidsDelta = (x, length) => x > length / 2 ? x - length : x < -length / 2 ? x + length : x;

export function validateBoids(input = {}, mode = 'history') {
    if (!['history', 'generator'].includes(mode)) throw new RangeError('Unknown playback mode.');
    const { count = 64, seed = 93717, ticks = boidsLimits.ticks, obstacle = 'circle' } = input;
    if (!Number.isInteger(count) || count < 1 || count > boidsLimits[mode])
        throw new RangeError(`Use 1–${boidsLimits[mode]} birds in ${mode} mode.`);
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Seed must be an integer from 0 to 4294967295.');
    if (!Number.isInteger(ticks) || ticks < 1 || ticks > boidsLimits.ticks) throw new RangeError(`Use 1–${boidsLimits.ticks} simulation ticks.`);
    if (!Object.hasOwn(boidsObstacles, obstacle)) throw new RangeError('Unknown obstacle preset.');
    const rules = {};
    for (const key of ['separation', 'alignment', 'cohesion']) {
        const value = input.rules?.[key] ?? true;
        if (typeof value !== 'boolean') throw new TypeError('Rule switches must be boolean.');
        rules[key] = value;
    }
    return Object.freeze({ count, seed, ticks, obstacle, obstacles: boidsObstacles[obstacle], rules: Object.freeze(rules) });
}

// Signed distance and outward normal to a periodic circle or capsule. Testing
// image copies also works at a wrapped world's seam, including long capsules.
export function obstacleContact(x, y, obstacle) {
    let nearest = null;
    for (const ix of [-1, 0, 1]) for (const iy of [-1, 0, 1]) {
        const tx = ix * boidsWorld.width, ty = iy * boidsWorld.height;
        let px, py, fallbackX = 1, fallbackY = 0;
        if (obstacle.type === 'circle') { px = obstacle.x + tx; py = obstacle.y + ty; }
        else {
            const ax = obstacle.ax + tx, ay = obstacle.ay + ty;
            const dx = obstacle.bx - obstacle.ax, dy = obstacle.by - obstacle.ay;
            const square = dx * dx + dy * dy;
            const t = square ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / square)) : 0;
            px = ax + t * dx; py = ay + t * dy;
            if (square) { fallbackX = dy / Math.sqrt(square); fallbackY = -dx / Math.sqrt(square); }
        }
        const dx = x - px, dy = y - py, distance = Math.hypot(dx, dy);
        const hit = { distance: distance - obstacle.radius,
            nx: distance > 1e-9 ? dx / distance : fallbackX,
            ny: distance > 1e-9 ? dy / distance : fallbackY };
        if (!nearest || hit.distance < nearest.distance) nearest = hit;
    }
    return nearest;
}

export function createBoids(input = {}, mode = 'history') {
    const config = validateBoids(input, mode);
    let seed = config.seed;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const birds = Array.from({ length: config.count }, (_, id) => {
        let x, y;
        do { x = random() * boidsWorld.width; y = random() * boidsWorld.height; }
        while (config.obstacles.some(o => obstacleContact(x, y, o).distance < boidsPhysics.birdRadius + 8));
        const angle = random() * 2 * Math.PI, speed = 1.8 + random() * 0.8;
        return Object.freeze({ id, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
    });
    return Object.freeze({ config, tick: 0, birds: Object.freeze(birds) });
}

function steering(x, y, bird, weight) {
    const length = Math.hypot(x, y);
    if (length < 1e-9) return vector();
    let sx = x / length * boidsPhysics.desiredSpeed - bird.vx;
    let sy = y / length * boidsPhysics.desiredSpeed - bird.vy;
    const size = Math.hypot(sx, sy);
    if (size > boidsPhysics.maxForce) { sx *= boidsPhysics.maxForce / size; sy *= boidsPhysics.maxForce / size; }
    return vector(sx * weight, sy * weight);
}

function decision(state, bird) {
    let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0;
    const neighbors = [], close = [];
    for (const other of state.birds) {
        if (other.id === bird.id) continue;
        const dx = boidsDelta(other.x - bird.x, boidsWorld.width), dy = boidsDelta(other.y - bird.y, boidsWorld.height);
        const dd = dx * dx + dy * dy;
        if (dd < boidsPhysics.neighborRadius ** 2) {
            neighbors.push(other.id); ax += other.vx; ay += other.vy; cx += dx; cy += dy;
            if (dd < boidsPhysics.separationRadius ** 2) {
                close.push(other.id);
                if (dd > 1e-9) { sx -= dx / dd; sy -= dy / dd; }
                else sx += bird.id < other.id ? -1 : 1;
            }
        }
    }
    const rules = state.config.rules;
    const separation = rules.separation && close.length ? steering(sx / close.length, sy / close.length, bird, 1.9) : vector();
    const alignment = rules.alignment && neighbors.length ? steering(ax / neighbors.length, ay / neighbors.length, bird, 1) : vector();
    const cohesion = rules.cohesion && neighbors.length ? steering(cx / neighbors.length, cy / neighbors.length, bird, 0.65) : vector();
    let ox = 0, oy = 0;
    for (const obstacle of state.config.obstacles) {
        const here = obstacleContact(bird.x, bird.y, obstacle);
        const ahead = obstacleContact(bird.x + bird.vx * 12, bird.y + bird.vy * 12, obstacle);
        if (here.distance < 38 || ahead.distance < 25) {
            const hit = ahead.distance < here.distance ? ahead : here;
            const turn = bird.vx * -hit.ny + bird.vy * hit.nx >= 0 ? 1 : -1;
            const force = steering(hit.nx * 2 - hit.ny * turn * 0.7, hit.ny * 2 + hit.nx * turn * 0.7, bird, 4);
            ox += force.x; oy += force.y;
        }
    }
    const obstacle = vector(ox, oy);
    const total = vector(separation.x + alignment.x + cohesion.x + ox, separation.y + alignment.y + cohesion.y + oy);
    return { neighbors, close, separation, alignment, cohesion, obstacle, total };
}

function integrate(state, bird, force) {
    let vx = bird.vx + force.x, vy = bird.vy + force.y;
    const speed = Math.hypot(vx, vy), limited = Math.max(boidsPhysics.minSpeed, Math.min(boidsPhysics.maxSpeed, speed));
    if (speed < 1e-9) { vx = limited; vy = 0; }
    else { vx *= limited / speed; vy *= limited / speed; }
    let x = bird.x + vx, y = bird.y + vy, contact = false;
    // The presets do not overlap. Repeating allows safe contact correction even
    // near two pieces; collision response is distinct from steering forces.
    for (let pass = 0; pass < 3; pass++) for (const obstacle of state.config.obstacles) {
        const hit = obstacleContact(x, y, obstacle);
        if (hit.distance < boidsPhysics.birdRadius) {
            x += hit.nx * (boidsPhysics.birdRadius - hit.distance + 1e-7);
            y += hit.ny * (boidsPhysics.birdRadius - hit.distance + 1e-7);
            const inward = vx * hit.nx + vy * hit.ny;
            if (inward < 0) { vx -= 2 * inward * hit.nx; vy -= 2 * inward * hit.ny; }
            contact = true;
        }
    }
    return { bird: Object.freeze({ id: bird.id, x: wrap(x, boidsWorld.width), y: wrap(y, boidsWorld.height), vx, vy }), contact };
}

export function analyzeBoid(state, id) {
    const bird = state.birds.find(b => b.id === id);
    if (!bird) throw new RangeError('Choose a bird from the applied flock.');
    const d = decision(state, bird), result = integrate(state, bird, d.total);
    return Object.freeze({ id, ...d, neighbors: Object.freeze(d.neighbors), close: Object.freeze(d.close),
        velocity: vector(bird.vx, bird.vy), nextVelocity: vector(result.bird.vx, result.bird.vy),
        nextPosition: vector(result.bird.x, result.bird.y), contact: result.contact });
}

export function advanceBoids(state) {
    // Every decision reads the same immutable input, never partially updated birds.
    const birds = state.birds.map(bird => integrate(state, bird, decision(state, bird).total).bird);
    return Object.freeze({ config: state.config, tick: state.tick + 1, birds: Object.freeze(birds) });
}

export function* boidsSteps(input = {}, mode = 'history') {
    let state = createBoids(input, mode);
    yield Object.freeze({ index: 0, state, event: Object.freeze({ kind: 'start' }) });
    for (let tick = 1; tick <= state.config.ticks; tick++) {
        state = advanceBoids(state);
        yield Object.freeze({ index: tick, state, event: Object.freeze({ kind: tick === state.config.ticks ? 'finished' : 'move' }) });
    }
}

export function createBoidsSource(input = {}, mode = 'history') {
    const config = validateBoids(input, mode);
    return (nextMode = mode) => {
        validateBoids(config, nextMode); // Validate before replacing the current player.
        return boidsSteps(config, nextMode);
    };
}
