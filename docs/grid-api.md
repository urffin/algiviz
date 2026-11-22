# Grid API: /grid

[Русский](ru/grid-api.md) · [Architecture sketch](grid-contract.md) · [Current API](current-api.md) · [Compatibility](api-compatibility.md)

**API since 1.3.0; unchanged in 1.3.1.** Independent headless ESM entry /grid exports createGridTrace,
gridScene and the 22 types below. /canvas/grid is a separate optional backend.
The package surface is 14 entries, 30 runtime names and 155 type-only exports
(143 distinct). The twelve previous entries are unchanged; grid imports need 1.3.0.
[Changes and migration](release-1.3.md).

## Scope and coordinates

The first model is a finite dense rectangular matrix of generic values. Shape
is fixed for a trace. Coordinates are zero-based `(row, column)`, with row
increasing downwards and column to the right in the stock presentation.
Storage is flat row-major: `row * columns + column`. This offset is not an ID.

Rows and columns are safe integers in **0…1,000,000**, inclusive; their product
must be at most **1,000,000 cells**. Values contain exactly that many own data
elements. These are validation ceilings, not a memory, frame-time or practical
rendering-size promise. Check sizes before copying elements or allocating an
endpoint scene. A path is separately limited to 1,000,000 entries; other cell
lists cannot exceed the cell count. No configurable limit is introduced here.

`0×0`, `0×N` and `N×0` retain their distinct shape with empty values and no valid
coordinates. A coordinate must be a safe integer pair within bounds; `-0`
normalizes to `0`. Horizontal movement cannot wrap by incrementing a flat index.

The identity of a cell is its grid namespace and coordinate. Writing or swapping
values does not move cells. Moving particles/tokens require application-owned
entity IDs and additional scene kinds. Generic values are opaque: `0`, `false`,
`""`, `null`, present `undefined`, `NaN` and infinities are values when allowed by
the application's type/policy. The module neither coerces them nor reserves wall,
empty or obstacle sentinels. A hole is never a present undefined value.

First scope excludes resizing, ragged/sparse/typed-array storage, row/column IDs,
region syntax, adjacency, numeric matrix operations and built-in algorithms.
Rectangular regions can be explicitly expanded to coordinate lists by an
application. Payload values may themselves be typed arrays, but remain opaque
and application-owned; this grants no shared-memory or transfer exception.

## Public declarations

Public declarations for @grundyjs/algiviz/grid in 1.3.0.

