// Application-owned maze algorithms. AlgiViz only supplies snapshots/playback.
import { createStepEmitter } from "@grundyjs/algiviz/playback";
import { limits } from "./player-settings.mjs";
const bits = [1, 2, 4, 8],
  dx = [0, 1, 0, -1],
  dy = [-1, 0, 1, 0];
const freeze = (values) => Object.freeze(Array.from(values));

export function validateMazeSize(width, height, mode = "generator") {
  if (
    !Object.hasOwn(limits, mode) ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > limits[mode]
  )
    throw new RangeError(
      `Use positive integer dimensions with at most ${limits[mode] ?? "?"} cells in ${mode} mode.`,
    );
  return width * height;
}
function adjacent({ width, height }, cell, d) {
  const x = (cell % width) + dx[d],
    y = Math.floor(cell / width) + dy[d];
  return x < 0 || x >= width || y < 0 || y >= height ? -1 : y * width + x;
}
export function createMaze(input) {
  if (!input || typeof input !== "object")
    throw new TypeError("Expected a maze");
  const { width, height } = input,
    count = validateMazeSize(width, height);
  if (
    (!Array.isArray(input.walls) && !(input.walls instanceof Uint8Array)) ||
    input.walls.length !== count
  )
    throw new RangeError("Expected one wall mask per cell");
  const walls = Array.from(input.walls);
  walls.forEach((mask, cell) => {
    if (!Number.isInteger(mask) || mask < 0 || mask > 15)
      throw new RangeError("Invalid wall mask");
    for (let d = 0; d < 4; d++) {
      const next = adjacent({ width, height }, cell, d);
      if (
        next === -1
          ? !(mask & bits[d])
          : !!(mask & bits[d]) !== !!(walls[next] & bits[(d + 2) % 4])
      )
        throw new RangeError(
          "Shared walls must agree and exterior walls must stay closed",
        );
    }
  });
  return Object.freeze({ width, height, walls: freeze(walls) });
}
function randomSource(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295)
    throw new RangeError("Seed must be a uint32 integer");
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
function work(width, height, walls, kind, start, target, method) {
  const count = width * height;
  return {
    width,
    height,
    walls,
    kind,
    start,
    target,
    method,
    status: new Uint8Array(count),
    levels: new Int32Array(count).fill(-1),
    parent: new Int32Array(count).fill(-1),
    current: start,
    frontier: [],
    path: [],
    phase: kind,
    found: null,
    counters: {
      visitedCount: 0,
      passageCount: 0,
      discoveredCount: 0,
      activatedCount: 0,
      finishedCount: 0,
      directionChecks: 0,
      maxFrontierSize: 1,
    },
  };
}
function emitter(state, frontier) {
  const emit = createStepEmitter(() =>
    Object.freeze({
      ...state,
      walls: freeze(state.walls),
      status: freeze(state.status),
      levels: freeze(state.levels),
      parent: freeze(state.parent),
      frontier: freeze(frontier()),
      path: freeze(state.path),
      counters: Object.freeze({ ...state.counters }),
    }),
  );
  return (event) => emit(Object.freeze(event));
}
// Validation/capture is eager; the iterator only allocates working arrays on first next().
function generation({ width, height, seed }, snapshots) {
  validateMazeSize(width, height);
  randomSource(seed);
  return (function* () {
    const state = work(
      width,
      height,
      new Uint8Array(width * height).fill(15),
      "generation",
      0,
      width * height - 1,
      "dfs",
    );
    const random = randomSource(seed);
    function frame(cell) {
      const directions = [0, 1, 2, 3];
      for (let i = 3; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [directions[i], directions[j]] = [directions[j], directions[i]];
      }
      return { cell, directions, cursor: 0 };
    }
    const stack = [frame(0)];
    const emit = snapshots
      ? emitter(state, () => stack.map((call) => call.cell))
      : (event) => ({ state, event });
    state.status[0] = 2;
    state.levels[0] = 0;
    state.counters.visitedCount = 1;
    yield emit({ type: "generation-start", seed });
    while (stack.length) {
      const call = stack.at(-1);
      if (call.cursor === 4) {
        stack.pop();
        state.status[call.cell] = 3;
        state.current = stack.at(-1)?.cell ?? null;
        if (state.current !== null) state.status[state.current] = 2;
        yield emit({ type: "backtrack", cell: call.cell, to: state.current });
        continue;
      }
      const direction = call.directions[call.cursor++],
        next = adjacent(state, call.cell, direction);
      state.counters.directionChecks++;
      yield emit({ type: "inspect", cell: call.cell, direction });
      if (next === -1 || state.status[next]) {
        yield emit({
          type: "skip",
          cell: call.cell,
          direction,
          reason: next === -1 ? "boundary" : "visited",
        });
        continue;
      }
      state.walls[call.cell] &= ~bits[direction];
      state.walls[next] &= ~bits[(direction + 2) % 4];
      state.status[call.cell] = 1;
      state.status[next] = 2;
      state.current = next;
      state.parent[next] = call.cell;
      state.levels[next] = state.levels[call.cell] + 1;
      stack.push(frame(next));
      state.counters.visitedCount++;
      state.counters.passageCount++;
      state.counters.maxFrontierSize = Math.max(
        state.counters.maxFrontierSize,
        stack.length,
      );
      yield emit({ type: "carve", cell: next, from: call.cell, direction });
    }
    state.phase = "done";
    yield emit({ type: "done" });
  })();
}
export function iterateMazeGeneration(input) {
  return generation(input, true);
}
export function generateMaze(input) {
  let result;
  // Finish in O(N) time without creating O(N)-sized animation snapshots per event.
  for (const step of generation(input, false)) result = step.state;
  return createMaze(result);
}
export function iterateMazeSearch({ topology, start, target, method }) {
  const maze = createMaze(topology);
  if (!["bfs", "dfs"].includes(method))
    throw new RangeError("Choose BFS or DFS");
  for (const cell of [start, target])
    if (!Number.isInteger(cell) || cell < 0 || cell >= maze.walls.length)
      throw new RangeError("Start and exit must be valid cells");
  return (function* () {
    const state = work(
      maze.width,
      maze.height,
      maze.walls,
      "search",
      start,
      target,
      method,
    );
    const frontier = [start],
      cursor = new Uint8Array(maze.walls.length);
    let head = 0;
    const size = () =>
      method === "bfs" ? frontier.length - head : frontier.length;
    const emit = emitter(state, () =>
      method === "bfs" ? frontier.slice(head) : frontier,
    );
    state.current = null;
    state.status[start] = 1;
    state.levels[start] = 0;
    state.counters.discoveredCount = 1;
    yield emit({ type: "search-start" });
    while (state.current !== null || size()) {
      if (state.current === null) {
        state.current = method === "bfs" ? frontier[head++] : frontier.at(-1);
        state.status[state.current] = 2;
        state.counters.activatedCount++;
        yield emit({ type: "activate", cell: state.current });
        if (state.current === target) {
          state.found = true;
          yield emit({ type: "target-found", cell: target });
          break;
        }
      }
      const cell = state.current;
      if (cursor[cell] === 4) {
        state.status[cell] = 3;
        state.counters.finishedCount++;
        if (method === "bfs") {
          state.current = null;
          yield emit({ type: "finish", cell });
        } else {
          frontier.pop();
          state.current = frontier.at(-1) ?? null;
          if (state.current !== null) state.status[state.current] = 2;
          yield emit({ type: "backtrack", cell, to: state.current });
        }
        continue;
      }
      const direction = cursor[cell]++,
        next = adjacent(state, cell, direction);
      state.counters.directionChecks++;
      yield emit({ type: "inspect", cell, direction });
      const reason =
        next === -1
          ? "boundary"
          : state.walls[cell] & bits[direction]
            ? "wall"
            : state.levels[next] !== -1
              ? "visited"
              : null;
      if (reason) {
        yield emit({ type: "skip", cell, direction, reason });
        continue;
      }
      state.parent[next] = cell;
      state.levels[next] = state.levels[cell] + 1;
      state.status[next] = 1;
      frontier.push(next);
      state.counters.discoveredCount++;
      state.counters.maxFrontierSize = Math.max(
        state.counters.maxFrontierSize,
        size(),
      );
      if (method === "dfs") {
        state.status[cell] = 1;
        state.current = null;
      }
      yield emit({ type: "discover", cell: next, from: cell, direction });
    }
    if (!state.found) {
      state.found = false;
      yield emit({ type: "no-path" });
    }
    if (state.found) {
      state.phase = "path";
      for (let cell = target; cell !== -1; cell = state.parent[cell]) {
        state.path.push(cell);
        yield emit({ type: "path-step", cell });
      }
      state.path.reverse();
    }
    state.phase = "done";
    yield emit({ type: "done" });
  })();
}
export const mazePresets = Object.freeze({
  cycle: createMaze({ width: 3, height: 2, walls: [9, 1, 3, 12, 4, 6] }),
  blocked: createMaze({ width: 2, height: 2, walls: [15, 15, 15, 15] }),
});

