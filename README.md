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
  adjacent snapshots by default, or a bounded window when rewind is enabled.
- **No runtime dependencies:** ESM and TypeScript declarations; playback works
  without DOM, React or Next.js.

Use it for educational demos, interactive articles and algorithm walkthroughs.
Algorithms and layouts belong to your application; AlgiViz provides the playback
and rendering API.

Package line: **1.2.x**. **1.2.1 updates documentation only**; the public API
and implementations are unchanged from 1.2.0 (`8e1f50b`).
Twelve entries are published, including `/tree` and `/canvas/tree`: ordered/binary
trees, atomic edits, layout, empty slots, captions and green results.
The ten previous imports need no migration.
[Documentation patch](https://github.com/urffin/algiviz/blob/master/docs/release-1.2.1.md) ·
[1.2.0 verification](https://github.com/urffin/algiviz/blob/master/docs/release-1.2.md) ·
[GitHub Release](https://github.com/urffin/algiviz/releases/tag/v1.2.1) ·
[Tree API](https://github.com/urffin/algiviz/blob/master/docs/tree-api.md) ·
[Tree Canvas](https://github.com/urffin/algiviz/blob/master/docs/tree-canvas-api.md) ·
[Current API](https://github.com/urffin/algiviz/blob/master/docs/current-api.md).

## Install

```sh
npm install @grundyjs/algiviz
```

There is no root entry point or CommonJS build. Import the modules you need:
`/player`, `/playback`, `/scene`, `/array`, `/canvas`, `/canvas/viewport`,
`/worker`, `/worker/runtime`, `/graph` and `/canvas/graph`.

Graph entries require 1.1.0 or newer; npm 1.0.0 contains neither.
Algorithms live in application code and examples. Compatible features use minor
releases under the [1.x compatibility policy](https://github.com/urffin/algiviz/blob/master/docs/api-compatibility.md);
consult [CHANGELOG.md](CHANGELOG.md) when updating.

## Quickstart: find a minimum on Canvas

The main quickstart uses `stepSource`/`isTerminal` and `done({ result })`, available
in 1.0.0. The guide installs exact npm version 1.0.0 into a separate app;
no repository checkout is required for this quickstart.

[Copy one complete HTML file and the exact run commands](https://github.com/urffin/algiviz/blob/master/docs/getting-started.md).
A one-pass minimum search compares [7,3,5,2,6]. Array operations capture snapshots,
the standard renderer draws Canvas, and Player supplies Start/Next/Restart. The
minimum stays green and the answer remains visible as “Minimum: 2”. The fixed
nonempty example uses 28 nonblank JS lines; your algorithm stays application-owned.

[Compare Player and one-button examples](https://github.com/urffin/algiviz/blob/master/docs/quickstart-comparison.md),
or follow the [progressive tutorial](https://github.com/urffin/algiviz/blob/master/docs/learning-path.md):
plain states/pre → createArrayPlayer → standard Player → scenes/interpolation.

## Modules and documentation

| Module | Purpose | First 1.x release |
| --- | --- | --- |
| [`/playback`](https://github.com/urffin/algiviz/blob/master/docs/playback.md) | Steps, players, timelines, termination and lifecycle | 1.0.0 |
| [`/scene`](https://github.com/urffin/algiviz/blob/master/docs/scene.md) | Custom types, object matching and projection | 1.0.0 |
| [`/array`](https://github.com/urffin/algiviz/blob/master/docs/array.md) | Immutable array operations, marks and results | 1.0.0 |
| [`/canvas`](https://github.com/urffin/algiviz/blob/master/docs/array.md) | Ready-made array Canvas rendering and palettes | 1.0.0 |
| [`/canvas/viewport`](https://github.com/urffin/algiviz/blob/master/docs/canvas-viewport.md) | CSS Canvas sizing, DPR and cleanup | 1.0.0 |
| [`/player`](https://github.com/urffin/algiviz/blob/master/docs/player.md) | Optional Player widget, media controls, recording/streams and on-demand loading | 1.0.0 |
| [`/worker`](https://github.com/urffin/algiviz/blob/master/docs/worker-source-api.md) | Dedicated browser Worker factory and transport errors | 1.0.0 |
| [`/worker/runtime`](https://github.com/urffin/algiviz/blob/master/docs/worker-source-api.md) | Worker-side endpoint; separate WebWorker types | 1.0.0 |
| [`/graph`](https://github.com/urffin/algiviz/blob/master/docs/graph-api.md) | Fixed graph traces, marks/captions/results and scene projection | 1.1.0 |
| [`/canvas/graph`](https://github.com/urffin/algiviz/blob/master/docs/graph-api.md) | Graph Canvas: arrows, loops, parallel edges and caption placement | 1.1.0 |
| [`/tree`](https://github.com/urffin/algiviz/blob/master/docs/tree-api.md) | Ordered/binary traces, atomic topology edits and scene projection | 1.2.0 |
| [`/canvas/tree`](https://github.com/urffin/algiviz/blob/master/docs/tree-canvas-api.md) | Explicit tree layout, empty binary slots, relation interpolation, captions and result | 1.2.0 |

Headless entries need no DOM. Canvas/Player/viewport and the Worker host need
their actual hosts and DOM types; the Worker endpoint uses WebWorker types.
Import safety does not provide a drawing/mounting host. [Environment boundary](https://github.com/urffin/algiviz/blob/master/docs/support-matrix.md#current-support-boundary).

[Complete TypeScript example](https://github.com/urffin/algiviz/blob/master/examples/custom-objects.ts) ·
[Getting started](https://github.com/urffin/algiviz/blob/master/docs/getting-started.md) ·
[Custom graph walkthrough](https://github.com/urffin/algiviz/blob/master/docs/custom-graph-example.md)

## Sources and playback

Player accepts plain states through source, explicit steps through stepSource,
a complete recording through history and asynchronous states through asyncSource.
[Choose a source](https://github.com/urffin/algiviz/blob/master/docs/player.md).

For streams, [rewindCapacity](https://github.com/urffin/algiviz/blob/master/docs/player.md)
enables backward navigation within a bounded window. [maxStepsPerFrame](https://github.com/urffin/algiviz/blob/master/docs/player-work-budget.md)
caps next-state requests per frame while carrying remaining playback time;
it does not bound the cost of an individual step or render.

[createAsyncSource](https://github.com/urffin/algiviz/blob/master/docs/async-source-api.md)
handles waiting, cancellation and cleanup. Async iteration alone does not move
CPU work to another thread. The [Worker adapter](https://github.com/urffin/algiviz/blob/master/docs/worker-source-api.md)
uses the same [Player asyncSource option](https://github.com/urffin/algiviz/blob/master/docs/player-worker.md),
with explicit ArrayBuffer transfer and observable completion through closed.

## Examples

| Example | What it demonstrates |
| --- | --- |
| [Your first Player](https://github.com/urffin/algiviz/blob/master/examples/getting-started.html) | One-pass minimum search, standard Canvas renderer, Player controls and explicit result |
| [How a frame is made](https://github.com/urffin/algiviz/blob/master/examples/visualization-pipeline.html) | AlgiViz visualizes its own generator → player → scene → renderer pipeline (Russian walkthrough) |
| [Sorting lab](https://github.com/urffin/algiviz/blob/master/examples/index.html) | Insertion and bubble sort using the array operations and renderer |
| [Merge sort](https://github.com/urffin/algiviz/blob/master/examples/merge.html) | Custom state and a two-row scene for the main array and buffer |
| [Quick sort partitions](https://github.com/urffin/algiviz/blob/master/examples/quick.html) | Lomuto and three-way partitioning with custom state and scene |
| [Heap sort](https://github.com/urffin/algiviz/blob/master/examples/heap.html) | Max-heap construction and extraction with synchronized tree and array identities |
| [Binary search](https://github.com/urffin/algiviz/blob/master/examples/binary-search.html) | First occurrence in sorted input, closed search intervals and lazy playback |
| [Detailed graph BFS](https://github.com/urffin/algiviz/blob/master/examples/graph.html) | Custom scene with animated queue, vertex distances and path markers; standard Player |
| [BFS with the stock graph renderer](https://github.com/urffin/algiviz/blob/master/examples/graph-player.html) | The same algorithm with createGraphTrace, vertex distance captions, /canvas/graph and Player |
| [Graph DFS](https://github.com/urffin/algiviz/blob/master/examples/dfs.html) | Recursive call frames, backtracking, tree depth and paths; history/generator playback |
| [Maze](https://github.com/urffin/algiviz/blob/master/examples/maze.html) | Randomized DFS generation, BFS wave, DFS backtracking, cycles and unreachable exits; history/generator playback |
| [Tree traversal](https://github.com/urffin/algiviz/blob/master/examples/tree.html) | Custom nodes, edges and pointer with Canvas and retained SVG backends |
| [Tree insertion and rotation](https://github.com/urffin/algiviz/blob/master/examples/tree-player.html) | Fixed BST insertion, one right rotation, stock tree layout/Canvas and Player; green result and rewind |
| [Boids flock](https://github.com/urffin/algiviz/blob/master/examples/boids.html) | Seeded simulation, five obstacle layouts and one-bird inspection with neighbors and steering vectors |
| [Falling sand](https://github.com/urffin/algiviz/blob/master/examples/sand.html) | Seeded cell simulation, paintable obstacles, a hopper gate and exact one-grain inspection with conflict resolution |

[Full catalog, local setup and algorithm details](https://github.com/urffin/algiviz/blob/master/docs/examples.md).
Examples live in the repository and are not included in the npm package.

## Development and license

[Contributing](https://github.com/urffin/algiviz/blob/master/CONTRIBUTING.md) ·
[Changelog](https://github.com/urffin/algiviz/blob/master/CHANGELOG.md) ·
[Report an issue](https://github.com/urffin/algiviz/issues)

Licensed under [MIT](https://github.com/urffin/algiviz/blob/master/LICENSE).
