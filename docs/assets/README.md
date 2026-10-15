# README animation

`bfs.gif` is the real AlgiViz graph example exported through CanvasTake 0.3.0.
The original export was produced while validating CanvasTake; it was decoded and
visually checked again before being copied here unchanged.

- CanvasTake source: commit `63032fdb1f3194aabf14b4d04f9be2d1b45a62dd`.
- Recipe: https://github.com/urffin/canvas-take/blob/63032fdb1f3194aabf14b4d04f9be2d1b45a62dd/examples/gif-bfs.html
- Reuses AlgiViz `graphSteps`, `sampleGraph`, `createGraphRenderer`, `createTimeline`.
- 800 x 560 pixels; 141 frames; 50 ms intervals for 7 seconds plus a 2-second final frame.
- Infinite loop; gifenc adapter, 128 colors, high quality; 1,597,694 bytes.

To regenerate, build sibling CanvasTake and AlgiViz checkouts, run the CanvasTake
example server and open `/canvas-take/examples/gif-bfs.html` on its local port.
Export the GIF and inspect the downloaded result before replacing this file.
CanvasTake is an export tool, not an AlgiViz runtime dependency.

The README uses an absolute raw GitHub URL so npm can display the same asset.
The GIF is intentionally outside the npm package allowlist.
