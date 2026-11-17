# Future /graph: contract sketch and core compatibility

[Русский](ru/graph-contract.md) · [Scene](scene.md) · [Playback](playback.md) · [Compatibility policy](api-compatibility.md)

**Follow-up, 2026-11-17:** the [public API contract](graph-api.md) now selects
trace/model types, marks/results, validation and the separate `/canvas/graph`
boundary against released 1.0.0. The headless `/graph` is now implemented locally,
unpublished; `/canvas/graph` is also implemented locally. This
2026-11-16 sketch and its evidence retain their historical scope; deferred
API decisions below are resolved by the follow-up where explicitly specified.

**Design review, 2026-11-16; no implementation or publication.** The current
candidate is a9b93f8. There is no /graph entry, graph trace, graph event type or
stock graph renderer exported by the package. Names and data outlines below
describe a future module, not declarations accepted by the current package.
Existing graph/DFS/tree demos remain application-owned examples.

## Conclusion and scope

The described graph module fits existing Step, Frame, Scene, scene dispatch and
Player contracts. It can be added as an independent capability without changing
the current eight entries or widening their closed unions. A future /graph
would itself add public API, normally a minor feature under U3; this review
does not add that ninth entry now or authorize its implementation.

There is no identified core-API blocker to 1.0 for this first scope. This is a
bounded architecture finding, not proof that every future graph editor/layout
feature is already designed or a replacement for implementation acceptance.

First scope:

- A fixed finite topology per trace: explicit nodes and edges with stable IDs.
  Disconnected components, an empty graph and an edgeless graph are valid.
- Distinct edge IDs support parallel edges and self-loops. Direction and optional
  finite weights are graph data, independent of playback. A missing direction
  means undirected; direction may be carried per edge. Negative/zero weights do
  not invalidate the model; each algorithm defines its own admissible weights.
- Immutable visual annotations and selected result nodes/edges, with explicit
  completion. BFS/DFS/Dijkstra, queues, stacks, distances and traversal order
  belong to the application. The module does not choose an algorithm or path.
- Projection of the graph into node/edge scene objects. Optional future stock
  drawing is separate from the headless model, like /array and /canvas today.

Interactive topology editing, a physics engine, automatic async layout, built-in
algorithms and distributed graph state are outside the first scope. Explicit
layout changes can be represented as ordinary immutable snapshots already.

## Model and ownership

The input vocabulary should follow the existing graph example: nodes with id/
label and edges with id/from/to, plus direction/weight as needed. Input order is
preserved; no implicit graph traversal or adjacency sort is part of playback.
The DFS demo's vertices/source/target format is a separate application model;
it need not change unless that demo chooses to adopt the future module.

Node and edge IDs are nonempty primitive strings, unique within their respective
sets. Labels and positions are not identities. Every edge endpoint refers to a
node in that snapshot. No edge ID is synthesized from an endpoint pair: parallel
edges need distinct identities even when all other data is equal.

The module owns copies of its structural records/annotation collections and
publishes immutable snapshots. Static topology may be shared across snapshots.
Application-owned payloads remain the application's immutability and Worker
cloneability responsibility; freezing a Map/Set object is not sufficient to make
its contents immutable. Prefer plain records and readonly arrays for owned data.

An illustrative state contains:

```text
graph: nodes[] + edges[]                  immutable topology
layout: node ID -> finite x/y            immutable endpoint positions
node/edge annotations: ID -> role/data   persistent visual state
result: node IDs + edge IDs, or none     explicit selected answer
```

This is a data outline, not final exported interfaces. Algorithm state such as
queue, stack, predecessor and distance can wrap or accompany the graph snapshot
in application State; it does not require new generic Frame fields. No-path or
not-found is an ordinary algorithm result in State, not a new Player phase/error.

Annotations and result membership belong to State, not only to the last Event.
That gives deterministic seek/rewind/repaint and retains a final path without
renderer memory, similar to array resultItemIds. No array sorted fields are reused.
Visual roles should have an explicitly open extension mechanism or typed
application payload, rather than a globally closed list of every algorithm's
possible state. Precise role/palette options belong to the module's API design.

Mutations/marks must validate before emitting or committing module-owned state.
Exact constructor/trace methods, readonly input/output types, validation order
and error classes still require a separate public-API contract. They are not
new promises imposed on current playback/scene APIs by this sketch.

## Steps, frames and controls

Use existing types directly:

```ts
// GraphState and GraphEvent here are application-owned types.
type GraphStep = Step<GraphState, GraphEvent>;
type GraphFrame = Frame<GraphState, GraphEvent>;
```

State may include graph plus algorithm annotations. Event is generic: the
existing BFS example uses kind: 'finished', while DFS uses type: 'done'. Both
work with an explicit terminal predicate. Future convenience names such as
createGraphTrace/graphScene may provide a smaller domain API, but their exact
export list and signatures are not selected here. They must not extend ArrayEvent.

Existing createStepEmitter, createPlayer/createTimeline, bounded rewind and
Player stepSource cover graph steps. Player receives a fresh factory and
isTerminal chosen for that event model; source closure, terminal timing,
Restart preparation and dispose stay exactly as specified today. Do final
algorithm work before a terminal yield, and cleanup in finally.

