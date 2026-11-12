import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, createTimeline } from '@grundyjs/algiviz/playback';
import { createSceneFrame } from '@grundyjs/algiviz/scene';
import { createBoids, advanceBoids, analyzeBoid, boidsSteps, createBoidsSource, validateBoids,
    obstacleContact, boidsObstacles, boidsLimits, boidsPhysics, boidsTiming } from '../examples/boids-algorithm.mjs';
import { boidsScene, createBoidsRenderer, interpolateBoid } from '../examples/boids-scene.mjs';
import { nextDelta, stepTime, timing } from '../examples/player-settings.mjs';

const near = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const freeze = value => {
    if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(freeze); }
};
const stateWith = (birds, rules = {}, obstacle = 'none') => Object.freeze({
    config: validateBoids({ count: birds.length, rules, obstacle, ticks: 3 }), tick: 0,
    birds: Object.freeze(birds.map((b, id) => Object.freeze({ id, vx: 2, vy: 0, ...b })))
});

test('boids has deterministic independent immutable snapshots, fixed IDs and bounded motion for every preset/rule combination', () => {
    for (const obstacle of Object.keys(boidsObstacles)) for (let mask = 0; mask < 8; mask++) {
        const rules = Object.fromEntries(['separation', 'alignment', 'cohesion'].map((key, i) => [key, !!(mask & (1 << i))]));
        const input = { count: 12, ticks: 35, seed: mask, rules, obstacle };
        const steps = [...boidsSteps(input)];
        assert.deepEqual(steps, [...boidsSteps(input)]);
        assert.equal(steps.length, 36); assert.equal(steps.at(-1).event.kind, 'finished');
        const original = JSON.stringify(steps[0]);
        for (const [index, step] of steps.entries()) {
            assert.equal(step.index, index); assert.equal(step.state.tick, index); freeze(step);
            assert.deepEqual(step.state.birds.map(b => b.id), Array.from({ length: 12 }, (_, i) => i));
            for (const bird of step.state.birds) {
                assert.ok(Object.values(bird).every(Number.isFinite));
                assert.ok(bird.x >= 0 && bird.x < 800 && bird.y >= 0 && bird.y < 500);
                const speed = Math.hypot(bird.vx, bird.vy);
                assert.ok(speed >= boidsPhysics.minSpeed - 1e-9 && speed <= boidsPhysics.maxSpeed + 1e-9);
                for (const o of boidsObstacles[obstacle]) assert.ok(obstacleContact(bird.x, bird.y, o).distance >= 3 - 1e-6);
            }
            if (index) {
                assert.notEqual(step.state.birds, steps[index - 1].state.birds);
                assert.notEqual(step.state.birds[0], steps[index - 1].state.birds[0]);
            }
        }
        assert.equal(JSON.stringify(steps[0]), original);
    }
});

test('known neighbors and weighted vectors agree with simple geometry, including wrapped seams and coincident birds', () => {
    const s = stateWith([{ x: 100, y: 100 }, { x: 110, y: 100 }, { x: 799, y: 499 }]);
    const a = analyzeBoid(s, 0);
    assert.deepEqual(a.neighbors, [1]); assert.deepEqual(a.close, [1]);
    near(a.separation.x, -0.045 * 1.9); near(a.separation.y, 0);
    near(a.alignment.x, 0.045); near(a.cohesion.x, 0.045 * 0.65);
    near(a.total.x, a.separation.x + a.alignment.x + a.cohesion.x);
    const seam = stateWith([{ x: 2, y: 250 }, { x: 798, y: 250 }]);
    const b = analyzeBoid(seam, 0);
    assert.deepEqual(b.neighbors, [1]); assert.ok(b.cohesion.x < 0); assert.ok(b.separation.x > 0);
    const coincide = stateWith([{ x: 300, y: 300 }, { x: 300, y: 300 }]);
    assert.ok(analyzeBoid(coincide, 0).separation.x < 0);
    assert.ok(analyzeBoid(coincide, 1).separation.x > 0);
    const alone = analyzeBoid(stateWith([{ x: 1, y: 1 }]), 0);
    assert.deepEqual(alone.neighbors, []); assert.deepEqual(alone.total, { x: 0, y: 0 }); freeze(alone);
});

