# 1.0.0 candidate preparation

[Русский](ru/candidate-1.0.md) · [Migration](migration-1.0.md) · [Eight-entry review](api-readiness-1.0.md)

**Prepared locally on 2026-11-16; not published.** This preparation covers
version/lockfile, release notes, migration, local checks and a local commit.
Push, tag, GitHub Release and npm publication are outside this preparation.
Published baseline evidence remains [0.16.0](releases/0.16.0.json).

Package metadata and both lockfile root versions are **1.0.0**. The eight export
paths, public signatures, dependencies and selected environment boundary remain
unchanged. The candidate includes accumulated F1/F2 fixes, U1/U2 control/error
changes, U5 regressions, common U3 policy and reconciled U4 documentation.

The [changelog](../CHANGELOG.md) marks 1.0.0 as a candidate, not a release.
[Migration notes](migration-1.0.md) describe the observable U1/U2 differences from
0.16.0 and the Worker data/error boundary. No intermediate 0.x release is needed.

## Local verification

The candidate passes **509 repository tests**, fresh installed-package checks
with TypeScript 6.0.3 in strict NodeNext/Bundler configurations (ES2022-only,
DOM and separately WebWorker), and bundle isolation. Installed checks include
61 U1, 55 U2, 75 U5 cases and the 121 isolated public F2 cases run through three
parent tests. The eight EN/RU migration examples were executed successfully.
The [candidate report](checks/candidate-1.0.0-2026-11-16.json) records source/build
hashes and the retained, file-verified npm archive. The archive's SHA512 identifies
the local payload; publication rebuilds must also be checked against that source
and file manifest, accounting for recorded text line endings.

Earlier native F1/F2 reports remain historical; no fresh native or CI result is
claimed for this candidate. Full tests/installed/bundle checks above are new
1.0.0 runs rather than a reuse of the earlier 0.16.0-metadata results.

## Remaining release gates

1. The local preparation commit containing the candidate manifest fixes the
   intended source and documentation. The preparation result records its exact
   SHA and archive hashes after committing, avoiding a self-referential SHA.
2. Under a subsequent instruction, push that candidate and require all **11 CI
   jobs on its exact SHA**: six Node/OS jobs, four selected TypeScript jobs with
   both resolutions and bundle isolation. Local checks alone do not close G2.
3. Record focused native checks of the same candidate in the existing Windows
   built-in browser boundary: playback/scene, Canvas/viewport, Worker data/cleanup
   and Player waiting/Pause/Next/Restart/dispose. Old native evidence does not
   close G3; source/artifact changes require affected checks again.
4. Publish only under a separate instruction after those gates, matching
   version/tag/SHA through GitHub Release → npm, then verify exact version/latest,
   fresh registry consumers and signature/provenance. No tag or Release is made
   during local preparation; the publish workflow is not started.

The [preparation report](checks/candidate-1.0.0-2026-11-16.json) and immutable Git
commit identify this candidate. Dated pre-F2/F2 audit JSON is retained unchanged.
