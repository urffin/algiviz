# List API: /list

[Русский](ru/list-api.md) · [Architecture sketch](linked-list-contract.md) · [Current API](current-api.md) · [Compatibility](api-compatibility.md) · [Contract verification](checks/list-public-api-2026-11-20.json)

**Available since 1.4.0.** The independent headless ESM entry `/list` exports
`createListTrace`, `listScene` and the 25 types below. Canvas rendering uses
[/canvas/list](list-canvas-api.md). [Implementation checks](checks/list-implementation-2026-11-20.json).

## Scope and model

The first model is one finite acyclic singly linked chain, including empty and
singleton lists. ListInput.headId and each node's nextId are the only topology
authority. Following next from head reaches every node exactly once and ends at
null. The head has zero incoming next pointers; every other node has one.
Missing targets, cycles/self-links, shared successors and unreachable nodes are
invalid. Empty means headId:null and nodes:[]; a nonempty list requires an
existing head. Storage order in nodes is preserved but does not define chain
order. Tail/length are derived, with no second writable edge or order table.

Each node has a required own value, including present undefined when permitted
by Value. Payloads are opaque: null, false, empty text, NaN, objects and typed
arrays have no implicit sentinel meaning. The application owns payload
immutability and structured-clone compatibility. No coercion, deep clone,
deep freeze, equality-by-value or algorithm runs inside the module.

The node count ceiling is 1,000,000, checked before copying elements. Layout,
node-role/caption patches and node selections cannot exceed the applicable
node count; pointer collections cannot exceed node count + 1. These are
validation ceilings, not a memory/frame-time/practical drawing guarantee.
Capture, validation and projection inspect whole current collections; retirement
processing may additionally depend on lifetime ID history. No O(1) edit/snapshot
guarantee is made. Bounded Player reads cannot interrupt a single expensive call.
Retired ID storage grows with distinct committed IDs.

Circular/doubly linked lists, sentinels, shared arenas, allocators, local variable
cursors, automatic list/graph/tree conversion and unrestricted pointer assignments
are outside this API. They are not future cases silently promised by its closed
unions. Application-owned custom State/Scene remains available.

## Public declarations

The declarations below describe @grundyjs/algiviz/list.
They are also checked against the installed local archive.

