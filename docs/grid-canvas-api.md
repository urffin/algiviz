# Grid Canvas API: /canvas/grid

[Русский](ru/grid-canvas-api.md) · [Grid API](grid-api.md) · [Tree Canvas](tree-canvas-api.md) · [Viewport](canvas-viewport.md) · [Compatibility](api-compatibility.md)

**Version 1.3.0.** Independent /canvas/grid exports createGridRenderer and
the five types below. Headless /grid remains a separate DOM-free entry.
The package has 14 entries, 30 runtime names and 155 type-only exports (143 distinct).
The twelve previous entries are preserved. [Changes and migration](candidate-1.3.md) ·
[Readiness review](grid-readiness-1.3.md) · [Native acceptance](checks/grid-canvas-browser-2026-11-20.json).

## Public declarations

Public declarations for @grundyjs/algiviz/canvas/grid in 1.3.0.

```ts
import type { GridCellView, GridSnapshot, GridFrame } from "@grundyjs/algiviz/grid";

export interface GridPalette {
    readonly background: string;
    readonly cell: string;
    readonly border: string;
    readonly text: string;
    readonly caption: string;
    readonly active: string;
    readonly visited: string;
    readonly queued: string;
    readonly result: string;
    readonly resultText: string;
    readonly path: string;
}
export interface GridCellPresentation {
    readonly label?: string | undefined;
    readonly color?: string | undefined;
}
export interface GridRendererOptions<Value = unknown> {
    readonly theme: "light" | "dark";
    readonly colors?: { readonly [K in keyof GridPalette]?: string | undefined } | undefined;
    readonly roleColors?: Readonly<Record<string, string>> | undefined;
    readonly cellGap?: number | undefined;
    readonly presentCell?: ((this: void, cell: GridCellView<Value>, snapshot: GridSnapshot<Value>) => GridCellPresentation | undefined) | undefined;
    readonly cellCaptions?: "auto" | "hidden" | undefined;
    readonly path?: "visible" | "hidden" | undefined;
}
export interface GridRenderSize {
    readonly width: number;
    readonly height: number;
}
export interface GridRenderer<Value = unknown> {
    render<Event>(context: CanvasRenderingContext2D, frame: GridFrame<Value, Event>, size: GridRenderSize): void;
}
export declare function createGridRenderer<Value = unknown>(
    options: GridRendererOptions<Value>
): GridRenderer<Value>;
```

The factory captures options once and returns a frozen renderer with **render
only**. Regular layout is automatic; there is no layout/setLayout, source,
viewport, hit-test or dispose method, automatic coordinate headers or legend. The caller owns Canvas, sizes and redraw
scheduling. The renderer retains immutable options/callback references, but no
context, frame, snapshot, presentation output or history after a call.

Defaults: `cellGap: 0.1` logical cell-side units, `cellCaptions: "auto"`,
`path: "visible"`, no presenter. Theme is required. Color overrides and role maps
are copied; later mutation does not change the renderer. Unknown roles use the
presentation/base fill. Roles are open strings, not a closed enum.

| Palette field | light | dark |
| --- | --- | --- |
| background | #f8fafc | #101827 |
| cell | #e2e8f0 | #334155 |
| border | #94a3b8 | #64748b |
| text | #0f172a | #f1f5f9 |
| caption | #475569 | #cbd5e1 |
| active | #fbbf24 | #fbbf24 |
| visited | #94a3b8 | #64748b |
| queued | #c4b5fd | #a78bfa |
| result | #047857 | #34d399 |
| resultText | #ffffff | #052e16 |
| path | #1d4ed8 | #fbbf24 |

Colors must be valid CSS color strings. The library validates nonempty primitive
strings; parsing and color-space behavior belong to Canvas. This is not an
automatic contrast checker. Custom result colors preserve membership priority.

## Regular layout and bitmap ownership

Within a frame, **rows and columns must match between endpoints**, including
zero-area grids. A mismatch is RangeError before callbacks or Canvas methods.
Separate calls may use another shape, for example after Restart. Cells keep
coordinate identity; replacing/swapping values does not move them.

For positive-area grids with logical width/height greater than 8 CSS px:

```text
LW = columns + (columns - 1) * cellGap
LH = rows    + (rows    - 1) * cellGap
side = min((width - 8) / LW, (height - 8) / LH)
left = (width  - LW * side) / 2
top  = (height - LH * side) / 2
cell(row, column) = [left + column * (1 + cellGap) * side,
                     top + row    * (1 + cellGap) * side, side, side]
```

Cells are square in logical coordinates, rows downward, columns rightward. The
complete board is centered with at least **4 CSS px** painted margin. Labels,
roles, results, paths and progress never alter fitting. For 3 columns × 2 rows,
gap 0.1 and 328×218, side is 100, origin is (4,4), and cell (1,2) starts at
(224,114). No pixel coordinates enter GridSnapshot.

