# Tree API: /tree

[Русский](ru/tree-api.md) · [Architecture sketch](tree-contract.md) · [Released graph API](graph-api.md) · [Compatibility](api-compatibility.md) · [Contract check](checks/tree-public-api-2026-11-17.json)

**Implemented locally, 2026-11-18; unpublished.** The baseline is released
1.1.0 / 629defe. This working copy adds independent headless ESM /tree with
createTreeTrace, treeScene and the 29 types below. It is absent from npm 1.1.0.
Use a local build/archive of the unpublished [1.2.0 candidate](candidate-1.2.md). This headless entry has no Canvas dependency; drawing is provided by
the separate local /canvas/tree entry. [Implementation checks](checks/tree-implementation-2026-11-18.json).
The [contract-only check](checks/tree-public-api-2026-11-17.json) and architecture
review keep their historical type/core-fit scope.
[The 1.2.0 readiness review](tree-readiness-1.2.md) accepts this headless API;
the renderer safety finding T1 is corrected. Candidate notes track exact-SHA CI
and the separately authorized release.

## Scope and selected boundary

Two runtime names: createTreeTrace and treeScene. The first scope is one finite
rooted ordered tree or one finite binary tree, including empty trees. The kind
is explicit and fixed for the life of a trace. Forests use separate namespaces;
DAGs, multiple parents, cycles and detached working nodes are outside a committed
TreeSnapshot. BST ordering, heap/balance properties, comparators, traversals and
rotations belong to application algorithms. The application chooses when to
compute/record layout; the separate /canvas/tree helper can compute positions.

The trace owns immutable model/view snapshots and emits existing Step values.
One edit commits a complete candidate topology/view atomically. There are no
insert/remove/move/rotate algorithms or mutation callbacks in this first API.
Existing Step/Frame/Scene, Player, ArrayEvent and GraphEvent remain unchanged.
The first graph trace keeps fixed topology; it cannot host evolving tree topology.

**Layout is explicit.** Construction requires a complete layout, including [] for
an empty tree. Coordinates are finite logical units, with no [0,1] restriction.
This headless contract promises no default tree layout, Canvas size, non-overlap
or binary-slot geometry. A future layout helper/Canvas renderer needs a separate
contract; none is implied by accepting left/right data.

## Complete declarations

All names in this block belong only to the local /tree entry. Ordered/binary
factory and scene overloads preserve node/link payload inference and the kind.
A union input returns a union-kind trace; its actual runtime kind is still fixed.
TreeFrame's third generic is Kind and fourth generic is Event; undefined events
are supported for state-only async/Worker playback.

