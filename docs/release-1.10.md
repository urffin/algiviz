# AlgiViz 1.10.0

[Русский](ru/release-1.10.md) · [Current API](current-api.md) · [Environments](support-matrix.md#current-support-boundary)

AlgiViz 1.10.0 adds optional controls for drawing graph edges and tree nodes
in the existing Canvas renderers. The package provides 16 ESM entry points
and has no runtime dependencies.

## Graph

- `drawEdge` can draw an edge from its calculated curve and arrow vertices.
  The optional `drawStroke()` and `drawArrow()` helpers can paint a dashed
  shaft and a solid arrowhead.
- `edgeBend` sets the signed bend of the route before drawing. The renderer
  uses the resulting curve for the stroke, arrow and label placement.
- `nodeRadius` sets a preferred radius in logical pixels. The viewport limits
  the radius to one eighth of its shorter side.

The [Aho–Corasick example configuration](graph-api.md#custom-edge-drawing)
combines these options with automatic edge labels. Failure links keep their
dash pattern when the active role changes their color.

## Tree

- `drawNode` can replace the node body or add a detail after `drawDefault()`.
- The fourth argument to `render` accepts `doubleOutlineNodeIds` so trie
  terminals keep their rings when active or on the highlighted path.
- The same `nodeRadius` option controls the node size and informs the link
  anchors, double outlines and caption placement.

The [trie example](tree-canvas-api.md#double-outlines-for-trie-terminals)
derives terminal IDs from the frame, so seeking through `stepHistory`
restores the same outlines.

[Changelog](../CHANGELOG.md)
