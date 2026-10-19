# AlgiViz

**Your algorithms and objects. Step-by-step playback and custom rendering.**

![BFS from A: custom graph vertices, edges and queue animated with AlgiViz](https://raw.githubusercontent.com/urffin/algiviz/master/docs/assets/bfs.gif)

*An application-owned BFS algorithm with custom objects. Exported with
[CanvasTake](https://github.com/urffin/canvas-take) —
[try an interactive sorting demo](https://grundyjs.ru/algorithms/insertion-sort/)
or explore the [BFS source](https://github.com/urffin/algiviz/blob/master/examples/graph-demo.mjs).*

A TypeScript toolkit for building interactive algorithm explanations. Write your
algorithm as a generator, emit immutable states and choose how your objects look.
AlgiViz handles playback and scene matching; optional array operations and a Canvas
renderer help you get started.

[Live sorting demo](https://grundyjs.ru/algorithms/insertion-sort/) ·
[Library overview](https://grundyjs.ru/algiviz/) ·
[npm package](https://www.npmjs.com/package/@grundyjs/algiviz) ·
[Minimal example source](https://github.com/urffin/algiviz/blob/master/examples/minimal.mjs)

- **Your algorithm:** control the loops, conditions and order of operations.
- **Your objects:** define custom types and handlers for Canvas, SVG or another target.
- **Two playback modes:** retain history for seeking, or consume a generator with
  only adjacent snapshots retained by the player.
- **No runtime dependencies:** ESM and TypeScript declarations; playback works
  without DOM, React or Next.js.

Use it for educational demos, interactive articles and algorithm walkthroughs.
Algorithms and layouts belong to your application; AlgiViz provides the playback
and rendering API. This README describes version 0.7.1.

## Start with one custom object

The [standalone page](https://github.com/urffin/algiviz/blob/master/examples/minimal.html)
moves one token with a generator and a custom Canvas handler. It uses only public
package imports, without the shared demo controller. Copy its
[complete module](https://github.com/urffin/algiviz/blob/master/examples/minimal.mjs)
into your application and connect a canvas:

```js
import { createTokenPlayer } from './minimal.mjs';

const canvas = document.querySelector('canvas');
const player = createTokenPlayer(canvas.getContext('2d'));
player.advance(100); // Advance playback by 100 ms.
// Call advance(deltaMs) from your controls or animation loop.
// Call player.dispose() when removing the visualization.
```

[Follow the walkthrough](https://github.com/urffin/algiviz/blob/master/docs/minimal-example.md)
for local setup, snapshot ownership and lifecycle. For a larger custom-object
example, see the [graph BFS walkthrough](https://github.com/urffin/algiviz/blob/master/docs/custom-graph-example.md).

## Install

```sh
npm install @grundyjs/algiviz
```

There is no root entry point or CommonJS build. Import the modules you need:
`/array`, `/playback`, `/scene` and `/canvas`.

Algorithms live in application code and examples.
For new integrations, use the APIs below. Version 0.x may introduce breaking changes
in minor releases; consult [CHANGELOG.md](CHANGELOG.md) when updating.

## User-defined algorithms


New applications use these entry points, which do not import bundled algorithms:

- `@grundyjs/algiviz/array`: array operations and generator definitions.
- `@grundyjs/algiviz/playback`: generic playback of any immutable states and events.
- `@grundyjs/algiviz/scene`: typed objects and user-provided visualizations.
- `@grundyjs/algiviz/canvas`: the ready-made array renderer.

You own the loops, conditions and operation order. No library registration or
changes to AlgiViz are required. For example, reversing an array:

```js
import { defineArrayAlgorithm, createArrayPlayer, createArrayTimeline } from "@grundyjs/algiviz/array";
import { createArrayRenderer } from "@grundyjs/algiviz/canvas";

const reverse = defineArrayAlgorithm(function* (array) {
    yield array.start();
    for (let i = 0; i < Math.floor(array.length / 2); i++) {
        yield array.highlight([i, array.length - 1 - i]);
        yield array.swap(i, array.length - 1 - i);
    }
    yield array.done();
});

const options = { stepDurationMs: 350, finalHoldMs: 1000 };
const ctx = canvas.getContext("2d");
const renderer = createArrayRenderer({ theme: "dark" });
const player = createArrayPlayer(reverse.iterate([1, 2, 3, 4]), {
    ...options,
    render: frame => renderer.render(ctx, frame)
});
// Your animation loop calls player.advance(deltaMs * speed).
// No calls while paused; advance(0) redraws after resizing.
// On teardown: cancel your animation loop and call player.dispose().

// Alternatively, retain history and seek:
const timeline = createArrayTimeline(reverse.steps([1, 2, 3, 4]), options);
renderer.render(ctx, timeline.sample(500));
```

`defineArrayAlgorithm` returns `iterate(values)` and `steps(values)`. Each
iterator owns a separate workspace and copies/validates input on the first
`next()`. `steps` collects the iterator into a frozen array. Yield every
operation immediately, begin with `start`, and end with `done`. Each operation
updates the workspace and returns an immutable snapshot; it does not draw.
The player invokes the supplied `render` initially and on every `advance`.
Rendering errors close the iterator and propagate to the caller.

### Array operations

| Operation | Effect |
| --- | --- |
| `at(index)`, `held`, `length` | Read a frozen item, the held item or array length |
| `start(regions?)` | Emit initial state; call once |
| `compare(left, right)` | Highlight two positions and count one comparison; either position can be `"held"` |
| `highlight(positions)` | Highlight items for this step without changing counters |
| `swap(left, right, regions?)` | Exchange occupied positions; count two writes (non-adjacent swaps are supported) |
| `select(from, regions?)` | Hold an item and leave a hole; no counted writes |
| `shift(from, to, regions?)` | Move an item into the hole; count one write |
| `insert(to, regions?)` | Fill the hole with the held item; count one write |
| `pass(end, regions?)` | Describe a completed pass without changing items or counters |
| `done(regions?)` | Finish; requires no held item; does not sort or infer sorted regions |

`regions` can contain `sortedPrefixLength` and `sortedSuffixLength`.
Omitted markers retain their previous values. The author decides when regions
are sorted; AlgiViz validates their bounds but does not prove that claim. Positions
are zero-based; invalid positions, occupied destinations and invalid operation
order throw before mutating the workspace. Read snapshots rather than modifying
items yourself. `createArrayTrace(values)` exposes the same operations directly,
with immediate input validation, for authors writing their own generator wrapper.

Insertion and bubble sort implementations live in [examples/algorithms.mjs](examples/algorithms.mjs).
The algorithms belong to the application; they require no changes to the library.

### Custom structures and renderers

`/playback` does not know arrays, sorting, Canvas, or event names. A source yields
`Step<State, Event>` objects with contiguous zero-based `index`, immutable
`state` and `event`. Supply `isTerminal` to identify the final step and
`render` to draw each interpolated frame using any rendering technology:

```js
import { createPlayer, createTimeline } from "@grundyjs/algiviz/playback";

const player = createPlayer(myTraversal(), {
    stepDurationMs: 300,
    finalHoldMs: 1000,
    isTerminal: step => step.event.kind === "finished",
    render: frame => drawGraph(frame.previous, frame.current, frame.progress, frame.event)
});
```

The render callback is optional. Without it, read `player.frame` and render
manually. `createTimeline(steps, timing)` supports seeking with the same generic
frame shape; call your renderer with its `sample(timeMs)` result. The generic
engine does not clone or freeze user states; that is the source's responsibility.
It retains adjacent snapshots only; the timeline retains the supplied history.
Custom array events or tree/graph operations can use this contract and a custom
renderer. The scene API below dispatches individual objects; there is no built-in
graph/tree algorithm or operation set.

### Playback contracts

Playback retains application snapshots without cloning them; keep steps, state and
events immutable while they are in use. A timeline copies the input array only.
Timeline timing follows array position, and finite sample times are clamped to its
range. Generator playback requires an explicit terminal step; an early end throws.
`dispose()` closes the source at most once, keeps the last frame readable and
prevents further advancement. Restart uses a fresh source.

Version 0.7.0 makes timeline `stepIndex` preserve the source `step.index`,
matching the player. If source consumption, a terminal predicate or rendering
throws, cleanup is attempted without replacing that primary error. A standalone
cleanup error from disposal or normal completion still propagates.

### Step emission helper (since 0.6.0)

Version 0.6.0 adds `createStepEmitter` from `/playback`. It removes manual step numbering and freezes the step wrapper:

```js
import { createStepEmitter } from '@grundyjs/algiviz/playback';

function* counter() {
    let count = 0;
    const emit = createStepEmitter(() => Object.freeze({ count }));
    yield emit('start');
    count++;
    yield emit('done');
}
```

Create the emitter inside each iterator. Its callback runs once per emission;
indices start at zero and failed captures do not consume an index. The helper
does not clone or freeze state/event data, infer terminal events or store history.
The callback must produce isolated immutable snapshots; immutable shared structures
can be reused. Returning a mutable workspace directly does not make it a snapshot.

### User-defined objects and visualizations

Define a type map with your own data, then
provide a visualization for every type. AlgiViz matches identities and dispatches
objects; your handlers decide how data becomes geometry and how it interpolates.

```ts
import { createSceneRenderer, type Scene } from "@grundyjs/algiviz/scene";

interface MyObjects {
    badge: { x: number; y: number; label: string };
}

const renderer = createSceneRenderer<MyObjects, CanvasRenderingContext2D>({
    badge(ctx, object) {
        const from = (object.previous ?? object.current)!.data;
        const to = (object.current ?? object.previous)!.data;
        const x = from.x + (to.x - from.x) * object.progress;
        const y = from.y + (to.y - from.y) * object.progress;
        ctx.save();
        try {
            ctx.globalAlpha = object.presence;
            ctx.fillText(to.label, x, y);
        } finally { ctx.restore(); }
    }
});

const before: Scene<MyObjects> = {
    objects: [{ id: "first", type: "badge", data: { x: 20, y: 30, label: "A" } }]
};
const after: Scene<MyObjects> = {
    objects: [{ id: "first", type: "badge", data: { x: 120, y: 30, label: "A" } }]
};
// Keep these states immutable. A generic timeline/player can provide this frame.
renderer.render(ctx, {
    previous: before, current: after, progress: 0.5, stepIndex: 1, event: "move"
});
```

- An object has a non-empty stable `id`, a `type`, user-defined `data` and an
  optional finite `zIndex` (default zero). IDs are unique within a snapshot. A
  retained ID cannot change type; use a new ID to replace an object of another type.
- Handlers receive `previous` and `current` objects, with `null` for a missing
  endpoint. `phase` is `enter`, `update` or `exit`. `progress` is the raw 0–1 frame
  progress. `presence` is progress on entry, 1 on update and 1−progress on exit;
  handlers may use it for opacity or scale. It is not applied automatically.
- Lower `zIndex` draws first. Ties follow the current snapshot's object order;
  removed objects follow in their previous order. The current layer wins when it
  changes. There is no implicit layout or coordinate system.
- The third handler argument exposes `scene.get(id)` for links, pointers and other
  references. It returns the referenced object's full transition, including both
  endpoints; missing references return `undefined`. The application decides how to
  handle them and how to interpolate positions or changing targets.
- `createSceneFrame(frame)` exposes the same resolved transitions without drawing.
  The registry is captured at renderer construction. Missing handlers, duplicate
  IDs, invalid progress/layers and changed types fail before any handler is called.
- Scene processing is stateless, so arbitrary seeking is supported. Handlers may
  see zero-presence objects. They are frame draws, **not guaranteed lifecycle
  callbacks**: skipping steps can skip appearances/exits entirely. Clear Canvas
  each frame; a retained SVG/DOM backend must reconcile its elements against the
  current frame, removing stale IDs itself. Save/restore Canvas state inside each
  handler. Exceptions propagate; there is no rollback of drawing already performed.
- Snapshots and user data are not cloned or deep-frozen. The author owns their
  immutability, as with generic playback. Scene indexing uses O(n) additional
  memory and layer ordering O(n log n) time per frame.

`arrayScene(snapshot)` from `/canvas` adapts an array to a `Scene<ArrayObjects>`
with `bar` objects whose data contains `item`, `index` and `held`. The built-in
array renderer uses this same dispatcher. You can provide a different `bar`
visualization using `createSceneRenderer<ArrayObjects, YourContext>`.

### State-to-scene projection

`createSceneProjector` adapts
playback frames from your state model to scenes without changing the algorithm:

```js
import { createSceneProjector } from '@grundyjs/algiviz/scene';
const projectFrame = createSceneProjector(state => ({
    objects: state.items.map(item => ({ id: item.id, type: 'node', data: item }))
}));
// Reuse the projector across renders, with either history or generator playback.
renderer.render(ctx, projectFrame(frame));
```

The projection receives only a state, not an event or progress. Use a pure
function and immutable states/scenes. Endpoints are compared with `Object.is`;
mutating a retained state or changing captured projection settings will not
invalidate the cache. Create a new projector when those settings change.
At most two endpoint projections are retained; seeking to older states may
recompute them. Events, step indices and progress are preserved. Viewport layout
and animation belong in render handlers, not in this cached projection.
The returned frame is frozen; user states and projected scenes are not cloned
or deep-frozen. Scene validation still happens in the scene renderer.
The merge example uses this adapter to avoid rebuilding two cell scenes on every
animation frame. The algorithm, object types and visual behavior remain external.

## Playback and rendering

Array players and timelines use the same frame shape as generic playback:
`previous`, `current`, `progress`, `stepIndex` and `event`.
A frame describes the transition into the current step; that step's state is the
state after its operation.

| API | Behavior |
| --- | --- |
| `createArrayPlayer(iterable, options)` | Array playback; recognizes the `done` event |
| `createPlayer(iterable, options)` | Generic playback; requires `isTerminal(step)` |
| `createArrayTimeline(steps, timing)` / `createTimeline(steps, timing)` | Retained history with `durationMs` and `sample(timeMs)` |
| `createArrayRenderer({ theme: "dark" \| "light" })` | Full-frame Canvas array rendering |
| `createSceneRenderer(handlers)` | Dispatches custom objects to your visualization handlers |
| `createSceneProjector(project)` | Adapts immutable state endpoints to scenes with a bounded cache |

Players read the first step at construction and expose `frame`, `advance(deltaMs)`,
`finished` and `dispose()`. The initial frame has progress 1.
`advance` accepts finite, non-negative elapsed playback time; zero consumes no steps.
Pause by not advancing. Apply speed by multiplying elapsed time.
The optional render callback runs initially and on every advance.

The source must reach a terminal step. The player closes the iterator after its
final transition and becomes finished after `finalHoldMs`. Premature exhaustion,
source errors and render errors propagate and close the iterator.
`dispose()` closes early and can be repeated; the frame remains readable, but
advancing a disposed player throws. Restart with a new iterator and player.

Timelines require an array of steps. Step i completes at `i * stepDurationMs`;
`finalHoldMs` extends the last frame. Sampling clamps finite times to the timeline
range and rejects non-finite times. There is no seeking or known total duration
in generator playback.

Animation scheduling belongs to your application. For example:

```js
const player = createArrayPlayer(reverse.iterate([1, 2, 3, 4]), options);
let last;
let requestId;
let paused = false;
let speed = 1;

function tick(now) {
    const delta = last === undefined ? 0 : Math.min(100, now - last);
    last = now;
    if (!paused) player.advance(delta * speed);
    renderer.render(ctx, player.frame);
    if (!player.finished) requestId = requestAnimationFrame(tick);
}
requestId = requestAnimationFrame(tick);
// On teardown: cancelAnimationFrame(requestId); player.dispose();
// To replay after finishing, create a new player and schedule a new loop.
```

This is an alternative to the player setup in the earlier array example, reusing
its `reverse`, `options`, `ctx` and `renderer`. Large deltas consume intervening steps
synchronously, so cap elapsed time or pause on hidden tabs to avoid a long catch-up.

The array renderer expects immutable snapshots. It uses Canvas bitmap dimensions
for layout, draws a full frame and restores context state. Negative values use
magnitude for bar height and retain their sign in labels; this is not a signed-axis
plot. Dense charts hide labels. For recording, use a canvas with fixed export
dimensions. Rendering does not start an animation loop or record video.

#### Custom array colors (unreleased)

The next release accepts partial palette overrides on both `createArrayRenderer`
and its compatible alias `createSortRenderer`:

```ts
import { createArrayRenderer, type ArrayPaletteOverrides } from '@grundyjs/algiviz/canvas';
const colors: ArrayPaletteOverrides = { background: '#ffffff', text: '#182230', active: '#e87900' };
const renderer = createArrayRenderer({ theme: 'light', colors });
renderer.render(ctx, currentFrame);
```

`ArrayPalette` defines six string roles: `background` (full canvas), `text`
(all labels), `bar` (ordinary bars), `sorted` (sorted prefix/suffix), `active`
(highlighted/compared/moved items), and `held` (the held item, taking precedence
over active and sorted). `ArrayPaletteOverrides` is its partial form;
`ArrayRendererOptions` describes the options object. Values are Canvas color
strings, passed through without CSS validation. Omitted or undefined roles use
the selected theme. Existing theme-only calls and default colors are unchanged.

Overrides are copied when creating a renderer. Changing the input object later
has no effect. To switch theme or palette, create a new renderer and render the
same current frame. This changes colors only, not playback, snapshots, layout or
bitmap/DPR handling. These options are not included in npm 0.7.1.

## Memory and generation cost

Array operations copy the input, validate finite numbers and reject sparse inputs.
`defineArrayAlgorithm` performs this work on the first iterator `next()`;
`createArrayTrace` validates immediately. Each iterator owns its workspace.
Array steps, events, snapshots and items are frozen; immutable items can be shared
between snapshots.

Generator playback retains adjacent snapshots, not the entire history. Array
playback therefore uses O(n) snapshot memory if the caller does not retain old
frames. Generic states and algorithm-specific storage may have different costs.
Each full array snapshot still copies n slots: laziness reduces retained history,
not the cost of producing every step. Collecting steps restores the history cost.
For example, a quadratic sorting trace with O(n)-sized snapshots can take O(n³)
time and history space. Iteration is synchronous and can block the UI.

## Browser examples

Build the project, serve the repository root with a static HTTP server and open
one of these pages. Examples are application code in the repository and are not
included in the npm archive.

| Example | What it demonstrates |
| --- | --- |
| [Sorting lab](examples/index.html) | Insertion and bubble sort using the array operations and renderer |
| [Merge sort](examples/merge.html) | Custom state and a two-row scene for the main array and buffer |
| [Quick sort partitions](examples/quick.html) | Lomuto and three-way partitioning with custom state and scene |
| [Heap sort](examples/heap.html) | Max-heap construction and extraction with synchronized tree and array identities |
| [Graph BFS](examples/graph.html) | Cycles, disconnected components, shortest distances and an animated queue |
| [Tree traversal](examples/tree.html) | Custom nodes, edges and pointer with Canvas and retained SVG backends |

All examples reuse [demo-player.mjs](examples/demo-player.mjs) and
[player-settings.mjs](examples/player-settings.mjs): 650 ms per step, 1,000 ms final
hold, speeds 0.25× through 32×, play/pause, restart and step controls.
History enables backward stepping and seeking; generator mode disables both.
Reduced motion disables interpolation, and hidden tabs pause playback.

All sorting examples accept up to **64 finite values with history** or **2,000 in
generator mode**. Enter values or generate an array by count with Random, Sorted or
Reverse order. These are demo limits, not library restrictions. Switching a large
array to history requires first loading an array within the history limit.
Dense charts hide labels; custom sorting examples preview the first 24 cells in
their text status.

### Merge sort

The [algorithm](examples/merge-algorithm.mjs) and
[renderer](examples/merge-scene.mjs) use `/playback` and `/scene`.
Equal values have letter suffixes to demonstrate stability. Cells use row/position
IDs because copy-back temporarily duplicates item identities. Left wins ties.
The algorithm uses O(n) auxiliary memory; full snapshot history has an
O(n² log n) space upper bound.

### Quick sort

Choose Lomuto or three-way partitioning while preserving loaded values.
Both algorithms and their scene belong to the example. Three-way recursion skips
the equal band: n ≥ 2 equal items take 2n scalar checks and zero swaps, versus
n(n−1)/2 checks with this Lomuto variant. Neither variant guarantees stability.
Worst-case algorithm time is quadratic; recursion can use O(n) stack space.
Full snapshot history has a separate O(n³) space upper bound.

### Heap sort

The [algorithm](examples/heap-algorithm.mjs) owns immutable states and events.
The [scene](examples/heap-scene.mjs) assigns separate tree/array visual IDs to each
element and uses the public scene projector with viewport-independent endpoints.
Tree positions stay fixed as the heap shrinks. At most 15 array cells wrap on narrow
screens; larger arrays use a dense row and hide unreadable labels.
Bottom-up construction is O(n), worst-case sorting O(n log n), and the iterative
in-place algorithm uses O(1) auxiliary space. This demo copies input and retains
O(n) adjacent snapshot data in generator mode; full history can use O(n² log n).
It is not stable: [2a, 2b, 1] becomes [1, 2b, 2a].

### Tree traversal

The example defines its own `node`, `edge` and `pointer` types. The pointer follows
tree edges through shared ancestors between visited nodes. The Renderer selector
switches between Canvas and SVG without restarting playback.
[tree-svg.mjs](examples/tree-svg.mjs) retains elements by ID, restores layer order
and removes stale elements even after seeking skips exit transitions.
No tree-specific algorithm or renderer is added to the package.

### Graph breadth-first search

Open [examples/graph.html](examples/graph.html) and choose a start vertex.
The example explores only its connected component, marks vertices when enqueued
and shows shortest unweighted distances. Its custom vertex, connection and queue
entry types are projected from immutable algorithm state. Both playback modes use
the same generator; changing the start creates a new traversal.

See [Building a custom graph example](docs/custom-graph-example.md) for the
algorithm, projection and renderer boundaries. This example uses the existing
public APIs and adds no graph-specific package exports.

## Development

Requires Node.js 22 or later and npm.

```sh
npm ci
npm test
npm run test:package
```

`npm test` builds the library, checks TypeScript fixtures and runs the tests.
`npm run test:package` builds a tarball, installs it offline in an isolated temporary
consumer, compiles against the installed declarations and exercises public APIs,
including rejection of the removed `/core` export. The temporary consumer is removed afterward.

GitHub Actions runs both checks on pushes to `master` and pull requests, using
Node.js 22 and 24 on Linux and Windows. CI checks do not publish packages.

`npm pack` rebuilds automatically. The archive includes dist, README, LICENSE,
CHANGELOG and package metadata. Source and issues:
[urffin/algiviz](https://github.com/urffin/algiviz). Licensed under MIT.

### Performance checks

Run `npm run benchmark` for 2,000-element insertion, bubble, merge and both quick-sort
variants. It reports generation of 1,000 steps, median rendering CPU time over five
100-frame samples and retained Node heap after each 5,000 playback steps, up to
25,000. Drawing uses a mock Canvas: these are CPU comparisons, not browser FPS or
GPU measurements. Heap samples use explicit GC and include the Node process;
they are diagnostics, not portable pass/fail thresholds.

## Release

Publishing is a maintainer action. Update the package version, lockfile and changelog;
run `npm test` and `npm run test:package`, commit and push, and check CI on the
candidate commit.

The [publish workflow](.github/workflows/npm-publish.yml) runs when a stable GitHub
Release is published. Drafts, prereleases and tag pushes alone do not publish.
Use `v` followed by the exact package version, such as `v0.7.1`, at the tested commit.

The workflow uses Node.js 24 and npm 11, checks the version and packed consumer,
then publishes with provenance through npm trusted publishing (OIDC).
The publish lifecycle also runs tests and rebuilds. No `NPM_TOKEN` secret is required.

The npm trusted publisher must match GitHub owner `urffin`, repository `algiviz`
and workflow `npm-publish.yml`. The workflow does not use a GitHub environment.
See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

After publication, verify the Actions run and the exact version in npm.
Never reuse an already published npm version. If a workflow fails, check whether
publication occurred before deciding whether to rerun it.