```ts
import type { Step, Frame } from "@grundyjs/algiviz/playback";
import type { Scene } from "@grundyjs/algiviz/scene";

export interface ListNode<Value = unknown> {
    readonly id: string;
    readonly value: Value;
    readonly nextId: string | null;
}
export interface ListInput<Value = unknown> {
    readonly headId: string | null;
    readonly nodes: readonly ListNode<Value>[];
}
export interface ListPosition {
    readonly nodeId: string;
    readonly x: number;
    readonly y: number;
}
export type ListPointerId = Readonly<
    | { kind: "head" }
    | { kind: "next"; nodeId: string }
>;
export interface ListAnnotation {
    readonly id: string;
    readonly role: string;
}
export interface ListMark {
    readonly id: string;
    readonly role: string | null;
}
export interface ListPointerAnnotation {
    readonly id: ListPointerId;
    readonly role: string;
}
export interface ListPointerMark {
    readonly id: ListPointerId;
    readonly role: string | null;
}
export interface ListNodeCaption {
    readonly id: string;
    readonly text: string;
}
export interface ListNodeCaptionPatch {
    readonly id: string;
    readonly text: string | null;
}
export interface ListMarkUpdate {
    readonly nodes?: readonly ListMark[] | undefined;
    readonly pointers?: readonly ListPointerMark[] | undefined;
    readonly nodeCaptions?: readonly ListNodeCaptionPatch[] | undefined;
}
export interface ListResultInput {
    readonly nodeIds?: readonly string[] | undefined;
    readonly pointerIds?: readonly ListPointerId[] | undefined;
}
export interface ListResult {
    readonly nodeIds: readonly string[];
    readonly pointerIds: readonly ListPointerId[];
}
export interface ListDoneOptions {
    readonly result?: ListResultInput | undefined;
}
export interface ListTraceOptions {
    readonly layout: readonly ListPosition[];
    readonly nodeCaptions?: readonly ListNodeCaption[] | undefined;
}
export interface ListEdit<Value = unknown> {
    readonly headId?: string | null | undefined;
    readonly nodes?: readonly ListNode<Value>[] | undefined;
    readonly layout?: readonly ListPosition[] | undefined;
    readonly marks?: ListMarkUpdate | undefined;
}
export interface ListSnapshot<Value = unknown> {
    readonly list: ListInput<Value>;
    readonly layout: readonly ListPosition[];
    readonly nodeMarks: readonly ListAnnotation[];
    readonly pointerMarks: readonly ListPointerAnnotation[];
    readonly nodeCaptions: readonly ListNodeCaption[];
    readonly result: ListResult | null;
}
export type ListEvent = Readonly<
    | { type: "start" }
    | { type: "edit" }
    | { type: "mark"; nodes: readonly ListMark[];
        pointers: readonly ListPointerMark[];
        nodeCaptions: readonly ListNodeCaptionPatch[] }
    | { type: "layout" }
    | { type: "done" }
>;
export type ListStep<Value = unknown> = Step<ListSnapshot<Value>, ListEvent>;
export type ListFrame<Value = unknown, Event = ListEvent> = Frame<ListSnapshot<Value>, Event>;
export interface ListTrace<Value = unknown> {
    readonly state: ListSnapshot<Value>;
    start(): ListStep<Value>;
    edit(update: ListEdit<Value>): ListStep<Value>;
    mark(update: ListMarkUpdate): ListStep<Value>;
    setLayout(layout: readonly ListPosition[]): ListStep<Value>;
    done(options?: ListDoneOptions): ListStep<Value>;
}
export interface ListSceneOptions {
    readonly namespace: string;
}
export interface ListNodeView<Value = unknown> {
    readonly node: ListNode<Value>;
    readonly position: ListPosition;
    readonly caption: string | null;
    readonly role: string | null;
    readonly result: boolean;
    readonly head: boolean;
    readonly tail: boolean;
}
export interface ListPointerView {
    readonly pointer: ListPointerId;
    readonly from: string | null;
    readonly to: string | null;
    readonly role: string | null;
    readonly result: boolean;
}
export type ListObjects<Value = unknown> = {
    listNode: ListNodeView<Value>;
    listPointer: ListPointerView;
};
export declare function createListTrace<Value = unknown>(
    list: ListInput<Value>, options: ListTraceOptions
): ListTrace<Value>;
export declare function listScene<Value = unknown>(
    state: ListSnapshot<Value>, options: ListSceneOptions
): Scene<ListObjects<Value>>;
```

The entry uses ES2022 declarations only and touches no DOM/Worker globals
or resources at import; Canvas remains a separate optional boundary.

## Node and pointer identities

Node IDs and namespaces are nonempty primitive strings, without trimming,
coercion or generation. Whitespace, separators and names such as __proto__ have
no special meaning. Retain a node ID across value, next, position, head/tail and
chain-order changes. Removing a node retires its ID for that trace, even after
rewind eviction. Reintroducing it in a later edit is RangeError. An ID present
before and after one atomic edit is retained. Failed calls reserve/retire no ID.
A fresh trace on Restart can use the original IDs; old snapshots remain valid.

A pointer ID is structural data, compared by kind and, for next, owner nodeId:

- { kind:"head" } identifies the single permanent head slot, including empty lists.
- { kind:"next", nodeId:"A" } identifies A's next slot, including a null target.

Changing A.next from B to X retains that pointer's ID. Its target, list rank and
object-reference identity never define its identity. Deleting A removes its
next slot; node retirement prevents unrelated later reuse. There is no separate
pointer ID allocator, user-writable pointer table or retirement set for head.
Node IDs and pointer IDs belong to separate domains. No targetId is stored in
ListPointerId; its target is derived from headId/nextId.

