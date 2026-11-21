# AlgiViz 1.5.0

[Русский](ru/release-1.5.md) · [Current API](current-api.md) · [Environments](support-matrix.md#current-support-boundary)

AlgiViz 1.5.0 adds dynamic topology to the existing graph modules.

- [`/graph`](graph-dynamic-topology.md) adds `createDynamicGraphTrace` and four
  types. One `edit` can add and remove vertices and edges, redirect retained
  edges, and update layout and marks atomically. Retained IDs keep their
  identity. Removed IDs are retired within the trace. Dynamic steps use
  `DynamicGraphEvent` with the existing snapshots, scenes and playback.
- [`/canvas/graph`](graph-dynamic-canvas.md) adds the optional
  `topologyTransitions` setting. It fades entering and exiting objects,
  crossfades redirected routes between their own endpoints, and animates
  changes in parallel lanes. Canvas dimensions and DPR remain caller-owned.
- The [edge contraction example](examples.md#edge-contraction) removes one
  vertex and redirects two edges with stable IDs. It shows a green result,
  Previous and Restart in both Player modes, and seeking in full history.
  The [BFS graph and queue example](examples.md#bfs-graph-and-queue-in-one-player)
  uses one Player to synchronize a graph and a linked-list queue.

## Migration and environments

Existing applications need no migration. The 16 ESM import paths remain the
same. `createGraphTrace` still captures fixed topology and its closed
`GraphEvent` is unchanged. Set `topologyTransitions: true` to enable dynamic
Canvas transitions. Omission, `undefined` and `false` preserve the default
renderer behavior.

`/graph` uses ES2022 declarations without DOM. `/canvas/graph` uses ES2022 with
DOM and needs an HTML Canvas 2D context for drawing. The package has no runtime
dependencies. Both example pages and their algorithms live in the repository.

[Changelog](../CHANGELOG.md) · [Readiness review](graph-readiness-1.5.md)
