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
[Minimal example source](https://github.com/urffin/algiviz/blob/master/examples/visualization-pipeline.html)

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
`/array`, `/playback`, `/scene` and `/canvas`.

Algorithms live in application code and examples.
Version 0.x may introduce breaking changes
in minor releases; consult [CHANGELOG.md](CHANGELOG.md) when updating.

## Start with one custom object

Four states of one circle: `40 → 200 → 360 → 560`. The generator supplies
coordinates, the `dot` handler draws the circle, and the player requests the next
state. Add a canvas and button to your HTML, then load the JavaScript below as a
module through a bundler that resolves imports from the installed npm package.

![Minimal AlgiViz example: code, sequential call highlighting and Canvas state](https://raw.githubusercontent.com/urffin/algiviz/master/docs/assets/minimal.gif)

*Actual example calls replayed slowly. The dot changes position at the drawing stage. [Explore the interactive walkthrough](https://github.com/urffin/algiviz/blob/master/examples/visualization-pipeline.html).*

```html
<canvas width="600" height="160"></canvas>
<button id="next">Next state</button>
```

```js
import { createPlayer } from '@grundyjs/algiviz/playback';
import { createSceneRenderer } from '@grundyjs/algiviz/scene';

const ctx = document.querySelector('canvas').getContext('2d');
function* steps() {
    for (const [index, x] of [40, 200, 360, 560].entries()) {
        const state = { objects: [{ id: 'circle', type: 'dot', data: { x } }] };
        yield { index, state, event: index === 3 ? 'done' : 'position' };
    }
}
const renderer = createSceneRenderer({
    dot(ctx, { current }) {
        ctx.beginPath();
        ctx.arc(current.data.x, 80, 18, 0, Math.PI * 2);
        ctx.fillStyle = '#b39bff';
        ctx.fill();
    },
});
const player = createPlayer(steps(), {
    stepDurationMs: 1000, finalHoldMs: 0,
    isTerminal: step => step.event === 'done',
    render(frame) {
        ctx.clearRect(0, 0, 600, 160);
        renderer.render(ctx, frame);
    },
});
document.querySelector('#next').onclick = () => player.nextStep();
```

The first frame (`x = 40`) is drawn immediately inside `createPlayer(...)`. Each
click requests the next state: the player resumes the loop until the next
`yield`, then renders. There is no interpolation here: the handler draws only
`current`. Each snapshot is created afresh and never mutated. Call
`player.dispose()` when removing the visualization.

[Interactive walkthrough with sequential code highlighting](https://github.com/urffin/algiviz/blob/master/examples/visualization-pipeline.html)
shows initial rendering behind a Start button and the subsequent loop iterations
(Russian UI). This is an example page in the repository; run it locally using
the [local setup instructions](https://github.com/urffin/algiviz/blob/master/docs/minimal-example.md).

## How it works

- **Algorithm:** a generator emits independent state snapshots.
- **Player:** requests steps and passes frames to your rendering callback.
- **Scene:** describes objects with stable IDs, types and application-owned data.
- **Handler:** chooses geometry and drawing behavior, including interpolation.

Do not mutate emitted states. Players require an explicit terminal step;
call `dispose()` when removing a visualization. Algorithms, layouts and animation
scheduling belong to the application.

## Playback modes

| | Generator: `createPlayer` | History: `createTimeline` |
| --- | --- | --- |
| Steps | Consumed on demand | Collected up front |
| Retention | Adjacent snapshots | Complete history |
| Seeking backward | No | Yes, via `sample(timeMs)` |
| Total duration | Unknown in advance | Available |

Generators reduce retained history, not the cost of producing each snapshot.
[Memory and performance details](https://github.com/urffin/algiviz/blob/master/docs/performance.md).

## Modules and documentation

| Module | Purpose |
| --- | --- |
| [`/playback`](https://github.com/urffin/algiviz/blob/master/docs/playback.md) | Steps, players, timelines, termination and lifecycle |
| [`/scene`](https://github.com/urffin/algiviz/blob/master/docs/scene.md) | Custom types, object matching and projection |
| [`/array` and `/canvas`](https://github.com/urffin/algiviz/blob/master/docs/array.md) | Array operations, ready-made rendering and palettes |

[Complete TypeScript example](https://github.com/urffin/algiviz/blob/master/examples/custom-objects.ts) ·
[Project setup and integration](https://github.com/urffin/algiviz/blob/master/docs/minimal-example.md) ·
[Custom graph walkthrough](https://github.com/urffin/algiviz/blob/master/docs/custom-graph-example.md)

## Examples

| Example | What it demonstrates |
| --- | --- |
| [How a frame is made](https://github.com/urffin/algiviz/blob/master/examples/visualization-pipeline.html) | AlgiViz visualizes its own generator → player → scene → renderer pipeline (Russian walkthrough) |
| [Sorting lab](https://github.com/urffin/algiviz/blob/master/examples/index.html) | Insertion and bubble sort using the array operations and renderer |
| [Merge sort](https://github.com/urffin/algiviz/blob/master/examples/merge.html) | Custom state and a two-row scene for the main array and buffer |
| [Quick sort partitions](https://github.com/urffin/algiviz/blob/master/examples/quick.html) | Lomuto and three-way partitioning with custom state and scene |
| [Heap sort](https://github.com/urffin/algiviz/blob/master/examples/heap.html) | Max-heap construction and extraction with synchronized tree and array identities |
| [Binary search](https://github.com/urffin/algiviz/blob/master/examples/binary-search.html) | First occurrence in sorted input, closed search intervals and lazy playback |
| [Graph BFS](https://github.com/urffin/algiviz/blob/master/examples/graph.html) | Queue, layers, shortest paths, unreachable targets and history/generator playback |
| [Graph DFS](https://github.com/urffin/algiviz/blob/master/examples/dfs.html) | Recursive call frames, backtracking, tree depth and paths; history/generator playback |
| [Tree traversal](https://github.com/urffin/algiviz/blob/master/examples/tree.html) | Custom nodes, edges and pointer with Canvas and retained SVG backends |

[Full catalog, local setup and algorithm details](https://github.com/urffin/algiviz/blob/master/docs/examples.md).
Examples live in the repository and are not included in the npm package.

## Development and license

[Contributing](https://github.com/urffin/algiviz/blob/master/CONTRIBUTING.md) ·
[Changelog](https://github.com/urffin/algiviz/blob/master/CHANGELOG.md) ·
[Report an issue](https://github.com/urffin/algiviz/issues)

Licensed under [MIT](https://github.com/urffin/algiviz/blob/master/LICENSE). Minor releases in 0.x may change the API.
