# Future matrix/grid: contract sketch and core fit

[Русский](ru/grid-contract.md) · [Graph](graph-contract.md) · [Tree](tree-contract.md) · [Scenes](scene.md) · [Compatibility](api-compatibility.md)

## Release closure — 2026-11-20

**1.3.0 is published from 90b26f8; R0–R4 are complete.** All eleven CI jobs and
exact/latest, installation, signature, provenance and README checks passed.
[Release and migration](release-1.3.md) ·
[Documentation patch 1.3.1](release-1.3.1.md).

## Historical stages

The original preparation scope follows. Earlier versions and pending items
describe that recorded stage, not the current status of the published API.

**Candidate follow-up, 2026-11-20:** package.json and both root lockfile versions
are now 1.3.0. The [preparation record](checks/candidate-1.3.0-2026-11-20.json) supersedes the older
version and R1/R2 status. R3 is checked after commit/push on the final SHA;
R4 (tag/publication) is outside this task. Dated stages below remain historical.

**Canvas follow-up, 2026-11-20:** independent [/canvas/grid](grid-canvas-api.md)
is implemented and checked locally, including native Canvas/Player acceptance.
Neither grid entry is published; historical scope below is retained.

**Implementation follow-up, 2026-11-20:** headless /grid is implemented locally,
unpublished. [Current Grid API](grid-api.md) · [Checks](checks/grid-implementation-2026-11-20.json).
The design stages below retain their historical scope.

**API follow-up, 2026-11-19:** the [public /grid contract](grid-api.md) is selected
against released 1.2.0; no implementation/export is added. It resolves the earlier
coordinate, operation, result, limit and projection questions. The sketch and
its checks below retain their historical scope.

**Architecture review, 2026-11-16; no implementation or publication.** Candidate
a9b93f8 is the checked baseline. Matrix/grid below denotes one future capability;
the entry name (/grid, /matrix or a different boundary) is not selected. Neither
entry exists today. These are model requirements, not exported declarations or
final method signatures. Existing maze/sand models and renderers remain examples.

## Conclusion and first scope

The proposed model fits the current Step, Frame, Scene, generic registries and
Player without changing their public API or closed unions. It can coexist with
the /graph and /tree sketches without widening either contract. No core API
blocker before 1.0 was found for this scope. Future exports would themselves be
new public API, potentially a minor feature under U3 if existing uses remain
compatible. No entry is added by this review.

The first scope is a finite dense rectangular **two-dimensional matrix of T**
with immutable values, annotations and selected results. Rows and columns stay
fixed within a trace. Numeric matrices, boards, maze state and cellular fields
can use that representation without implying the same algorithm or cell values.
No built-in search, simulation, matrix arithmetic or editor is selected here.

Ragged, sparse, infinite, hexagonal and 3D grids, resizing/inserting/deleting rows
during a trace, logical row/column identities and automatic cell-level deltas are
outside the first scope. A new shape can start a fresh source. Core enter/exit
can represent additional views, but that does not establish resize semantics for
the future module. Neither sorting rows nor transposition implies moving the
identity of a matrix location; richer identity policies need a separate design.

## Model, coordinates and validation

An illustrative state contains:

```text
rows, columns: nonnegative safe integers, fixed for a trace
values: dense row-major readonly collection of T
annotations: addresses/regions -> persistent role/data
result: selected addresses/regions/ordered path, or application result metadata
view/layout: immutable policy/data where needed
```

This is not a public TypeScript interface. An address is a zero-based **(row,
column)** pair: 0 <= row < rows and 0 <= column < columns, both integers. Flat
storage position is row * columns + column; it is not a global scene/entity ID.
UI labels may be one-based. Labels, screen x/y and flattened storage indices do
not change the coordinate convention. No wrap to the next row on a horizontal
boundary is implied by adding one to a flat index.

The product must be safe and representable by the chosen storage, with exactly
that many present entries and no holes. Practical size limits must be chosen and
validated before allocation in the later API; being a safe integer is not a
promise that the grid can be allocated. Example-specific history/generator limits
are not library limits. Jagged input must not be silently padded or truncated.