Fill stays inside each cell rectangle. Border width is min(1, side/4) CSS px,
inset by half its width so the complete stroke remains inside that rectangle.
Computed zero-width strokes are omitted. Path width/halo are bounded below;
their rounded caps also remain within board bounds. Safe reservations include
painted strokes, not just their centerlines. Nonfinite, nonpositive required
scales, overflow or unrepresentable safe geometry cause RangeError before paint.
Validate the final painted bounds against the inset viewport after arithmetic.
Rounding-sized inward adjustments are allowed and must be shared by cells, text
and path anchors; ordinary floating-point roundoff must not reject a safely
representable layout. The formula describes the ideal real-valued layout.

Zero-area grids paint the background only, without division by zero, callbacks
or measurements. Positive sizes with width/height at most 8 also paint background
only. Zero logical or bitmap dimensions are a no-op after input, pair-shape and
bitmap validation, with no Canvas methods or presenter calls; skipped fitting
does not validate hypothetical geometry. Every endpoint is still validated.

Size is explicit logical width/height, finite and nonnegative. Read canvas.width
and canvas.height, but never resize them or read CSS, window.devicePixelRatio or
DOM layout. Use bitmap/logical ratios independently; each must be finite and
positive for drawing. DPR, resize/redraw and resource cleanup belong to the
caller or existing viewport. First scope is HTML Canvas 2D, not OffscreenCanvas.

## Value presentation and callback ownership

With no presenter, cells have no primary label and use palette/role/result fills.
There is no automatic String(Value), numeric interpolation, wall sentinel or
inspection of payload properties. Captions remain independent recorded strings.
For numbers an application may explicitly supply:

```ts
const renderer = createGridRenderer<number>({
    theme: "light",
    presentCell: ({ value }) => ({ label: String(value) }),
});
```

For every drawable render, capture and validate **both complete endpoints and
their shared shape before callbacks**. Call presentCell synchronously for **current only**,
row-major, once per cell, including progress zero or identical endpoint references.
Previous values need no presentation because cells/labels/fills are discrete-current.
Calls receive a frozen current GridCellView and captured,
structurally copied/frozen GridSnapshot. Opaque Value references remain caller-
owned; deep freezing/cloning them is not promised. No event/context is passed,
and `this` is undefined. Outputs are captured immediately before the next call.

Callbacks must be pure functions of these arguments and immutable captured
configuration, so redraw/rewind is reproducible. No source reads, drawing or
mutation of retained payloads. Functions stay on the host and are not Worker
data. Undefined return or an empty record means no label/fill override. Null,
Promise or another non-plain return is TypeError. Recognized label/color fields
must be own data properties: optional undefined omits, label must be a primitive
string (empty is valid), color a nonempty primitive string. Unknown fields are
ignored without reading; accessors are rejected without invocation. Original
callback/Proxy throws, including falsy values, escape unchanged.

All callback results are validated even when a role/result overrides their fill,
the path/captions are hidden, or the current path has zero opacity. There are
no callbacks for nondrawable/empty grids as defined above. No results are cached
between calls. Same-renderer recursive render fails with Error before argument
inspection; busy covers validation, callbacks, measurement, paint and restore,
and is released in finally. Reading snapshots/gridScene remains allowed.

## Labels and captions

Retained cells use **current** label, caption and role at every progress, including
zero. Normalize CR/LF and Unicode line-separator sequences to one space for
one-line presentation only; snapshot strings stay unchanged. No ID/value fallback,
implicit ellipsis or compressed fillText(maxWidth). Empty/absent labels draw no
text; empty captions remain a recorded clear-looking string, distinct from null.

Text fits inside a cell inset by **2 CSS px** on every side. Use measured advance
and ink bounds in centered sans-serif text, alphabetic baseline. Primary sizes
are 14 down to 8 CSS px in integer steps; caption sizes 11 down to 8. First try
both, with label above caption and at least 2 CSS px between measured boxes,
centered together. Prefer the largest label size, then largest caption size that
fits. Otherwise draw the largest fitting label centered; if no label fits, try
caption alone centered. If nothing fits, omit text. Hidden captions are not
measured; their snapshot data is still validated. Cells/selection never disappear
because text does not fit.

Use the union of advance bounds [-width/2,width/2] and supplied actual ink bounds
[-actualBoundingBoxLeft,actualBoundingBoxRight]. Vertically union ink with
[-0.8*fontSize,0.2*fontSize]. Missing actual metrics use that font/advance fallback;
provided metrics must be finite, advance width nonnegative. Invalid metrics or
unrepresentable boxes are RangeError before clear/paint. Native metric getter
errors retain identity. Font-specific raster identity is not promised.

## Green result and paths

Cell fill priority is **result membership → custom role color → active/visited/
queued → presenter color → palette.cell**. Membership is the union of result.cells
and result.path coordinates from the snapshot; role "result" alone selects nothing.
Result text/caption use resultText, otherwise text/caption palette fields. Green
is the stock result fill. Values, labels, captions and fills switch discretely to
current; no result/event cache or numeric value/color interpolation is introduced.
Rewind to a state without a result removes the green selection immediately.

