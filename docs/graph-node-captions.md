# Vertex captions: /graph and /canvas/graph contract

[Русский](ru/graph-node-captions.md) · [Current graph API](graph-api.md) · [BFS comparison](bfs-graph-comparison.md)

**Released in 1.1.0, 2026-11-17.** /graph and /canvas/graph include immutable
captions, atomic mark and Canvas-metric placement. BFS supplies distances.
[Implementation and native checks](checks/graph-node-captions-implementation-2026-11-17.json)
supplement the historical [contract review](checks/graph-node-captions-contract-2026-11-17.json).
Npm 1.0.0 has neither graph entry; dependencies are unchanged.

## 1. Scope and API delta

One optional secondary text per node, outside its circle. GraphNode.label remains
the primary text inside the vertex; stable ID, primary label, caption, role and
result are independent. Distances, cost strings and component numbers are
application-formatted text. The module computes no distance and parses no markup.
No queue, start/target badge, edge caption update, rich text, click handling,
layout solver or Player option is introduced.

These are selected replacement excerpts; unchanged types/methods are omitted:

```ts
export interface GraphNodeCaption {
    readonly id: string;
    readonly text: string;
}
export interface GraphNodeCaptionPatch {
    readonly id: string;
    readonly text: string | null;
}
export interface GraphTraceOptions {
    readonly layout?: readonly GraphPosition[] | undefined;
    readonly nodeCaptions?: readonly GraphNodeCaption[] | undefined;
}
export interface GraphMarkUpdate {
    readonly nodes?: readonly GraphMark[] | undefined;
    readonly edges?: readonly GraphMark[] | undefined;
    readonly nodeCaptions?: readonly GraphNodeCaptionPatch[] | undefined;
}
export interface GraphSnapshot<NodeData = unknown, EdgeData = unknown> {
    readonly graph: GraphInput<NodeData, EdgeData>;
    readonly layout: readonly GraphPosition[];
    readonly nodeMarks: readonly GraphAnnotation[];
    readonly edgeMarks: readonly GraphAnnotation[];
    readonly result: GraphResult | null;
    readonly nodeCaptions?: readonly GraphNodeCaption[] | undefined;
}
export interface GraphNodeView<Data = unknown> {
    readonly node: GraphNode<Data>;
    readonly position: GraphPosition;
    readonly role: string | null;
    readonly result: boolean;
    readonly caption?: string | undefined;
}
export type GraphEvent = Readonly<
    | { type: "start" }
    | { type: "mark"; nodes: readonly GraphMark[]; edges: readonly GraphMark[];
        nodeCaptions?: readonly GraphNodeCaptionPatch[] | undefined }
    | { type: "layout" }
    | { type: "done" }
>;
```

No new GraphTrace method, runtime export or GraphEvent discriminant. mark updates
roles and captions atomically in one existing step. Existing GraphDoneOptions,
GraphEdgeView, GraphObjects keys/scene types and Step/Frame remain unchanged.
GraphNodeCaption and GraphNodeCaptionPatch are two new type-only exports.

The optional Canvas option is:

```ts
export interface GraphRendererOptions {
    readonly theme: "light" | "dark";
    readonly colors?: { readonly [K in keyof GraphPalette]?: string | undefined } | undefined;
    readonly roleColors?: Readonly<Record<string, string>> | undefined;
    readonly nodeCaptions?: "auto" | "hidden" | undefined;
}
```

Default is auto; hidden disables caption measurement/painting, not snapshot
validation. The option is an own data field: missing/undefined means auto; any
other value outside auto/hidden gives TypeError, after existing theme/palette/role
option checks. Without nonblank captions, base drawing/fit/controls stay as before.
No callback closes over a mutable distance Map; no new required palette member.

## 2. Snapshot ownership, updates and validation

- Constructor options can provide initial captions in any order. Capture/freeze
  their records/array immediately, storing them in node input order. New trace
  snapshots always expose a frozen nodeCaptions array, initially empty when absent.
  Public optionality accepts old snapshots with missing/undefined nodeCaptions;
  graphScene treats that as empty. Captions are copied text, not mutable node.data.
- mark({ nodeCaptions }) patches by node ID. Omitted/undefined collection or []
  preserves existing captions. Omitted IDs preserve their old text. text:null
  removes a caption. text:"" is stored as an explicit empty string but not drawn;
  text:undefined is invalid. Clear all explicitly by supplying null for each ID.
- IDs use existing exact nonempty string/node-membership rules. Repeated IDs in
  one patch are rejected even with equal text. Unknown/duplicate IDs: RangeError.
  Wrong records/arrays/scalars, sparse arrays, accessors, invalid ID/text: TypeError.
  Text accepts every primitive string, including empty; no coercion or parsing.
  Initial/snapshot text must be a string, never null. Snapshot arrays must be
  unique and follow node input order; patch/event arrays preserve supplied order.
