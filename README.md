# AlgiViz

A TypeScript library for educational algorithm visualization: stable insertion sort traces, a seekable timeline and a canvas renderer. No runtime dependencies. The core works without DOM, React or Next.js. ESM only, with TypeScript declarations.

## Install

```sh
npm install algiviz
```

Try the [interactive insertion sort demo](https://grundyjs.ru/algorithms/insertion-sort/). Import the core from `algiviz/core` and the browser renderer from `algiviz/canvas`; there is no root entry point or CommonJS build. Version 0.1 is an initial API and may change in later minor releases.

## Development

Requires Node.js 22 or later and npm.

```sh
npm install
npm test
npm pack
```

Build output includes ESM and TypeScript declarations. `npm pack` rebuilds automatically; `npm publish` runs the tests before packing. The archive includes only dist, README, LICENSE, CHANGELOG and package metadata. Licensed under MIT.

```js
import { insertionSortSteps } from "algiviz/core";

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

## Timeline and canvas

Import `createSortTimeline` from `algiviz/core` and `createSortRenderer` from `algiviz/canvas`.
Step i completes at i * stepDurationMs; finalHoldMs extends the final frame. sample clamps finite times to the timeline range and rejects non-finite times. Frames include the current event for explanations and highlights.
The renderer draws a full frame using the canvas bitmap dimensions and restores context state. Signed values use magnitude for bar height and retain their sign in labels. Use small inputs for readable labels.

```js
import { createSortTimeline } from "algiviz/core";
import { createSortRenderer } from "algiviz/canvas";

const timeline = createSortTimeline(steps, { stepDurationMs: 650, finalHoldMs: 2000 });
const renderer = createSortRenderer({ theme: "dark" });
renderer.render(canvas.getContext("2d"), timeline.sample(3250));
```

Build, serve this project root using any static HTTP server, and open examples/index.html for play, pause, restart and seeking. The example changes bitmap size to fit its container; for video use a separate canvas with fixed export dimensions. Canvas rendering does not start any animation loop. There are no video recording dependencies.

## API at a glance

- `insertionSortSteps(values)` returns immutable `SortStep[]` snapshots. Empty arrays are valid.
- `createSortTimeline(steps, { stepDurationMs, finalHoldMs })` returns `durationMs` and `sample(timeMs)`. Frames expose `previous`, `current`, `progress`, `stepIndex` and `event`.
- `createSortRenderer({ theme: "dark" | "light" }).render(ctx, frame)` draws into a browser 2D canvas context. Drawing and animation scheduling remain separate.

For playback, call `timeline.sample(elapsedMs)` in your own requestAnimationFrame loop. For recording, use a fixed-size export canvas. Negative values are shown by magnitude with signed labels; the chart is not a signed-axis plot.

## Release

Run `npm test`, `npm pack --dry-run` and test the resulting tarball in a separate consumer project. Public source repository metadata will be added after the repository is created; no repository URL is claimed here. Publishing is a separate maintainer action.