test('analysis predicts the actual synchronous update and update order cannot change the result', () => {
    for (const obstacle of Object.keys(boidsObstacles)) {
        let state = createBoids({ count: 18, obstacle, seed: 42 });
        for (let i = 0; i < 20; i++) {
            const after = advanceBoids(state);
            for (const bird of state.birds) {
                const a = analyzeBoid(state, bird.id), next = after.birds.find(b => b.id === bird.id);
                near(next.vx, a.nextVelocity.x); near(next.vy, a.nextVelocity.y);
                near(next.x, a.nextPosition.x); near(next.y, a.nextPosition.y);
                near(a.total.x, a.separation.x + a.alignment.x + a.cohesion.x + a.obstacle.x);
                near(a.total.y, a.separation.y + a.alignment.y + a.cohesion.y + a.obstacle.y);
            }
            const reverse = advanceBoids({ ...state, birds: [...state.birds].reverse() });
            for (const bird of after.birds) {
                const other = reverse.birds.find(b => b.id === bird.id);
                for (const key of ['x', 'y', 'vx', 'vy']) near(bird[key], other[key]);
            }
            state = after;
        }
    }
});

test('disabled rules preserve ballistic motion and speed limiting/contact response are explicit', () => {
    const rules = { separation: false, alignment: false, cohesion: false };
    const s = stateWith([{ x: 799, y: 499, vx: 2, vy: 1 }], rules);
    const next = advanceBoids(s).birds[0]; near(next.x, 1); near(next.y, 0); near(next.vx, 2); near(next.vy, 1);
    const fast = analyzeBoid(stateWith([{ x: 100, y: 100, vx: 20, vy: 0 }], rules), 0);
    near(fast.nextVelocity.x, 2.8);
    const contact = stateWith([{ x: 341, y: 250, vx: 2.8, vy: 0 }], rules, 'circle');
    const a = analyzeBoid(contact, 0);
    assert.ok(a.contact); assert.ok(a.obstacle.x !== 0 || a.obstacle.y !== 0);
    assert.ok(obstacleContact(a.nextPosition.x, a.nextPosition.y, boidsObstacles.circle[0]).distance >= 3 - 1e-6);
    near(obstacleContact(400, 250, boidsObstacles.circle[0]).distance, -58);
    near(obstacleContact(400, 250, boidsObstacles.wall[0]).distance, -18);
    assert.ok(boidsObstacles.gate.every(o => obstacleContact(400, 250, o).distance > 3));
});

test('input validation isolates applied settings, respects shared limits and permits finite lazy cancellation', () => {
    for (const input of [{ count: 0 }, { count: 65 }, { count: 1.5 }, { seed: NaN }, { seed: -1 }, { ticks: 0 }, { ticks: 601 }, { obstacle: 'toString' }, { rules: { separation: 1 } }])
        assert.throws(() => createBoidsSource(input));
    for (const mode of ['toString', 'ticks', 'unknown']) assert.throws(() => validateBoids({}, mode));
    assert.equal(validateBoids({ count: 64 }).count, 64);
    assert.equal(validateBoids({ count: boidsLimits.generator }, 'generator').count, boidsLimits.generator);
    assert.throws(() => validateBoids({ count: boidsLimits.generator + 1 }, 'generator'));
    const input = { count: 12, seed: 0xffffffff, rules: { cohesion: false } };
    const source = createBoidsSource(input); input.rules.cohesion = true; input.seed = 0;
    const iterator = source(), first = iterator.next().value;
    assert.equal(first.state.config.rules.cohesion, false); assert.equal(first.state.config.seed, 0xffffffff);
    iterator.return(); assert.equal(iterator.next().done, true);
    assert.deepEqual(source().next().value, first);
    const large = createBoidsSource({ count: 65 }, 'generator');
    assert.throws(() => large('history')); assert.equal(large('generator').next().value.state.birds.length, 65);
});

