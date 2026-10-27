import test from "node:test";
import assert from "node:assert/strict";
import {
  createMaze,
  generateMaze,
  iterateMazeGeneration,
  iterateMazeSearch,
  mazePresets,
  createMazeSource,
  validateMazeSize,
} from "../examples/maze-algorithm.mjs";
import {
  createMazeRenderer,
  mazeScene,
  mazeLayout,
} from "../examples/maze-scene.mjs";
import { limits } from "../examples/player-settings.mjs";
import { createPlayer, createTimeline } from "@grundyjs/algiviz/playback";
const finish = (iterator) => {
  let last;
  for (const step of iterator) last = step.state;
  return last;
};
const frozen = (value) => {
  if (value && typeof value === "object") {
    assert.ok(Object.isFrozen(value));
    Object.values(value).forEach(frozen);
  }
};
function neighbors(maze, id) {
  const x = id % maze.width,
    y = Math.floor(id / maze.width),
    result = [];
  if (y > 0 && !(maze.walls[id] & 1)) result.push(id - maze.width);
  if (x + 1 < maze.width && !(maze.walls[id] & 2)) result.push(id + 1);
  if (y + 1 < maze.height && !(maze.walls[id] & 4))
    result.push(id + maze.width);
  if (x > 0 && !(maze.walls[id] & 8)) result.push(id - 1);
  return result;
}
function oracle(maze, start, target, method) {
  const parent = Array(maze.walls.length).fill(-1),
    levels = Array(parent.length).fill(-1);
  levels[start] = 0;
  let found = false;
  if (method === "bfs") {
    const queue = [start];
    while (queue.length) {
      const id = queue.shift();
      if (id === target) {
        found = true;
        break;
      }
      for (const next of neighbors(maze, id))
        if (levels[next] === -1) {
          parent[next] = id;
          levels[next] = levels[id] + 1;
          queue.push(next);
        }
    }
  } else {
    function visit(id) {
      if (id === target) {
        found = true;
        return true;
      }
      for (const next of neighbors(maze, id))
        if (levels[next] === -1) {
          parent[next] = id;
          levels[next] = levels[id] + 1;
          if (visit(next)) return true;
        }
      return false;
    }
    visit(start);
  }
  const path = [];
  if (found) for (let id = target; id !== -1; id = parent[id]) path.push(id);
  return { parent, levels, path: path.reverse(), found };
}
function generationOracle(width, height, seed) {
  const walls = Array(width * height).fill(15),
    seen = new Set(),
    masks = [1, 2, 4, 8],
    opposite = [4, 8, 1, 2];
  let state = BigInt(seed);
  const u = (x) => BigInt.asUintN(32, x);
  const random = () => {
    state = u(state + 0x6d2b79f5n);
    let v = u((state ^ (state >> 15n)) * (state | 1n));
    v = u(v ^ u(v + u((v ^ (v >> 7n)) * (v | 61n))));
    return Number(u(v ^ (v >> 14n))) / 4294967296;
  };
  function visit(id) {
    seen.add(id);
    const dirs = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    const x = id % width,
      y = Math.floor(id / width);
    const next = [
      y > 0 ? id - width : -1,
      x + 1 < width ? id + 1 : -1,
      y + 1 < height ? id + width : -1,
      x > 0 ? id - 1 : -1,
    ];
    for (const d of dirs)
      if (next[d] !== -1 && !seen.has(next[d])) {
        walls[id] &= ~masks[d];
        walls[next[d]] &= ~opposite[d];
        visit(next[d]);
      }
  }
  visit(0);
  return walls;
}
test("Seeded generation matches independent recursive/BigInt oracle and tree invariants", () => {
  for (const [width, height] of [
    [1, 1],
    [1, 7],
    [7, 1],
    [3, 2],
    [7, 5],
  ])
    for (const seed of [0, 2, 42, 4294967295]) {
      const steps = [...iterateMazeGeneration({ width, height, seed })],
        s = steps.at(-1).state,
        n = width * height;
      assert.deepEqual(s.walls, generationOracle(width, height, seed));
      assert.deepEqual(generateMaze({ width, height, seed }).walls, s.walls);
      assert.equal(s.counters.visitedCount, n);
      assert.equal(s.counters.passageCount, n - 1);
      assert.equal(s.counters.directionChecks, 4 * n);
      assert.equal(steps.length, 9 * n + 2);
      assert.deepEqual(s.frontier, []);
      assert.equal(
        s.walls.reduce((sum, _, id) => sum + neighbors(s, id).length, 0) / 2,
        n - 1,
      );
      for (const id of Array.from({ length: n }, (_, i) => i))
        assert.ok(oracle(s, 0, id, "bfs").found);
      for (const [i, step] of steps.entries()) {
        assert.equal(step.index, i);
        frozen(step);
        assert.equal(
          new Set(step.state.frontier).size,
          step.state.frontier.length,
        );
      }
    }
});
test("A larger lazy example finishes generation and both searches without retaining history", () => {
  const input = { width: 25, height: 17, seed: 2 };
  const state = finish(iterateMazeGeneration(input));
  assert.equal(state.counters.visitedCount, 425);
  assert.equal(state.counters.passageCount, 424);
  assert.equal(state.counters.directionChecks, 1700);
  const topology = createMaze(state);
  for (const method of ["bfs", "dfs"]) {
    const result = finish(
      iterateMazeSearch({ topology, start: 0, target: 424, method }),
    );
    const expected = oracle(topology, 0, 424, method);
    assert.deepEqual(result.path, expected.path);
    assert.deepEqual(result.parent, expected.parent);
    frozen(result);
  }
});