Zero-area shapes are valid: 0x0, 0xN and Nx0 retain their distinct dimensions with
empty values, no valid cell address and no cell selection/path. Rendering must
not divide by zero or invent a dummy cell; empty selections or non-cell result
metadata can still express an algorithm's answer. This does not change the
positive-dimension input rules of the existing maze example.

Values are generic. 0, false, empty string, null or undefined (when T permits it)
are actual values, not automatic absence/blockage sentinels. A dense present
undefined entry differs from an array hole. Numeric-domain restrictions such as
finite values, precision or overflow belong to the chosen algorithm/value policy.
The sand example's EMPTY/WALL encodings are not reserved module-wide values.

Blocked cells remain cells. Adjacency, 4/8-neighbor order, diagonal corner rules,
wrapping, costs, wall reciprocity and traversability are explicit application or
future domain-adapter policies, not implicit consequences of a matrix. Matrix
arithmetic does not need a graph interpretation at all.

Persistent marks and results refer to valid addresses or regions of this model.
A rectangular region can use half-open row/column bounds; exact syntax is a
later API decision. Ordered paths must preserve order and any meaningful repeats,
not be silently treated as sets. Queues, distances, arithmetic accumulators and
no-path/scalar results stay in application State. Exact result shapes, role
extension/palette rules, error classes and validation order remain to be designed.
The module must validate the whole update before commit/emission; generic Scene
does not validate dimensions, coordinates, region bounds or neighbor consistency.

## Identity and ownership

The domain identity of a cell in the first scope is its model plus address. A
value change or exchange changes contents, not the identity of that location.
A moving token/grain has a separate stable entity ID and a changing address.
Otherwise swapping values could incorrectly animate the grid itself as moving
items. Reuse /array item identities only where the application really models
moving entities, not by flattening a matrix into ArraySnapshot.

Scene IDs must namespace model/view/kind/address, distinct from graph/tree nodes
and from other grids. A tuple such as JSON.stringify([scope, view, 'cell', row,
column]) is a safe example; its exact encoding is not a public contract. Separate
visual copies of one cell/entity need separate scene IDs.

Module-owned value containers, coordinates and annotations/results are copied
and frozen into immutable snapshots, sharing unchanged owned portions where
possible. Application payload T remains the application's immutability and
Worker-cloneability responsibility. No deep clone of arbitrary T is promised.
Nonempty typed-array contents are not made immutable by readonly types or by
freezing a wrapper. Typed-array storage support and copy/transfer options require
an explicit later contract; plain immutable arrays are sufficient for this sketch.
Do not mutate/reuse or transfer-detach storage still referenced by playback,
rewind history or an endpoint projector. Existing Worker shared-memory rejection
continues to apply; grid support creates no exception.

## Scenes and animation

Two independent projection strategies fit the existing API:

| Strategy | Matching unit | Lookup and animation |
| --- | --- | --- |
| Aggregate surface | One stable scene object per grid | Handler reads both endpoint grids and progress; cells are addressed in its data |
| Per-cell objects | Stable scene object per projected address | scene.get returns each declared cell transition; overlays can reference its scene ID |

These are separate strategies, **not a new required union of built-in kinds**.
Each future projection needs a deliberately chosen stable type map. No universal
renderer registry is selected here. Adding mandatory kinds later could break
consumer registries under U3; application decorations use explicit extensions.

An aggregate scene does not make virtual cells available through scene.get: it
only knows declared objects. A coordinate-based overlay can resolve the aggregate
object's old/new grid data and apply the same layout. An overlay relying on an
individual cell transition must use a projection that supplies that cell object.
Cells filtered from both endpoint scenes cannot be retrieved by scene.get.

Both strategies can retain old/new values, marks and results. Generic core does
not interpolate arbitrary T, wall masks, booleans or algorithm roles. A renderer
must deliberately choose discrete switching, numeric interpolation when meaningful,
or crossfade. The exact defaults/priority are not chosen by this architecture
review. Moving entities interpolate their own old/new coordinates and keep their
entity IDs. Model/result state must not be inferred from the interpolated image.

