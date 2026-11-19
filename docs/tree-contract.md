# Future /tree: contract sketch and core fit

[Русский](ru/tree-contract.md) · [Graph sketch](graph-contract.md) · [Scenes](scene.md) · [Compatibility](api-compatibility.md)

**Public API follow-up, 2026-11-17:** [the selected /tree contract](tree-api.md)
now defines types, atomic edit, ID retirement, binary slots and validation on
released 1.1.0. /graph is published; /tree is now implemented locally, unpublished.
[Runtime/package checks](checks/tree-implementation-2026-11-18.json) record the new stage. The sketch/checks below
retain their 2026-11-16 scope; the new contract supersedes deferred API decisions.

**Design review, 2026-11-16; no implementation or publication.** The reviewed
candidate is a9b93f8. Neither /tree nor /graph exists in the package export map.
Names and shapes below describe a possible future module, not current exports
or finalized signatures. Existing tree/heap examples remain application code.

## Conclusion and scope

The proposed tree model fits current Step, Frame, Scene, generic registries and
Player. No change to the existing eight entries or their closed unions is
needed for this scope. A future /tree export would itself add public API;
adding it compatibly may be a minor feature under U3. This review adds no entry.
No core API blocker for 1.0 was found within the scope below.

The first scope is a finite **rooted ordered tree**, including an empty tree.
Snapshots may describe insertion, subtree removal, reparenting, sibling reorder
and rotations atomically. This establishes what data must be representable;
it does not choose mutation helpers or promise a built-in rotation algorithm.
The algorithms and construction of successive snapshots remain application-owned
until a separate trace API is designed.

A forest can be composed from independently namespaced trees in one scene. DAGs,
shared children, cycles and arbitrary graph edges are outside the tree model.
BST/balance/heap properties, key comparison, traversals and automatic balancing
are algorithm policies, not invariants of every tree. General ordered trees do
not imply binary left/right slots; sparse binary slots need an explicit future
policy rather than guessing from an absent child.

## Model, validity and ownership

Conceptually, a snapshot has:

```text
rootId: node ID | null
nodes: records with stable ID and application label/data
links: records with stable ID, parentId and childId
layout: node ID -> finite x/y
annotations: node/link ID -> persistent role/data
result: selected node/link IDs, or no result
```

This is a model sketch, not exported TypeScript. The ordered link list defines
sibling order by filtering links for each parent; node storage order is not child
order. One representation is authoritative: parent/children/depth indexes, if
offered, are derived views and cannot independently disagree with it. The exact
input syntax, defaults, accessors and validation/error order are a later API task.

Required invariants of every committed model snapshot:

- Node and link IDs are nonempty primitive strings, unique within their own
  collections. Labels, values, array indices, depth and sibling order are not IDs.
- Empty means rootId is null and both nodes/links are empty. A nonempty tree has
  one existing root, with no incoming parent link.
- Each other node has exactly one incoming link. Endpoints exist; self-links,
  duplicate parent-child links, multiple parents and cycles are invalid.
- All nodes are reachable from the root. Disconnected hidden nodes are not a
  second implicit tree; visibility and membership are different concepts.
- Annotation/result references belong to the appropriate current node/link set;
  layout provides positions required by the projection, with finite coordinates.

The future module must validate an entire update before committing it or emitting
a step. Reparenting to a descendant is invalid. Removal includes incident links
and affected annotations/results; removing a root either produces an empty tree
or atomically supplies a new valid root/hierarchy. Rotation must emit a valid
before and after snapshot, not expose temporarily invalid intermediate mutations.
This review does not implement or verify the future model validator.

Module-owned records/collections are copied and frozen into immutable snapshots.
Unchanged portions may be shared. Application payload immutability and Worker
cloneability remain the application's responsibility. Freezing Map/Set wrappers
does not freeze their contents. No automatic deep clone of arbitrary payload is
promised by this sketch or by generic playback.

## Relationship with /graph

Both sketches require stable node/link identities, immutable annotations/results,
namespaced scene IDs, pure projection and links resolved through scene.get.
An explicit tree link ID satisfies the graph requirement for a separate edge ID;
do not derive identity from parent-child pairs, which change during reparenting.

A tree snapshot can be represented as graph data: nodes map to nodes, links to
directed parent-to-child edges with the same domain IDs. Root and sibling order
remain tree metadata; a generic graph does not imply either. Arbitrary graphs
cannot be accepted as trees without checking all the tree invariants.

The initial /graph sketch deliberately fixes topology for a trace. **Do not feed
a changing tree topology to that future fixed-topology graph trace or silently
widen its contract.** Tree changes can use their own State and current generic
playback/scene directly. Sharing future internal projection/routing code does not
require a public dependency, inheritance or extending a closed GraphEvent union.
Neither module exists yet, so exact dependencies/adapters remain undecided.

Tree scene kinds are provisionally treeNode/treeLink; graph kinds are separately
provisional. Shared geometry is possible, but a graph registry is not automatically
a tree registry. A composite application registry can contain both. No new
mandatory kind is added to existing registries or the future graph type map.
Each projection must expose a deliberate, stable kind set rather than grow one
with every algorithm. Decorations use application extensions.

## Steps, frames and control