- Use existing own-data/plain-record/dense-array capture and busy/lifecycle guard.
  Constructor order: graph, options capture, layout, initial captions. mark order:
  guard; capture known update fields nodes/edges/nodeCaptions; validate nodes,
  edges, captions; allocate and commit once. Within caption items: capture id/text,
  validate scalar types, node membership, duplicate ID. Do not call accessors or
  user callbacks; original proxy throws retain identity. Unknown fields stay ignored.
  graphScene validates caption collections after marks and before result.
- Any failure preserves snapshot, indices and phase; a caption error cannot
  commit valid role changes. Success emits exactly one mark, including no-ops.
  New mark events include a copied/frozen nodeCaptions patch array (empty if
  omitted); the field remains optional in the type for existing event fixtures.
  start has initial captions in State, without a new event. setLayout preserves
  text; done preserves all captions, marks and positions, sets result and seals.
  No mutation after done. No new reference-identity or constant-time promise.

Snapshots carry full captions, never only a delta/event. Old snapshots remain
unchanged after updates or changes to caller input. The strings/records/arrays
are ordinary cloneable data; Async/Worker rules and transport formats are unchanged.

## 3. Projection, rewind and transition semantics

graphScene adds optional caption to each graphNode.data from that snapshot's
caption table, undefined when absent. IDs, namespace encoding, layers, routing
and graphEdge data are unchanged; no caption scene object or DOM dependency.
Non-Canvas backends choose their own placement using this text.

The renderer reads the endpoint view, never event or a live algorithm variable.
For an existing/entering node, current text applies throughout the frame,
including progress=0, like current roles/results. It is not crossfaded/interpolated.
Clearing a current caption never falls back to previous text. An exiting node
may use its previous caption and presence until it vanishes, matching existing
scene endpoint rules. Anchors follow the currently interpolated node geometry.

Seek/Previous/Next reconstruct from previous/current State plus progress; they do
not undo trace calls or replay caption patches. The same endpoints, progress,
logical size and font metrics produce the same placement independent of visit
order/caches. Text/anchors may switch discretely when a candidate becomes blocked;
no smooth or permanently pinned caption placement is promised. Resize/DPR changes
recompute presentation without consuming a source or emitting a graph step.

Pause retains the current frame/text. Restart restores the initial recording
state or a new stream trace, including its initial captions; no final distance
leaks into the new run. Caption handling works with undefined Frame.event in
history and async/Worker state sources. No Player/core change is needed.

## 4. Placement and the non-overlap guarantee

The guarantee covers **new visible caption reservation boxes**, not a planar
layout or repair of existing graph/primary-label intersections. Automatic drawing
may omit captions: arbitrary dense/coincident topology, tiny canvases, long text
and edge crossings cannot guarantee every caption remains visible.

Rules for auto:

1. Fit nodes/routes as before. Captions do not move nodes, change topology,
   reroute edges, enlarge the canvas or alter the primary text. Use explicit
   logical CSS-pixel size; do not read DOM/window.devicePixelRatio.
2. Draw one horizontal plain-text line with the renderer's 12px sans-serif font
   and theme text color, independently of role/result color. An opaque background
   uses the existing background color. Normalize runs of TAB/CR/LF/U+2028/U+2029
   to a space for presentation only. Blank/whitespace-only strings are not drawn.
3. Reserve the full measured text/ink cell (at least 16px high), horizontal
   padding 4px per side and vertical padding 2px per side. Do not squeeze/shrink
   or truncate text. If the full box exceeds 120 CSS px in width or usable
   viewport dimensions, omit it. Original full text stays in State. If reliable
   text bounds are unavailable, omit that optional caption rather than guess.
4. Evaluate a bounded deterministic set of eight candidates in topology node
   order: below, above, right, left, lower-right, lower-left, upper-right,
   upper-left. Side candidates lie outside the node circle with a 4px gap;
   lower/upper side variants shift their center by one node radius vertically.
   Top/bottom candidates have a 4px gap to the circle. No unbounded search,
   force layout or retained previous-frame winner. Candidate constants/order
   specify the initial design; they are not a public pixel-coordinate promise.
5. A candidate must stay at least 4 CSS px inside the viewport, clear all
   nonzero-presence node circles/primary-text bounds, edge strokes/loops,
   arrowheads, edge labels/weights, and previously accepted caption boxes.
   Keep a 2px safety gap beyond their painted/reserved bounds; use conservative
   curve exclusion with no unchecked gaps. Broad conservative rejection is
   allowed, but must pass the default BFS readability acceptance below. Testing
   just edge endpoints or a sparse point sample is insufficient for curves.
6. Accept the first free candidate; if none is free, draw no caption for this
   node on this frame. Graph input order is the tie-breaker; result/active status
   does not grant caption priority. Skipping text is normal presentation, not a
   Player error and not deletion from State. Applications retain HTML/accessible
   alternatives for complete data. No new placement-report/tooltip API is added.

