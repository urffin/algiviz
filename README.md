# AlgiViz

[Русский](ru/README.md)

**Your algorithms and objects. Step-by-step playback and custom rendering.**

A TypeScript toolkit for building interactive algorithm explanations. Write your
algorithm as a generator, emit immutable states and choose how your objects look.
AlgiViz handles playback and scene matching; optional array operations and a Canvas
renderer help you get started.

[Live sorting demo](https://grundyjs.ru/algorithms/insertion-sort/) ·
[Library overview](https://grundyjs.ru/algiviz/) ·
[npm package](https://www.npmjs.com/package/@grundyjs/algiviz) ·
[Getting started](https://github.com/urffin/algiviz/blob/master/docs/getting-started.md)

- **Your algorithm:** control the loops, conditions and order of operations.
- **Your objects:** define custom types and handlers for Canvas, SVG or another target.
- **Two playback modes:** retain history for seeking, or consume a generator with
  only adjacent snapshots retained by the player.
- **No runtime dependencies:** ESM and TypeScript declarations; playback works
  without DOM, React or Next.js.

Use it for educational demos, interactive articles and algorithm walkthroughs.
Algorithms and layouts belong to your application; AlgiViz provides the playback
and rendering API.

## Install

```sh
npm install @grundyjs/algiviz
```

There is no root entry point or CommonJS build. Import the modules you need:
`/player`, `/playback`, `/scene`, `/array` and `/canvas`.

Algorithms live in application code and examples.
Version 0.x may introduce breaking changes
in minor releases; consult [CHANGELOG.md](CHANGELOG.md) when updating.

## Start with one circle

The generator supplies four positions; `Player` creates the controls and passes
states to your drawing callback. Add the HTML below, then load the JavaScript as
a module through a bundler that resolves imports from the installed npm package.

```html
<div id="player">
  <canvas width="600" height="160"></canvas>
</div>
```

```js
import { Player } from '@grundyjs/algiviz/player';

const container = document.querySelector('#player');
const canvas = container.querySelector('canvas');
const ctx = canvas.getContext('2d');

const player = new Player(container, {
  viewport: canvas,
  source: function* () {
    for (const x of [40, 200, 360, 560]) yield { x };
  },
  render({ current }) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.arc(current.x, 80, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#b39bff';
    ctx.fill();
  },
});
```

Press **Start** to draw the first state and **Next state** to move the circle.
The source is read lazily; one additional click after the last position detects
completion. Each yielded snapshot is new and must not be mutated.

This example uses manual steps without interpolation. Add `stepDurationMs: 1000`
to enable Play/Pause and speed controls. Call `player.dispose()` when removing the
visualization; the last drawing remains.

[Run this example locally](https://github.com/urffin/algiviz/blob/master/examples/getting-started.html),
or continue with the [step-by-step guide](https://github.com/urffin/algiviz/blob/master/docs/getting-started.md):
ready-made controls, manual playback and custom object types with `/scene`.
See the [player reference](https://github.com/urffin/algiviz/blob/master/docs/player.md)
for history, seeking, labels and on-demand loading.

## Modules and documentation

| Module | Purpose |
| --- | --- |
| [`/player`](https://github.com/urffin/algiviz/blob/master/docs/player.md) | Optional `new Player(...)` widget, media controls, recording/stream modes and on-demand UI loading; added in 0.12.0 |
| [`/playback`](https://github.com/urffin/algiviz/blob/master/docs/playback.md) | Steps, players, timelines, termination and lifecycle |
| [`/scene`](https://github.com/urffin/algiviz/blob/master/docs/scene.md) | Custom types, object matching and projection |
| [`/array` and `/canvas`](https://github.com/urffin/algiviz/blob/master/docs/array.md) | Array operations, ready-made rendering and palettes |

[Complete TypeScript example](https://github.com/urffin/algiviz/blob/master/examples/custom-objects.ts) ·
[Getting started](https://github.com/urffin/algiviz/blob/master/docs/getting-started.md) ·
[Custom graph walkthrough](https://github.com/urffin/algiviz/blob/master/docs/custom-graph-example.md)

## Examples

| Example | What it demonstrates |
| --- | --- |
| [Your first Player](https://github.com/urffin/algiviz/blob/master/examples/getting-started.html) | The README circle with standard controls and lazy manual states |
| [How a frame is made](https://github.com/urffin/algiviz/blob/master/examples/visualization-pipeline.html) | AlgiViz visualizes its own generator → player → scene → renderer pipeline (Russian walkthrough) |
| [Sorting lab](https://github.com/urffin/algiviz/blob/master/examples/index.html) | Insertion and bubble sort using the array operations and renderer |
| [Merge sort](https://github.com/urffin/algiviz/blob/master/examples/merge.html) | Custom state and a two-row scene for the main array and buffer |
| [Quick sort partitions](https://github.com/urffin/algiviz/blob/master/examples/quick.html) | Lomuto and three-way partitioning with custom state and scene |
| [Heap sort](https://github.com/urffin/algiviz/blob/master/examples/heap.html) | Max-heap construction and extraction with synchronized tree and array identities |
| [Binary search](https://github.com/urffin/algiviz/blob/master/examples/binary-search.html) | First occurrence in sorted input, closed search intervals and lazy playback |
| [Graph BFS](https://github.com/urffin/algiviz/blob/master/examples/graph.html) | Queue, layers, shortest paths, unreachable targets and history/generator playback |
| [Graph DFS](https://github.com/urffin/algiviz/blob/master/examples/dfs.html) | Recursive call frames, backtracking, tree depth and paths; history/generator playback |
| [Maze](https://github.com/urffin/algiviz/blob/master/examples/maze.html) | Randomized DFS generation, BFS wave, DFS backtracking, cycles and unreachable exits; history/generator playback |
| [Tree traversal](https://github.com/urffin/algiviz/blob/master/examples/tree.html) | Custom nodes, edges and pointer with Canvas and retained SVG backends |
| [Boids flock](https://github.com/urffin/algiviz/blob/master/examples/boids.html) | Seeded simulation, five obstacle layouts and one-bird inspection with neighbors and steering vectors |
| [Falling sand](https://github.com/urffin/algiviz/blob/master/examples/sand.html) | Seeded cell simulation, paintable obstacles, a hopper gate and exact one-grain inspection with conflict resolution |

[Full catalog, local setup and algorithm details](https://github.com/urffin/algiviz/blob/master/docs/examples.md).
Examples live in the repository and are not included in the npm package.

## Development and license

[Contributing](https://github.com/urffin/algiviz/blob/master/CONTRIBUTING.md) ·
[Changelog](https://github.com/urffin/algiviz/blob/master/CHANGELOG.md) ·
[Report an issue](https://github.com/urffin/algiviz/issues)

Licensed under [MIT](https://github.com/urffin/algiviz/blob/master/LICENSE). Minor releases in 0.x may change the API.