```ts
import type { Step, Frame } from "@grundyjs/algiviz/playback";
import type { Scene } from "@grundyjs/algiviz/scene";

export type TreeKind = "ordered" | "binary";
export type TreeBinarySlot = "left" | "right";
export interface TreeNode<Data = unknown> {
    readonly id: string;
    readonly label?: string | undefined;
    readonly data?: Data | undefined;
}
export interface TreeOrderedLink<Data = unknown> {
    readonly id: string;
    readonly parentId: string;
    readonly childId: string;
    readonly label?: string | undefined;
    readonly data?: Data | undefined;
    readonly slot?: undefined;
}
export interface TreeBinaryLink<Data = unknown> {
    readonly id: string;
    readonly parentId: string;
    readonly childId: string;
    readonly slot: TreeBinarySlot;
    readonly label?: string | undefined;
    readonly data?: Data | undefined;
}
export type TreeLink<Data = unknown, Kind extends TreeKind = TreeKind> =
    Kind extends "binary" ? TreeBinaryLink<Data> : TreeOrderedLink<Data>;
export interface TreeOrderedInput<NodeData = unknown, LinkData = unknown> {
    readonly kind: "ordered";
    readonly rootId: string | null;
    readonly nodes: readonly TreeNode<NodeData>[];
    readonly links: readonly TreeOrderedLink<LinkData>[];
}
export interface TreeBinaryInput<NodeData = unknown, LinkData = unknown> {
    readonly kind: "binary";
    readonly rootId: string | null;
    readonly nodes: readonly TreeNode<NodeData>[];
    readonly links: readonly TreeBinaryLink<LinkData>[];
}
export type TreeInput<N = unknown, L = unknown, Kind extends TreeKind = TreeKind> =
    Kind extends "binary" ? TreeBinaryInput<N, L> : TreeOrderedInput<N, L>;
export interface TreePosition {
    readonly nodeId: string;
    readonly x: number;
    readonly y: number;
}
export interface TreeAnnotation {
    readonly id: string;
    readonly role: string;
}
export interface TreeMark {
    readonly id: string;
    readonly role: string | null;
}
export interface TreeNodeCaption {
    readonly id: string;
    readonly text: string;
}
export interface TreeNodeCaptionPatch {
    readonly id: string;
    readonly text: string | null;
}
export interface TreeMarkUpdate {
    readonly nodes?: readonly TreeMark[] | undefined;
    readonly links?: readonly TreeMark[] | undefined;
    readonly nodeCaptions?: readonly TreeNodeCaptionPatch[] | undefined;
}
export interface TreeResultInput {
    readonly nodeIds?: readonly string[] | undefined;
    readonly linkIds?: readonly string[] | undefined;
}
export interface TreeResult {
    readonly nodeIds: readonly string[];
    readonly linkIds: readonly string[];
}
export interface TreeDoneOptions {
    readonly result?: TreeResultInput | undefined;
}
export interface TreeTraceOptions {
    readonly layout: readonly TreePosition[];
    readonly nodeCaptions?: readonly TreeNodeCaption[] | undefined;
}
export interface TreeEdit<N = unknown, L = unknown, Kind extends TreeKind = TreeKind> {
    readonly rootId?: string | null | undefined;
    readonly nodes?: readonly TreeNode<N>[] | undefined;
    readonly links?: readonly TreeLink<L, Kind>[] | undefined;
    readonly layout?: readonly TreePosition[] | undefined;
    readonly kind?: undefined;
}
export interface TreeSnapshot<N = unknown, L = unknown, Kind extends TreeKind = TreeKind> {
    readonly tree: TreeInput<N, L, Kind>;
    readonly layout: readonly TreePosition[];
    readonly nodeMarks: readonly TreeAnnotation[];
    readonly linkMarks: readonly TreeAnnotation[];
    readonly nodeCaptions: readonly TreeNodeCaption[];
    readonly result: TreeResult | null;
}
export type TreeEvent = Readonly<
    | { type: "start" }
    | { type: "edit" }
    | { type: "mark"; nodes: readonly TreeMark[]; links: readonly TreeMark[];
        nodeCaptions: readonly TreeNodeCaptionPatch[] }
    | { type: "layout" }
    | { type: "done" }
>;
export type TreeStep<N = unknown, L = unknown, Kind extends TreeKind = TreeKind> =
    Step<TreeSnapshot<N, L, Kind>, TreeEvent>;
export type TreeFrame<N = unknown, L = unknown, Kind extends TreeKind = TreeKind, Event = TreeEvent> =
    Frame<TreeSnapshot<N, L, Kind>, Event>;
export interface TreeTrace<N = unknown, L = unknown, Kind extends TreeKind = TreeKind> {
    readonly state: TreeSnapshot<N, L, Kind>;
    start(): TreeStep<N, L, Kind>;
    edit(update: TreeEdit<N, L, Kind>): TreeStep<N, L, Kind>;
    mark(update: TreeMarkUpdate): TreeStep<N, L, Kind>;
    setLayout(layout: readonly TreePosition[]): TreeStep<N, L, Kind>;
    done(options?: TreeDoneOptions): TreeStep<N, L, Kind>;
}
export interface TreeSceneOptions {
    readonly namespace: string;
}
export interface TreeNodeView<Data = unknown> {
    readonly node: TreeNode<Data>;
    readonly position: TreePosition;
    readonly caption: string | null;
    readonly role: string | null;
    readonly result: boolean;
    readonly root: boolean;
}
export interface TreeLinkView<Data = unknown, Kind extends TreeKind = TreeKind> {
    readonly link: TreeLink<Data, Kind>;
    readonly from: string;
    readonly to: string;
    readonly role: string | null;
    readonly result: boolean;
}
export type TreeObjects<N = unknown, L = unknown, Kind extends TreeKind = TreeKind> = {
    treeNode: TreeNodeView<N>;
    treeLink: TreeLinkView<L, Kind>;
};
export declare function createTreeTrace<N = unknown, L = unknown>(
    tree: TreeOrderedInput<N, L>, options: TreeTraceOptions
): TreeTrace<N, L, "ordered">;
export declare function createTreeTrace<N = unknown, L = unknown>(
    tree: TreeBinaryInput<N, L>, options: TreeTraceOptions
): TreeTrace<N, L, "binary">;
export declare function createTreeTrace<N = unknown, L = unknown>(
    tree: TreeInput<N, L>, options: TreeTraceOptions
): TreeTrace<N, L>;
export declare function treeScene<N = unknown, L = unknown>(
    state: TreeSnapshot<N, L, "ordered">, options: TreeSceneOptions
): Scene<TreeObjects<N, L, "ordered">>;
export declare function treeScene<N = unknown, L = unknown>(
    state: TreeSnapshot<N, L, "binary">, options: TreeSceneOptions
): Scene<TreeObjects<N, L, "binary">>;
export declare function treeScene<N = unknown, L = unknown>(
    state: TreeSnapshot<N, L>, options: TreeSceneOptions
): Scene<TreeObjects<N, L>>;
```