```ts
import type { Step, Frame } from "@grundyjs/algiviz/playback";
import type { Scene } from "@grundyjs/algiviz/scene";

export interface GridCoordinate {
    readonly row: number;
    readonly column: number;
}
export interface GridInput<Value = unknown> {
    readonly rows: number;
    readonly columns: number;
    readonly values: readonly Value[];
}
export interface GridWrite<Value = unknown> extends GridCoordinate {
    readonly value: Value;
}
export interface GridAnnotation extends GridCoordinate {
    readonly role: string;
}
export interface GridMark extends GridCoordinate {
    readonly role: string | null;
}
export interface GridCellCaption extends GridCoordinate {
    readonly text: string;
}
export interface GridCellCaptionPatch extends GridCoordinate {
    readonly text: string | null;
}
export interface GridMarkUpdate {
    readonly cells?: readonly GridMark[] | undefined;
    readonly cellCaptions?: readonly GridCellCaptionPatch[] | undefined;
}
export interface GridResultInput {
    readonly cells?: readonly GridCoordinate[] | undefined;
    readonly path?: readonly GridCoordinate[] | undefined;
}
export interface GridResult {
    readonly cells: readonly GridCoordinate[];
    readonly path: readonly GridCoordinate[];
}
export interface GridDoneOptions {
    readonly result?: GridResultInput | undefined;
}
export interface GridTraceOptions {
    readonly cellCaptions?: readonly GridCellCaption[] | undefined;
}
export type GridEdit<Value = unknown> = Readonly<{
    readonly rows?: undefined;
    readonly columns?: undefined;
    readonly marks?: GridMarkUpdate | undefined;
} & (
    | { readonly values: readonly Value[]; readonly writes?: undefined }
    | { readonly values?: undefined; readonly writes?: readonly GridWrite<Value>[] | undefined }
)>;
export interface GridSnapshot<Value = unknown> {
    readonly grid: GridInput<Value>;
    readonly cellMarks: readonly GridAnnotation[];
    readonly cellCaptions: readonly GridCellCaption[];
    readonly result: GridResult | null;
}
export type GridEvent = Readonly<
    | { type: "start" }
    | { type: "edit" }
    | { type: "mark"; cells: readonly GridMark[]; cellCaptions: readonly GridCellCaptionPatch[] }
    | { type: "done" }
>;
export type GridStep<Value = unknown> = Step<GridSnapshot<Value>, GridEvent>;
export type GridFrame<Value = unknown, Event = GridEvent> = Frame<GridSnapshot<Value>, Event>;
export interface GridTrace<Value = unknown> {
    readonly state: GridSnapshot<Value>;
    start(): GridStep<Value>;
    edit(update: GridEdit<Value>): GridStep<Value>;
    mark(update: GridMarkUpdate): GridStep<Value>;
    done(options?: GridDoneOptions): GridStep<Value>;
}
export interface GridSceneOptions {
    readonly namespace: string;
}
export interface GridCellView<Value = unknown> extends GridCoordinate {
    readonly value: Value;
    readonly caption: string | null;
    readonly role: string | null;
    readonly result: boolean;
}
export interface GridPathView {
    readonly cellIds: readonly string[];
}
export type GridObjects<Value = unknown> = {
    gridCell: GridCellView<Value>;
    gridPath: GridPathView;
};
export declare function createGridTrace<Value = unknown>(
    grid: GridInput<Value>, options?: GridTraceOptions
): GridTrace<Value>;
export declare function gridScene<Value = unknown>(
    state: GridSnapshot<Value>, options: GridSceneOptions
): Scene<GridObjects<Value>>;
```

## Atomic operations and lifecycle

Construction captures values and optional initial captions, with empty marks and
`result: null`; no step is emitted. `start()` is required exactly once and emits
index 0 with the same initial state. Each successful later command emits the next
index and a new outer snapshot, including no-ops. All owned records, arrays,
events, steps and snapshot wrappers are copied/frozen before commit. Unchanged
owned structures may be shared. Payload `Value` is retained by reference; callers
must keep it immutable while snapshots, playback or projection use it.

| Command | Contract |
| --- | --- |
| `edit({ writes, marks })` | Apply distinct cell writes and optional role/caption patches as one step. Each write requires its own `value`, even when undefined. No partial snapshot is visible. |
| `edit({ values, marks })` | Replace the complete values collection, preserving shape and optionally patching marks/captions atomically. Defined values and writes are mutually exclusive. |
| `edit({})` | Emit an edit with unchanged content; omitted/undefined fields retain their state. Defined rows or columns are forbidden, even if equal to the current shape. |
| `mark(update)` | Apply roles then captions atomically without changing values; absent/undefined lists are empty patches. Empty update emits a mark step. |
| `done(options?)` | Preserve grid/marks/captions and emit one terminal done with the selected result or null. No later mutation is valid. |

Writes use supplied order for validation, but duplicate coordinates are rejected
rather than last-write-wins. Read the previous state to prepare a batch swap;
both writes commit together. Marks and captions persist across value changes.
`role: null` / `text: null` clear that attribute; roles are nonempty primitive
strings, open to application names. Empty caption text is valid and distinct from
absence. Each patch list rejects duplicates independently, so a write, role patch
and caption patch may address the same cell in one edit. Stored marks/captions
are canonical row-major lists; events retain patch order.

Only the final candidate is committed. Errors preserve state object identity,
step index and lifecycle. All capture/validation/allocation finishes before
commit, and busy is released in finally. External Proxy side effects cannot be
rolled back. Same-trace mutation during capture throws before inspecting nested
arguments; state reads see the prior committed state and another idle trace is
independent. Lifecycle/busy failures are ordinary Error, not Player extensions.

