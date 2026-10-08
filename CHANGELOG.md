# Changelog

## 0.2.0 — 2026-10-09

- Move the held key horizontally along the baseline without lifting it above the array;
  remove the redundant key label while retaining its color highlight.

- Expand the demo with history/generator playback, array input, generation and speed
  controls; hide individual bar labels on dense charts.

- Add `createSortPlayer` for forward-only playback with bounded snapshot storage,
  interpolated canvas-compatible frames, final hold and iterator cleanup.

- Add `iterateInsertionSortSteps` for lazy immutable snapshots without retaining history.
- Keep `insertionSortSteps` compatible by collecting the shared generator implementation.

## 0.1.0

- Stable, immutable insertion sort traces with item identities and operation counters.
- A seekable timeline with interpolated frames and final hold.
- Stateless light and dark canvas rendering.
- ESM and TypeScript declarations; no runtime dependencies.
