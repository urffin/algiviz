# Canvas viewport: accepted API contract

[Русский](ru/canvas-viewport.md) · [Prototype and checks](canvas-viewport-prototype.md)

Design fixed on 2026-11-12. **This entry point is not implemented or shipped in
0.12.0.** The running implementation remains example-only at `7ba76ba`; this
document defines the boundary for its later TypeScript/package implementation.

## Entry point and dependency boundary

The selected entry is **`@grundyjs/algiviz/canvas/viewport`**, with one runtime
export, `createCanvasViewport`, and three type-only exports: `CanvasViewport`,
`CanvasViewportOptions` and `CanvasViewportSize`.

It is an independent entry, not a re-export from `/canvas`, `/player` or a root
barrel. It does not import the array model, scene dispatch, array renderer,
playback, player UI or example modules. The existing `/canvas` contract remains
bitmap-based. The helper ships no controls, stylesheets, algorithms or framework
dependencies. Import evaluation performs no DOM access or global registration.
Creation requires a DOM canvas and its owner window, including ResizeObserver,
RAF/cancellation, resolution matchMedia and computed-style/layout access.
Declarations require DOM types; existing headless entries remain independent.

The future implementation file is `src/canvas/viewport.ts`, independent of
`src/canvas/index.ts`. Its explicit package mapping will be:

```json
"./canvas/viewport": {
  "types": "./dist/canvas/viewport.d.ts",
  "import": "./dist/canvas/viewport.js",
  "default": "./dist/canvas/viewport.js"
}
```

The existing `dist/canvas` allowlist will include these files. There will be no
wildcard/private-path exports, root export or new CommonJS entry. The mapping is
recorded here, not added to package.json before its target files exist.

## Public signatures

```ts
export interface CanvasViewportOptions {
  readonly onResize: () => void;
  readonly maxPixelRatio?: number | undefined;
}

export interface CanvasViewportSize {
  readonly width: number;
  readonly height: number;
  readonly bitmapWidth: number;
  readonly bitmapHeight: number;
  readonly pixelRatio: number;
}

export interface CanvasViewport {
  readonly context: CanvasRenderingContext2D;
  resize(heightForWidth: (width: number) => number): CanvasViewportSize | null;
  dispose(): void;
}

export declare function createCanvasViewport(
  canvas: HTMLCanvasElement,
  options: CanvasViewportOptions,
): CanvasViewport;
```

Use a factory, not a public constructor or an additional alias. Options are
captured on creation; later mutation of the supplied object has no effect.
The stable `context` is the canvas's 2D context. `onResize` is required and
synchronous when delivered; the helper does not await asynchronous callbacks.
`maxPixelRatio` is a positive number, including Infinity; omitted or explicitly
undefined means Infinity. Values below one intentionally permit lower resolution.
Changing the cap requires disposing and creating a new helper.

## Coordinates and ownership

| Owner | Responsibility |
| --- | --- |
| Application | DOM canvas, CSS width independent of bitmap width, minimum content size, placement, layout height function, clearing/drawing and playback/source lifecycle |
| Helper | Inline CSS height, bitmap width/height, base transform, size/DPR observation and queued invalidation |

The host keeps at most one active helper per canvas and does not concurrently write
its bitmap dimensions or override the helper's height. CSS must use horizontal
writing mode and leave height unconstrained: competing height/min-height/max-height,
aspect-ratio or `!important` rules and intrinsic-width feedback are outside this
contract. Padding and borders are supported in content-box and border-box sizing.
The application must express its minimum **content** size, rather than assuming
border-box width is the same value.

Logical dimensions are CSS content pixels before post-layout CSS transforms.
For border-box, horizontal padding/borders are subtracted from the resolved width;
vertical padding/borders are added when setting the requested content height.
For content-box, the requested height is assigned directly. The helper does not
supersample CSS transforms or supply pointer-coordinate conversion.

Let `r` be the owner's positive finite devicePixelRatio, falling back to 1 for an
invalid host value, then capped by maxPixelRatio. The result's `pixelRatio` is r:

```text
bitmapWidth  = max(1, round(width  × r))
bitmapHeight = max(1, round(height × r))
transform    = [bitmapWidth / width, 0, 0, bitmapHeight / height, 0, 0]
```

