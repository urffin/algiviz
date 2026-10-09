# AlgiViz

A TypeScript toolkit for user-defined algorithm visualizations. You write the algorithm; AlgiViz provides array operations, immutable steps, playback and canvas rendering. No runtime dependencies. Playback works without DOM, React or Next.js. ESM only, with TypeScript declarations.

## User-defined algorithms (unreleased)

The following API is available in this checkout and is not yet in npm 0.3.0.
New applications use these entry points, which do not import bundled algorithms:

- `@grundyjs/algiviz/array`: array operations and generator definitions.
- `@grundyjs/algiviz/playback`: generic playback of any immutable states and events.
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

Full insertion/bubble implementations live in [examples/algorithms.mjs](examples/algorithms.mjs).
The browser demo imports those external algorithms. Deprecated `/core` exports
remain available through isolated compatibility implementations using the same
operations; they are retained in the package until a breaking release removes them.
Existing insertion/bubble traces remain unchanged. `ArrayEvent` also includes the
new `highlight` event, so exhaustive event switches must handle it.

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
renderer; there is no built-in graph/tree operation set yet.

## Legacy sorting API

The following `/core` examples remain supported for compatibility. Prefer the
user-defined algorithm API above for new integrations.

## Install

```sh
npm install @grundyjs/algiviz
```

