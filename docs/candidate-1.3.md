# Candidate 1.3.0

[Русский](ru/candidate-1.3.md) · [Changelog](../CHANGELOG.md) · [Current API](current-api.md) · [Grid readiness](grid-readiness-1.3.md)

**Prepared 2026-11-20; unpublished.** Package.json and both root lockfile version
fields are 1.3.0. The commit introducing this document identifies the candidate.
This stage includes commit/push and waiting for all eleven CI jobs on that exact
SHA. No tag, GitHub Release or npm publication is part of this stage.

## Contents and migration

Compared with released **1.2.1 / c398d2d**, two independent ESM paths are added:
/grid (createGridTrace, gridScene and 22 types) and /canvas/grid
(createGridRenderer and five types). The total surface is **14 entries, 30 runtime
names and 155 type-only exports (143 distinct names)**.

[Grid API](grid-api.md) supplies fixed-shape dense generic values, atomic
replacement/writes with marks/captions, unique result cells, ordered paths with
repeats and stable namespaced coordinate scene IDs. Failed commands preserve
state identity, index and lifecycle. Value payloads remain application-owned;
there is no implicit numeric interpolation, wall sentinel or deep value cloning.

[Grid Canvas](grid-canvas-api.md) fits square cells, explicitly presents values,
measures labels/captions and clips paths out of their text boxes. Green result
membership outranks role/presenter colors. Paths crossfade using raw progress;
current cell styles switch discretely. Caller owns Canvas/viewport/DPR. Context
state, primary/falsy host errors and ordinary bitmap-reset redraw are covered.

**Existing twelve imports need no migration.** Their 53 implementation sources,
export records, dependencies and compiler versions are unchanged. New grid
imports need **1.3.0 or newer**. They receive the same 1.x compatibility protection.
Existing steps, frames, scenes, Player rewind/seek, Restart and dispose need no
API extension. No root/CommonJS import or browser-support expansion is added.

The separate [Grid BFS page](examples.md#grid-bfs-shortest-path) finds a 10-move
shortest path, records distances and demonstrates unreachable and zero-move
cases, history and bounded rewind. BFS/obstacles/queue/parents belong to the
example; it is not a built-in library algorithm or an npm-shipped file. The
earlier maze and its generation/BFS/DFS remain unchanged. The minimum-search
quickstart deliberately stays pinned to npm 1.0.0 and remains reproducible.

Until npm publication, use the versioned local archive for the new imports.
README/changelog/API descriptions explain the contents of version 1.3.0 and do
not claim that a tag, CI result or registry publication already exists.

## Verification and remaining gates

The [preparation record](checks/candidate-1.3.0-2026-11-20.json) records fresh
repository tests, the exact versioned archive, strict installed NodeNext/Bundler
consumers, bundle isolation and file/declaration/documentation hashes. Packaged
README.md, ru/README.md and CHANGELOG.md are checked against source files and the
fourteen exports before freezing the commit.

Native acceptance is reused after checking renderer/algorithm/control code,
compiled runtime and fixture identity: **18 renderer** and **23 example UI**
checks. The BFS HTML changes only its version-status paragraph; its controls,
markup and behavior are otherwise identical. Its one version-text assertion is
updated and covered by the fresh suite. No new browser or performance run is
claimed. See [renderer evidence](checks/grid-canvas-browser-2026-11-20.json) and
[example evidence](checks/grid-player-example-2026-11-20.json).

R0 (review), R1 (metadata/notes) and R2 (local archive freeze) are covered here.
R3 requires all **11 jobs on the final commit**: Node 22/24/26 × Ubuntu/Windows
(6), TypeScript 5.0.4/5.4.5/5.9.3/6.0.3 consumers (4), bundle isolation (1).
Results are checked after commit/push; the pre-commit preparation record does
not claim them. Previous-release CI cannot certify this candidate.

R4 remains separate: authorize v1.3.0 and a stable GitHub Release on the verified
SHA, await OIDC/provenance npm publication, then verify exact version, latest,
fresh installation, source SHA/provenance and registry-served README/packaged
EN/RU documentation. The publish workflow does not enforce the preceding eleven
CI jobs. No tag or publication is performed by this preparation.
