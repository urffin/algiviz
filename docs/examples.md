# Example catalog

[README](../README.md) · [Русский](ru/examples.md)

## Browser examples

![BFS from A: custom graph vertices, edges and queue animated with AlgiViz](https://raw.githubusercontent.com/urffin/algiviz/master/docs/assets/bfs.gif)

*An application-owned BFS algorithm with custom objects. Exported with
[CanvasTake](https://github.com/urffin/canvas-take) —
[try an interactive sorting demo](https://grundyjs.ru/algorithms/insertion-sort/)
or explore the [BFS source](https://github.com/urffin/algiviz/blob/master/examples/graph-demo.mjs).*

Build the project, serve the repository root with a static HTTP server and open
one of these pages. Examples are application code in the repository and are not
included in the npm archive.

| Example | What it demonstrates |
| --- | --- |
| [How a frame is made](https://github.com/urffin/algiviz/blob/master/examples/visualization-pipeline.html) | AlgiViz visualizes its own generator → player → scene → renderer pipeline (Russian walkthrough) |
| [Sorting lab](https://github.com/urffin/algiviz/blob/master/examples/index.html) | Insertion and bubble sort using the array operations and renderer |
| [Merge sort](https://github.com/urffin/algiviz/blob/master/examples/merge.html) | Custom state and a two-row scene for the main array and buffer |
| [Quick sort partitions](https://github.com/urffin/algiviz/blob/master/examples/quick.html) | Lomuto and three-way partitioning with custom state and scene |
| [Heap sort](https://github.com/urffin/algiviz/blob/master/examples/heap.html) | Max-heap construction and extraction with synchronized tree and array identities |
| [Binary search](https://github.com/urffin/algiviz/blob/master/examples/binary-search.html) | First occurrence in sorted input, closed search intervals and lazy playback |
| [Graph BFS](https://github.com/urffin/algiviz/blob/master/examples/graph.html) | Queue, layers, shortest paths, unreachable targets and history/generator playback |
| [Graph DFS](https://github.com/urffin/algiviz/blob/master/examples/dfs.html) | Recursive call frames, backtracking, tree depth and paths; history/generator playback |
| [Maze](https://github.com/urffin/algiviz/blob/master/examples/maze.html) | Randomized DFS generation, BFS wave, DFS backtracking, cycles and unreachable exits; history/generator playback |
| [Tree traversal](https://github.com/urffin/algiviz/blob/master/examples/tree.html) | Custom nodes, edges and pointer with Canvas and retained SVG backends |

The minimal `visualization-pipeline.html` walkthrough uses its own start button and sequential highlighting; shared speeds and playback modes do not apply to it.

Most examples reuse [demo-player.mjs](https://github.com/urffin/algiviz/blob/master/examples/demo-player.mjs) and
[player-settings.mjs](https://github.com/urffin/algiviz/blob/master/examples/player-settings.mjs): 650 ms per step, 1,000 ms final
hold, speeds 0.25× through 32×, play/pause, restart and step controls.
History enables backward stepping and seeking; generator mode disables both.
Reduced motion disables interpolation, and hidden tabs pause playback.

All sorting examples accept up to **64 finite values with history** or **2,000 in
generator mode**. Enter values or generate an array by count with Random, Sorted or
Reverse order. These are demo limits, not library restrictions. Switching a large
array to history requires first loading an array within the history limit.
Dense charts hide labels; custom sorting examples preview the first 24 cells in
their text status.

## Merge sort

The [algorithm](https://github.com/urffin/algiviz/blob/master/examples/merge-algorithm.mjs) and
[renderer](https://github.com/urffin/algiviz/blob/master/examples/merge-scene.mjs) use `/playback` and `/scene`.
Equal values have letter suffixes to demonstrate stability. Cells use row/position
IDs because copy-back temporarily duplicates item identities. Left wins ties.
The algorithm uses O(n) auxiliary memory; full snapshot history has an
O(n² log n) space upper bound.

## Quick sort

Choose Lomuto or three-way partitioning while preserving loaded values.
Both algorithms and their scene belong to the example. Three-way recursion skips
the equal band: n ≥ 2 equal items take 2n scalar checks and zero swaps, versus
n(n−1)/2 checks with this Lomuto variant. Neither variant guarantees stability.
Worst-case algorithm time is quadratic; recursion can use O(n) stack space.
Full snapshot history has a separate O(n³) space upper bound.

## Heap sort

The [algorithm](https://github.com/urffin/algiviz/blob/master/examples/heap-algorithm.mjs) owns immutable states and events.
The [scene](https://github.com/urffin/algiviz/blob/master/examples/heap-scene.mjs) assigns separate tree/array visual IDs to each
element and uses the public scene projector with viewport-independent endpoints.
Tree positions stay fixed as the heap shrinks. At most 15 array cells wrap on narrow
screens; larger arrays use a dense row and hide unreadable labels.
Bottom-up construction is O(n), worst-case sorting O(n log n), and the iterative
in-place algorithm uses O(1) auxiliary space. This demo copies input and retains
O(n) adjacent snapshot data in generator mode; full history can use O(n² log n).
It is not stable: [2a, 2b, 1] becomes [1, 2b, 2a].

## Binary search

The [algorithm](https://github.com/urffin/algiviz/blob/master/examples/binary-search-algorithm.mjs) finds the first occurrence, including duplicates. Equal values save a candidate and continue searching left. Input must be sorted; invalid loads preserve the current session. Generate sorted arrays by count with the shared history/generator limits. The counter counts inspected middle elements.

The [scene](https://github.com/urffin/algiviz/blob/master/examples/binary-search-scene.mjs) uses stable index-based IDs and viewport-independent projection. Up to 32 cells wrap; larger arrays use a dense strip and suppress unreadable labels. Search takes O(log n) time and O(1) extra algorithm space. The demo validates and copies input in O(n), shares a frozen array across snapshots and stores O(n + log n) history data. The example is not part of the npm package and needs no new public export.

## Tree traversal

The example defines its own `node`, `edge` and `pointer` types. The pointer follows
tree edges through shared ancestors between visited nodes. The Renderer selector
switches between Canvas and SVG without restarting playback.
[tree-svg.mjs](https://github.com/urffin/algiviz/blob/master/examples/tree-svg.mjs) retains elements by ID, restores layer order
and removes stale elements even after seeking skips exit transitions.
No tree-specific algorithm or renderer is added to the package.

## Graph breadth-first search

Open [examples/graph.html](https://github.com/urffin/algiviz/blob/master/examples/graph.html), choose a graph, start and optional
target, then Apply. BFS marks on enqueue, completes the reachable component and
restores one shortest path by following parents. Try the isolated H, a zero-edge
path to the start, a chain or a diamond with equal-length paths. The original
disconnected graph shown in the README GIF remains a separate preset.

The scene shows a fixed graph, an animated queue, distances, parent/path edges and
explicit discovery/processing/neighbor-inspection counters. On narrow screens the
queue wraps below the graph. Canvas rendering uses logical coordinates and DPR.
Self-loops and parallel edges remain supported; neighbor order can change which
shortest path is chosen, but not its length.

Both playback modes use the same immutable generator. Restart and mode changes
replay the applied graph/start/target, not draft controls. Generator mode consumes
lazily without collecting history. Full history enables backward seeks and has an
O(V(V + E)) snapshot-space upper bound, separately from graph and algorithm data.

See [Building a custom graph example](https://github.com/urffin/algiviz/blob/master/docs/custom-graph-example.md) for the
algorithm, projection and renderer boundaries. This example uses the existing
public APIs and adds no graph-specific package exports.

## Graph depth-first search

Open [examples/dfs.html](https://github.com/urffin/algiviz/blob/master/examples/dfs.html) to compare DFS with BFS on the same
graph layouts. Choose a graph, start and optional target. Each explicit call frame
stores its next neighbor cursor; marking happens before entry. Returning pops the
finished call and resumes its parent. The stack contains the active branch only.

The default discovery order is A, B, D, G, E, C, F; return order is F, C, E, G, D, B, A.
The DFS tree path to F has 6 edges; BFS finds A → C → F with 2. DFS tree depth is not
a shortest distance. H is unreachable. Traversal finishes before reconstructing the
path. The example accepts simple undirected graphs; self-loops and parallel edges
are rejected. Neighbor order follows edge input order.

The fixed-capacity stack moves below the graph on narrow screens. Canvas uses
logical coordinates and DPR. Both modes share one immutable generator and the
[shared demo player](https://github.com/urffin/algiviz/blob/master/examples/demo-player.mjs); restart reuses applied inputs.
Generator playback is lazy, while history enables backward seeks. The traversal
uses O(V + E) time and O(V) auxiliary space; snapshot history has a separate
O(V(V + E)) upper bound. No graph API or built-in DFS is added to the package.


## Maze generation and pathfinding

Open [examples/maze.html](https://github.com/urffin/algiviz/blob/master/examples/maze.html). Choose seeded generation, then BFS or DFS on the same dimensions and seed; Apply loads that stage. Coordinates are one-based column,row. Restart and mode changes replay applied inputs, without reading draft controls. Generation always starts at the top-left and finishes the whole grid. Searches stop when the exit becomes current.

Randomized DFS uses versioned Mulberry32 and one Fisher–Yates shuffle per entered cell. It creates a connected tree with N−1 passages. Thus both searches restore its unique route. The 3×2 cycle preset demonstrates BFS's 1-transition route versus DFS's 5-transition route; the disconnected preset demonstrates No path. BFS marks on enqueue, uses NESW order and counts waiting cells without the current cell. DFS uses explicit suspended calls, with the current cell included in its stack.

The example reuses the shared demo player and its limits: **64 cells in history**, **2000 in generator mode**. The count is width × height, not a side length. A mode change above the history limit preserves the existing session and reports an error. Larger grids hide unreadable cell labels; the text previews at most 16 frontier entries.

The wall model, immutable generator, aggregate maze-grid object and drawing belong to the example. It uses only public /playback and /scene exports. Topology preparation and algorithm working space are O(N). Each animation snapshot copies O(N) data: full history uses O(N²) memory; lazy generator playback retains adjacent snapshots in O(N), but snapshot creation still costs O(N) per event. This is deliberately different from the website's packed/checkpointed history; its 201×201 UI limit does not apply here.

Sources: [algorithm](https://github.com/urffin/algiviz/blob/master/examples/maze-algorithm.mjs), [scene](https://github.com/urffin/algiviz/blob/master/examples/maze-scene.mjs), [shared-player integration](https://github.com/urffin/algiviz/blob/master/examples/maze-demo.mjs). The [website walkthrough](https://grundyjs.ru/algorithms/maze/) explains the guarantees, counters and search code. No npm API or release is added.
