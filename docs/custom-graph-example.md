# Build your own algorithm and object types

The graph example combines `createStepEmitter` (since 0.6.0) with the public
`/playback` and `/scene` APIs. Algorithms, topology, layout and drawing belong to
the example. No graph-specific API or built-in BFS is added to the package.

## 1. Own the algorithm and immutable state

[graph-algorithm.mjs](../examples/graph-algorithm.mjs) exports
`graphSteps(graph, start, target = null)`. Nodes have unique nonempty string IDs
and optional labels. Edges have unique IDs and `from`/`to` node IDs. The graph is
undirected and unweighted; self-loops and parallel edges remain valid. Neighbor
order follows the edge input order, without sorting inside BFS.

The generator validates and copies input on first consumption. It freezes the
topology once and builds independent frozen snapshots of the waiting queue,
processed vertices, discovery edges, distances, parents, path and counters.
The current vertex is outside the queue and is cleared when it is settled.
`createStepEmitter` numbers and wraps steps; it does not clone application data.

BFS marks a vertex when enqueuing it. A cycle or parallel edge therefore cannot
enqueue it twice. An array head index implements the queue without repeated
`shift()` calls. Only the component reachable from the start is traversed.

The optional target never stops the traversal early. `traversal-done` marks the
boundary between traversal and path restoration. For a reachable target, `path`
events follow parents from target to start; the `finished` state contains the
reversed, start-to-target path. No target or an unreachable target produces no
`path` events. Start equal to target produces a one-vertex path of zero edges,
after the entire reachable component has been processed.

`parents` records each vertex's parent and the exact discovery edge ID. This
distinguishes parallel edges when highlighting a path. Parents are assigned once.
Changing neighbor order can change the chosen shortest path, but not its length.
Distances are shortest lengths by edge count. `null` means undiscovered during
traversal and unreachable only after traversal completes.

The counters are explicit: `discoveredCount` includes the start,
`processedCount` counts fully examined vertices, `edgeChecks` counts inspected
adjacency entries including skips, and `maxQueueSize` excludes the current vertex.
A non-loop edge has two adjacency entries; a self-loop has one. Restoring a path
does not change traversal counters.

## 2. Project state into visual objects

[graph-scene.mjs](../examples/graph-scene.mjs) defines a JSDoc type map with
`vertex`, `connection` and `queueEntry`. Visual IDs include their role: a vertex
and its queue entry are distinct visual objects. Connections refer to their
endpoint scene IDs; path flags use the chosen parent edge IDs.

`graphScene(state)` contains no drawing calls, animation progress or viewport
dimensions. `createSceneProjector(graphScene)` retains at most two immutable
endpoint scenes. Reuse it across frames and do not mutate snapshots to invalidate
its cache. Reconstruction and reverse seeks restore the same vertex and edge IDs.

## 3. Supply the visualizations

`createSceneRenderer` receives three handlers:

- `vertex` shows discovery/queue/processing state, a distance, start/target marks
  and path membership;
- `connection` resolves endpoints with `scene.get`, highlights the examined,
  discovery or path edge, and animates examination along that edge;
- `queueEntry` uses a separate visual ID, interpolates queue positions and fades
  entering/exiting entries.

The graph stays fixed during a run. Presets have application-owned layouts;
custom graphs fall back to a circular layout. Parallel edges use separate curves.
On narrow screens the queue is below the graph and wraps; on wide screens it is
beside the graph. Space for a queue of up to V−1 waiting vertices (one for a
singleton graph) is reserved without consuming the generator to measure it.

The controller sets the Canvas bitmap size using devicePixelRatio and supplies
logical CSS width/height to the renderer. Drawing preserves that transform; its
layout must not use bitmap pixels as CSS geometry. Handlers save/restore Canvas
state. Retained SVG/DOM backends would instead reconcile the full frame and remove
stale objects even when a seek skips exit transitions.

## 4. Connect shared playback

[graph-demo.mjs](../examples/graph-demo.mjs) supplies a source factory,
`isTerminal` and render callback to the existing `demo-player.mjs`. The terminal
event remains `kind: "finished"`, including when there is no target or no path.
Controls, timing, speed, reduced motion, cancellation and seeking come from that
shared controller and `player-settings.mjs`.

Choose a graph, start and target, then press Apply. The factory captures those
applied inputs. Restart and mode changes create a fresh generator for the same
inputs, rather than reading unapplied fields. A rejected load leaves the previous
session usable. Full history retains snapshots and enables backward seeks;
generator playback consumes lazily and retains adjacent states, without first
collecting a complete traversal. Replacing or leaving a generator closes it.

The default preset uses vertices A–H and edges AB, AC, BD, BE, CE, CF, DG, EG, FG.
From A, processing order is A, B, C, D, E, F, G; H is unreachable. There are 18
adjacency inspections, maximum queue size 3, and one shortest path to G is
A → B → D → G. Other presets are a chain, a diamond with tied paths, and the
original disconnected graph used in the README GIF.

## Cost and verification

With adjacency lists, BFS and input copying take O(V + E) time and store
O(V + E) graph/adjacency data plus O(V) traversal data. Restoring one path takes
O(V). Snapshot construction copies O(V) data per event: the generator avoids
retaining history, but does not remove that allocation cost. Full history has an
O(V(V + E)) time/space upper bound for snapshot copying/retention, plus shared
topology. The small fixed demo is not a large-graph performance benchmark.

Tests compare distances and paths with independent Floyd–Warshall on all 1,099
simple graphs on 1–5 vertices and all 32,110 start/optional-target combinations.
Other checks cover loops, parallel discovery edges, immutable input and history,
counters, early disposal, history/generator frame equivalence, reverse seeks,
wrapped queues and logical Canvas geometry with a DPR-scaled bitmap.
