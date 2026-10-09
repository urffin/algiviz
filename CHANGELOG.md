# Changelog

## Unreleased

- Support forward-only generator playback in the merge sort example without retaining history.

- Add an application-owned merge sort example using scene/playback, with a main
  array and buffer, stable identity labels, seeking and accessible playback controls.

## 0.4.0 — 2026-10-09

- Verify the packed npm archive in an isolated TypeScript consumer before publishing.

- Add `/scene` with typed user-defined object data and visualization handlers,
  identity matching, enter/update/exit transitions, layers and reference lookup.
- Render array bars through the scene dispatcher and expose `arrayScene`.
- Add an external tree traversal demo defining its own nodes, edges and pointer.

- Add algorithm-free `/array` and `/playback` entry points: user-defined generators,
  validated array operations, generic states/events and optional rendering callbacks.
- Add `highlight` events and `createArrayRenderer`; existing rendering names remain available.
- Move demo algorithms into application-owned examples using only the public API.
  Old `/core` algorithm exports remain deprecated compatibility adapters.
- Preserve all original insertion/bubble traces; premature exhaustion now reports
  a missing terminal step rather than a missing done event.

## 0.3.0 — 2026-10-09

- Extend `SortEvent` with `swap` and `pass`, and `SortSnapshot` with optional
  `sortedSuffixLength`. Consumers with exhaustive event switches must handle
  the new event types. Existing insertion-sort traces remain unchanged.

- Share input validation, item identities, immutable snapshots and operation
  counters between sorting algorithms; document adding an algorithm internally.

- Add stable bubble sort with `bubbleSortSteps` and `iterateBubbleSortSteps`,
  adjacent swaps, sorted suffix tracking and early exit after a pass without swaps.
- Render both swapped items and the sorted suffix; select either algorithm in
  the demo with history or generator playback.

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
