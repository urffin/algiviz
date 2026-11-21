# AlgiViz 1.4.0

[Русский](ru/release-1.4.md) · [Current API](current-api.md) · [Support boundary](support-matrix.md#current-support-boundary)

AlgiViz 1.4.0 adds two independent entry points for singly linked lists.

- [`/list`](list-api.md) provides `createListTrace` and `listScene`. A trace records
  a complete acyclic chain at each step. Node, head and next-slot IDs stay stable
  across edits. Edits validate atomically, and steps can record captions and results.
- [`/canvas/list`](list-canvas-api.md) provides `createListRenderer`. It animates
  pointer changes between snapshots, draws head and null markers, and highlights
  nodes and pointers independently. The caller owns the Canvas bitmap and DPR.
- The [linked list example](examples.md#linked-list-edits) uses Player to insert,
  remove and reverse nodes. It shows a green final chain, bounded rewind and
  full-history seeking. The algorithm and demo page live in the repository.

## Migration and environments

Existing imports need no migration. The preceding fourteen entry points keep
their runtime code, declarations and environment requirements. `/list` works
with ES2022 declarations. `/canvas/list` requires DOM declarations and an HTML
Canvas 2D context for drawing. The package has 16 ESM subpaths and no runtime dependencies.

[Changelog](../CHANGELOG.md) · [Historical readiness review](list-readiness-1.4.md)