A path connects cell centers in recorded order. Preserve repetitions and reverse
visits; draw non-neighbor pairs directly without invented cells, adjacency or
wall validation. Zero-length consecutive pairs are visually skipped; a singleton
or all-repeated path has no stroke. No arrows, visit numbers or inferred graph
edges are added. path:"hidden" hides only the stroke, retaining green membership.

Paint fills/inset borders, paths, then text. A route uses a background-colored
halo of min(5, side/3) CSS px and path-colored core of min(3, side/5), round caps/
joins. Clip route strokes out of all planned label/caption boxes expanded by
1 CSS px; these disjoint reservations fit inside cells and may touch at boundaries.
This prevents routes crossing text without background overpainting. Native
even-odd clipping or an equivalent union exclusion may implement the plan.

Compare full coordinate sequences, including repetitions. Identical endpoint
paths paint once at full opacity. A changed path paints previous at **1-progress**
and current at **progress**, previous first, each with its own halo/core. Empty
paths contribute no route. Do not morph vertices or deduplicate shared segments
between the two routes. Raw progress is used, without clamping/easing. Cells stay
fixed, so interpolation animates path presence/replacement; it does not move
values or blend arbitrary labels/colors. Current green cells can therefore be
visible at progress zero while a new route has zero opacity.

| Changed-path progress | Cell fill/label/caption | Previous route | Current route |
| --- | --- | --- | --- |
| 0 | current | 1 | 0 |
| 0.5 | current | 0.5 | 0.5 |
| 1 | current | 0 | 1 |

## Validation, host failures and context recovery

Constructor fields are captured in declaration order before scalar validation:
theme, colors, roleColors, cellGap, presentCell, cellCaptions, path. Plain records,
own-data/unknown-property rules match /grid. Role maps capture own string names
in JS property order, rejecting empty names, accessors and non-string/empty
values; symbols are ignored. Wrong types/options/enums throw TypeError;
negative/nonfinite gap returns RangeError. No callback runs at construction.

Render priority is: busy; size descriptors and width/height; frame descriptors
in progress/previous/current order; progress in [0,1]; previous then current grid
validation; matching shapes; canvas/bitmap dimensions; drawable layout and safe
arithmetic; presentations in the order above; context setup and text planning;
paint. Hidden data remains validated. Frame.event and stepIndex are not read or
validated, even when accessors; state-only async/Worker frames are supported.

Before pixels, save context, set the bitmap/logical transform and neutralize
alpha/composite/filter/shadows/dashes/text state, including supported spacing/
kerning fields. Prepare the complete measured/clipped plan, then clearRect the
full logical rectangle, paint background and draw. Transparent background
overrides do not accumulate preceding pixels. The caller supplies an unclipped
context and owns its current path; save/restore does not preserve path contents.

Never restore a save that failed. Attempt restoration of every acquired nested
save in reverse order, including route clipping. The first setup/measurement/
drawing error wins over restore errors, including undefined/null/false throws;
an otherwise standalone restore error escapes. Busy always clears. Pixels painted
before a host failure are not rolled back; working native restore is assumed.
External callback/Proxy side effects cannot be rolled back.
No context/history cache survives a call, so ordinary bitmap/context reset and
the next redraw require no renderer reconstruction. No forced GPU recovery or
browser/version support expansion is promised here.

Rendering and text/route planning are synchronous work over cells and paths.
The grid size ceiling is not a frame-time guarantee; the Player read budget
cannot preempt one callback/render. No sparse/dirty-region optimization or
performance benchmark is promised.

## Implementation verification and release boundary

The [implementation record](checks/grid-canvas-implementation-2026-11-20.json)
records permanent renderer/Player regressions, the full suite, installed
consumers on supported compilers and independent static/lazy bundles.
[Native acceptance](checks/grid-canvas-browser-2026-11-20.json) passed 18 checks:
12 theme/size/backing-ratio combinations × 4 progress values, actual text/path
pixels, presenter, results, context/bitmap reset, transparent rewind and both
Player modes with real controls, resize/DPR and cleanup. This is the recorded
embedded Chromium host, not expanded browser support or forced GPU loss coverage.

The [contract record](checks/grid-canvas-contract-2026-11-20.json) retains its
historical declaration-only scope. Current acceptance checks the implementation.
The exact 1.3.0 archive and identity of reused native acceptance are recorded in
[candidate preparation](checks/candidate-1.3.0-2026-11-20.json). CI and publication
are separate gates; see [candidate notes](candidate-1.3.md).

## Pathfinding example

[Grid BFS](../examples/grid-player.html) combines createGridTrace, this renderer
and Player: distances, a shortest path, green result, bounded rewind and Restart.
The detailed [maze](../examples/maze.html) remains a separate example.
[Walkthrough and checks](examples.md#grid-bfs-shortest-path).