test('history and generator agree at transitions, seek nonsequentially and close early without eager simulation', () => {
    const input = { count: 8, ticks: 5, seed: 7, obstacle: 'gate' }, options = { ...boidsTiming, finalHoldMs: 7 };
    const timeline = createTimeline([...boidsSteps(input)], options);
    let consumed = 0, closed = false;
    function* source() { try { for (const step of boidsSteps(input)) { consumed++; yield step; } } finally { closed = true; } }
    const player = createPlayer(source(), { ...options, isTerminal: step => step.event.kind === 'finished' });
    assert.equal(consumed, 1);
    for (let time = 0; time <= timeline.durationMs; time++) {
        const frame = time ? player.advance(1) : player.frame;
        assert.deepEqual(frame, timeline.sample(time));
    }
    assert.ok(player.finished && closed); player.dispose();
    const p = createPlayer(source(), { ...options, isTerminal: step => step.event.kind === 'finished' });
    const prior = consumed; p.advance(1); assert.ok(consumed <= prior + 1); p.dispose(); assert.ok(closed);
    assert.equal(timeline.sample(0).current.tick, 0);
    assert.equal(timeline.sample(250).current.tick, 5);
    assert.equal(timeline.sample(50).current.tick, 1);
});

test('stable scene IDs, inspection neighbors/vectors and finite drawing survive selection, resize, seams and seeking', () => {
    const steps = [...boidsSteps({ count: 8, ticks: 4, obstacle: 'islands' })];
    const timeline = createTimeline(steps, boidsTiming), renderer = createBoidsRenderer();
    const calls = new Set();
    const ctx = new Proxy({ canvas: { width: 960, height: 600 } }, { get(target, key) {
        if (key in target) return target[key];
        return (...args) => { calls.add(key); for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), String(key)); };
    } });
    for (const time of [0, 25, 50, 150, 200, 0, 125, 75]) for (const inspect of [false, true]) for (const selectedId of [0, 7]) {
        const frame = timeline.sample(time), scene = boidsScene(frame.current, { inspect, selectedId });
        freeze(scene); assert.equal(new Set(scene.objects.map(o => o.id)).size, scene.objects.length);
        const resolved = createSceneFrame({ ...frame, previous: scene, current: scene });
        assert.ok(resolved.get(`bird:${selectedId}`));
        assert.equal(scene.objects.filter(o => o.type === 'steering-vector').length, inspect ? 6 : 0);
        if (inspect) {
            const a = analyzeBoid(frame.current, selectedId);
            assert.equal(scene.objects.filter(o => o.type === 'neighbor-link').length, a.neighbors.length);
        }
        for (const width of [288, 640, 1100]) {
            ctx.canvas = { width, height: Math.max(240, width * 0.625) };
            renderer.render(ctx, frame, { inspect, selectedId });
        }
    }
    assert.ok(calls.has('arc') && calls.has('fillText') && calls.has('lineTo'));
    const half = interpolateBoid({ x: 799, y: 499, vx: 2, vy: 2 }, { x: 1, y: 1, vx: 2, vy: 2 }, 0.5);
    near(half.x, 0); near(half.y, 0);
});

test('shared stepping keeps the existing defaults and supports the boids tick duration', () => {
    assert.equal(nextDelta({ progress: 0.5 }), timing.stepDurationMs / 2);
    assert.equal(stepTime(650, 1, 3000), 1300);
    assert.equal(nextDelta({ progress: 0.5 }, boidsTiming), 25);
    assert.equal(stepTime(50, 1, 1300, boidsTiming), 100);
    assert.equal(stepTime(50, -1, 1300, boidsTiming), 0);
});
