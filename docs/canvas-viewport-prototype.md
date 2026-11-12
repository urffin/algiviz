# Canvas viewport prototype

[Русский](ru/canvas-viewport-prototype.md) · [Plan](optional-player-proposal.md)

Prototype assessment and checks through 2026-11-13 are recorded below. The helper
was moved to [src/canvas/viewport.ts](../src/canvas/viewport.ts) afterward for the
next release; BFS and binary search now use the public import. Published 0.12.0
keeps five entries; the repository adds the sixth without changing existing contracts.

The [accepted API contract](canvas-viewport.md) now fixes the future entry as
`@grundyjs/algiviz/canvas/viewport`. This report records prototype behavior and
verification; the contract now also describes the package implementation.

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

## Local prototype interface

```js
import { createCanvasViewport } from '@grundyjs/algiviz/canvas/viewport';

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

Fractional/high DPR and DPR-only changes were initially unit-tested with the host
harness; the real Chrome zoom follow-up below adds native browser evidence,
without certifying a physical high-DPI display. Direct native context
inspection through the browser tool was unavailable in that first run; the
follow-up fixture below exposes native readbacks in its UI. These local checks
do not broaden the browser support matrix or replace installed-package checks.

## Native hidden-to-visible follow-up

The [browser fixture](../test/canvas-viewport-browser.html) imports the actual
prototype and public playback entry. Build the project, serve the repository,
open `/test/canvas-viewport-browser.html`, click Next state, then Run browser checks.
The page uses real Canvas/ResizeObserver and no DPR override or CSS zoom.

Embedded-browser result on 2026-11-12: **12 passed, 0 failed, actual DPR 1**.
Both content-box and border-box passed fractional geometry/transform, unchanged
resize retaining a painted pixel, display:none preserving bitmap/transform,
automatic redraw on becoming visible at a different width, settled height
feedback, and terminal disposal stopping delivery while preserving pixels.
The generator remained at Step 1 with two reads throughout. Native and console
error lists were empty.

The final content size was 319.25 × 159.75, bitmap 319 × 160. Native transform
readback was approximately 0.9992169142 / 1.0015649796. Canvas can round stored
matrix values; the browser check uses a 1e-6 relative tolerance rather than
claiming exact double-precision readback. Unit tests still check the exact values
supplied to setTransform.

The embedded browser's zoom shortcut left reported DPR at 1; its capability
controls viewport size only. The following Chrome check closes that zoom gate.

## Native Chrome zoom follow-up

On 2026-11-13, the same fixture ran in desktop Chrome on Windows, with reported
UA Chrome/157.0.0.0. Native browser zoom shortcuts changed the real DPR; no device
scale override or CSS zoom was used. All actions stayed in the designated test
tab, loaded by entering its URL in the active blank tab.

| Reported DPR | Effective ratio | Bitmap for 319.25 × 159.75 CSS content |
| ---: | ---: | ---: |
| 1, original and restored | 1 | 319 × 160 |
| ≈1.1 | ≈1.1 | 351 × 176 |
| 1.25 | 1.25 | 399 × 200 |
| 1.5 | 1.5 | 479 × 240 |
| 1.75 | 1.75 | 559 × 280 |
| 2 | 2 | 639 × 320 |
| 2.5 | 2.5 | 798 × 399 |
| 2.5, maxPixelRatio 2 | 2 | 639 × 320 |

At ≈1.1 the browser resolves CSS width to 319.247 rather than 319.25; the bitmap
and transform use that measured width. Automatic redraw retained Step 1 and two
source reads through the zoom transitions and cap changes. Returning below the
cap updated the effective ratio again. The original DPR, bitmap and transform
were restored, and the optional cap was unchecked as before.

All **12 native cases passed** at DPR 1.25, DPR 2.5 uncapped, DPR 2.5 capped at 2,
and restored DPR 1. A repeated run at 1.25 also passed. Native errors and console
warnings/errors were empty. The repeat exposed a fixture-only counting bug:
the prior body result was counted as another passed case. Counts and result
colors now target only check-list entries; running clears the prior body result.
The fixture also records its user agent in the visible metrics.

This is prototype verification in one Chrome configuration, not certification of
all Chrome versions or a physical display/DPR migration. Physical HiDPI displays
and other browser products remain separate coverage. The package follow-up below records the subsequent implementation checks.

## Before a public API

Naming, export placement and CSS-height/context ownership are fixed in the
[contract](canvas-viewport.md): `createCanvasViewport` from `/canvas/viewport`,
with CSS coordinates and no bitmap adapter in the first scope. Native visibility
and real zoom/DPR checks are complete for the recorded prototype hosts.
The TypeScript/package implementation is now present for the next release.
Its compiled-entry native check and implementation CI are recorded below.
A versioned release candidate still needs its own CI and release approval.

## Package follow-up, 2026-11-13

The independent `/canvas/viewport` implementation replaces the local JavaScript
copy. BFS, binary search and the browser fixture import the new entry. There are
no changes to the existing module implementations or to the published version.

Local verification: **184 tests passed**, including twelve viewport contract
tests. All twelve also pass against the installed tarball. Strict consumers pass
on TypeScript 5.0.4, 5.4.5, 5.9.3 and 6.0.3 with NodeNext and Bundler; no-DOM
headless consumers and DOM-free viewport runtime import pass. The exact installed
export inventory and private-path rejection include the new entry.

Raw/minified old four-entry bundles and static/dynamic Player bundles are
byte-identical without viewport files present. The direct viewport bundle imports
only its own module: 4,496 raw / 2,456 minified / 1,162 minified gzip bytes in
esbuild 0.28.2, Node 22.17.0 on Windows. Dynamic viewport loading adds 86 initial
minified bytes to the four-entry fixture and defers the helper. These are local
fixture measurements, not a registry-release or universal application comparison.

Implementation commit `a05bd48953865bcd36e58143e61eb12821237870` passed all eleven
[CI jobs](https://github.com/urffin/algiviz/actions/runs/43323095050). The initial
browser connection limit was resolved; the following check now covers the
compiled public entry, independently of the earlier prototype results.

## Native checks after package transfer

On 2026-11-13 the browser fixture was rerun at `a05bd48` in desktop Chrome on
Windows (reported UA Chrome/157.0.0.0). The import map resolves the public
`@grundyjs/algiviz/canvas/viewport` to `dist/canvas/viewport.js`. The served file
was byte-identical to the local compiled file, and an in-memory TypeScript build
matched it. This checks the committed local build, not a registry tarball in a browser.

| Native configuration | Passed cases | Final bitmap |
| --- | ---: | ---: |
| Original DPR 1 | 12/12 | 319 × 160 |
| DPR 1.25 | 12/12 | 399 × 200 |
| DPR 2.5, uncapped | 12/12 | 798 × 399 |
| DPR 2.5, maxPixelRatio 2 | 12/12 | 639 × 320 |
| Restored original DPR 1 | 12/12 | 319 × 160 |

All five runs cover both box models: fractional sizing/transform, unchanged-size
pixel preservation, display:none, automatic redraw after showing at a new width,
settled height feedback, and idempotent terminal dispose retaining pixels while
stopping delivery/rejecting resize. Intermediate native zoom DPRs ≈1.1, 1.5,
1.75 and 2 also automatically updated the bitmap.

An additional live hidden-zoom check hid the capped Canvas at DPR 2.5 and changed
native zoom to DPR 1.75. It retained bitmap 639 × 320, transform and height-call
count while hidden; showing it automatically resized to 559 × 280. Every record
kept Step 1 and two source reads. The original DPR, bitmap, transform, visibility
and uncapped setting were restored. Native and console error lists were empty.
No other tab was selected. Physical-display transitions and other browser
products remain separate coverage; no release or support expansion is implied.