## Result cells and ordered path

Before done, result is null. `done()` or an absent/undefined result records null;
`done({ result: {} })` records `{ cells: [], path: [] }`. These are different
states. Null result input is invalid. Result cells preserve caller order and
reject duplicates. Path entries preserve order **and repetitions**, including
consecutive repeats, a return to the start or a one-cell path. Empty paths are
valid. Both collections may overlap and are independent.

Every referenced coordinate must exist. There is **no** adjacency, wall,
traversability, cost or simple-path test: those are application policies. A
non-neighbor consecutive pair is a direct segment in the stock renderer;
there are no invented intermediate cells. `GridCellView.result` is true for the
union of explicit selected cells and path membership, without altering roles.
The gridPath object's ordered IDs preserve repeats; it is not a graph conversion.
A role named "result" is still a role, not an implicit result selection.
No-path, distances, queues, scalar answers and algorithm-specific status live in
an application state wrapper. An empty selection does not imply any such answer.

```ts
import { createGridTrace } from "@grundyjs/algiviz/grid";

function* example() {
    const grid = createGridTrace({ rows: 2, columns: 3, values: [0, 0, 0, 0, 0, 0] });
    yield grid.start();
    yield grid.edit({
        writes: [{ row: 0, column: 1, value: 1 }],
        marks: {
            cells: [{ row: 0, column: 1, role: "visited" }],
            cellCaptions: [{ row: 0, column: 1, text: "1" }],
        },
    });
    yield grid.done({ result: { path: [
        { row: 0, column: 0 }, { row: 0, column: 1 }, { row: 1, column: 1 },
    ] } });
}
```

This example requires @grundyjs/algiviz 1.3.0 or newer.

## Validation, ownership and error priority

Recognized record fields must be own data properties on plain Object/null-prototype
records. Recognized accessors are rejected without invocation; unknown fields
are ignored without reading their values. Arrays must be ordinary dense arrays
with own data indices; typed-array storage and sparse/inherited/accessor elements
are rejected. Capture declared fields in declaration order; do not enumerate or
inspect opaque values. Original Proxy exceptions, including falsy/non-Error
throws, propagate unchanged. Messages/stacks are diagnostic, not stable codes.

| Invalid input | Error |
| --- | --- |
| Wrong record/array/scalar type, missing required field, recognized accessor, sparse array, non-string/empty role or namespace, non-string caption, defined edit dimensions, both defined values and writes | TypeError |
| Nonfinite/fractional/negative/unsafe dimension or coordinate, dimension/product/list ceiling, out-of-bounds coordinate, values length mismatch, duplicate coordinate where uniqueness is required, noncanonical stored marks/captions | RangeError |
| Command before start/after done, repeated start, same-trace reentrant mutation | Error |
| A Proxy/host/allocation throws | Original exception; no normalization/wrapping |

Priority is contractual, including mixed-invalid cases:

1. Trace commands: busy, then lifecycle, before arguments. Every record captures
   recognized descriptors before scalar validation; every array checks type,
   length/ceiling and density before validating its element records.
2. Constructor: input envelope; rows, columns, product; exact values length and
   dense opaque values; options envelope and initial captions. Optional undefined
   means omitted; explicit null for options/collections/records is invalid.
3. Edit: envelope; forbidden rows, then columns; values/writes exclusivity;
   replacement values or writes in supplied order; marks envelope, cell-role
   patches, then caption patches. A write validates row, column, then bounds and
   uniqueness; value presence was checked during descriptor capture.
4. For a mark/caption record: row, column, role/text scalar, coordinate bounds,
   duplicate. Initial captions use the same order. List length ceilings precede
   records, so an overlong list wins over an invalid first element.
5. Done: options/result envelopes; selected cells (unique), then path (repeats
   allowed), in supplied order. Coordinate checks are row, column, bounds.
6. `gridScene`: options/namespace, snapshot envelope, grid shape/values, canonical
   cellMarks, canonical cellCaptions, result. Scene validation does not require a
   frozen brand, trace instance, lifecycle history or event. Result cells keep
   caller order; only marks/captions require increasing row-major order.

