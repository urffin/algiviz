# AlgiViz

A TypeScript library for educational algorithm visualization: stable insertion sort traces, a seekable timeline and a canvas renderer. No runtime dependencies. The core works without DOM, React or Next.js. ESM only, with TypeScript declarations.

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
Mode changes restart the loaded array. These limits apply only to the demo.
Dense charts hide bar labels. Hidden tabs pause playback, and delayed frames cap
catch-up work to keep controls responsive.


## API at a glance

- `insertionSortSteps(values)` returns immutable `SortStep[]` snapshots. Empty arrays are valid.
- `createSortTimeline(steps, { stepDurationMs, finalHoldMs })` returns `durationMs` and `sample(timeMs)`. Frames expose `previous`, `current`, `progress`, `stepIndex` and `event`.
- `createSortRenderer({ theme: "dark" | "light" }).render(ctx, frame)` draws into a browser 2D canvas context. Drawing and animation scheduling remain separate.

For playback, call `timeline.sample(elapsedMs)` in your own requestAnimationFrame loop. For recording, use a fixed-size export canvas. Negative values are shown by magnitude with signed labels; the chart is not a signed-axis plot.

## Release

Run `npm test`, `npm pack --dry-run` and test the resulting tarball in a separate consumer project. Source and issues: [urffin/algiviz](https://github.com/urffin/algiviz). Publishing is a separate maintainer action.