Try the [interactive insertion sort demo](https://grundyjs.ru/algorithms/insertion-sort/). Import the core from `@grundyjs/algiviz/core` and the browser renderer from `@grundyjs/algiviz/canvas`; there is no root entry point or CommonJS build. Version 0.x is an initial API and may change in later minor releases.

## Development

Requires Node.js 22 or later and npm.

```sh
npm install
npm test
npm pack
```

Build output includes ESM and TypeScript declarations. `npm pack` rebuilds automatically; `npm publish` runs the tests before packing. The archive includes only dist, README, LICENSE, CHANGELOG and package metadata. Licensed under MIT.

```js
import { insertionSortSteps } from "@grundyjs/algiviz/core";

const steps = insertionSortSteps([5, 2, 4, 2, 1]);
console.log(steps.at(-1).state.slots.map(item => item.value));
// [1, 2, 2, 4, 5]
```

Each step contains a typed event and the complete state **after** it. `start` preserves the input; `done` has no held item and a fully sorted array. Original-index ids (`item-0`, etc.) distinguish equal values and are deterministic within one trace. The input is never modified. Invalid values, including NaN, Infinity and sparse holes, throw TypeError.

`select` moves the key into `held` and leaves one null slot. `compare` compares the neighbor with the key. `shift` moves the neighbor into the hole. `insert` puts the key back. All original items occur exactly once across `slots` and `held` in every snapshot. Equal values are never shifted past each other.

`sortedPrefixLength` counts the leading occupied slots known to be sorted: initially min(1, n), during insertion it ends at the hole, after insertion it extends through the processed region. `comparisons` counts compare events. `writes` counts shift and insert events, including reinserting an unchanged key; extracting a key and clearing the hole are visualization bookkeeping, not counted writes.

The result, steps, events, snapshots, slot arrays and items are frozen at runtime. Items may be shared between snapshots because they are immutable.

The underlying sort uses O(n²) comparisons in the worst case and O(n) on already sorted input. This API stores full history, so its worst-case time and memory are O(n³), unlike ordinary in-place insertion sort. Intended for small educational inputs; the demo site limits inputs to 24 items. This core imposes no UI limit.

Tests replay every event independently, check item conservation, stability, prefix ordering, counters, frozen snapshots and 1,093 exhaustive inputs with values -1, 0 and 1 of lengths 0–6.

## Bubble sort

`bubbleSortSteps(values)` collects a frozen history; `iterateBubbleSortSteps(values)`
yields the same snapshots on demand. Both work with the existing timeline, player
and canvas renderer. Available since version 0.3.0.

```js
import { bubbleSortSteps, iterateBubbleSortSteps, createSortPlayer } from "@grundyjs/algiviz/core";

const steps = bubbleSortSteps([5, 2, 4, 2, 1]);
const player = createSortPlayer(iterateBubbleSortSteps([5, 2, 4, 2, 1]), {
    stepDurationMs: 350, finalHoldMs: 1000
});
```

Each left-to-right pass compares adjacent items. `compare` identifies both items;
`swap` contains their pre-swap `leftId`, `rightId`, `left` and `right` positions,
and its snapshot is after the exchange. Each swap counts as two array writes.
Equal items are never swapped, so the sort is stable. `held` remains null and
`sortedPrefixLength` is zero.

`pass` marks a completed pass, with `end` identifying its last compared position.
The optional `sortedSuffixLength` snapshot field counts trailing items in their
final positions; renderers treat an omitted value as zero for older traces.
A pass with no swaps ends the sort early and marks the entire array sorted.
`done` always has `sortedSuffixLength` equal to the array length.

Validation, lazy input copying, freezing and memory costs match insertion sort.
The underlying algorithm performs O(n²) comparisons in the worst case and O(n)
on sorted input; full snapshots still make worst-case trace generation O(n³).
Consumers switching on `SortEvent.type` should handle the new `swap` and `pass` events.

## Lazy steps

Use `iterateInsertionSortSteps` to consume steps on demand without retaining the
entire history. It yields the same immutable `SortStep` snapshots as
`insertionSortSteps`, which collects this iterator into a frozen array.

```js
import { iterateInsertionSortSteps } from "@grundyjs/algiviz/core";

const iterator = iterateInsertionSortSteps([5, 2, 4, 2, 1]);
const start = iterator.next().value;
const selected = iterator.next().value;
iterator.return(); // Stop early when no more steps are needed.
```

Creating the generator does not read the input or run the algorithm. The first
`next()` copies and validates the input; invalid values throw at that point.
Changes to the input before the first `next()` are observed; later changes do not
affect the iterator. Each subsequent `next()` runs only to the next step. An
iterator is single-use; create a new one to restart. A `for...of` loop can also
consume it, and `break` closes it early.

When the consumer retains only a fixed number of snapshots, memory is O(n).
Every snapshot still copies n slots, so consuming the complete worst-case trace
still takes O(n³) time. Collecting the iterator into an array restores the full
history memory cost. Iteration is synchronous; a long loop can block the UI.

The existing `createSortTimeline` still requires an array of steps for seeking.
It does not accept this iterator directly. Use `createSortPlayer` for forward-only
playback; the generator itself provides no timing or backward seeking.

## Sequential playback

`createSortPlayer` consumes an iterable of steps and retains only the two adjacent
snapshots needed for rendering. With the lazy generator, playback uses O(n)
memory as long as the caller does not retain old frames.

```js
import { createSortPlayer, iterateInsertionSortSteps } from "@grundyjs/algiviz/core";
import { createSortRenderer } from "@grundyjs/algiviz/canvas";

const player = createSortPlayer(iterateInsertionSortSteps([5, 2, 4, 1]), {
    stepDurationMs: 650, finalHoldMs: 2000
});
const renderer = createSortRenderer({ theme: "dark" });
const ctx = canvas.getContext("2d");
let paused = false;
let speed = 1;
let last;
let requestId;
function tick(now) {
    const delta = last === undefined ? 0 : now - last;
    last = now;
    if (!paused) player.advance(delta * speed);
    renderer.render(ctx, player.frame);
    if (!player.finished) requestId = requestAnimationFrame(tick);
}
requestId = requestAnimationFrame(tick);
// Set paused = true/false or speed = 2 from your controls.
// On teardown: cancelAnimationFrame(requestId); player.dispose();
```

- Construction reads the first step immediately, including input validation by
  the generator. The initial `frame` is fully rendered at progress 1.
- `advance(deltaMs)` accepts finite, non-negative elapsed playback time and
  returns a `SortFrame` compatible with the existing canvas renderer. Zero does
  not consume steps. Pause by not advancing; multiply delta by a non-negative
  speed factor to change speed.
- `finished` becomes true after the final transition and `finalHoldMs`. Further
  advances return the final frame. There is no known total duration or seeking.
- The source must end with a `done` event. The player closes the iterator when
  that transition completes; unexpected exhaustion or source errors throw and
  close playback. `dispose()` closes early and is safe to repeat; afterward the
  frame remains readable but `advance()` throws.
- Restart by disposing the old player and creating a new player and generator.
  Large deltas synchronously consume all intervening steps, so limit the elapsed
  delta in the UI if resuming from a background tab should not cause a long catch-up.

## Timeline and canvas

Import `createSortTimeline` from `@grundyjs/algiviz/core` and `createSortRenderer` from `@grundyjs/algiviz/canvas`.
Step i completes at i * stepDurationMs; finalHoldMs extends the final frame. sample clamps finite times to the timeline range and rejects non-finite times. Frames include the current event for explanations and highlights.
The renderer draws a full frame using the canvas bitmap dimensions and restores context state. Signed values use magnitude for bar height and retain their sign in labels. Use small inputs for readable labels.

```js
import { createSortTimeline } from "@grundyjs/algiviz/core";
import { createSortRenderer } from "@grundyjs/algiviz/canvas";

const timeline = createSortTimeline(steps, { stepDurationMs: 650, finalHoldMs: 2000 });
const renderer = createSortRenderer({ theme: "dark" });
renderer.render(canvas.getContext("2d"), timeline.sample(3250));
```

Build, serve this project root using any static HTTP server, and open examples/index.html for play, pause, restart and seeking. The example changes bitmap size to fit its container; for video use a separate canvas with fixed export dimensions. Canvas rendering does not start any animation loop. There are no video recording dependencies.

The demo supports history (up to 64 items) and generator playback (up to 2,000).
Enter values or generate random, sorted or reversed arrays. Both modes support
pause, restart and speed changes; seeking is available only with full history.
Algorithm and mode changes restart the loaded array. Choose insertion or bubble
sort; both support both playback modes. These limits apply only to the demo.
Dense charts hide bar labels. Hidden tabs pause playback, and delayed frames cap
catch-up work to keep controls responsive.


## API at a glance

- `insertionSortSteps(values)` returns immutable `SortStep[]` snapshots. Empty arrays are valid.
- `bubbleSortSteps(values)` returns the same snapshot format for stable bubble sort.
- `iterateInsertionSortSteps(values)` and `iterateBubbleSortSteps(values)` yield snapshots lazily.
- `createSortPlayer(iterable, { stepDurationMs, finalHoldMs })` provides forward-only playback with `frame`, `advance(deltaMs)`, `finished` and `dispose()`.
- `createSortTimeline(steps, { stepDurationMs, finalHoldMs })` returns `durationMs` and `sample(timeMs)`. Frames expose `previous`, `current`, `progress`, `stepIndex` and `event`.
- `createSortRenderer({ theme: "dark" | "light" }).render(ctx, frame)` draws into a browser 2D canvas context. Drawing and animation scheduling remain separate.

For playback, call `timeline.sample(elapsedMs)` in your own requestAnimationFrame loop. For recording, use a fixed-size export canvas. Negative values are shown by magnitude with signed labels; the chart is not a signed-axis plot.

## Adding an algorithm

Create an application-owned generator with `defineArrayAlgorithm`, as shown
above. Add it to your application's controls or the demo registry. AlgiViz needs
no change when the existing operations are sufficient. For a new kind of state
or event, implement the generic playback contract and its renderer.

## Release

Run `npm test`, `npm pack --dry-run` and test the resulting tarball in a separate consumer project. Source and issues: [urffin/algiviz](https://github.com/urffin/algiviz). Publishing is a separate maintainer action.

### Publishing from GitHub Releases

The `.github/workflows/npm-publish.yml` workflow publishes to npm when a stable
GitHub Release is published (`release: published`). Drafts, prereleases and tag
pushes alone do not publish a package. The release tag must be `v` followed by
the exact version in `package.json` and `package-lock.json` (for example `v0.3.0`).
The workflow uses Node.js 24 and npm 11. The publish lifecycle runs the tests and
build before publishing with provenance, using npm trusted publishing (OIDC).

One-time setup in the npm package settings, under **Trusted Publisher**:

- Provider: GitHub Actions.
- Organization or user: `urffin`.
- Repository: `algiviz`.
- Workflow filename: `npm-publish.yml` (without the directory).
- Environment: leave empty; this workflow does not use a GitHub environment.
- Allow direct publishing with `npm publish` if the settings show this option.

No `NPM_TOKEN` secret is required. Keep account 2FA enabled.
See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

For each release, update the version and changelog, commit and push the changes
(including the workflow), then publish a GitHub Release for the matching tag at
that commit. Check the Actions run and the npm package version afterward. Do not
reuse an already published npm version; if setup failed before publication,
correct the settings and rerun the failed workflow.

