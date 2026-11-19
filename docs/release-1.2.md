# AlgiViz 1.2.0 release

[Русский](ru/release-1.2.md) · [Receipt](releases/1.2.0.json) · [Current API](current-api.md) · [Changelog](../CHANGELOG.md)

**Released 2026-11-19** from 8e1f50b3fb0a565e1634066ebd9e3e32dd0ced1f.
[Stable GitHub Release](https://github.com/urffin/algiviz/releases/tag/v1.2.0),
[all 11 CI jobs](https://github.com/urffin/algiviz/actions/runs/44607527511)
and the [OIDC publish workflow](https://github.com/urffin/algiviz/actions/runs/44608620588)
succeeded on that exact commit. Exact npm 1.2.0 and latest = 1.2.0 were verified.
This document records the completed release task; it makes no fresh registry
observation and performs no publication.

## Contents and compatibility

Twelve ESM entries are published: the ten 1.1.0 paths plus `/tree` and
`/canvas/tree`. Surface: 27 runtime names, 128 type-only exports, 116 distinct
types. The ten previous implementations/export records, runtime/build
dependencies and Player API are unchanged; existing imports need no migration.

Tree traces support ordered/binary trees, stable IDs, atomic edits, explicit
layout, marks, captions and independent results. Canvas adds ordered/binary
layout, empty slots, attached relation crossfades, measured text and green
results. T1 was closed before release with complete painted-slot safety bounds.
Insertion/right-rotation is a separate repository example, not an algorithm
export. Grid/list remain designs; neither has a package entry.

## Verification and evidence

- Local candidate: 648 repository tests, 403 installed-package regressions and
  34 bundle variants; then 11 exact-SHA CI jobs.
- Fresh npm installation: 1.2.0, all twelve paths and 27 runtime names, private
  paths rejected. All 106 dist files match after newline normalization; 105 are
  byte-identical. LICENSE and dist/player/mount.js have only Windows/Linux
  newline differences; package metadata/export mappings match separately.
- npm audit signatures verified one registry signature and one attestation,
  with no invalid or missing signatures. Provenance binds the tarball SHA-512,
  source SHA, refs/tags/v1.2.0 and .github/workflows/npm-publish.yml to the
  successful run. [Transparency entry](https://search.sigstore.dev/?logIndex=4005857088).
- Native evidence reused for the unchanged candidate: 32 renderer and 17
  example UI checks. It covers the recorded embedded Chromium host, not an
  expanded browser guarantee or forced GPU context loss.

The workflow succeeded before npm propagation completed. Publication was
verified after exact-version/latest metadata appeared; no duplicate publish or
approval bypass occurred. Full counts, digests and limits are in the receipt.

## Documentation correction

The immutable npm 1.2.0 archive retained candidate-status wording in EN/RU
README and changelog, calling tree entries unpublished. That status was stale;
the API, package exports and implementation are released and verified. This
repository update corrects current documentation and preserves dated evidence.
It cannot replace files inside the already published version. Corrected packaged
documentation is supplied by the [1.2.1 documentation patch](release-1.2.1.md).
