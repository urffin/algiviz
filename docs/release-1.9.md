# AlgiViz 1.9.0

[Русский](ru/release-1.9.md) · [Current API](current-api.md) · [Environments](support-matrix.md#current-support-boundary)

AlgiViz 1.9.0 adds opt-in edge label placement to the Canvas graph renderer.

```ts
import { createGraphRenderer } from "@grundyjs/algiviz/canvas/graph";

const renderer = createGraphRenderer({
    theme: "light",
    edgeLabels: { placement: "auto", preferredSide: "left" }
});
```

The renderer measures horizontal text and looks beside the visible curve for a
position clear of strokes, arrowheads, nodes and other edge labels. It skips a
label when no candidate fits inside the Canvas. The preferred side defaults to
left relative to the direction of the edge. Omit `edgeLabels` to keep the
previous placement and paint order. [Graph Canvas API](graph-api.md#edge-label-placement).

The [browser test](../test/graph-edge-labels-browser.html) uses Russian and
English Aho–Corasick graphs plus a dictionary that produces crossings between
letter transitions and failure links.

The package has 16 ESM entry points and no runtime dependencies. The option
extends the existing /canvas/graph entry.

[Changelog](../CHANGELOG.md)