test("BFS/DFS match independent queue and recursive search on all 3x2 wall configurations", () => {
  const edges = [
    [0, 1, 2, 8],
    [1, 2, 2, 8],
    [3, 4, 2, 8],
    [4, 5, 2, 8],
    [0, 3, 4, 1],
    [1, 4, 4, 1],
    [2, 5, 4, 1],
  ];
  for (let mask = 0; mask < 128; mask++) {
    const walls = Array(6).fill(15);
    edges.forEach(([a, b, x, y], i) => {
      if (mask & (1 << i)) {
        walls[a] &= ~x;
        walls[b] &= ~y;
      }
    });
    const topology = { width: 3, height: 2, walls };
    for (let start = 0; start < 6; start++)
      for (let target = 0; target < 6; target++)
        for (const method of ["bfs", "dfs"]) {
          const expected = oracle(topology, start, target, method),
            s = finish(iterateMazeSearch({ topology, start, target, method }));
          assert.deepEqual(s.path, expected.path);
          assert.deepEqual(s.parent, expected.parent);
          assert.deepEqual(s.levels, expected.levels);
          assert.equal(s.found, expected.found);
          assert.ok(s.counters.activatedCount <= s.counters.discoveredCount);
          assert.ok(s.counters.directionChecks <= 24);
          assert.equal(s.phase, "done");
        }
  }
});
test("Default counters, cycle, unreachable exit, zero-length route and frozen input isolation", () => {
  const topology = generateMaze({ width: 7, height: 5, seed: 2 });
  for (const [method, checks, peak] of [
    ["bfs", 56, 2],
    ["dfs", 36, 13],
  ]) {
    const steps = [
        ...iterateMazeSearch({ topology, start: 0, target: 34, method }),
      ],
      serialized = JSON.stringify(steps[1]);
    const s = steps.at(-1).state;
    assert.equal(s.path.length - 1, 12);
    assert.equal(s.counters.discoveredCount, 15);
    assert.equal(s.counters.activatedCount, 15);
    assert.equal(s.counters.directionChecks, checks);
    assert.equal(s.counters.maxFrontierSize, peak);
    for (const step of steps) frozen(step);
    assert.equal(JSON.stringify(steps[1]), serialized);
  }
  assert.deepEqual(
    finish(
      iterateMazeSearch({
        topology: mazePresets.cycle,
        start: 0,
        target: 3,
        method: "bfs",
      }),
    ).path,
    [0, 3],
  );
  assert.deepEqual(
    finish(
      iterateMazeSearch({
        topology: mazePresets.cycle,
        start: 0,
        target: 3,
        method: "dfs",
      }),
    ).path,
    [0, 1, 2, 5, 4, 3],
  );
  for (const method of ["bfs", "dfs"]) {
    const no = finish(
      iterateMazeSearch({
        topology: mazePresets.blocked,
        start: 0,
        target: 3,
        method,
      }),
    );
    assert.equal(no.found, false);
    assert.deepEqual(no.path, []);
    const same = finish(
      iterateMazeSearch({ topology, start: 4, target: 4, method }),
    );
    assert.deepEqual(same.path, [4]);
    assert.equal(same.counters.directionChecks, 0);
  }
  const input = { width: 3, height: 2, walls: [...mazePresets.cycle.walls] };
  const iterator = iterateMazeSearch({
    topology: input,
    start: 0,
    target: 3,
    method: "bfs",
  });
  input.walls.fill(15);
  assert.deepEqual(finish(iterator).path, [0, 3]);
});
test("Validation preserves applied factories and shared history/generator limits; lazy disposal closes source", () => {
  assert.equal(validateMazeSize(8, 8, "history"), limits.history);
  assert.throws(() => validateMazeSize(9, 8, "history"));
  for (const input of [
    { width: 0, height: 1 },
    { width: 1.5, height: 2 },
    { width: Infinity, height: 2 },
    { width: limits.generator + 1, height: 1 },
  ])
    assert.throws(() => validateMazeSize(input.width, input.height));
  assert.throws(() => createMaze({ width: 1, height: 1, walls: [0] }));
  assert.throws(() => createMaze({ width: 2, height: 1, walls: [15, 7] }));
  for (const seed of [-1, 1.5, 4294967296, NaN])
    assert.throws(() => iterateMazeGeneration({ width: 1, height: 1, seed }));
  assert.throws(() =>
    iterateMazeSearch({
      topology: mazePresets.cycle,
      start: -1,
      target: 3,
      method: "bfs",
    }),
  );
  assert.throws(() =>
    iterateMazeSearch({
      topology: mazePresets.cycle,
      start: 0,
      target: 3,
      method: "other",
    }),
  );
  assert.throws(() =>
    createMazeSource({ preset: "cycle", stage: "generation" }),
  );
  const draft = {
    preset: "seeded",
    stage: "generation",
    width: 7,
    height: 5,
    seed: 2,
  };
  const source = createMazeSource(draft);
  draft.seed = 42;
  assert.deepEqual(
    finish(source("history")).walls,
    generateMaze({ width: 7, height: 5, seed: 2 }).walls,
  );
  const large = createMazeSource(
    { preset: "seeded", stage: "generation", width: 40, height: 50, seed: 2 },
    "generator",
  );
  assert.throws(() => large("history"));
  const old = source("history");
  const first = old.next().value;
  assert.equal(first.index, 0);
  old.return();
  assert.equal(old.next().done, true);
  let requested = 0,
    closed = false;
  function* tracked() {
    try {
      for (const step of large("generator")) {
        requested++;
        yield step;
      }
    } finally {
      closed = true;
    }
  }
  const player = createPlayer(tracked(), {
    stepDurationMs: 8,
    finalHoldMs: 5,
    isTerminal: (step) => step.event.type === "done",
  });
  assert.equal(requested, 1);
  player.advance(8);
  assert.ok(requested < 5);
  player.dispose();
  assert.ok(closed);
  assert.ok(requested < 5);
});
test("History/generator frames agree; aggregate scene stays finite on resize and backwards seek", () => {
  const sources = [
    () => iterateMazeGeneration({ width: 7, height: 5, seed: 2 }),
    ...["bfs", "dfs"].map(
      (method) => () =>
        iterateMazeSearch({
          topology: mazePresets.cycle,
          start: 0,
          target: 3,
          method,
        }),
    ),
  ];
  const colors = {
    canvasBackground: "#111",
    text: "#fff",
    border: "#aaa",
    sorted: "#34d399",
    active: "#fb0",
    held: "#c4b5fd",
    finished: "#555",
  };
  for (const source of sources) {
    const steps = [...source()],
      options = { stepDurationMs: 8, finalHoldMs: 5 };
    const timeline = createTimeline(steps, options);
    const player = createPlayer(source(), {
      ...options,
      isTerminal: (step) => step.event.type === "done",
    });
    for (let t = 0; t <= timeline.durationMs; t++)
      assert.deepEqual(
        t ? player.advance(1) : player.frame,
        timeline.sample(t),
      );
    player.dispose();
    const renderer = createMazeRenderer(colors);
    for (const width of [232, 288, 390, 960]) {
      const ctx = new Proxy(
        { canvas: { width, height: 320 } },
        {
          get(t, k) {
            return k in t
              ? t[k]
              : (...args) => {
                  for (const arg of args)
                    if (typeof arg === "number")
                      assert.ok(Number.isFinite(arg), String(k));
                };
          },
        },
      );
      for (let t = timeline.durationMs; t >= 0; t -= 41) {
        const frame = timeline.sample(t);
        assert.equal(mazeScene(frame.current).objects.length, 1);
        renderer.render(ctx, frame);
      }
    }
  }
  assert.throws(() => mazeLayout(0, 320, 7, 5));
  assert.throws(() => mazeLayout(320, 320, 0, 5));
});