Use pure endpoint projection with immutable captured settings. Viewport, DPR,
pointer hit-testing and pixel transforms belong to drawing/application code, not
mutable DOM reads inside createSceneProjector. Content-dependent layout can be
part of an immutable State or a pure deterministic projection. A changed captured
policy requires a new projector. Culling in the projection must depend on immutable
view state; draw-time clipping can use the current viewport without changing it.
Aggregate and per-cell projection modes must not change type under the same
retained scene ID. Changing modes needs distinct identities/projections and an
explicit application policy, not an incidental type swap.

Canvas is redrawn each frame. A retained SVG/DOM backend reconciles actually drawn
IDs every frame, since seek may skip enter/exit callbacks. An aggregate handler
may draw an empty grid without cells; a per-cell projection may simply be empty.
No special generic Scene phase or lifecycle callback is needed.

One aggregate object avoids a scene object per cell, but does **not** imply O(1)
copying, drawing or hit-testing. A dense snapshot/draw may still cost O(rows*columns),
and history can retain that cost per step. The existing [Player work budget](player-work-budget.md)
limits reads per RAF; it cannot interrupt one expensive next/projection/render.
Chunking, sparse storage, checkpoints, dirty-region rendering and performance
guarantees require separate workloads/design, not new generic Frame fields here.

## Relationship with /graph and /tree

A coordinate grid may have a graph interpretation: a cell maps to a namespaced
node, an explicitly chosen adjacency maps to edges with distinct stable IDs.
The conversion must define direction/order/parallel relationships and ID mapping;
matrix values are not graph IDs. An aggregate grid need not materialize any of
those edges as scene objects, and this review supplies no converter.

The /graph sketch fixes topology per trace. Fixed potential adjacency with
traversability annotations may fit that scope; actually inserting/removing
graph nodes/edges while walls change does not silently become supported by that
trace. Grid algorithms can use their own immutable State and generic playback
directly. A future adapter must choose its exact mapping and filtering contract.

A traversal's predecessor map is not automatically a tree containing the whole
grid: undiscovered/disconnected cells may be absent or form a forest. A future
/tree conversion must explicitly choose its root/reachable subset, sibling order
and link IDs and satisfy connectivity/acyclicity/single-parent rules. No default
conversion should misrepresent a cyclic grid as a tree. Maze generation may also
change topology over time; the graph sketch's scope remains unchanged.

Graph/tree/grid views can coexist through namespaces and a composite registry.
Shared geometry/data is possible without public inheritance, mandatory package
dependencies or new cases in ArrayEvent/GraphEvent/TreeEvent. The exact future
adapter imports and rendering entries remain undecided; keep the data model
headless and DOM-free, with optional backend loading separate.

## Steps, control and verification

Application types fit `Step<GridState<T>, GridEvent>` and `Frame<GridState<T>, GridEvent>`
directly. State contains everything required to redraw an earlier/result frame;
Event can describe a write, inspection or terminal step without accumulating
renderer history. Existing createStepEmitter, createPlayer/createTimeline,
bounded rewind and Player stepSource/isTerminal apply. No new phases/options or
global event kinds are required.

Pause, Next, hold, Restart and dispose keep current contracts. Terminal work runs
before terminal yield, cleanup in finally. Restart uses a fresh source with the
chosen initial shape/contents, not old marks/results. Previous restores buffered
states without undoing arithmetic/simulation. AsyncSource/Worker remain state-only
with EOF completion and possibly undefined Frame.event; marks/results must not
depend on an event being present. Algorithms/handlers are executable application
code, not serialized state.

The isolated check passed **32/32 runtime cases** and four strict TypeScript 6.0.3
configurations: NodeNext/Bundler × headless ES2022/Player DOM, with ten grid-specific
negative type cases. It uses handwritten application states/scenes and existing
maze/sand examples against current public APIs. No matrix/grid module, adapter,
validator, renderer or package declaration/stub was implemented. The check is
about current core data availability, not native rendering quality, future model
validation, performance or a complete future-module compiler matrix.

Before implementation, choose entry boundaries, exact input/storage/types, size
and validation/error policies, trace methods, results/regions, renderer strategies
and defaults, hit-testing and optional graph/tree adapters. Those are new-module
decisions, not identified requirements to change Step/Frame/Scene before 1.0.

[Architecture check record](checks/grid-contract-2026-11-16.json).