The effective transform can differ from r and between axes due to integer
rounding. Every successful resize establishes this transform, even when dimensions
are unchanged. The formula specifies the values supplied to setTransform; native
matrix readback can round them to the browser's implementation precision. Bitmap
attributes are assigned only when their values differ.
Unchanged dimensions retain pixels and other context settings; changed dimensions
reset native canvas state. Drawing must re-establish its paint settings and use
balanced save/restore for local transforms or clipping. The helper does not clear,
draw, restore arbitrary caller context state or roll back pixels.

This is a **CSS-coordinate helper**. The array renderer keeps reading native bitmap
dimensions and drawing under an identity transform; using the helper does not
turn that renderer into a CSS-coordinate renderer. The first contract adds no
bitmap mode, renderer adapter or changes to its label thresholds.

## Resize and invalidation

`resize` synchronously measures width, calls the pure heightForWidth function
with positive CSS content width, validates its result and applies sizing. The
returned metrics are immutable. The callback must not mutate layout, canvas
dimensions or the helper while measuring.

Without a measurable layout box, including display:none or zero content width,
resize returns null. It does not call heightForWidth or change CSS height,
bitmap or transform. The function argument is still validated first. An element
with visibility:hidden retains layout and can be resized normally. A later
measurable width can invalidate the viewport again.

`onResize` is an invalidation notification, not an automatic resize or render.
Construction does not call it synchronously. Initial observer delivery may cause
a deferred notification; the host must tolerate having no frame yet. ResizeObserver,
window resize and resolution changes are coalesced into at most one pending RAF
callback. There is no per-event count or immediate/background delivery guarantee.

Only changes in measured content width, applicable vertical insets or effective
DPR require notification. The helper rearms its resolution query when raw DPR
changes, even if the cap prevents a redraw. Height-only feedback and a measurement
already handled by resize do not force another notification. Calling resize
does not synchronously call onResize.

The helper never owns elapsed time, iterators or retained algorithm states.
To preserve playback, the host's notification redraws its current frame without
calling next/advance or restarting a source. The host redraws explicitly when
data or the height policy changes without a width/DPR change.

## Errors and disposal

| Condition | Result |
| --- | --- |
| Wrong canvas/onResize/height function | TypeError |
| Invalid cap, non-positive/non-finite height or numeric bitmap overflow | RangeError |
| No 2D context or required browser facility | Error or the original host exception |
| Resize after disposal, or disposal during height calculation | Error; no subsequent sizing writes |
| Height callback throws | The original error; no sizing writes by that resize |
| Browser setup fails after acquiring resources | Partial observers/listeners are released; the primary error is preserved |
| Native CSS/bitmap/transform operation fails | Error propagates; already-applied native changes are not rolled back |
| onResize throws | Error propagates to the host; the helper remains disposable and does not automatically retry the same invalidation |

Height is a positive finite number. Rounded bitmap dimensions must be safe
integers no greater than 2^32−1; CSS height including insets must be finite.
Validation completes before sizing writes. Actual allocation limits are
browser-dependent. Exact error message strings are not part of the contract.

Dispose is synchronous, terminal and idempotent. It cancels queued notification,
disconnects the observer and removes window/media listeners. CSS height, bitmap,
transform and the last drawing remain intact. After disposal, resize throws;
the context remains a caller-owned native object. No automatic pagehide behavior
is added to this lower-level helper. Hosts dispose on unmount/pagehide and create
a new helper on persisted pageshow **before** restoring playback that can draw.

## Implementation gates

The contract and entry choice are fixed; implementation and release are separate.
Native visibility checks passed in the embedded browser at DPR 1. Desktop Chrome
real zoom/DPR checks passed on 2026-11-13 from DPR 1 through 2.5, with capped and
uncapped sizing and restoration of the original scale. All twelve native cases
passed at 1.25, 2.5 uncapped/capped and restored 1. Physical HiDPI displays remain
unverified; see the [report](canvas-viewport-prototype.md#native-chrome-zoom-follow-up).

Then implement the signatures, add installed-package consumers, DOM-free runtime
import checks, selected TypeScript configurations, exact exports/private-path
rejection and bundle fixtures. Existing-only bundles must remain unchanged; the
new direct entry must not load array/scene/player dependencies. CI must pass for
the exact future candidate. A feature release is planned as 0.13.0; this document
does not create that release or advance the separate 1.0 decision.
