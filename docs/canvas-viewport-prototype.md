# Canvas viewport prototype

[Русский](ru/canvas-viewport-prototype.md) · [Plan](optional-player-proposal.md)

Assessment and local checks: 2026-11-12. The helper is
[example code](../examples/canvas-viewport.mjs), not an npm export. Package version
0.12.0, the five public entry points and existing Canvas renderer contracts are unchanged.

## What the examples need

| Integration | Existing sizing pattern | Finding |
| --- | --- | --- |
| [BFS](../examples/graph-demo.mjs) | CSS width, layout-dependent height, DPR bitmap and transform | The old `height + 2` assumed a particular border; content and border dimensions need distinct handling. |
| [Binary search](../examples/binary-search-demo.mjs) | Bounding rectangle width, wrapped rows, DPR bitmap and transform | Content-box width avoids treating borders or a post-layout CSS transform as logical scene dimensions. |
| [Boids](../examples/boids-demo.mjs) / [sand](../examples/sand-demo.mjs) | Similar sizing, with an explicit DPR cap of 2 | A cap belongs to the host's quality/memory choice, not to a hidden universal default. These demos are not migrated by this prototype. |
| [Array renderer](../src/canvas/index.ts) | Bitmap coordinates; identity transform during drawing | A CSS-coordinate helper must not silently change its layout, label thresholds or coordinate contract. |

The prototype is integrated into BFS and binary search. It centralizes sizing,
adds DPR-only notifications and explicit cleanup. It is not an FPS improvement
claim or a completed migration of every example; lifecycle handling also requires
host code that the previous observer snippets omitted.

## Proposed local interface

```js
import { createCanvasViewport } from './canvas-viewport.mjs';

let frame = null;
const viewport = createCanvasViewport(canvas, {
  onResize: redraw,
  maxPixelRatio: 2, // Optional explicit cap; default is uncapped.
});

function redraw() {
  if (!frame) return;
  const size = viewport.resize(width => Math.max(180, width * 0.6));
  if (size) draw(viewport.context, frame, size);
}

function render(nextFrame) {
  frame = nextFrame;
  redraw();
}
// On teardown: viewport.dispose().
```

The host sets an independent CSS width, for example `width: 100%`, and any minimum
logical size required by its layout. The helper owns inline CSS height and bitmap
dimensions. Competing `height`, `min-height`, `max-height`, aspect-ratio or
`!important` rules are outside this prototype's contract. Intrinsic-width feedback
and alternate writing modes are not supported. Drawing uses horizontal CSS content
coordinates; post-layout CSS transforms are not additional supersampling requests.

## Guarantees and ownership

- Construction acquires the canvas's 2D context and uses its owner window. Import
  itself accesses no DOM globals. `onResize` is required; construction does not
  synchronously invoke it. Observer delivery can schedule an initial notification.
- `resize(heightForWidth)` measures resolved CSS content width. For border-box
  sizing it subtracts horizontal padding/borders and adds vertical padding/borders
  when setting CSS height. Layout determines height; the callback must be pure.
- The result contains CSS `width`/`height`, `bitmapWidth`/`bitmapHeight` and the
  effective `pixelRatio`. Bitmap dimensions are rounded to integers, at least one.
  The transform uses actual bitmap-to-logical ratios on both axes, including
  rounding differences. The helper owns that base transform, not paint styles.
- Unchanged bitmap attributes are not reassigned, preserving existing pixels.
  Changed bitmap dimensions reset native context state; rendering must establish
  its paint settings again. The helper does not clear or redraw a frame itself.
- With no layout box or zero content width, resize returns null without evaluating
  height or modifying the bitmap/CSS height. This covers `display: none`; elements
  with `visibility: hidden` still have layout dimensions.
- Invalid heights and bitmap numeric overflow are rejected before CSS/bitmap
  writes. Native allocation limits remain browser-dependent; errors are not a
  pixel rollback guarantee. Notification callback failures propagate to the host.
- ResizeObserver, window resize and resolution-media changes coalesce into one
  RAF notification. Height-only feedback with unchanged width/insets/DPR is
  ignored. Notification does not request an algorithm state or own playback time.
- Disposal is terminal and idempotent: disconnect observation, remove DPR/window
  listeners and cancel queued work. It leaves CSS height, bitmap, transform and
  drawing intact. BFcache hosts create a new helper before reloading playback;
  both migrated demos register restoration in that order.

The implementation follows browser documentation for
[resolved CSS dimensions](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle),
[DPR changes and rearming resolution queries](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio),
and [deferring resize work to avoid observer feedback](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver).

## Verification and limits

`npm test`: **182 passed**, including ten new [viewport tests](../test/canvas-viewport.test.mjs).
They cover fractional geometry/DPR, both box models, unchanged attributes, source
consumption, capped and uncapped ratios, hidden/zero size, validation and cleanup.
The shared controller's existing tests now also cover browser-restored mode values
without changing the loaded frame or closing a source.

The embedded browser exercised both demos in history and generator modes at
390 × 844 and 1100 × 900. Actual DPR was **1**:

| Demo | Browser width | Content / bitmap width | Content / bitmap height |
| --- | ---: | ---: | ---: |
| BFS | 390 | 341 | 578 |
| BFS | 1100 | 1030 | 344 |
| Binary search | 390 | 343 | 384 |
| Binary search | 1100 | 1032 | 130 |

Resizing retained the Step 1 status in both modes and the 650 ms history position.
Returning to BFS restored a usable session. During this check the browser restored
a Generator select value over a fresh history session; the shared example
controller now synchronizes that select after pageshow, without reloading or
advancing playback. Console warnings/errors were empty after the fix. Temporary
viewport overrides were reset.

Fractional/high DPR and DPR-only changes are currently unit-tested with the host
harness, not certified on a physical high-DPI display. Direct native context
transform inspection was unavailable through the browser tool; exact transform
values are covered by the viewport tests. These local checks do not broaden the
browser support matrix or replace installed-package checks for a future export.

## Before a public API

Review naming, export placement and CSS-height/context ownership. Decide whether
a bitmap-only variant is needed for the array renderer. Check real high-DPI/zoom
changes and a host with appearing/disappearing layout before widening guarantees.
Then add types, installed consumers, export inventory and bundle-isolation checks
for an explicitly chosen entry point. Promotion and release remain separate steps.
