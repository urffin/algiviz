# AlgiViz 1.6.0

[Русский](ru/release-1.6.md) · [Current API](current-api.md) · [Environments](support-matrix.md#current-support-boundary)

AlgiViz 1.6.0 adds optional `itemLabel` to `createArrayRenderer` and its
compatibility alias `createSortRenderer`. The callback receives the item
being drawn. Use its ID to distinguish equal values through exchanges,
rewind and Restart. Omitting the callback or returning `undefined` gives
the default numeric label. Returning an empty string hides the value
label and keeps the slot index. [Array Canvas reference](array.md#custom-item-labels).

The repository includes two examples with synchronized views in one Player:

- Kruskal's algorithm shows the input graph and the growing minimum spanning
  tree. [Kruskal example](examples.md#kruskals-minimum-spanning-tree).
- Heap sort shows a binary heap and an array on `[2a, 2b, 1]`. Its array view
  draws tiles at different heights during the exchange to keep the labels
  legible. [Heap sort example](examples.md#heap-sort-with-player).

The two-panel guide shows how to share one immutable snapshot, project both
endpoints of a frame, and keep an `ArrayEvent` for full history.
[Two panels in one Player](player-multiple-panels.md).

## Migration and environments

Existing applications can keep their imports and renderer options. The
package has 16 ESM entry points and no runtime dependencies. The `/canvas`
declarations use ES2022 and DOM, and drawing uses an HTML Canvas 2D context.
The host sets the Canvas size and pixel ratio. Example pages and algorithms
live in the repository.

[Changelog](../CHANGELOG.md) · [Historical readiness review](readiness-1.6.md)
