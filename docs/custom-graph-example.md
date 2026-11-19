# BFS: two renderers with one Player

[Detailed example](../examples/graph.html) · [Stock renderer example](../examples/graph-player.html) · [Comparison](bfs-graph-comparison.md) · [Graph API](graph-api.md)

**Updated for released 1.1.0, 2026-11-17.** Both pages share /graph snapshots,
BFS state and the standard /player. The detailed page preserves its custom /scene
renderer; the other uses /canvas/graph. Published npm 1.0.0 does not contain the
two graph entries; they are published in 1.1.0. BFS itself remains application code.

## 1. Keep the algorithm in the application

[graph-algorithm.mjs](../examples/graph-algorithm.mjs) exports
`graphSteps(graph, start, target = null, options?)`. The optional options supply
a graph layout. [Shared presets](../examples/graph-presets.mjs) are independent
of either BFS or DFS implementation; [normalized positions](../examples/graph-layout.mjs)
are view policy. Custom graphs use the trace's deterministic circle fallback.

`createGraphTrace` captures/validates topology, stable IDs and layout. This example
accepts undirected, unweighted graphs, including loops and parallel edges. It
rejects directed or weighted inputs explicitly: the more general graph module
does not make this BFS algorithm a weighted or directed path finder.

The adjacency list, queue head index, discovered set, parents, exact discovery
edge IDs, distances, path and counters stay in the generator. Nodes are marked
on enqueue, so cycles/parallel edges never enqueue twice. Neighbor order follows
the input edge order. The reachable component is completed before restoring a
path; target=start still performs the full traversal. No target and unreachable
targets do not generate path events.

Each emitted application state keeps the original teaching metadata plus:

- `visual`: the immutable GraphSnapshot owned by the trace;
- `event`: the immutable BFS event for state-only recording playback.

`createStepEmitter` still numbers and wraps application BFS events. The graph
trace is initialized internally and receives role patches for visual snapshots.
These two counters are separate concerns; BFS step indices remain exactly as
before. The first visible BFS step already marks the start as queued.

Stock roles `active`, `queued`, `visited` and open roles `tree`, `path` are stored
in snapshots. During reconstruction, the path role grows from target to start.
At `finished`, `trace.done({ result: { nodeIds, edgeIds } })` records the final
start-to-target answer using the actual parent edge IDs, including parallel edges.
No target uses done without a selection; an unreachable target has an explicit
empty selection. Renderer memory and final events are not needed to retain green.

## 2. Choose the drawing independently of Player

[graph-page.mjs](../examples/graph-page.mjs) owns the shared DOM controls/panels
and Player session. Each thin entry point supplies a drawing factory with
height(width, state) and render(context, frame, size). This is private example
code, not a new library abstraction. Each graph preset gets a fresh drawing
instance when loading a session; resize repaints the retained frame.

[graph-demo.mjs](../examples/graph-demo.mjs) supplies the detailed
[graph-view.mjs](../examples/graph-view.mjs), which wraps the original
[graph-scene.mjs](../examples/graph-scene.mjs). Its vertex/connection/queueEntry
objects retain animated queue cells, per-node distances, start/target rings,
processed checks and the examination dot. The wrapper restores the BFS event
for the scene from immutable state.event, because recorded history has no
Frame.event. The renderer preserves the viewport's caller-owned DPR transform.

[graph-player-demo.mjs](../examples/graph-player-demo.mjs) supplies the stock
[graph-player-view.mjs](../examples/graph-player-view.mjs):

```js
const renderer = createGraphRenderer({
    theme: 'dark', roleColors: { tree: '#a78bfa', path: '#34d399' }
});
renderer.render(context, {
    ...frame,
    previous: frame.previous.visual,
    current: frame.current.visual
}, size);
```

The stock renderer fits normalized graph positions and owns context transforms/
restoration. Queue, distances, operation descriptions, counters and result remain
in HTML in both pages. Stock drawing also shows nodeCaptions distance text beside
vertices when a collision-free location is available. The detailed view retains
its custom queue/markers/distance drawing. Neither drawing runs a timer or controls source consumption.

The BFS generator includes nodeCaptions in the same mark as roles, formatted
from the distance Map and current phase before capture. traversal-done changes
unknown distances from dash to infinity; done preserves the caption table.
[Caption contract and implementation](graph-node-captions.md) covers clear/empty,
legacy snapshots, placement suppression and native pixel checks.

## 3. Connect the standard Player

[graph-session.mjs](../examples/graph-session.mjs) reuses `timing` and graph size
`limits` from player-settings.mjs. It prepares/validates inputs before retiring
the current visible player. Both pages are mounted by graph-page.mjs; controls are provided by `new Player`;
there is no custom RAF/tick/controller loop in either BFS page.

History materializes immutable states once. Descriptions use state.event because
history Frame.event is undefined. Restart resets this recording. Generator mode
uses stepSource/isTerminal, a 32-position rewind window and a 16-request frame
budget. Preparation probes/closes only one initial step, never the full traversal;
starting and restarting use a fresh lazy source. The BFS generator has no external
effects, so this validation probe cannot perform algorithm-side I/O.

Apply captures graph, start, target and layout. Restart and mode changes reuse
applied values, not draft selectors. Speed survives Apply and mode changes. Page
hide disposes the player/viewport; bfcache restoration recreates both. Standard
Player handles keyboard controls, reduced motion, Pause/Next/Previous and hold.

The default run still has 57 steps (indices 0–56) and the common 650 ms step /
1000 ms final hold policy. One Previous from the end of a recording can first
rewind the terminal hold; another reaches the prior BFS step. Stream positions
are ordinal: at the default end the retained window is 25–56, not the full run.

## 4. Keep Player independent of graph decoration

The detailed example demonstrates /scene extension; the stock example demonstrates
ready-made graph drawing. Both keep the same algorithm and playback behavior, so
visual detail can be compared without changing BFS or implementing a new panel.
Player's existing render callback accepts either view; its viewport can also host
a caller-owned container with Canvas/SVG/HTML. Algorithm-specific queue movement,
node annotations and edge effects remain drawing concerns. No Player or renderer
API was expanded for these pages. The original GIF still depicts detailed drawing
with the earlier custom controls; both current pages use standard Player.

## Verification and costs

[Migration regressions](../test/bfs-graph-migration.test.mjs) compare 179 baseline runs /
6756 semantic steps and check stock result projection/color, both Player modes,
bounded replay, source closure, Restart, input limits and transitive import maps.
[Two-view regressions](../test/bfs-two-examples.test.mjs) also exercise the actual
drawing wrappers through both Player modes, green result, backward replay, Restart
and dispose, including state-only history examination events. Native checks in
the [two-example report](checks/bfs-two-examples-2026-11-17.json) cover both pages.
Existing independent Floyd–Warshall coverage still exercises all 1099 simple
graphs on 1–5 vertices and 32110 start/optional-target combinations.

BFS traversal remains O(V + E). Annotation/snapshot construction is additional
work and scans nodes/edges per event here; no speed/allocation improvement is
claimed. Graph/layout are shared, retained BFS metadata/marks cost O(V) per
snapshot. Full history retains all snapshots; streaming bounds retained source
positions, without eliminating snapshot work. Older benchmark reports keep their
original code/workload scope. See the [comparison](bfs-graph-comparison.md) for
code counts, visual tradeoffs and native verification.
