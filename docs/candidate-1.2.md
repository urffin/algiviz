# Candidate 1.2.0

[Русский](ru/candidate-1.2.md) · [Changelog](../CHANGELOG.md) · [Current API](current-api.md) · [Tree readiness](tree-readiness-1.2.md)

**Prepared 2026-11-19; unpublished.** package.json and both root lockfile versions
are 1.2.0. The commit introducing this document identifies the candidate revision.
This stage includes commit/push and waiting for all 11 CI jobs on that exact
commit. Tag v1.2.0, GitHub Release and npm publication require a separate stage.

## Contents and migration

Compared with released 1.1.0 / 629defe, two independent ESM paths are added:
`/tree` (`createTreeTrace`, `treeScene`, 29 types) and `/canvas/tree`
(`createTreeRenderer`, four types). The surface is twelve entries, 27 runtime
names and 128 type-only exports (116 distinct types).

[Tree API](tree-api.md) defines rooted ordered/binary trees, stable node/link IDs,
atomic topology edits, explicit layout, marks, captions and independent results.
Removed IDs cannot be reused in the same trace; retirement history grows with
distinct committed IDs independently of the playback window. Algorithms remain
application-owned. [Tree Canvas](tree-canvas-api.md) adds ordered/binary layout,
empty-slot decorations, attached relation crossfades, safe secondary text and
green results. The T1 correction reserves the complete painted slot stroke.

**Existing ten imports need no migration.** Their 43 source files and export-map
records, runtime dependencies and compiler versions are unchanged. Existing
steps, frames, scenes and Player handle completion, rewind, Restart and cleanup.
No new Player controls, root import, CommonJS or browser support promise is added.
The new entries receive the common 1.x compatibility policy at first publication.

Tree imports require 1.2.0 after publication; npm 1.1.0 contains neither entry.
Until then use a local build/archive. The minimum-search quickstart deliberately
pins npm 1.0.0 and remains reproducible. The new insertion/right-rotation page is
a repository example alongside the preserved custom traversal; neither the
example nor a general-purpose tree algorithm is a package export.

## Verification and remaining gates

The [preparation record](checks/candidate-1.2.0-2026-11-19.json) records fresh
repository tests, the versioned installed archive, strict NodeNext/Bundler
consumers, bundle isolation and file hashes. Native acceptance is reused by
checking source and compiled-file identity: 32 renderer checks and 17 example UI
checks from the [T1 native report](checks/tree-t1-native-2026-11-19.json).
Metadata/documentation preparation adds no new browser run or performance claim.

R0 (T1), R1 (metadata/notes) and R2 (local archive freeze) are covered by these
records. R3 requires all eleven jobs on the final commit: Node 22/24/26 ×
Ubuntu/Windows (6), TypeScript 5.0.4/5.4.5/5.9.3/6.0.3 consumers (4), bundle
isolation (1). Previous release CI cannot certify this candidate. CI results
are checked after commit/push; this preparation record does not claim them.

R4 remains separate: authorize the tag and stable GitHub Release on the verified
SHA, await OIDC npm publication and verify exact version, latest, fresh install
and provenance/source SHA. The publishing workflow does not itself enforce the
preceding eleven-job gate. No tag or publication belongs to this preparation.
