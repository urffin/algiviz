# Future linked list: contract sketch and core fit

[Русский](ru/linked-list-contract.md) · [Graph](graph-contract.md) · [Tree](tree-contract.md) · [Scenes](scene.md) · [Compatibility](api-compatibility.md)

The implementation is available in 1.4.0. See the [List API](list-api.md) and
[Canvas API](list-canvas-api.md) for the public contracts. The dated sections below
record the design and implementation process.

**Public API selected 2026-11-20:** the future entry is named /list.
[The /list contract](list-api.md) selects createListTrace/listScene, complete
atomic edits, stable node IDs and structural head/next-slot IDs, marks/results,
validation and the application-owned microstep boundary. Released 1.3.1 is the
baseline. The implementation and package exports were added after this design stage. The sketch below
retains its historical scope; previously undecided names/choices are superseded
where the new contract explicitly specifies them.

**Architecture review, 2026-11-16; no implementation or publication.** Candidate
a9b93f8 is the baseline. There is no linked-list package entry, trace, event type
or stock renderer. Entry names such as /list or /linked-list and all signatures
remain undecided. The models below are design requirements, not current exports.

## Conclusion and scope

Insertion, deletion and pointer retargeting fit the current Step, Frame, Scene,
generic registries and Player. No existing public field, event union, scene kind
or entry must change for the proposed scope. No core API blocker before 1.0 was
found here. A future independent entry would add public API, potentially a minor
feature under U3 if existing supported uses remain compatible; none is added now.

The first scope is a finite **acyclic singly linked list**, including empty and
singleton lists, with immutable complete snapshots. Insertion/removal at any
position, reordering/reversal and valid pointer redirection are representable
as atomic snapshot changes; specific trace methods and algorithms are not chosen.
Circular/doubly linked lists, sentinel conventions, multiple lists sharing nodes,
memory allocators and a general pointer-heap debugger are outside that scope.
Future variants need their own API/compatibility review, not an implicit extension
of a closed next-only type map or union.

## Model and invariants

Conceptual data, not exported TypeScript:

```text
headId: node ID | null
nodes: { id, value: T, nextId: node ID | null }[]
layout: node ID -> finite x/y, or immutable layout policy
annotations: node/pointer IDs -> persistent role/data
result: selected node IDs/order, or application answer metadata
```

Node storage order is not list order. Following headId/nextId defines the chain.
Tail and length are derived; if the future API exposes cached versions, they
must agree with that chain rather than become independent topology inputs.
No separate user-writable edge table duplicates nextId as a second authority.

Every complete model snapshot must satisfy:

- IDs are unique nonempty primitive strings. Equal T values/labels do not imply
  equal nodes. Positions, indices and traversal ranks are not identities.
- Empty means headId is null and nodes is empty. A nonempty head exists in nodes.
- Every non-null nextId references an existing node. Null means no successor;
  it is not a missing ID, a dummy node, undefined or an implicit sentinel object.
- Following next from head reaches every node exactly once, ending at null.
  No cycles, self-links, unreachable nodes or shared successor with two incoming
  list links are allowed. Head has no incoming next link; the tail is unique.
- Marks/result references to current entities and required layout coordinates
  are valid. A removed node's mark/cursor is cleared or reassigned atomically;
  historical answer metadata can instead be application-owned copied data.

The future module validates an entire update before commit/emission. Redirecting
A.next to C is not generally valid if B becomes unreachable but remains a member:
remove/move B in the same complete update or use a separate working-state view.
Inserting X between A and B commits X.next=B and A.next=X together; deleting B
commits the predecessor bypass and removal of B together. Head/tail/singleton
cases follow the same invariants. The exact accepted input, operation names,
allocation rules, error classes and validation order require later API design.
Generic Scene does not enforce these model rules, and this review implements
neither the future validator nor a list mutation algorithm.

## Teaching individual pointer assignments

Atomic valid snapshots are not a complete account of a pointer algorithm's local
work. After allocating X and setting X.next=B, but before A.next=X, X can be
detached and B can have two incoming arrows in the working view. During removal,
an allocated detached node or a local cursor may remain visible after bypass.
Such a working arena is **not a valid committed list or tree** under the sketches.

Keep it in a separate application State: e.g. a valid list snapshot plus local
allocated nodes/references/operation context, or a fully application-owned arena
for that lesson. Current generic Step/Frame and custom scenes can show those
microsteps without adding a new ListState/Player phase or relaxing the complete
model validator. Do not pass that arena to the future list/tree validator and
claim it is a valid chain. A public staging builder or unrestricted setNext API
would require its own contract; this sketch does not silently promise either.

If an instructional view wants to show a dangling/freed reference, it must retain
explicit diagnostic/tombstone data or draw an unresolved reference deliberately.
scene.get cannot dereference an entity absent from both endpoint scenes. ID
references are data, not actual machine pointers or memory ownership instructions.

## Node and pointer identities

Retain node ID when changing value, position, head status or successor. A new
logical node receives a new ID even if its value equals a removed one. Avoid
recycling IDs within retained history; seek can skip the gap and match unrelated
entities. Restart supplies a fresh source/session; it does not mutate old states.

The logical next pointer belongs to an owner's **next slot**. Its identity is
conceptually (owner node ID, 'next'), independent of the target. Projection can
materialize an explicit pointer ID from that slot; do not derive it from the
owner-target pair. Thus A.next=B -> A.next=X updates one retained pointer.
Deleting the owner removes its pointer; a new node owns a different slot.

Provisional scene kinds are listNode and listPointer, with stable names still to
be chosen. Node data can hold value/position/marks; pointer data holds scene ID
of its owner and a nullable target scene ID. A useful strategy is to project one
pointer object for every node, including a null next slot: null-to-target and
target-to-null then remain update transitions. A null pointer marker/short stroke
is drawn by the pointer handler without a fake null node. Whether this becomes
the stock projection default is a later rendering/API choice.