## IDs, hierarchy and binary slots

- IDs are nonempty primitive strings; whitespace is significant, with no trim,
  coercion or generated IDs. Node/link ID domains are independent. Labels,
  payloads, positions, parent-child pairs, order and slots do not define identity.
- Keep a node ID across value/label/parent/root/position changes. Keep a link ID
  only when the application intends the same logical relation to animate through
  endpoint/slot changes. A link ID is not owned by a child or a parent's slot.
  There is no automatic rematching by endpoints or silent ID allocation.
- Removed IDs are retired in their own domain for that trace: later reintroduction
  is RangeError. An ID present before and after one edit is retained, not removed
  and recreated. Failed calls retire/reserve no IDs. A fresh trace/Restart gets
  fresh identity history and can use its original input IDs again. Old snapshots
  remain valid while retained by playback; retirement is not snapshot data.
- Empty means rootId = null and nodes/links empty. Otherwise exactly one existing
  root has no incoming link; every other node has exactly one. All endpoints exist,
  all nodes are reachable, and self-links, repeated parent-child pairs and cycles
  are invalid. Node storage order is not hierarchy order.
- Ordered mode: filtering the authoritative links array by parent defines child
  order. A defined slot is TypeError. Replacing that array reorders siblings;
  no second parent/children/order table can disagree with it.
- Binary mode: each link requires its own left or right slot. Each parent has at
  most one link per slot. Array order never changes left/right meaning. A missing
  left link means an empty left slot; a right-only child stays right. There is no
  placeholder node, null-ended link, inferred compression or automatic promotion.
  Placeholder decorations may use application scene kinds keyed by parent+slot.

## Atomic trace operations

Construction captures tree, complete layout and optional initial captions.
The initial snapshot has empty marks and null result. Construction emits no step.
state is readable immediately. start is required exactly once and returns index 0
with that same initial state. Each successful later command increments index by
one and creates a new outer snapshot, including a no-op; unchanged owned records
may be shared. Step envelopes, events, owned records and collections are frozen.

| Command | Selected behavior |
| --- | --- |
| edit(update) | Omitted/undefined rootId, nodes, links and layout retain their current values subject to pruning described below. Supplied nodes/links replace their entire collections, not an upsert or sequential patch. kind cannot be supplied with a defined value. Validate the effective candidate as one unit. |
| mark(update) | Apply node roles, link roles, then node-caption patches atomically. Missing lists are empty; duplicate IDs within a list are RangeError. Empty update still emits a mark step. |
| setLayout(layout) | Replace complete current-node positions atomically; it never changes topology. No-op layout still emits a step. |
| done(options?) | Preserve topology/layout/marks/captions, store the selected result or null, emit terminal done once. No later mutation is allowed. |

To insert, supply complete new nodes and links plus complete layout in one edit.
To remove a subtree, supply remaining nodes and links and rootId if needed. No
structural cascade is guessed: deleting nodes while retaining dangling links is
invalid. Removing everything needs rootId:null, nodes:[], links:[] together.
Reparenting/reordering/rotation can replace links/rootId without replacing nodes.
Only the final candidate must be a tree; no invalid intermediate snapshots escape.

When an edit removes entities, their marks/captions and node positions are pruned.
Retained IDs keep marks/captions and positions; changed link endpoints keep that
link's mark. Result is null before done, so edit does not carry a terminal result.
If layout is omitted, every candidate node must already have a retained position;
adding a node therefore requires a supplied complete layout in the same edit.
Supplied layout contains each candidate node exactly once, no removed or extra ID.
Stored layout follows nodes order; stored marks/captions follow their entity order.

Roles are open nonempty strings; null removes a role. They do not assert traversal
or sorted/balanced status. Caption text is any string, including empty; null patch
removes it. NodeView.caption is null when absent and preserves explicit empty text.
Node labels and captions are independent. Result node/link selections are unique,
existing IDs in caller order; either list may be empty/omitted. Selections are
independent: selecting a link does not select its endpoints or assert a path.
done() or result:undefined stores null; result:{} stores two empty arrays.
A role named result is just a role. Permanent visual state belongs to State,
not to past events. edit/layout events carry no redundant replay log.

