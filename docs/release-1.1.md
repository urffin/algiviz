# AlgiViz 1.1.0 release

[Русский](ru/release-1.1.md) · [Current API](current-api.md) · [Changelog](../CHANGELOG.md)

**Released 2026-11-17** from 629defe2eb570034ea368d736c1e5fdf74ea3502.
[Stable GitHub Release](https://github.com/urffin/algiviz/releases/tag/v1.1.0),
[11 successful CI jobs](https://github.com/urffin/algiviz/actions/runs/44164521486)
and the [successful OIDC publish workflow](https://github.com/urffin/algiviz/actions/runs/44165469767)
refer to that exact commit. Exact npm 1.1.0 and latest = 1.1.0 were verified.

## Contents and compatibility

The package now publishes ten entries: the original eight plus /graph and
/canvas/graph. The surface is 24 runtime names and 95 type-only exports (83 distinct).
Graph traces have fixed topology, stable IDs, marks, results and vertex captions.
The optional Canvas renderer supports arrows, loops, parallel edges, interpolation
and safe caption placement/omission. BFS remains repository example code.

The original eight implementations and export records match 1.0.0; existing
imports need no migration. New graph imports require 1.1.0. Runtime/build
dependencies, headless/DOM/WebWorker boundaries and the 1.x policy are unchanged.
Tree/grid/list remain designs, not exported modules.

## Verification and evidence

- Local candidate: 595 repository tests, 356 installed-package regressions and
  26 bundle variants passed; exact-SHA CI then passed all 11 jobs.
- Fresh registry install: 1.1.0, ten entry paths and 24 runtime names. All 86 dist
  files and the four other packaged text files match the candidate after newline
  normalization; package metadata/export mappings were checked separately.
- npm audit signatures verified one registry signature and one attestation.
  Provenance links the tarball SHA-512, exact source commit, refs/tags/v1.1.0 and
  .github/workflows/npm-publish.yml to the publishing run. Its payload matches
  [transparency entry 3952700530](https://search.sigstore.dev/?logIndex=3952700530).
- Earlier native evidence remains 31 Canvas cases and seven BFS-page checks,
  retained by source identity. No new browser/font/performance guarantee follows.

npm initially reported processing delay after accepting publication. The task
waited for exact-version and latest metadata and verified them before completion;
no duplicate local publish or trusted-publisher change was made.

These results describe the original publication check. Candidate, readiness and
implementation reports describe earlier stages. Candidate labels in the tagged
npm documentation describe preparation.
