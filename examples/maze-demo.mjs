import { createDemoPlayer } from "./demo-player.mjs";
import { createMazeSource, mazePresets } from "./maze-algorithm.mjs";
import { createMazeRenderer } from "./maze-scene.mjs";
import { limits } from "./player-settings.mjs";
const $ = (id) => document.getElementById(id);
const canvas = $("maze"),
  ctx = canvas.getContext("2d");
const renderer = createMazeRenderer({
  canvasBackground: "#101827",
  text: "#f1f5f9",
  border: "#94a3b8",
  sorted: "#34d399",
  active: "#fbbf24",
  held: "#c4b5fd",
  finished: "#475569",
});
const names = ["north", "east", "south", "west"];
const coordinate = (s, id) =>
  id === null
    ? "none"
    : `${(id % s.width) + 1},${Math.floor(id / s.width) + 1}`;
function describe(s, e) {
  const cell = coordinate(s, e.cell ?? s.current);
  switch (e.type) {
    case "generation-start":
      return `Start generation at 1,1; seed ${e.seed}.`;
    case "search-start":
      return `Prepare ${s.method.toUpperCase()} from ${coordinate(s, s.start)} to ${coordinate(s, s.target)}.`;
    case "activate":
      return `Activate ${cell}; level ${s.levels[e.cell]}.`;
    case "inspect":
      return `Inspect ${names[e.direction]} from ${cell}.`;
    case "skip":
      return `Skip ${names[e.direction]} from ${cell}: ${e.reason}.`;
    case "carve":
      return `Open a passage from ${coordinate(s, e.from)} to ${cell}.`;
    case "discover":
      return `Discover ${cell} from ${coordinate(s, e.from)}.`;
    case "backtrack":
      return `Return from ${cell} to ${coordinate(s, e.to)}.`;
    case "finish":
      return `Finish ${cell}; take the next waiting cell.`;
    case "target-found":
      return `The exit is current; stop the search and follow parents.`;
    case "no-path":
      return "The frontier is empty; the exit is unreachable.";
    case "path-step":
      return `Add ${cell} to the route, following parents towards S.`;
    case "done":
      return s.kind === "generation"
        ? "Generation complete."
        : "Search complete.";
    default:
      throw Error("Unknown maze event");
  }
}
const playback = createDemoPlayer({
  isTerminal: (step) => step.event.type === "done",
  onError: (error) => {
    $("error").textContent = error.message;
  },
  render(frame, { running, mode }) {
    const s = frame.current,
      width = Math.max(180, canvas.clientWidth),
      height = width < 600 ? 320 : 480;
    canvas.style.height = `${height + 2}px`;
    const ratio = devicePixelRatio || 1,
      w = Math.round(width * ratio),
      h = Math.round(height * ratio);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    const logical = new Proxy(ctx, {
      get(t, k) {
        if (k === "canvas") return { width, height };
        const value = Reflect.get(t, k, t);
        return typeof value === "function" ? value.bind(t) : value;
      },
      set(t, k, v) {
        return Reflect.set(t, k, v, t);
      },
    });
    renderer.render(logical, frame);
    $("status").setAttribute("aria-live", running ? "off" : "polite");
    $("status").textContent =
      `Step ${frame.stepIndex}: ${describe(s, frame.event)}`;
    const c = s.counters;
    $("counters").textContent =
      s.kind === "generation"
        ? `Visited: ${c.visitedCount}/${s.walls.length} · Passages: ${c.passageCount} · Directions checked: ${c.directionChecks} · Largest stack: ${c.maxFrontierSize}`
        : `Discovered: ${c.discoveredCount} · Activated: ${c.activatedCount} · Directions checked: ${c.directionChecks} · Largest ${s.method === "bfs" ? "waiting queue" : "stack"}: ${c.maxFrontierSize}`;
    const frontier = s.frontier,
      preview =
        frontier.length <= 16
          ? frontier
          : [...frontier.slice(0, 8), null, ...frontier.slice(-8)];
    $("frontier").textContent =
      `${s.kind === "search" && s.method === "bfs" ? "Queue, head → tail" : "Stack, base → top"} (${frontier.length}): ` +
      (preview
        .map((id) => (id === null ? "…" : `(${coordinate(s, id)})`))
        .join(" ") || "empty");
    $("result").textContent =
      s.kind === "generation"
        ? "The generator builds the whole maze. Search starts from the finished walls."
        : s.phase !== "done"
          ? "Search stops when the exit becomes current; its route is then restored."
          : !s.found
            ? "No path."
            : `Path length: ${s.path.length - 1} ${s.path.length === 2 ? "transition" : "transitions"}. ` +
              (s.path.length <= 20
                ? s.path.map((id) => `(${coordinate(s, id)})`).join(" → ")
                : "Route shown in green.");
    $("limit").textContent =
      `Applied mode: ${mode}. Limit: ${limits[mode]} cells (width × height); shared example limit, not a library constraint.`;
  },
});
function coordinates(value, width, height) {
  const parts = value.split(",").map((v) => v.trim());
  if (parts.length !== 2 || parts.some((v) => !/^\d+$/.test(v)))
    throw new RangeError("Use column,row, counted from 1");
  const [column, row] = parts.map(Number);
  if (column < 1 || row < 1 || column > width || row > height)
    throw new RangeError("Coordinates are outside the maze");
  return (row - 1) * width + column - 1;
}
function draftInputs() {
  const preset = $("preset").value,
    stage = $("stage").value;
  const width =
    preset === "seeded" ? Number($("width").value) : mazePresets[preset].width;
  const height =
    preset === "seeded"
      ? Number($("height").value)
      : mazePresets[preset].height;
  return {
    preset,
    stage,
    width,
    height,
    seed: /^\d+$/.test($("seed").value.trim()) ? Number($("seed").value) : NaN,
    start:
      stage === "generation" ? 0 : coordinates($("start").value, width, height),
    target:
      stage === "generation"
        ? width * height - 1
        : coordinates($("target").value, width, height),
  };
}
function controls() {
  const seeded = $("preset").value === "seeded";
  for (const id of ["width", "height", "seed"]) $(id).disabled = !seeded;
  $("stage").querySelector('option[value="generation"]').disabled = !seeded;
  if (!seeded && $("stage").value === "generation") $("stage").value = "bfs";
  for (const id of ["start", "target"])
    $(id).disabled = $("stage").value === "generation";
}
$("preset").onchange = () => {
  const preset = mazePresets[$("preset").value];
  if (preset) {
    $("width").value = preset.width;
    $("height").value = preset.height;
    $("start").value = "1,1";
    $("target").value = $("preset").value === "cycle" ? "1,2" : "2,2";
  }
  controls();
};
$("stage").onchange = controls;
$("input-form").onsubmit = (event) => {
  event.preventDefault();
  try {
    playback.load(createMazeSource(draftInputs(), playback.mode));
  } catch (error) {
    $("error").textContent = error.message;
  }
};
new ResizeObserver(() => playback.draw()).observe(canvas);
addEventListener("resize", () => playback.draw());
controls();
playback.load(createMazeSource(draftInputs()));
