# AlgiViz 1.8.0

[Русский](ru/release-1.8.md) · [Current API](current-api.md) · [Environments](support-matrix.md#current-support-boundary)

AlgiViz 1.8.0 adds `mapFrame(frame, selectState)` to `/playback`. It applies
the selector to `previous` and `current` and returns a new shallow-frozen
frame. The original `progress`, `stepIndex` and `event` carry over, and the
selected states are used as returned. [Frame projection](playback.md#project-a-frame).

Kruskal, BFS and heap sort use frame projection to render synchronized panels.
The heap sort example still takes the array renderer's `swap` event from the
shared snapshot. The Dijkstra demo reads a single destination snapshot for
its graph, distances and priority queue when seeking with `stepHistory`.
[Synchronized panels](player-multiple-panels.md) · [Dijkstra demo](../examples/dijkstra.html).

The package has 16 ESM entry points and no runtime dependencies. The new
function runs in the existing DOM-free `/playback` module.

[Changelog](../CHANGELOG.md)
