# Release 1.3.0

[Русский](ru/release-1.3.md) · [Current API](current-api.md) · [Machine receipt](releases/1.3.0.json)

**Released 2026-11-20** from commit `90b26f8b936ece9b149e0ac660856b2953ac2b4e`.
[GitHub Release](https://github.com/urffin/algiviz/releases/tag/v1.3.0) ·
[npm 1.3.0](https://www.npmjs.com/package/@grundyjs/algiviz/v/1.3.0).

The compatible minor adds [/grid](grid-api.md) and [/canvas/grid](grid-canvas-api.md):
fixed-shape dense grids, atomic edits, stable coordinate IDs, captions, green
results and ordered paths. Fourteen entries expose 30 runtime names and 155
type-only exports (143 distinct). The twelve earlier imports need no migration.
Grid imports require 1.3.0 or newer. The separate [BFS example](examples.md#grid-bfs-shortest-path)
is application code; it and the preserved maze are not npm algorithm exports.

## Completed verification

- All eleven [CI jobs](https://github.com/urffin/algiviz/actions/runs/44642599848) passed on the release SHA.
- The [publication workflow](https://github.com/urffin/algiviz/actions/runs/44643911400) completed successfully. Exact npm version and latest were 1.3.0 at verification.
- Fresh registry installation passed public/private import checks for all fourteen entries. The archive contains 131 files, including 126 dist files matching the candidate after newline normalization.
- Packaged EN/RU README and changelog matched the release; the registry-served README matched the archive.
- Registry signature and SLSA provenance were cryptographically verified. Provenance binds the tarball digest, source SHA, v1.3.0 tag and npm-publish workflow; [transparency record](https://search.sigstore.dev/?logIndex=4010859496).

The receipt records verification at 2026-11-20T00:21:37.673Z; latest is a point-in-time
observation. Native renderer (18 checks) and BFS UI (23 checks) acceptance retained
their recorded host limits. [Preparation](candidate-1.3.md) and
[readiness](grid-readiness-1.3.md) are historical evidence; R0–R4 are complete.

[Documentation patch 1.3.1](release-1.3.1.md) reconciles release statuses and
README references without changing this functional API.