## Atomic operations and lifecycle

Construction captures the list, complete logical layout and optional initial
captions, with empty marks and result:null. It emits no step; state is readable
immediately. start() is required exactly once, emits index 0 and the same initial
state. Each successful later command, including no-ops, emits the next index
and a new outer snapshot. Trace, owned records/arrays, pointers, steps and events
are frozen; unchanged owned structures may be shared. Value references are retained.
Initial nodeCaptions default to empty; they require unique existing IDs and
string text. Duplicate IDs are RangeError. Initial roles are empty.

| Command | Contract |
| --- | --- |
| edit(update) | Supplied nodes replace the entire collection. Omitted/undefined headId, nodes and layout retain current values subject to pruning. Optional marks patch the final candidate atomically with topology/layout. This is not an upsert or a sequence of assignments. |
| mark(update) | Apply node roles, pointer roles and node-caption patches atomically to the current list. Missing/undefined collections are empty patches. An empty update emits a step. |
| setLayout(layout) | Replace complete current-node positions; topology and annotations stay unchanged. |
| done(options?) | Preserve list/layout/annotations, store a result or null and emit terminal done once. No later command is valid. |

Only the complete candidate must be valid. Insertion of X between A and B sets
A.next=X and X.next=B, adds X and its position in one edit. Deletion replaces the
predecessor target (or head), removes the node and adjusts topology together.
No cascade, predecessor repair, reverse or sorting algorithm is guessed. Clearing
all nodes requires headId:null and nodes:[] in one edit. Reversal supplies all
new nextId fields and the new head in one edit. Retargeting alone is valid only
when the resulting complete chain still satisfies every invariant.

Complete layout contains every candidate node exactly once, finite numeric x/y,
and no extra IDs. Omitted edit.layout prunes deleted nodes' positions and retains
survivors; every new node therefore requires supplied complete layout. Positions
are snapshot-owned and do not secretly change with Canvas size or viewport/DPR.
Stored layout, node marks and captions follow node storage order. Stored pointer
marks follow head then next slots in node storage order. Topology edits prune
removed nodes' marks/captions and owned next-slot marks; retained node/slot IDs
retain their annotations, even when a pointer changes target. Apply edit.marks
after this pruning, validating references against the final candidate. A patch
for a removed/absent entity is an error, not a silent discard.

Roles are open nonempty strings; null patch removes a role. Caption text is any
string, including empty; null removes it. Duplicates within each patch collection
are RangeError; the same node may have a role and caption patch in one command.
Events retain patch order; stored attributes use canonical entity order.

### Example: one insertion, one valid snapshot

This example uses @grundyjs/algiviz 1.4.0 or later. The nodes
array deliberately stores B before X: nextId, not array order, defines A→X→B.

```ts
import { createListTrace } from "@grundyjs/algiviz/list";

function* insertExample() {
    const list = createListTrace({
        headId: "A",
        nodes: [
            { id: "A", value: 7, nextId: "B" },
            { id: "B", value: 3, nextId: null },
        ],
    }, { layout: [{ nodeId: "A", x: 0, y: 0 }, { nodeId: "B", x: 2, y: 0 }] });
    yield list.start();
    yield list.edit({
        nodes: [
            { id: "A", value: 7, nextId: "X" },
            { id: "B", value: 3, nextId: null },
            { id: "X", value: 5, nextId: "B" },
        ],
        layout: [
            { nodeId: "A", x: 0, y: 0 },
            { nodeId: "B", x: 2, y: 0 },
            { nodeId: "X", x: 1, y: 0 },
        ],
        marks: { pointers: [{ id: { kind: "next", nodeId: "A" }, role: "changed" }] },
    });
    yield list.done({ result: {
        nodeIds: ["X"], pointerIds: [{ kind: "next", nodeId: "A" }],
    } });
}
```

## Result selections

