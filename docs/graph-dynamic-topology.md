# Dynamic topology in /graph

[Русский](ru/graph-dynamic-topology.md) · [Graph API](graph-api.md) · [Compatibility](api-compatibility.md) · [Edge contraction](examples.md#edge-contraction)

Available since 1.5.0. A single `edit` records a complete,
valid graph after a topology change.

## Compatibility

`createDynamicGraphTrace` reuses `GraphInput`, `GraphTraceOptions` and
`GraphSnapshot`, with a separate step event type that includes
`{ type: "edit" }`. The existing `createGraphTrace` keeps its fixed topology
and closed `GraphEvent`. The dynamic trace uses the existing `Step`, `Frame`
and `graphScene`.

## Public API

`@grundyjs/algiviz/graph` exports the
`createDynamicGraphTrace` factory and four types. The node and edge data types
are inferred independently from the initial graph. For an empty graph, callers
can supply explicit type arguments for records they will add later.

```ts
import type {
    GraphDoneOptions, GraphEdge, GraphEvent, GraphInput, GraphMarkUpdate,
    GraphNode, GraphPosition, GraphSnapshot, GraphTraceOptions,
} from "@grundyjs/algiviz/graph";
import type { Step } from "@grundyjs/algiviz/playback";

export interface DynamicGraphEdit<NodeData = unknown, EdgeData = unknown> {
    readonly nodes?: readonly GraphNode<NodeData>[] | undefined;
    readonly edges?: readonly GraphEdge<EdgeData>[] | undefined;
    readonly layout?: readonly GraphPosition[] | undefined;
    readonly marks?: GraphMarkUpdate | undefined;
}

export type DynamicGraphEvent = GraphEvent | Readonly<{ type: "edit" }>;

export type DynamicGraphStep<NodeData = unknown, EdgeData = unknown> =
    Step<GraphSnapshot<NodeData, EdgeData>, DynamicGraphEvent>;

export interface DynamicGraphTrace<NodeData = unknown, EdgeData = unknown> {
    readonly state: GraphSnapshot<NodeData, EdgeData>;
    start(): DynamicGraphStep<NodeData, EdgeData>;
    edit(update: DynamicGraphEdit<NodeData, EdgeData>): DynamicGraphStep<NodeData, EdgeData>;
    mark(update: GraphMarkUpdate): DynamicGraphStep<NodeData, EdgeData>;
    setLayout(layout: readonly GraphPosition[]): DynamicGraphStep<NodeData, EdgeData>;
    done(options?: GraphDoneOptions): DynamicGraphStep<NodeData, EdgeData>;
}

export declare function createDynamicGraphTrace<N = unknown, E = unknown>(
    graph: GraphInput<N, E>,
    options?: GraphTraceOptions,
): DynamicGraphTrace<N, E>;
```

The `edit` argument is required. An empty update is written as `edit({})`.
All commands return `DynamicGraphStep`. A successful edit emits only
`{ type: "edit" }`. The other commands use their existing event shapes,
including the patch arrays on `mark`. The closed `DynamicGraphEvent` set
is `start | mark | layout | edit | done`.

A `GraphStep` can be read as a `DynamicGraphStep` with the same data types.
TypeScript rejects assignment of a `DynamicGraphStep` to a `GraphStep`.
A dynamic event handler can handle `edit` separately and forward the remaining
events to a `GraphEvent` handler. Existing exhaustive handlers retain four cases.
Use `GraphFrame<NodeData, EdgeData, DynamicGraphEvent>` for event-bearing
frames. The default `GraphFrame` event parameter remains `GraphEvent`.

## Player and scene integration

`graphScene` accepts `GraphSnapshot` from either trace. To animate, pass the
whole frame through `createSceneProjector` and `createSceneFrame`, then draw
the matched objects. Projection and matching are independent of the event type.

A streaming Player uses `stepSource` to read event-bearing steps.
Its `isTerminal` predicate ends the stream only on `done`. A recorded
Player uses `history` to read an array of snapshots and receives
`frame.event` as `undefined`. Both examples below pass snapshots to `graphScene`.

```ts
import { createDynamicGraphTrace, graphScene } from "@grundyjs/algiviz/graph";
import { Player } from "@grundyjs/algiviz/player";

function* steps() {
    const trace = createDynamicGraphTrace({
        nodes: [{ id: "A" }, { id: "B" }],
        edges: [{ id: "e", from: "A", to: "B", directed: true }],
    });
    yield trace.start();
    yield trace.edit({
        nodes: [{ id: "A" }, { id: "C" }],
        edges: [{ id: "e", from: "A", to: "C", directed: true }],
        layout: [{ nodeId: "A", x: 0, y: 0 }, { nodeId: "C", x: 1, y: 0 }],
        marks: { edges: [{ id: "e", role: "active" }] },
    });
    yield trace.done({ result: { nodeIds: ["C"], edgeIds: ["e"] } });
}

function mountStream(host: HTMLElement) {
    return new Player(host, {
        stepSource: steps,
        isTerminal: step => step.event.type === "done",
        rewindCapacity: 8,
        render(frame) {
            graphScene(frame.previous, { namespace: "demo" });
            graphScene(frame.current, { namespace: "demo" });
        },
    });
}

function mountRecording(host: HTMLElement) {
    return new Player(host, {
        history: () => Array.from(steps(), step => step.state),
        stepDurationMs: 200,
        render(frame) {
            graphScene(frame.previous, { namespace: "demo" });
            graphScene(frame.current, { namespace: "demo" });
        },
    });
}
```

The declarations and example were checked under TypeScript 6.0.3 with
`strict` and `exactOptionalPropertyTypes` in NodeNext and Bundler. The
headless check uses ES2022, and the Player check adds DOM. Hand-built
`start → edit → done` steps also ran on the current Player in both modes,
including Previous, replay without a source read, Restart and disposal.

## Atomic edit

An edit accepts optional `nodes`, `edges`, `layout` and `marks` fields.
A supplied node or edge array replaces that collection. Omission or
`undefined` preserves it, and `[]` clears it. Records in a supplied collection
are complete. For example, retaining an edge's weight and label requires
including them along with its new endpoints. The supplied collection order
becomes the snapshot order.

| Action | Final graph requirement |
| --- | --- |
| Add a node | Include it with a new ID in `nodes` and supply a complete layout in the same edit. |
| Add an edge | Include it with a new ID in `edges`. Both endpoints must exist in the final node collection, including nodes added in this edit. |
| Remove a node | Omit it from `nodes`. Explicitly remove or redirect every incident edge in the same edit. A dangling endpoint rejects the entire edit. |
| Remove an edge | Omit it from `edges`. Its nodes remain. |
| Redirect an edge | Keep its ID and supply a new `from`, `to`, or both. The `directed` field has its usual meaning. |
| Clear the graph | Supply `nodes: []` and `edges: []` in one edit. |

Empty and disconnected graphs, cycles, loops, parallel edges and opposing
directed edges are valid. Existing rules for finite weights, direction, labels
and application `data` apply. Validation checks the final graph. A node
replacement and an incident edge redirect can therefore share one step.

Omitting `layout` retains positions for surviving nodes. Adding a node
requires a complete layout in the same edit, with one finite position per
final node and no extra IDs. The default initial layout remains available at
trace creation. Edit leaves positioning to the application.

Marks and captions for removed IDs disappear from the new snapshot. Retained
IDs keep their roles and captions, including the role of a redirected edge.
`marks` uses `GraphMarkUpdate` and targets the final graph after cleanup.
A patch may mark a new node in the same edit. A patch for a removed or unknown
ID is rejected. Layout, roles and captions follow their final collection order.

## Identity and lifecycle

IDs are application-supplied nonempty strings in independent node and edge
domains. The same text can identify a node and an edge. An ID present before
and after an edit identifies the same entity, including when its label,
position, order or endpoints change. A replacement entity gets a new ID.

A successfully removed ID is retired for the rest of that trace in its domain,
even when the old step falls out of the rewind window. A failed edit leaves
retirement unchanged and reserves no new IDs. Retirement storage depends on
the trace's removal history independently of the Player's rewind capacity.

`start()` is called once and records step 0. Every successful `edit`, including `edit({})`,
records exactly one subsequent step with a complete immutable snapshot
and an `edit` event. The event identifies the command. Playback reads the
snapshots. `mark`, `setLayout` and `done` use the current topology.
`result` remains `null` until `done`. The terminal command selects nodes
and edges independently by their current IDs and closes the trace. A result
can select a redirected edge. Selecting a removed edge is rejected.

## Validation and rollback

Edit checks in this order:

1. Reentrancy and lifecycle. A command before `start`, after `done`, or during
   capture of another command on this trace throws `Error`.
2. The edit record and known field descriptors, followed by the effective
   nodes and edges in `GraphInput` validation order, including duplicates and
   endpoint membership.
3. Retired IDs, first nodes and then edges, in final collection order.
4. The supplied or retained layout, then `marks.nodes`, `marks.edges` and
   `marks.nodeCaptions` under the existing `GraphMarkUpdate` rules.

Invalid shapes and types throw `TypeError`. Duplicate or retired IDs,
dangling endpoints, invalid layout coverage and unknown mark IDs throw
`RangeError`. Existing record and array capture rules, opaque `data`
ownership and preservation of original Proxy throws apply. Topology, positions
and marks commit together with the step. On failure, the state object, next
index, lifecycle and retired IDs all remain as they were. Reading `state`
during capture returns the previously committed snapshot.

## Frames and rewind

`graphScene` projects each snapshot independently. With a stable `namespace`,
new entities get `enter`, removed ones get `exit` and retained ones get `update`.
A redirected edge keeps one scene ID and the `update` phase. Resolve the old
route using `previous` and the new route using `current`, including entering
or exiting nodes at zero presence. Parallel-edge groups, `routeIndex` and
`routeCount` are computed for each snapshot. Lane indices can change when
edges enter, exit or change order.

For example, one edit can take a graph with nodes A and B and edges
`e: A → B`, `p: B—A` to nodes A and C and edges `e: A → C`, `q: C—A`.
The frame has `B/p` exiting, `C/q` entering and an updated `e` with old
endpoint B and new endpoint C. Each snapshot contains only its own topology.
The [Canvas contract](graph-dynamic-canvas.md) describes the
crossfade between attached routes.

History seeking and bounded source rewind read recorded snapshots. Seeking
before a removal restores the entity with its old marks and endpoints. Forward
replay restores the recorded result. Rewind leaves the trace's mutation state
intact and runs no edits. Stream Restart creates a new trace with the original
IDs available. Recorded-history Restart returns to the start of the history.

The transition was checked with two snapshots prepared independently through
the current API. `graphScene` and `createSceneFrame` preserved the edge ID,
both generations of endpoints and the lane indices. `createTimeline` and
`createRewindBuffer` restored recorded snapshots and the result without
rereading retained steps.

## Regression coverage

- Add a node and edge in one edit, explicitly remove incident edges with a
  node, redirect a retained edge and clear the graph.
- Identity across domains, retirement in both domains, retained marks on
  redirects and rejection of patches to removed entities.
- Rollback on late layout or mark errors, with the same state, next index and
  ID history. Check corrected retry, lifecycle precedence and Proxy throws.
- Scene phases, endpoint-specific resolution and parallel lanes, result
  restoration, history seeking, bounded rewind and Restart.