## Example: sparse binary tree and one atomic rotation

This runs against the local build/archive, not the published npm 1.1.0. It retains both node
IDs and the explicitly chosen link ID; the missing left slot is never mistaken
for the right child. The application chooses the new hierarchy and positions.

```ts
import { createTreeTrace } from "@grundyjs/algiviz/tree";

function* rotateExample() {
    const tree = createTreeTrace({
        kind: "binary", rootId: "A",
        nodes: [{ id: "A", data: 2 }, { id: "B", data: 3 }],
        links: [{ id: "relation", parentId: "A", childId: "B", slot: "right" }],
    }, { layout: [{ nodeId: "A", x: 0, y: 0 }, { nodeId: "B", x: 1, y: 1 }] });
    yield tree.start();
    yield tree.edit({
        rootId: "B",
        links: [{ id: "relation", parentId: "B", childId: "A", slot: "left" }],
        layout: [{ nodeId: "A", x: 0, y: 1 }, { nodeId: "B", x: 1, y: 0 }],
    });
    yield tree.done({ result: { nodeIds: ["B"], linkIds: ["relation"] } });
}
```

## Capture, validation and errors

Inputs owned by the module are plain Object/null-prototype records and dense
arrays of own data elements. Required fields must be own data properties.
Recognized accessors are rejected without invoking them; inherited optional fields
are ignored. Undefined optional fields mean omission. Unknown fields are ignored,
except the explicitly forbidden defined edit.kind and ordered-link slot fields.
Array length must be a primitive integer in 0..2^32-1; malformed reported lengths
are TypeError before element inspection.
Payload data is captured by reference, never traversed/cloned/deep-frozen. The
application owns payload immutability and structured-clone compatibility.

Retirement requires trace storage that grows with distinct IDs ever committed,
not just live nodes/links; bounded playback rewind does not bound this history.
Whole-collection capture/validation and layout remain synchronous work. The
Player frame budget bounds source reads, not the cost of one edit/projection.

| Invalid case | Error |
| --- | --- |
| Wrong record/array/scalar type, missing required field, accessor/sparse array, empty/non-string ID/role/namespace, non-string label/caption, defined ordered slot or edit.kind | TypeError |
| Unsupported nonempty kind/slot string, duplicate/retired ID, unknown reference, invalid root/hierarchy/cycle/slot occupancy, duplicate/missing/extra position, nonfinite numeric x/y | RangeError |
| Repeated start, command before start/after done, same-trace mutation during capture | Error |

Empty/non-string kind or binary slot is TypeError; a missing binary slot is a
missing-field TypeError. No coercion or validation of application payload occurs.
No TreeError/error code or wrapper is introduced. Original Proxy trap throws,
including non-Error/falsy values, propagate unchanged. Proxies are not sandboxed.
Messages/stacks are diagnostic, not stable identifiers.

Validation precedence is part of the contract:

1. A trace command checks busy, then lifecycle, before inspecting arguments.
   state reads during capture see the previous committed snapshot. A nested
   command fails before touching its arguments. Reads and another idle trace
   remain allowed; this adds no new Player reentrancy behavior.
2. For each record, capture/check recognized property descriptors before scalar
   values. For each array, capture length/density/data elements before records.
   Constructor: tree envelope; kind and root scalar; nodes in supplied order
   (id, label, opaque data, duplicate ID); links in supplied order (id, parentId,
   childId, slot, label, opaque data, duplicate ID, endpoint membership).
3. Validate root/empty membership; self/repeated-pair and binary slot occupancy
   in link order; incoming-parent counts in node order; reachability/cycles from
   root using child order (binary left before right). Disconnected components
   are invalid. Then options envelope, layout, initial captions.
4. edit: update envelope, forbidden kind, optional root scalar, effective nodes,
   effective links, full hierarchy as above, retired node IDs then retired link
   IDs in candidate order; then complete/effective layout. Prune/canonicalize
   surviving annotations/captions only after validation. All IDs are retired
   only at commit, never while capturing. No callback sees a proposed state.
5. Layout: records in supplied order, nodeId/x/y scalar checks, membership,
   duplicate check; then missing nodes in node order. mark: envelope; nodes,
   links, nodeCaptions, with id/value checks, membership, duplicate check. done:
   options/result envelope, node IDs then link IDs, preserving selection order.