Before done, result is null. done(), missing result or result:undefined stores
null. done({ result:{} }) stores { nodeIds:[], pointerIds:[] }; null result input
is invalid. Both selections contain unique existing IDs in caller order and
may be empty or omitted independently. Pointer duplicates use structural slot
equality, not object identity. Head and null next slots are valid selections.

Node selection sets only that ListNodeView.result; pointer selection sets only
that ListPointerView.result. It does not select endpoints or assert a path,
traversal, sortedness, a successful search or a non-null target. Marks/captions
remain unchanged. A role named result is still only a role. Scalar answers,
visited order with repeats and algorithm-specific outcome belong to an
application wrapper. No separate path field is required for this first scope.
Result flags persist in snapshots through final hold/rewind/seek; a new trace
starts without results. Green styling belongs to a later optional renderer.

## Capture, validation and errors

Module-owned inputs are Object/null-prototype records and dense arrays of own
data elements. Required fields must be own data properties. Recognized accessors
are rejected without invoking getters; inherited optional fields are ignored.
Optional undefined means omission; required nextId/headId cannot be undefined.
Unknown fields are ignored and are not topology authorities. Array length must
be a primitive integer in 0..2^32-1; a malformed length is TypeError. A recognized
collection over its domain ceiling is RangeError before element inspection.
Records capture recognized descriptors in declaration-field order; arrays capture
length and all own data elements before inspecting their records. Opaque value
is captured once by reference and never traversed.

| Invalid case | Error |
| --- | --- |
| Wrong record/array/scalar type, missing required own field, accessor/hole/inherited array element, empty/non-string ID/role/namespace, non-string caption, non-number coordinate, malformed pointer kind | TypeError |
| Unsupported nonempty pointer kind; duplicate/retired node ID; unknown head/next/slot owner; self-link/cycle/shared successor/unreachable node; invalid empty/head combination; duplicate/missing/extra position; nonfinite numeric coordinate; duplicate selection/patch; noncanonical snapshot order; exceeded collection ceiling | RangeError |
| Repeated start, command before start/after done, same-trace mutation during capture | Error |

For pointer IDs, empty/non-string/missing kind is TypeError; unknown nonempty kind
is RangeError. next requires a valid own nodeId. Extra fields on head do not
change its identity. Original Proxy trap exceptions, including falsy/non-Error
values, propagate unchanged. No ListError wrapper/code is added; diagnostic
messages/stacks are not stable identifiers. External Proxy side effects cannot
be rolled back.

Validation precedence:

1. Commands check busy, then lifecycle, before inspecting arguments. state reads
   during capture see the previous committed snapshot; another idle trace is independent.
2. Constructor: list envelope; head scalar; nodes length/density; node records in
   supplied order (id, opaque value, nextId, duplicate ID). Then empty/head membership,
   next membership/self-links in node order, incoming counts in node order and
   iterative reachability/cycle check from head. Then options, layout, initial captions.
3. edit: update envelope; optional head scalar; effective nodes and full topology
   as above; retired node IDs in candidate storage order; effective/complete layout;
   prune attributes; marks envelope, node patches, pointer patches, caption patches.
4. Layout: each supplied record's nodeId/x/y, membership, duplicate; then missing
   nodes in storage order. Patches: ID/value scalars, membership, duplicate. Pointer
   IDs check kind then next owner. done checks options/result envelope, node
   selections then pointer selections. A collection's density/ceiling checks precede
   its element checks. Missing lists act as empty inputs, not replacements.
5. listScene checks options/namespace, snapshot envelope, full list/topology,
   layout, nodeMarks, pointerMarks, nodeCaptions, result. Stored attribute/layout
   order must be canonical; result keeps caller order. It validates a standalone
   snapshot, not trace retirement history or the event/lifecycle that produced it.

All capture, validation, freezing and required allocation finishes before commit.
Failure preserves state object identity, next index, lifecycle and retired IDs;
busy is released in finally. A corrected retry emits the same next index.
Empty lists support start, edit({}), empty marks/layout and done. Head-slot
mark/result is valid even then; any node or next-slot reference is not.

## Scene and playback boundary