```ts
// TreeState/TreeEvent are application types here, not package exports.
type TreeStep = Step<TreeState, TreeEvent>;
type TreeFrame = Frame<TreeState, TreeEvent>;
```

The root, hierarchy, persistent marks and result live in State. Events describe
an operation; the renderer must not reconstruct the hierarchy from past events.
Queues, stacks, recursion frames, comparator results and traversal order stay in
application state as needed. Visual roles need an explicit open extension or
typed payload; ArrayEvent and Player status phases remain unchanged.

createStepEmitter, createPlayer/createTimeline and Player stepSource/isTerminal
already carry these types. Terminal work precedes terminal yield; source cleanup
belongs in finally. Pause, Next, final hold, Restart and dispose keep their
current contracts. Restart obtains a fresh factory source, restoring its initial
root/hierarchy and clearing old results. Previous restores buffered snapshots;
it does not run inverse rotations. The rewind window uses sequence positions,
not node IDs, depths or step.index.

State-only asyncSource/Worker delivery remains possible with EOF completion and
undefined event. Persistent visual state cannot depend on Frame.event being
available. Async explicit events/terminal predicates would be a separate playback
feature, not a tree-specific PlayerOptions branch. Plain model data is suitable
for structured cloning; executable algorithms/handlers are not sent as data.

## Identity, hierarchy changes and layout

Scene IDs must distinguish trees, graphs, nodes, links and multiple views of the
same domain entity. The graph sketch's tuple encoding is a safe example, not a
publicly promised integration encoding. For synchronized tree/array heap views,
share a domain item ID but use different scene IDs for each visible copy.

Retain a node ID when its position, parent, label or root status changes. A new
logical entity gets a new ID even if its value matches a removed node. Links also
have explicit logical identities: the same link may change endpoints; deleting
and replacing a relation may instead use a fresh ID. The future trace API must
choose and document its allocation/retention rules. Endpoint changes do not imply
a scene type change or automatic rematching by endpoint pair.

A rotation frame exposes both roots/hierarchies through previous/current State.
Scene transitions retain node positions and old/new link references. A link
handler must resolve **both generations** through scene.get when endpoints change;
reading only current references can visibly jump. Interpolation or crossfading
of the two link geometries is a renderer policy still to be selected. No new
relation/parent field in Frame or Scene is needed.

Only committed snapshots must be valid trees. In-between geometry is an animation,
not a third topology to validate; temporary crossings/overlap are possible. No
non-crossing animation or automatic morphing guarantee follows from core fit.
For simultaneous node/link exit, scene.get retains old endpoint transitions even
at zero presence. Insertions use new endpoints. Retained SVG/DOM handlers must
reconcile actual drawn IDs on each frame: seeking can skip exit callbacks.

Layout must be deterministic from the immutable model/view policy, independent
of render history. Positions belong in State or in a pure deterministic projection
with immutable captured policy. Layout may depend on hierarchy and sibling order;
viewport/DPR transformation belongs in handlers and must match for nodes/links.
Changing a captured layout policy requires a new projector. Avoid mutable DOM
reads or progress-dependent layout inside createSceneProjector's endpoint cache.

Collapsing/filtering, if offered later, needs immutable view state separate from
model membership. Project only links whose endpoints are projected. scene.get
cannot supply an object omitted from both endpoint scenes. A selected hidden
node remains model data; whether to show a summary is a future view policy.
Cursor routing through ancestors remains an application/renderer concern, not a
new playback control. The current tree pointer example is not a promise for
routing across arbitrary changing topologies.

## Fit check and unresolved module decisions

| Need | Existing mechanism | Core change |
| --- | --- | --- |
| Root, ordered children, tree constraints | Generic State; module validation | None |
| Insertion/removal/reparent/rotation snapshots | Endpoint matching by stable ID, enter/update/exit | None |
| Moving nodes and redirected links | ObjectTransition + progress + scene.get | None |
| Results, rewind, seek and fresh restart | Immutable State, generic playback and Player | None |
| Graph/tree/array in one scene | Namespaces and composite generic registry | None |
| Canvas or retained SVG | Backend-independent handlers; application reconciliation | None |
| Async/Worker states | Existing state-only source contracts | None |

The isolated check passed **31/31 runtime cases** and four strict TypeScript 6.0.3
configurations: NodeNext/Bundler × headless ES2022/Player DOM. Nine tree-specific
negative type cases check readonly data, narrowing, events and registries. Runtime
fixtures are handwritten application snapshots/scenes, plus existing tree/heap
examples, against the installed candidate's public core. There is no /tree
implementation, model validator, layout solver or new package declaration/stub.
The check establishes data availability, not native rendering quality, routing,
frame cost or a complete future-module/compiler compatibility matrix.

Before implementation, decide exact exports/input types, validation/errors and
atomic trace methods, link identity allocation, binary-slot/forest boundaries,
layout API and bounds, palette priorities, optional renderer loading and graph
interop. Keep the tree model headless and DOM-free; no new rendering imports in
current headless entries. General performance guarantees need separate workloads.

Those are decisions for a new capability, not identified changes required in
Step/Frame/Scene before 1.0. Broader future requirements need their own review.

[Architecture check record](checks/tree-contract-2026-11-16.json).
