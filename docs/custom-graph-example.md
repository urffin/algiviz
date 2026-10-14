# Build your own algorithm and object types

The graph example combines createStepEmitter (since 0.6.0) with existing APIs: createPlayer/createTimeline
through the shared demo controller, createSceneProjector and createSceneRenderer.
No registration or graph-specific code is needed in the library.

## 1. Own the algorithm and immutable state

[graph-algorithm.mjs](../examples/graph-algorithm.mjs) exports graphSteps(graph, start).
It uses the optional createStepEmitter helper from /playback for indexing and step wrappers; it imports no renderer. This helper requires AlgiViz 0.6.0 or later. The input is an undirected graph:
nodes have unique string IDs and optional labels; edges have unique IDs and
from/to node IDs. Self-loops and parallel edges are valid.

The generator creates one emitter per traversal. Its callback builds the state snapshot; emitting an event returns a frozen step with index, state and event. It copies and validates
input on first consumption, freezes the topology once, and creates fresh snapshots
for the queue, completed nodes, discovery edges and distances. A source must emit
its final event; here that is kind: "finished".

BFS marks a node when it is enqueued. Cycles therefore do not enqueue it twice.
Only the chosen connected component is traversed. Distances are shortest unweighted
path lengths; null means not yet discovered, or unreachable at completion.

Changing the algorithm requires only a new source with this contract and a renderer
that understands its state/events. Generic playback does not freeze application data.

## 2. Project state into visual objects

[graph-scene.mjs](../examples/graph-scene.mjs) defines GraphObjects using a JSDoc
type map: vertex, connection and queueEntry. Object IDs are prefixed by visual role:
the same domain vertex can appear both on the graph and in the queue.

graphScene(state) decides what exists and which objects are active. It contains no
Canvas drawing calls, animation progress or viewport dimensions. Connections refer
to the scene IDs of their endpoints.

createSceneProjector(graphScene) reuses at most two endpoint scenes. Reuse the
projector across frames. Treat the returned scenes as immutable; do not mutate
retained state to invalidate the cache.

## 3. Supply the visualizations

createSceneRenderer receives a handler for each type:
- vertex chooses its fill from traversal status and displays its distance;
- connection uses scene.get to find endpoint objects and draws the examined edge;
- queueEntry interpolates its queue position and uses presence to enter/exit.

Layout is calculated using current Canvas dimensions. It is application policy,
not graph state. The examined-edge dot follows an actual edge; dequeueing does not
pretend that BFS walks directly between successive queue entries.

The renderer saves/restores Canvas state and clears the full frame. For SVG or DOM,
reconcile against the frame instead, including stale elements after a seek.

## 4. Connect playback

[graph-demo.mjs](../examples/graph-demo.mjs) supplies a source factory, isTerminal
and render callback to the existing demo-player.mjs. The factory captures the selected
start; restart and mode changes create a fresh generator for that input. Controls,
timing, seeking, cancellation and reduced motion are shared with the other examples.

## What this example tells us about the API

The existing scene/playback contract expresses the graph, queue and traversal. The optional createStepEmitter helper removes repeated numbering and step-wrapper construction from this example and merge sort.
The recurring application work is immutable snapshot construction, source factories,
scene ID conventions and contextual status text. Those are candidates for further
reuse, but no generic graph DSL or automatic deep-cloning policy is introduced.

Full snapshots copy traversal state. Generator playback avoids retaining all steps,
but does not eliminate snapshot allocation, graph storage or algorithm work.
The example uses a small fixed graph; it is not a large-graph performance benchmark.