listScene accepts valid application/structured-cloned snapshots without a frozen
brand and without Event. It returns exactly the closed listNode/listPointer kinds.
For N nodes there are 2N+1 objects: head pointer, every next pointer (including
null), then nodes. Pointers have zIndex 0, nodes 1. Pointer order is head then
node storage order; node order is storage order. NodeView.head/tail are derived
from headId/nextId. ListPointerView.from/to are scene node IDs: head.from is null,
head.to resolves headId or null; next.from resolves owner and next.to resolves
its target or null. A null target is not a fake null node. The backend supplies
an external head anchor under its own rendering policy.

Scene IDs are JSON.stringify tuples: [namespace,"list","node",nodeId],
[namespace,"list","pointer","head"] and
[namespace,"list","pointer","next",ownerId]. These domains are separate from
graph/tree/grid IDs; independent lists/views need independent namespaces.
Projection copies/freezes owned view wrappers; node/position references are the
supplied immutable snapshot records, not deep clones. It neither mutates state
nor chooses routing, head-anchor/null-marker geometry, arrow crossfade, layout
or Canvas pixels. The separate [/canvas/list](list-canvas-api.md) entry implements these drawing decisions using both endpoint targets and the recorded result flags.

Existing Step/Frame, createSceneProjector/createSceneRenderer and Player
stepSource/isTerminal suffice. Terminal detection can use step.event.type ===
"done"; asyncSource/Worker remain state-only/EOF with possibly undefined event.
Persistent marks/results never depend on remembered event history. Previous/seek
restore retained snapshots, not inverse assignments or trace retirement history.
Pause/Next/Restart/dispose and source ownership keep their current contracts;
Restart constructs a new trace, dispose closes the owned iterator/session, not
machine memory nodes. No change to existing errors, phases, registries or entry
unions is required. ListEvent.type, ListPointerId.kind and ListObjects keys are
closed after publication; roles and application-owned State are extension points.

## Intermediate pointer assignments: explicit application boundary

A trace owns only complete valid lists. There is no setNext/allocate/free/stage
method, invalid ListSnapshot phase or automatic repair. X.next=B while X is
detached and A still points to B is a valid teaching working state but an invalid
ListInput containing all three nodes. A.next=C while B remains allocated but
unreachable is likewise invalid. Temporary cycles, dangling/freed pointers and
local cursor aliases require explicit application data.

For microsteps, use an application wrapper containing a valid ListSnapshot plus
its working arena, or a fully application-owned arena. Emit generic Step/Frame
and custom Scene objects for that arena; do not send it to listScene or the
stock renderer as a valid list. Emit the next ListSnapshot only when the
complete candidate is valid. A Step has no transaction spanning multiple yields;
backward playback restores each recorded working view. Use separate namespaces
for arena versus committed-list objects unless the application deliberately
owns compatible identity/kind semantics across both views. SceneFrame.get cannot
resolve a freed target absent from both endpoints; keep explicit tombstones or
custom unresolved-reference data when that lesson needs it.

This boundary preserves complete-chain validation and allows detailed pointer
lessons with today's generic API. A future staging helper would need a separate
contract/compatibility review; it is not promised as a mode of this closed model.

## Implementation verification and remaining Canvas boundary

[Implementation report](checks/list-implementation-2026-11-20.json) records permanent
model/scene regressions, Player history/stepSource, rewind/Restart/cleanup,
installed consumers on supported TypeScript versions and static/lazy bundle boundaries.
This is headless and a modeled DOM host, not native browser verification.

[Contract selection](checks/list-public-api-2026-11-20.json) and the earlier
[37-case architecture check](checks/linked-list-contract-2026-11-16.json) retain
their original scope. Opaque values remain application-owned; Worker/transfer
rules are not expanded. The headless implementation covers complete snapshots and keeps intermediate pointer assignments in application state.

The [/canvas/list renderer](list-canvas-api.md) provides explicit layout, value and next compartments, head and null markers, arrow interpolation, captions and independent result coloring.