Payload ownership and Worker cloneability remain application responsibilities.
Copying a values container does not deep-copy or freeze its elements. Do not
mutate or transfer-detach a value retained by snapshots. Worker shared-memory
restrictions apply unchanged. There is no GridError, custom code or sanitizer.

## Projection and playback

`gridScene` is a pure endpoint projection with exactly **gridCell and gridPath**.
It requires a nonempty primitive namespace; whitespace is significant, with no
trim or coercion. Stable scene IDs encode namespace,
kind and coordinate with unambiguous tuple boundaries, separate from array,
graph, tree and path IDs; byte spelling is private. Different views/grids require
different namespaces. Cells are emitted row-major at zIndex 0, with copied/frozen
view records retaining value references. One gridPath object at zIndex 1 appears
only for a nonempty result path; its cellIds reference emitted cells in path
order with repeats. A one-cell path exists but has no segment. Zero-area grids
produce an empty scene, never a fake cell. `gridScene` returns `Scene` with
`objects`. Lookup via `get(id)` belongs to the `SceneFrame` produced by
`createSceneFrame` or passed during dispatch; it is not a method on `gridScene`
output.

Frames preserve both endpoint values/roles/captions/results. Events describe a
command; edit does not duplicate values in its event. Playback/projection cannot
infer state from the event or an intermediate image. Existing Step, Frame, Scene,
registry, bounded rewind and Player stepSource/isTerminal need no API changes.
Previous restores snapshots; Restart creates a fresh trace. Pause, Next and
dispose retain their current behavior. Async/Worker state-only frames may have
undefined event and complete by EOF. Application cleanup belongs in finally.

Trace work, values capture and a per-cell scene can cost O(rows×columns); history
can retain that cost per step. Player read budgets do not preempt one expensive
command/projection/render. Limits above are not a performance guarantee.

## Canvas boundary

`/canvas/grid` stays optional and DOM-typed; `/grid` is ES2022-only,
DOM-free and has no renderer dependency. The renderer consumes the two endpoint
snapshots with existing progress, computes a regular cell layout and paints it;
no domain pixel geometry is stored in the headless model. Cell identity remains
fixed when values change. Generic values receive no implicit numeric interpolation
or toString invocation: text/color presentation must be explicit. Roles/captions
and the independent green result come from recorded snapshots; there is no final
color cache. Result membership outranks role colors. A path joins the corresponding
cell centers in stored order; it does not validate movement rules.

Canvas ownership, CSS/bitmap sizes, DPR and disposal stay with the caller or
existing viewport. Empty grids must render safely without division by zero.
The backend must validate and prepare presentation before changing pixels,
restore context state and preserve primary host errors, including falsy throws.
It must not mutate state, request source steps, run algorithms or require events.
Hover, hit-testing, editing, pan/zoom, moving entities and graph/tree conversion
are outside this first backend boundary.

The separate [Grid Canvas contract](grid-canvas-api.md) now selects complete
createGridRenderer declarations, regular fitting, presentation callbacks, text,
result/path and interpolation. The renderer is implemented and checked separately;
both entries receive the common 1.x compatibility protection in 1.3.0.

## Verification and historical evidence

The [1.3.0 preparation record](checks/candidate-1.3.0-2026-11-20.json) covers the
exact archive, tests, installed consumers and evidence identity; [release notes](release-1.3.md)
record completed CI/publication separately from local checks. [Grid Canvas](grid-canvas-api.md) and
the [BFS example](examples.md#grid-bfs-shortest-path) have separate acceptance.

The [initial headless implementation record](checks/grid-implementation-2026-11-20.json)
retains its historical 30 grid regressions, 678 repository tests, four TypeScript
consumers and 38 bundle variants. Its old version/status does not describe 1.3.0.
The [public contract](checks/grid-public-api-2026-11-19.json) and
[architecture check](checks/grid-contract-2026-11-16.json) retain their original
scope and counts. Old JSON is not rewritten as fresh acceptance.