If another projection omits null slots, they enter/exit when becoming non-null/null;
scene.get will only find slots declared at either endpoint. A handler registry
must have a deliberate stable kind set; head/tail/cursor decorations can be
application extensions rather than new mandatory kinds added later under U3.
Scene IDs namespace list/view/kind/node/slot, separate from graph/tree and other
lists. Tuple encoding is an example, not a public integration encoding promise.

## Frames, redirection and rendering

For insertion, retained nodes keep their identities while the inserted node/slot
enter. Predecessor pointer transitions carry old and new targets. Layout can move
survivors to make space without renumbering them. Removal makes the node and its
owned pointer exit; the predecessor pointer updates to the surviving successor
or null. Old data for a removed target is still available through scene.get,
including at zero presence. That is animation data, not permission for a dangling
reference in the committed current model.

A pointer handler must inspect **both previous and current pointer data**, resolve
their respective owner/target transitions and select the corresponding endpoint
positions. Guard null before scene.get. Using only the current target can jump
or lose the disappearing link geometry. Core provides the data; it does not
choose arrow morphing, crossfade, null-marker geometry, routing or opacity rules.
Those rendering defaults still need design and visual acceptance. Intermediate
geometry is not a third list snapshot; overlaps/crossings may occur in a frame.

Projection is pure in immutable State/captured policy. Positions may be in State
or computed deterministically from chain/order/view state. Changing captured
layout settings requires a new projector. Draw-time viewport/DPR transformation
is the same for nodes/pointers and must not be read as mutable input to the
endpoint projection cache. No next/parent/relation field is added to Frame/Scene.

Canvas redraws a frame. Retained SVG/DOM backends reconcile actually drawn IDs
each frame because seek can skip insert/delete callbacks. A pointer can still be
dispatched with zero presence. Draw order uses current zIndex; scene.get does not
depend on which handler drew first. No guaranteed per-node lifecycle is implied.

## Relationship with /graph and /tree

A complete list snapshot maps to a directed graph: nodes retain domain IDs;
each non-null next slot yields an edge with its own explicit ID derived from the
slot, not from its two endpoints. Null slots/head markers remain metadata or
decorations. A linked list is more constrained than a graph; arbitrary graph
data must not bypass the complete-chain validation.

The /graph sketch fixes topology per trace. Inserting/removing nodes or retargeting
edges does not become supported by that trace merely because one list snapshot
can be mapped to graph data. Lists use generic playback/scene directly. Sharing
future geometry/internal code need not create public inheritance/dependencies.
A nullable list pointer is not automatically accepted by a graph edge handler.

A complete acyclic list also maps to a degenerate ordered tree rooted at head,
with at most one child per node; empty maps to an empty tree. Null is not a child.
The next-slot edge IDs can be supplied as explicit tree link IDs. A working arena
with detached nodes, shared targets or temporary cycles is not such a tree.
Tree order/root rules and graph's initial scope remain unchanged; no conversion
or adapter is implemented by this review.

Lists, graphs and trees can coexist in one composite generic registry with unique
scene IDs. Data sharing does not require extending ArrayEvent, future graph/tree
events, Player statuses or existing scene registry requirements. Exact entry names,
adapters and optional stock rendering boundaries are separate module API decisions.
Keep the data model headless and DOM-free.

## Playback, ownership and check

Application-owned `Step<ListState<T>, ListEvent>` and `Frame<ListState<T>, ListEvent>`
work with createStepEmitter, createPlayer/createTimeline and Player stepSource/
isTerminal. Even an empty list emits an initial state/step; existing playback
requirements for nonempty sources remain. State carries the chain, pointers,
marks and result; render must not reconstruct it from event history. Roles need an explicit open extension or typed
payload rather than a global closed vocabulary for all algorithms.

Pause, Next, final hold, Restart and dispose retain current contracts. Terminal
work runs before terminal yield; cleanup belongs in finally. Previous restores
buffered snapshots, not inverse pointer assignments; eviction uses sequence
positions, not node IDs or step.index. Restart restores the chosen initial chain
without old marks/results. State-only asyncSource/Worker still complete at EOF
with undefined event, so persistent display cannot require Frame.event.

Module-owned nodes/metadata/collections are copied/frozen; unchanged parts may be
shared. Payload T remains application-owned immutable/cloneable data. Do not
mutate or transfer-detach storage retained by playback/history. Worker shared-memory
restrictions remain unchanged. Source dispose closes the owned iterator/session;
it is not C-style node deallocation or a promise of immediate garbage collection.
Lookup, layout and immutable snapshot cost are separate from O(1) pointer rewiring;
no O(1) snapshot/draw guarantee follows. Player's budget cannot interrupt a single
expensive next/projection/render call.

The isolated check passed **37/37 runtime cases** and four strict TypeScript 6.0.3
configurations: NodeNext/Bundler × headless ES2022/Player DOM, with ten list-specific
negative type cases. Handwritten application snapshots/scenes check insertion,
deletion, null transitions, reversal, old/new target lookup, staging display,
rewind/seek/source closure and graph/tree composition against current public APIs.
No linked-list implementation, model validator, staging builder, renderer or
package declarations/stubs were added. This is core data-availability evidence,
not native arrow-animation validation, performance or a full future-module matrix.

Before implementation, select exact model/input/types, atomic trace methods,
validation/errors, ID allocation, staging boundaries, projection/null/routing
defaults, palette priorities and optional graph/tree adapters. Those are new-module
decisions, not identified reasons to change Step/Frame/Scene before 1.0.

[Architecture check record](checks/linked-list-contract-2026-11-16.json).