6. treeScene: options/namespace, snapshot envelope, complete tree/hierarchy,
   layout, nodeMarks, linkMarks, nodeCaptions, result. Canonical layout/mark/caption
   order is required; result keeps caller order. Any canonical-order violation
   is RangeError. It checks snapshot validity, not trace retirement history.

Every capture, validation and required allocation finishes before changing state,
index, lifecycle or retired-ID sets. Failure preserves state object identity and
all internal history, so a corrected retry uses the same next index. Busy is
released in finally. Arbitrary external Proxy side effects are not rolled back.
Empty trees allow start/edit({})/empty mark/layout/done and reject entity IDs.

## Scene, playback and module boundary

The pure treeScene endpoint projection accepts correctly formed application or
Worker-cloned snapshots; it requires no frozen brand or Event. Owners must keep
retained snapshots/payloads immutable. It emits exactly treeNode and treeLink,
links at zIndex 0 then nodes at 1, in their stored order. Wrappers/view data are
copied/frozen while immutable snapshot records and payload references are retained.
Root is a derived node flag; no parent/depth cache is persisted as a second truth.

Scene identities distinguish tree nodes, tree links and graph objects even for
matching namespace/domain IDs. Their encoding is opaque. Use distinct namespaces
for different trees/views. from/to are scene node IDs, not domain IDs. Retained
links may change endpoints/slot with the same ID/type; handlers must resolve old
and new endpoint generations through scene.get. A missing binary slot emits no
object. There are no mandatory arrow/label/placeholder scene kinds. Snapshot
validation is not a guarantee of crossing-free intermediate animation.

Use existing Player.stepSource with isTerminal:step=>step.event.type==='done'.
Rewind/seek restore snapshots, not inverse edits; Restart creates a fresh trace
and its original identity history. dispose/source cleanup keep current contracts.
State-only asyncSource/Worker can deliver TreeSnapshot with undefined events and
EOF completion; tree rendering cannot require TreeEvent. Existing Worker clone/
transfer/shared-memory restrictions still apply; trees add no transport exemption. Use application
finally for cleanup, not work after yielding done.

/tree stays DOM-free with ES2022 declarations and no rendering dependency.
The [separate /canvas/tree entry](tree-canvas-api.md) implements createTreeRenderer
locally, unpublished, with explicit layout/render methods. Its layout output
feeds existing constructor/edit options, without changing this headless API; /canvas/graph is
not declared to accept tree snapshots. Static tree-to-graph conversion requires
explicit directed edges and preserving tree metadata separately; it does not
make createGraphTrace topology mutable. No new root/deep import, player option,
algorithm export, implicit headless layout or existing closed-union widening is selected.

## Implementation verification and release boundary

The [implementation report](checks/tree-implementation-2026-11-18.json) records
permanent model/control regressions, installed compiler consumers and optional
bundle isolation. The earlier [contract-only report](checks/tree-public-api-2026-11-17.json)
retains its declaration-probe scope; it is not rewritten as runtime evidence.
The regression areas below are covered in this headless stage. The later
[Canvas implementation report](checks/tree-canvas-implementation-2026-11-19.json)
covers layout/render/native verification separately. Candidate CI/publication remain pending.

| Area | Required regression cases |
| --- | --- |
| Model/slots | Empty/singleton, right-only child, ordered reorder, wrong/missing/duplicate slot, multiple roots/parents, cycle/disconnected graph, arbitrary stable IDs |
| Atomic edit | Insert/delete/subtree removal, reparent, root change, rotation, clear; malformed late input leaves state/index/lifecycle/retirement unchanged |
| Identity | Preserved endpoint/slot changes, retirement/reuse rejection in each domain, same ID in different domains, fresh trace after Restart |
| View state | Marks/captions/layout preserved or pruned by ID, new node requires complete layout, result persistence/independence, no-op steps |
| Errors | Descriptor/accessor/proxy throws, mixed-invalid precedence, same-trace reentrancy, no payload inspection or partial commit |
| Scene/control | Old/new link endpoints, enter/update/exit, namespaced composition, event-free cloned snapshots, history/bounded rewind, Restart/dispose |
| Package | Real installed exports, strict supported compilers, ES2022-only headless types, lazy independent loading, all existing ten entries unchanged |

The [readiness review](tree-readiness-1.2.md) selects 1.2.0 as the compatible minor
target; package and lockfile now identify the unpublished 1.2.0 candidate. Slot/kind/event closed
sets and all selected error/ownership behavior need the same compatibility review
at first publication.
