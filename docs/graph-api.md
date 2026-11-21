# Graph API: /graph and /canvas/graph

[Русский](ru/graph-api.md) · [Architecture sketch](graph-contract.md) · [Scene](scene.md) · [Compatibility](api-compatibility.md)

The graph modules were introduced in [1.1.0](release-1.1.md) with vertex
captions, atomic patches and auto/hidden placement. Version 1.5.0 adds
[`createDynamicGraphTrace`](graph-dynamic-topology.md) and opt-in
[`topologyTransitions`](graph-dynamic-canvas.md) under the same import paths.
[AlgiViz 1.5.0](release-1.5.md) · [Edge contraction example](examples.md#edge-contraction).

The [contract-only record](checks/graph-public-api-2026-11-17.json), [headless](checks/graph-implementation-2026-11-17.json)
and [Canvas](checks/graph-canvas-implementation-2026-11-17.json) implementation
reports retain their stages. [Caption implementation/native evidence](checks/graph-node-captions-implementation-2026-11-17.json)
covers 31 Canvas and seven BFS-page checks. The earlier 15 native cases retain
their pre-caption scope and are not added to that count.

## Scope and entry boundary

`/graph` exports **createGraphTrace**, **createDynamicGraphTrace** and
**graphScene**, plus 26 types. The next block covers the fixed trace and shared
types. The [dynamic API reference](graph-dynamic-topology.md#public-api) covers
the four dynamic types. The module stays synchronous and DOM-free (ES2022).
`/canvas/graph` independently exports **createGraphRenderer** and its four
types. It may import `/graph` and `/scene`; the reverse dependency is forbidden.
Importing either entry must not access DOM globals; calling the Canvas renderer
requires Canvas 2D. Graph exports stay on their dedicated import paths.

The first trace has fixed, finite topology. Empty/disconnected graphs, mixed
directed and undirected edges, loops, parallel edges and finite signed weights
are supported. Algorithms, adjacency indexing/traversal order, queues, stacks,
distances, path finding, editors and force-directed layout stay application-owned.
There is no graph-specific player, timeline, algorithm wrapper, error class or
new Player option. Topology mutation is outside this first API.

## Declarations: /graph

```ts
import type { Step, Frame } from "@grundyjs/algiviz/playback";
import type { Scene } from "@grundyjs/algiviz/scene";

export interface GraphNode<Data = unknown> {
    readonly id: string;
    readonly label?: string | undefined;
    readonly data?: Data | undefined;
}
export interface GraphEdge<Data = unknown> {
    readonly id: string;
    readonly from: string;
    readonly to: string;
    readonly directed?: boolean | undefined;
    readonly weight?: number | undefined;
    readonly label?: string | undefined;
    readonly data?: Data | undefined;
}
export interface GraphInput<NodeData = unknown, EdgeData = unknown> {
    readonly nodes: readonly GraphNode<NodeData>[];
    readonly edges: readonly GraphEdge<EdgeData>[];
}
export interface GraphPosition {
    readonly nodeId: string;
    readonly x: number;
    readonly y: number;
}
export interface GraphAnnotation {
    readonly id: string;
    readonly role: string;
}
export interface GraphMark {
    readonly id: string;
    readonly role: string | null;
}
export interface GraphNodeCaption {
    readonly id: string;
    readonly text: string;
}
export interface GraphNodeCaptionPatch {
    readonly id: string;
    readonly text: string | null;
}
export interface GraphMarkUpdate {
    readonly nodes?: readonly GraphMark[] | undefined;
    readonly edges?: readonly GraphMark[] | undefined;
    readonly nodeCaptions?: readonly GraphNodeCaptionPatch[] | undefined;
}
export interface GraphResultInput {
    readonly nodeIds?: readonly string[] | undefined;
    readonly edgeIds?: readonly string[] | undefined;
}
export interface GraphResult {
    readonly nodeIds: readonly string[];
    readonly edgeIds: readonly string[];
}
export interface GraphDoneOptions {
    readonly result?: GraphResultInput | undefined;
}
export interface GraphTraceOptions {
    readonly nodeCaptions?: readonly GraphNodeCaption[] | undefined;
    readonly layout?: readonly GraphPosition[] | undefined;
}
export interface GraphSnapshot<NodeData = unknown, EdgeData = unknown> {
    readonly graph: GraphInput<NodeData, EdgeData>;
    readonly layout: readonly GraphPosition[];
    readonly nodeMarks: readonly GraphAnnotation[];
    readonly edgeMarks: readonly GraphAnnotation[];
    readonly result: GraphResult | null;
    readonly nodeCaptions?: readonly GraphNodeCaption[] | undefined;
}
export type GraphEvent = Readonly<
    | { type: "start" }
    | { type: "mark"; nodes: readonly GraphMark[]; edges: readonly GraphMark[];
        nodeCaptions?: readonly GraphNodeCaptionPatch[] | undefined }
    | { type: "layout" }
    | { type: "done" }
>;
export type GraphStep<N = unknown, E = unknown> = Step<GraphSnapshot<N, E>, GraphEvent>;
export type GraphFrame<N = unknown, E = unknown, Event = GraphEvent> = Frame<GraphSnapshot<N, E>, Event>;

export interface GraphTrace<NodeData = unknown, EdgeData = unknown> {
    readonly state: GraphSnapshot<NodeData, EdgeData>;
    start(): GraphStep<NodeData, EdgeData>;
    mark(update: GraphMarkUpdate): GraphStep<NodeData, EdgeData>;
    setLayout(layout: readonly GraphPosition[]): GraphStep<NodeData, EdgeData>;
    done(options?: GraphDoneOptions): GraphStep<NodeData, EdgeData>;
}
export interface GraphSceneOptions {
    readonly namespace: string;
}
export interface GraphNodeView<Data = unknown> {
    readonly node: GraphNode<Data>;
    readonly caption?: string | undefined;
    readonly position: GraphPosition;
    readonly role: string | null;
    readonly result: boolean;
}
export interface GraphEdgeView<Data = unknown> {
    readonly edge: GraphEdge<Data>;
    readonly from: string;
    readonly to: string;
    readonly role: string | null;
    readonly result: boolean;
    readonly routeIndex: number;
    readonly routeCount: number;
}
export type GraphObjects<N = unknown, E = unknown> = {
    graphNode: GraphNodeView<N>;
    graphEdge: GraphEdgeView<E>;
};
export declare function createGraphTrace<N = unknown, E = unknown>(graph: GraphInput<N, E>, options?: GraphTraceOptions): GraphTrace<N, E>;
export declare function graphScene<N = unknown, E = unknown>(state: GraphSnapshot<N, E>, options: GraphSceneOptions): Scene<GraphObjects<N, E>>;
```

IDs are primitive nonempty strings, compared exactly without coercion, trimming
or Unicode normalization. Node IDs and edge IDs are independently unique: a node
and an edge may both be `"A"`. Every endpoint must name an existing node. IDs are
explicit: no generation from labels, array positions or endpoint pairs. Input
order is retained and defines deterministic tie-breaking; labels may repeat.
Use arrays, so IDs such as `"__proto__"` and strings containing separators work
without property-key collisions. A namespace must be a nonempty string too.

An omitted/undefined direction means undirected; `true` means `from → to`.
An omitted/undefined weight is unweighted, not weight 1. Zero and negative finite
weights are valid. Algorithm restrictions (for example Dijkstra's) are separate.
Node display text is `label ?? id`; edge text is `label ?? String(weight)` when
a weight exists, otherwise no text. An explicit empty label hides that text.
No label is parsed as markup. No default label/direction/weight is written back.

## Capture, layout and immutable state

The constructor captures input immediately, not on a later `next()`. It copies
and freezes known structural records, arrays, positions, marks, results, events
and step envelopes. The copied topology is shared across snapshots of this trace.
Later edits to caller-owned records/arrays cannot change it. Optional `data` is
retained by reference, neither recursively cloned nor frozen. Its immutability,
type safety and Worker cloneability belong to the application; this is no shared
memory validator. Worker transport keeps its existing independent restrictions.
Unknown properties are ignored, not copied or inspected.

Initially marks are empty and `result` is null. Supplied layout must contain
exactly one finite `x/y` position for every node, no extras or duplicate IDs.
Positions use graph coordinates, independent of CSS/DPR; negative coordinates
are valid. Snapshots store positions in node input order. Layout omission gives
an empty array for no nodes, `(0.5, 0.5)` for one node, and a deterministic circle
for n ≥ 2: angle `-π/2 + 2πi/n`, x = `0.5 + 0.4 cos(angle)`,
y = `0.5 + 0.4 sin(angle)`, with i in node input order. This is a convenience
initial placement, not a graph-layout solver or bitwise cross-engine float promise.

`setLayout` replaces the complete layout; it is not a partial patch. Invalid
updates retain the old layout. No hidden resize-driven solver or function-valued
layout callback is invoked. Application layout algorithms provide explicit
positions; the Canvas renderer only fits them to its drawing rectangle.

`state` exposes the latest committed snapshot before start, while running and
after completion. It never advances the trace. Owned output is runtime immutable;
application payload references remain subject to the rule above. Retaining steps
retains their snapshots; structural sharing is allowed, but no O(1) snapshot,
projection, validation or rendering guarantee is made.

## Trace operations and result

| Operation | State change and event |
| --- | --- |
| `start()` | Exactly once, before all other operations; emits `start`, index 0, with initial state |
| `mark({ nodes, edges, nodeCaptions })` | Patch roles and caption text atomically by ID; emits `mark` with copied supplied patches (omitted collections become empty arrays) |
| `setLayout(positions)` | Replace all positions; emits `layout`; marks/result unaffected |
| `done({ result })` | Optionally select result nodes/edges, emit `done` and seal the trace |

After start, each successful operation emits exactly one consecutively indexed
step containing the complete state **after** that operation. No-op/empty patches
and an unchanged layout still emit a step. Methods do not yield or play steps:
the application's generator yields them. There are no implicit neighbor visits,
edge marks, counter increments or graph mutations.

One nonempty string role is stored per marked entity. `role: null` removes a
role; `undefined` is invalid there. Omitted patch collections and omitted IDs
preserve old roles; an empty collection does not clear all marks. Duplicate IDs
within one patch collection are rejected, even with the same role. Snapshot mark
arrays contain only present roles and follow topology input order. Event patch
arrays retain supplied order. Roles are open strings, not a closed algorithm
union. `active`, `visited`, `queued` are stock visual conventions, not mandatory
trace phases; an unknown nonempty role is valid.
Even the role `"result"` is only a role; selection is set exclusively by done.

`done()` or `done({ result: undefined })` leaves `result: null` (no selected
answer). `done({ result: {} })` stores two empty arrays (explicit empty answer).
Each supplied result ID must exist in its domain; repeats are deduplicated in
first-occurrence order. Node and edge selections are independent: no endpoints,
path continuity, traversal direction, reachability or optimality are inferred or
validated. A path may use the selection order, but it remains the application's
claim. A no-path outcome can select nothing and carry its explanation in
application state. There is no special Player failure status for it.

Completion **preserves all roles**, captions and positions. The Canvas result color takes
priority over roles on selected entities; unselected entities keep their marks.
This persists on terminal hold, repaint and rewind to the final snapshot without
remembering events in the renderer. Before completion, `result` is null.
There are no result mutations after done. Rewind reads old snapshots and does
not undo trace calls. Restart must create a new trace/source, clearing marks and
result and reusing only the desired immutable input/initial layout.

`GraphEvent` is a new **closed** union confined to `/graph`. No new ArrayEvent,
Frame field, Player phase or global role enum is added. Application events can
use existing generic Step/Frame with `createStepEmitter`; this first trace has no
custom-event callback or arbitrary event-emission method. `GraphFrame` permits
an explicitly chosen Event, including `undefined` for async state-only playback.
After publication, adding a GraphEvent variant is subject to the closed-union
major-release rule; open roles do not silently widen that union.

## Validation, errors and atomicity

Module-owned inputs are plain records (Object/null prototype) and dense arrays.
Required fields must be own data properties. Accessors on recognized properties
or array elements are rejected without invoking them; inherited optional fields
are ignored. `undefined` optional fields mean omission. No coercion, iterable
consumption, DOM access or application-payload inspection occurs. Arbitrary Proxy
traps are not made safe by this API: a trap's original throw propagates, and
reentrant commands on this trace are guarded. This is validation, not a sandbox.

| Invalid input | Error |
| --- | --- |
| Wrong container/record/scalar type, sparse array, accessor, missing required field, empty/non-string ID/role/namespace, non-string label, non-boolean direction | `TypeError` |
| Nonfinite numeric coordinate/weight, duplicate node/edge ID, missing endpoint, duplicate/missing/extra layout position, unknown mark/result ID, duplicate patch ID | `RangeError` |
| Repeated start, operation before start/after done, nested mutation while capturing another command | `Error` |

Messages and stack text are diagnostic, not stable identifiers; no GraphError
class/code is introduced. No Error cause normalization wraps original Proxy
throws. Separate Worker/Player errors retain their current contracts.

Error precedence is deterministic:

1. Trace mutation checks busy/lifecycle before inspecting arguments. Reads of
   `state` remain allowed and see the previous committed state during capture.
2. Constructor: graph envelope; node array/records in input order (id, label,
   data capture, then duplicate check); edge array/records in order (id, from,
   to, directed, weight, label, data capture, duplicate check, endpoint check);
   options; layout; initial captions.
3. Layout: array shape, then records in supplied order (nodeId, x, y, membership,
   duplicate check), then missing nodes in topology order.
4. Mark: update envelope; nodes, then edges, then nodeCaptions. Role records:
   id, role, membership, duplicate check. Caption records: id/text capture, scalar
   types, node membership, duplicate check. Done: options/result envelope, node IDs
   then edge IDs. Missing optional lists are empty; caption snapshots follow nodes.
5. `graphScene`: options/namespace first, then snapshot envelope, graph, layout,
   nodeMarks, edgeMarks, nodeCaptions, result. Snapshot marks must be unique, non-null and
   ordered by topology; layout must be in topology order, result IDs unique.
   Invalid snapshot ordering is a RangeError.

An array shape check checks length/density/data elements before its records.
For each record, shape/recognized-property descriptor checks precede field values.
Duplicate IDs in separate node/edge domains do not conflict. All validation and
copies finish before a command commits state, increments the step index or
changes lifecycle. Failure leaves all three unchanged, so the caller can retry.
Empty graphs accept start/empty mark/empty layout/done and reject any entity ID.
`graphScene` also accepts correctly formed application-created immutable snapshots;
it is not restricted to objects from createGraphTrace. No Object.isFrozen brand
is required: application/Worker-cloned records must be treated as immutable by
their owner while retained by playback.

## Projection and stable scene identities

`graphScene(state, { namespace })` is a pure, validated endpoint projection with
exactly two kinds: `graphNode` and `graphEdge`. It copies/freezes scene wrappers
and view data while retaining immutable snapshot records/payload references.
Edges have zIndex 0, nodes zIndex 1; order within each layer follows graph input.
No labels/arrowheads are separate mandatory scene kinds. Applications can add
their own kinds to a composite registry without extending GraphObjects.

Scene IDs encode `(namespace, domain, domain ID)` injectively, including quotes,
separators and matching node/edge IDs. The encoding is opaque, not a public
string format. NodeView.node.id and EdgeView.edge.id preserve domain IDs;
EdgeView.from/to are **scene node IDs**, ready for `scene.get`, not domain IDs
or positions. To compose scenes use distinct namespaces. Keep the same namespace
and domain IDs across snapshots; changing namespace intentionally creates new
scene identities. Replacing an entity needs a new ID, never a label-based match.

Non-loop edges are grouped by unordered endpoint pair (including antiparallel
directed edges). Loops are grouped by node. `routeIndex` is zero-based input
order within the group; `routeCount` is its size. These stable routing metadata
are independent of marks, layout and playback history. Their values do not define
a public curve equation. The Canvas implementation uses distinct deterministic
lanes/loop radii, but does not promise overlap-free layout or crossings avoidance.

Node positions interpolate previous/current endpoints with Frame.progress;
edges resolve the same node transitions through scene.get, including both
generations and zero-presence enter/exit objects. Generic scene mechanisms can
compose independently supplied snapshots, but do not add topology-editing methods
to this fixed trace. See the [dynamic trace](graph-dynamic-topology.md)
for topology edits and retargeting.
Projection never reads progress, viewport dimensions, DPR or mutable DOM. Use
`createSceneProjector(state => graphScene(state, { namespace: "main" }))` for
existing bounded endpoint caching; change projector when its captured policy changes.

## Declarations: /canvas/graph

The renderer is available since 1.1.0 and highlights results in green in both
themes. From 1.5.0, the [topologyTransitions option](graph-dynamic-canvas.md)
enables dynamic topology transitions.

```ts
import type { Frame } from "@grundyjs/algiviz/playback";
import type { GraphSnapshot } from "@grundyjs/algiviz/graph";

export interface GraphPalette {
    readonly background: string;
    readonly text: string;
    readonly node: string;
    readonly edge: string;
    readonly active: string;
    readonly visited: string;
    readonly queued: string;
    readonly result: string;
}
export interface GraphRendererOptions {
    readonly theme: "light" | "dark";
    readonly colors?: { readonly [K in keyof GraphPalette]?: string | undefined } | undefined;
    readonly roleColors?: Readonly<Record<string, string>> | undefined;
    readonly nodeCaptions?: "auto" | "hidden" | undefined;
    readonly topologyTransitions?: boolean | undefined;
}
export interface GraphRenderSize {
    readonly width: number;
    readonly height: number;
}
export interface GraphRenderer {
    render<N, E, Event>(context: CanvasRenderingContext2D, frame: Frame<GraphSnapshot<N, E>, Event>, size: GraphRenderSize): void;
}
export declare function createGraphRenderer(options: GraphRendererOptions): GraphRenderer;
```

Factory captures/copies theme and own color overrides once. Theme is required.
The same plain-record/data-property capture rules apply to these options;
unknown palette keys are ignored, and roleColors uses only own keys without
prototype lookup.
An invalid theme/container/non-string or empty color gives TypeError. Actual CSS
color support is the host's responsibility. Omitted/undefined palette overrides
use the theme; roleColors contains only explicit nonempty role → color pairs.
For each entity: **selected result → roleColors[role] → stock role color → base
node/edge color**. Result is green in both stock themes (dark `#34d399`, light
`#047857`). Unknown roles use base color unless overridden. Text uses `text`.
Result membership does not force incident edges/nodes into the result.

`render` paints one complete bitmap; it is not a scene-composition handler. SVG,
custom Canvas regions and mixed structures use graphScene plus their own handlers.
`size` is the logical content width/height, such as the width/height returned by
createCanvasViewport.resize. The application owns canvas CSS, bitmap sizing,
resize observation and redraw scheduling. The renderer owns none of them and
retains no context, canvas, source, RAF, Worker or DOM listener. It needs no dispose;
any endpoint caches are bounded to two snapshots/one matching pair.

Before drawing, validate size envelope/numbers, progress in [0,1], then previous
and current snapshots in the order above (using its internal fixed namespace).
Wrong scalar/container types give TypeError; negative/nonfinite dimensions,
invalid progress and unrepresentable derived geometry give RangeError. Zero
logical or bitmap dimensions give a no-op **after** input validation. Failed
validation makes no Canvas calls. Reentrant render on the same renderer throws
Error before validation; different renderers remain independent.

For a nonempty drawable bitmap, save context, set bitmap/logical transform from
the supplied size, neutralize alpha/composite/filter/shadow/dash drawing state,
paint the background and graph, then restore in finally. Caller provides an
unclipped context and owns any existing path (Canvas save/restore does not restore
paths). Canvas host throws propagate unchanged; pixels already painted are not
rolled back. If drawing and restore both throw, the original drawing failure
wins; a standalone restore failure propagates unchanged. Restoration assumes a
working host restore method. Neither transform nor styles leak after an ordinary draw/throw.
The busy guard is always released in finally; a failed call does not poison
subsequent renders or replace a valid endpoint cache with invalid data.

Fit the joint previous/current layout bounds uniformly into the logical rectangle
with padding and centered degenerate axes, keeping that transform fixed through
the transition. Vertex interpolation uses raw progress; annotation/result styles
come from current state for the whole transition. Draw edges first, nodes next;
directed edges get arrowheads toward `to`, undirected ones do not. Loops and
parallel lanes remain visible at ordinary sizes. Coincident nodes/tiny viewports
are valid but do not guarantee legibility. Font, padding, curve equations and
anti-aliasing are presentation defaults, not pixel-stable API promises. No built-in
queue panel, event-specific animation or remembered final-step highlight is used.

Captions belong to nodeCaptions in State, not Event or a live callback. Initial
values come from options, mark patches text atomically with roles, setLayout/done
preserve it, and graphScene accepts legacy missing/undefined fields as empty.
Renderer nodeCaptions: auto/hidden controls painting; hidden still validates.
Text metrics are a host phase after input/base-geometry validation and before
pixels: invalid numeric metrics give RangeError; missing/nonnumeric required
bounds omit captions without coercion. Original measureText throws
survive and context state is restored. [Placement and bounds](graph-node-captions.md)
use eight candidates and omission when no safe location exists, without moving
the graph.

## Usage shape and control compatibility

Use headless playback to project each fixed-graph snapshot:

```ts
import { createGraphTrace, graphScene } from "@grundyjs/algiviz/graph";
import { createPlayer } from "@grundyjs/algiviz/playback";

function* walk() {
    const trace = createGraphTrace({
        nodes: [{ id: "A" }, { id: "B" }],
        edges: [{ id: "AB", from: "A", to: "B", directed: true }]
    });
    yield trace.start();
    yield trace.mark({ nodes: [{ id: "A", role: "active" }] });
    yield trace.done({ result: { nodeIds: ["B"], edgeIds: ["AB"] } });
}
const player = createPlayer(walk(), {
    isTerminal: step => step.event.type === "done",
    render(frame) {
        const scene = graphScene(frame.current, { namespace: "main" });
        console.log(frame.event.type, scene.objects);
    }
});
player.nextStep();
player.nextStep();
player.dispose();
```

For Canvas playback, the application provides the context, mount and logical size.

```ts
import { createGraphTrace } from "@grundyjs/algiviz/graph";
import { createGraphRenderer } from "@grundyjs/algiviz/canvas/graph";
import { Player } from "@grundyjs/algiviz/player";

const graph = {
    nodes: [{ id: "A" }, { id: "B" }],
    edges: [{ id: "AB", from: "A", to: "B", directed: true }]
};
function* walk() {
    const trace = createGraphTrace(graph);
    yield trace.start();
    yield trace.mark({ nodes: [{ id: "A", role: "active" }] });
    yield trace.mark({
        nodes: [{ id: "A", role: "visited" }, { id: "B", role: "active" }],
        edges: [{ id: "AB", role: "visited" }]
    });
    yield trace.done({ result: { nodeIds: ["A", "B"], edgeIds: ["AB"] } });
}
const renderer = createGraphRenderer({ theme: "light" });
// mount: HTMLElement; context: CanvasRenderingContext2D; size: GraphRenderSize
const player = new Player(mount, {
    stepSource: walk,
    isTerminal: step => step.event.type === "done",
    rewindCapacity: 32,
    render: frame => renderer.render(context, frame, size)
});
```

Pause, Next, final hold, Previous, bounded work/history, source return, Restart
and dispose use unchanged Player rules. Do algorithm work before yielding done;
put generator cleanup in finally. Restart invokes walk again. Async/Worker can
carry GraphSnapshot as ordinary state with EOF completion and undefined event;
no async explicit-step contract or new transport format is introduced. The
renderer never reads event. A live application queue/distances panel needs its
own immutable wrapper State and scene/renderer composition, not hidden trace data.

## Implementation acceptance and evidence

- Exact runtime/type exports; headless ES2022, DOM and strict compiler consumer
  matrix; optional graph-renderer bundle isolation; unchanged eight-entry exports.
- Capture/immutability and generic payload inference; hostile ID strings, same
  node/edge ID, empty/disconnected graphs, loops/parallel/antiparallel edges and
  finite signed weights; no generated IDs or adjacency policy.
- All validation groups/order and lifecycle conflicts; failed commands preserve
  snapshot/index/phase; no getter invocation or partial commit; original trap
  throws and guarded reentrancy. The implementation reports distinguish actual checks from the original requirements.
- Persistent/open marks, clearing, no-op steps, done null versus explicit empty,
  duplicate result ordering and green result priority; rewind/Restart isolation.
- Namespace collisions, scene references/layers/routing metadata; moving nodes,
  pure projector and custom registry; render without any Event.
- Real Canvas/DPR/resize, loop and arrow direction, parallel lanes, context
  restoration, invalid input before drawing; existing Player controls/cleanup and
  async/Worker copy/transfer with unchanged transport restrictions.

The contract-only stage used isolated no-emit probes and EN/RU parity/link checks;
its report below does not claim implementation coverage. The subsequent
[headless implementation report](checks/graph-implementation-2026-11-17.json)
records repository/installed runtime tests, types and optional bundle isolation.
The [Canvas report](checks/graph-canvas-implementation-2026-11-17.json) records
command/geometry/DPR/context tests, installed consumers and optional bundle isolation.
The [native report](checks/graph-canvas-native-2026-11-17.json) passes 15 checks in
the built-in browser: actual pixels, context restore/throw, raw interpolation,
loops/lanes/arrows, resize and Player Previous/Next/Restart/dispose. Bitmap ratios
1/1.25/2 are controlled backing-store sizes; they are not three browser zoom settings.
The eight previously published entries and their closed unions are unchanged.
The compatible addition is released in 1.1.0. Future breaking changes require
separate review and the major-release policy. This reference update publishes nothing.

[Contract verification record](checks/graph-public-api-2026-11-17.json).