Snapshot/option and base-geometry validation still precede all Canvas calls.
Caption measurement/planning is a later host phase, after save/font setup and
before the first pixel write; errors in measured metrics are not input-validation
errors. Paint accepted captions last, after graph nodes/edges/primary text; no
leader lines or covering blocked content. Existing save/restore, recursive-render guard, numeric validation and
primary-host-error precedence apply. All supplied numeric metrics must be finite and width nonnegative; violations
or unrepresentable computed geometry give RangeError before painting. Missing/
nonnumeric required metrics mean unusable bounds: after checking supplied numbers,
omit the caption without coercion; a host measureText throw is preserved like other
Canvas throws. Missing usable ink bounds can suppress text, but thrown host
errors are not swallowed. Zero-size drawing validates State and performs no
caption metrics/painting. The 8-candidate bound is not an O(1) frame-cost claim:
text measurement and obstacle checks still scale with text/graph size.

This is a geometry/reservation guarantee under supplied backend metrics, not
bitwise pixel equality across fonts/browsers or an antialiasing proof. Actual
Canvas metrics, curves, DPR and context recovery are exercised in the native implementation
checks. Fonts/viewport changes may legitimately alter visibility.

## 5. BFS distance check

The integration adds caption patches to the existing nonterminal mark
inside emit; the application BFS numbering/queue/parents/path/counters do not
change. Format from the very state being captured, not the generator's later Map:

```js
const nodeCaptions = nodes.map(({ id }) => ({
    id,
    text: `d = ${distance.get(id) ?? (phase === "traversal" ? "—" : "∞")}`
}));
trace.mark({ nodes: nodeRoles, edges: edgeRoles, nodeCaptions });
// Later: done preserves captions already committed at traversal-done.
trace.done({ result: { nodeIds: path, edgeIds: pathEdges } });
```

In this excerpt nodeRoles/edgeRoles/pathEdges are the existing prepared patches
and exact parent-edge selection. This is the connection shape; the example uses existing inline role patches. At traversal-done, all unknown distances become
infinity before path restoration. done keeps them; it does not clear/recompute.

| Node | BFS state 0 | State 13: discover E | State 51: traversal-done | State 56: finished |
| --- | --- | --- | --- | --- |
| A | d = 0 | d = 0 | d = 0 | d = 0 |
| B, C | d = — | d = 1 | d = 1 | d = 1 |
| D, E | d = — | d = 2 | d = 2 | d = 2 |
| F | d = — | d = — | d = 2 | d = 2 |
| G | d = — | d = — | d = 3 | d = 3 |
| H | d = — | d = — | d = ∞ | d = ∞ |

Implementation acceptance: at 960×480 logical pixels the default fixed BFS layout must
show all eight short distance captions without moving the graph or crossing
obstacles, including a side alternative for bottom G. Narrow/dense/long-text
fixtures may suppress captions, but never weaken collision checks to show more.
Check all presets, unreachable H, target=start, no target, reversed edge order,
loop/parallel inputs; visible text is independent of selected result. End result
A→B→D→G stays green with its distances, while unselected H still says infinity.
Rewind from traversal-done to a traversal state restores the earlier dash; rewind
past discovery restores dash for that vertex. Restart restores state 0. Window
boundaries, final hold, source closing and per-frame read budget stay unchanged.

## 6. Evidence and compatibility boundary

The implementation passed 595 repository tests, installed consumers on four
TypeScript versions and optional bundle checks. The built-in browser passed 31
automatic real-Canvas cases plus 7 BFS-page control checks. Its pixel oracle uses
a hidden-caption graph bitmap independently of placement logic. See the
implementation report for scope/limits; the following review evidence retains
its earlier contract-only scope.

The historical contract-only review used handwritten proposed snapshot fields and declaration
excerpts with existing public playback. It checks BFS distance availability,
recording/stream rewind and type assignability; it does not implement or exercise
caption capture, graphScene caption projection or Canvas caption placement.
Placement evidence is a fixed geometric witness against existing straight BFS
edges with conservative synthetic text boxes, not an automatic placement solver
or native font/rendering test. The report names tested and still-required cases.

Adding optional fields/types with the same closed GraphEvent cases avoids new
required structural members. It was an additive extension to the graph API before its first 1.1.0 release; implementation acceptance, consumer and package checks are
recorded in the implementation report. The newly recognized nodeCaptions/caption names cannot also serve as
unrelated application metadata: review any such local fixtures before adoption.
Optional types alone do not prove runtime compatibility; graph entries and
captions were released together in 1.1.0. Existing eight published entries/core/Player need no extension. The
contract-stage inventory was 24 runtime / 93 type-only names. The implementation
adds two types: now 24 runtime / 95 type-only names, 83 distinct types. Historical evidence retains
its own source hashes. No release/CI/native approval follows from this review.