Previous and seeking read retained states; they do not run an algorithm backwards.
Restart creates a fresh trace and clears annotations/results. Stable IDs refer
to entities within one trace, not mutable objects shared across restarts.
Step index/timing rules remain existing playback rules; node IDs and edge IDs
have no relationship to step indices or rewind-window ordinal positions.

Async/Worker sources already carry arbitrary graph State through asyncSource.
That branch remains state-only with EOF completion; graph drawing must not
require a non-undefined Frame.event there. Store persistent annotations in State.
Async explicit steps/terminal predicates are a separate playback feature, not
an implicit requirement or new PlayerOptions branch added by /graph.

## Scene identity and geometry

Each graph becomes a Scene with two stable built-in kinds, conceptually
graphNode and graphEdge. Their exact exported type-map names are deferred.
Node/edge labels can be drawn by those handlers. App-owned decorations can use
an extended application registry; adding a new required built-in kind later
would break existing registry implementations under U3 and must be avoided.

Scene IDs must be globally unique inside the combined scene, even if a node and
an edge share domain ID A or several graphs reuse labels/IDs. A safe conceptual
encoding is JSON.stringify([namespace, 'node', nodeId]) and the analogous edge
key. It is injective for strings containing separators/quotes; exact encoding
need not be a public application integration API.

An edge's scene data stores **scene node references**, not guessed array
positions or coordinates. scene.get returns the referenced node transition,
including previous/current data and exiting objects. Typical layering is edges
below nodes and decorations above; no new zIndex or relation field is needed.

For a moving node, interpolate its endpoint positions using existing progress.
An edge uses the same interpolated node positions. A handler must resolve both
old and new edge endpoint data if its own model allows retargeting; using only
the current endpoint would be an implementation bug, not missing core data.
Self-loops require curved routing; parallel edges require deterministic lanes
tied to stable edge IDs/input order. This routing belongs to the graph renderer,
not scene matching or Frame. Geometric formulas/default layout remain undecided.

Every standalone snapshot must have valid endpoints. If topology editing is
added later, an edge and its node may exit together: scene.get still exposes
the old node transition for the exiting edge. Core enter/exit already supports
this. Dangling edges, changing an object's scene type under the same ID, or
reusing an ID for a different entity are graph/application identity errors.
Replacing an entity requires a fresh identity; seek can skip intermediate states.

Projection must be a pure function of immutable State. Do not read progress,
mutable canvas dimensions, algorithm globals or live DOM in createSceneProjector.
Represent layout endpoints in State or an immutable captured layout. A renderer
can map those coordinates to the current viewport consistently for both endpoints.
Changing captured namespace/layout policy requires a new projector. Existing
two-endpoint caching and caller-owned viewport/DPR handling remain unchanged.

## Fit against the current API

| Need | Existing mechanism | Core change required |
| --- | --- | --- |
| Nodes, directed/weighted/parallel edges, loops | Arbitrary State/data + distinct scene IDs | No |
| Queue/stack/distance/current/result | Application State and custom object registry | No |
| Graph-specific events | Generic E in Step/Frame and the terminal predicate | No |
| Moving nodes and attached edges | ObjectTransition endpoints, progress, scene.get | No |
| Deterministic seek, rewind and final answer | Immutable State + projector + current-frame annotations | No |
| Completion, hold, source closure, Restart/dispose | Generic headless players and Player stepSource | No |
| Canvas or SVG | Backend-independent handlers and caller-owned context | No |
| Future topology enter/exit | Existing missing endpoints and presence | No; outside initial module scope |
| Async graph state | Existing asyncSource/Worker contracts, event may be undefined | No |

## Evidence and remaining module decisions

The check uses **handwritten application state/scenes** and current public
functions, plus the existing BFS/DFS examples. It does not implement a graph
builder, layout, adapter or stock renderer. Isolated strict type probes check
graph State/Event inference and graphNode/graphEdge handlers without declaring
any new package module. Runtime probes exercise linking, IDs, layers, parallel
edges, loops, enter/exit, projection, seeking, terminal closure and the existing
example sources. This is a core-fit check, not new /graph runtime coverage,
visual routing verification or a new native-browser release result.

Before a future /graph implementation, select its exact exports, model/defaults,
trace/event extensibility, validation/error rules, color priorities and routing/
layout API. If the convenience stock renderer is included, its own optional
loading/declaration boundary must keep /graph headless and DOM-free, either via
a separate graph rendering entry or other explicitly selected separation.
The graph module must not add rendering imports to existing headless modules.

Those are decisions for the new capability, not discovered reasons to redesign
Step, Frame or Scene before 1.0. If new requirements later demand changing the
existing contracts, they require a new compatibility review rather than being
silently classified as a minor graph feature.

The isolated check passed **25/25 current-core runtime cases** and four strict
TypeScript 6.0.3 configurations: NodeNext/Bundler × headless ES2022/DOM. This is
not a new module's full compiler matrix or native-browser verification.

[Design verification record](checks/graph-contract-2026-11-16.json).