/** Capture applied inputs once. Restart/mode changes never read draft form values. */
export function createMazeSource(input, initialMode = "history") {
  if (!input || !["generation", "bfs", "dfs"].includes(input.stage))
    throw new RangeError("Choose a stage");
  const stage = input.stage;
  let topology;
  const width = input.width,
    height = input.height,
    seed = input.seed;
  if (input.preset === "seeded") {
    validateMazeSize(width, height, initialMode);
    randomSource(seed);
    if (stage !== "generation")
      topology = generateMaze({ width, height, seed });
  } else {
    if (!Object.hasOwn(mazePresets, input.preset))
      throw new RangeError("Choose a maze preset");
    if (stage === "generation")
      throw new RangeError(
        "Imported presets have no generation history; choose BFS or DFS",
      );
    topology = mazePresets[input.preset];
    validateMazeSize(topology.width, topology.height, initialMode);
  }
  const start = input.start,
    target = input.target;
  if (stage !== "generation")
    iterateMazeSearch({ topology, start, target, method: stage });
  return (mode) => {
    validateMazeSize(
      topology?.width ?? width,
      topology?.height ?? height,
      mode,
    );
    return stage === "generation"
      ? iterateMazeGeneration({ width, height, seed })
      : iterateMazeSearch({ topology, start, target, method: stage });
  };
}
