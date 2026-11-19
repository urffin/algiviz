# Candidate 1.1.0

[Русский](ru/candidate-1.1.md) · [Changelog](../CHANGELOG.md) · [Current API](current-api.md) · [Readiness review](graph-readiness-1.1.md)

**Release follow-up, 2026-11-17:** 1.1.0 was released from 629defe after all
11 CI jobs; exact npm/latest and provenance passed. [Completed release](release-1.1.md).
The candidate preparation below is historical; no gate below remains pending for 1.1.0.

**Prepared 2026-11-17; unpublished.** package.json and both root lockfile versions
are 1.1.0. This preparation authorizes commit/push and waiting for all 11 CI jobs
on the resulting commit. It does not create a tag, GitHub Release or npm release.
The commit introducing this document identifies the candidate revision.

## Contents and migration

Compared with released 1.0.0 / 3977c78, two independent ESM paths are added:
/graph (createGraphTrace, graphScene) and /canvas/graph (createGraphRenderer).
The surface is ten entries, 24 runtime names and 95 type-only exports (83 distinct).
Fixed topology, stable IDs, marks, results, snapshot-owned captions, atomic
validation and the Canvas boundary are defined in [Graph API](graph-api.md).
Algorithms and layout computation remain application-owned. BFS is supplied as
two repository examples, not a package algorithm export.

**Existing eight imports need no migration.** Their implementation files and
export records, runtime dependencies and compiler versions are unchanged.
No new Player controls/options, root import, CommonJS or browser support promise
are introduced. New graph entries receive the same 1.x compatibility policy at
first publication. Caption placement may omit text when no safe position exists.

Graph imports require 1.1.0; published 1.0.0 has neither graph entry. Until
publication use a local build/archive. The minimum-search quickstart deliberately
pins published npm 1.0.0 and needs neither graph entry.

## Verification and remaining gates

The [candidate preparation record](checks/candidate-1.1.0-2026-11-17.json) records
fresh repository tests, versioned archive/consumer checks, bundle isolation and
file hashes. Earlier native evidence is retained by source identity: 31 real
Canvas cases and seven BFS-page control checks. No fresh browser run or
performance benchmark is claimed for metadata/documentation preparation.

After local acceptance, commit/push all reviewed sources, tests, examples,
assets and documentation. All 11 jobs must succeed on that exact commit:
Node 22/24/26 × Ubuntu/Windows (6), four TypeScript consumer jobs (4), and bundle
isolation (1). Old 1.0.0 CI or a different candidate SHA cannot satisfy this gate.

Only after exact-SHA success may a separately authorized stage create tag
v1.1.0 and a stable GitHub Release, await OIDC npm publication and verify exact
version, normal latest and provenance/source SHA. The publishing workflow does
not itself enforce this preceding 11-job CI gate.
