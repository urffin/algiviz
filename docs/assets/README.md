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

## Minimal usage animation

`minimal.gif` shows the code from `examples/visualization-pipeline.html`, with
sequential highlighting and the actual Canvas snapshots produced by that code.
The recipe strips teaching-only hooks, instruments generator/render calls, and
runs the source with AlgiViz's public playback and scene APIs. The algorithm is
not reimplemented. Captions use API names and English so both READMEs share one asset.

- CanvasTake 0.4.0, `createGifExporter` and gifenc adapter, 128 colors, high quality.
- 1100 × 700; 20 frames; 27.7 seconds; infinite loop; 645,838 bytes.
- Each call holds for 1.1 seconds; rendered states hold for 2.2 seconds,
  with a 3.5-second final hold before restarting.
- Verified decoded opening, middle and final frames, timings and all four positions.

To regenerate, build AlgiViz and the sibling `../canvas-take` checkout, run
`node scripts/serve-minimal-gif.mjs` from the AlgiViz root, and open
`http://127.0.0.1:3016/docs/assets/minimal-export.html`. Click **Export GIF**;
the local-only server writes `docs/assets/minimal.gif`. Review it before committing.
The server accepts only this fixed output path. Stop it when finished.

The GIF's absolute raw GitHub URL becomes available after pushing the asset.
Like the BFS preview, this file and its recipe are excluded from the npm archive.
