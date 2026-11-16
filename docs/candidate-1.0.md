# Updated 1.0.0 candidate

[Русский](ru/candidate-1.0.md) · [Migration](migration-1.0.md) · [Current API](current-api.md)

**Documentation freeze follow-up, 2026-11-16:** the accumulated design/readiness
documents and reports are prepared for the authorized commit/push and all 11 CI
jobs on its resulting SHA. The [freeze check](checks/candidate-1.0.0-docs-freeze-2026-11-16.json)
records the intended files, source/payload equivalence and link/report checks.
The commit containing that record defines the documentation revision; its exact
SHA and CI result are recorded after commit, without a self-referential SHA here.
The a9b93f8 evidence below remains tied to that earlier code/payload baseline.
Native G3 remainder, tag/Release and publication are outside this follow-up.

**Updated 2026-11-16; unpublished.** This candidate includes explicit Player
steps, array result markers and the simplified minimum quickstart, in addition
to F1/F2 and U1–U5. It replaces the earlier candidate **5e2fd18**. That commit's
11 successful CI jobs are historical and do not certify these changes.

G1/G2 are complete on **a9b93f8db8db92ac1ba08ca4f127be82aad53f95**: origin/master
matches and all 11 jobs in [run 43860619331](https://github.com/urffin/algiviz/actions/runs/43860619331)
are successful. Native checks passed the requested 26-case stepSource/result/
control scope; the wider G3 remainder stays open. The [consolidated core review](core-readiness-1.0.md)
also records four compatible future model sketches and the documentation state
at review time. No tag, Release or publication is authorized here.
The published baseline remains [0.16.0](releases/0.16.0.json).

## Candidate contents

Package.json and both lockfile root versions remain **1.0.0**. The eight ESM
paths, 21 runtime export names, dependencies and selected environment boundary
are unchanged. The current surface has 69 type-only exports (57 distinct names),
including the new ArrayDoneOptions. Public options/types have changed:

- Player<State, Event = undefined> and PlayerOptions support the exclusive
  stepSource/isTerminal branch, direct typed frames and explicit terminal steps.
  The source-union widening is breaking under U3; exhaustive source checks need
  the migration documented in [EN](migration-1.0.md)/[RU](ru/migration-1.0.md).
- done({ result }) records immutable result IDs in the final array snapshot.
  The stock renderer's optional result role keeps chosen bars green; the done
  event, sorted regions and unmarked traces retain their meanings.
- The EN/RU quickstart uses a fixed nonempty array, 31 JS lines, one renderer and
  standard Start/Next/Restart. Pre/plain states, manual array playback and
  scenes/interpolation remain progressive examples, not algorithm exports.
- Result collections reject malformed reported lengths as well as sparse arrays
  before completion commits; original getter throws and validation precedence
  are preserved.

[Changelog](../CHANGELOG.md), [step contract](player-step-source.md) and
[result contract](array-result.md) describe the full behavior and migration.
The original [candidate report](checks/candidate-1.0.0-2026-11-16.json) and dated
implementation reports are retained with their original stage-specific hashes.

## Verification and exact revision

The [refreshed preparation report](checks/candidate-1.0.0-explicit-steps-2026-11-16.json)
records the local checks, source/build hashes and retained archive for this
preparation. Source/tests and public declarations are checked together; an old
archive or another SHA's CI cannot substitute for this candidate.

The report was committed at a9b93f8. A fresh [GitHub/npm snapshot](checks/candidate-1.0.0-ci-a9b93f8-2026-11-16.json)
confirms that exact SHA, all 11 successful jobs and no v1.0.0 tag/Release/npm
version. The [native record](checks/candidate-1.0.0-native-a9b93f8-2026-11-16.json)
covers 26 checks on its installed 75-file payload. These later records supplement,
not rewrite, the preparation report's pre-commit/pre-native status fields.

## Remaining release gates

1. Preserve G1/G2 for a9b93f8. Commit/push the checked documentation under the
   authorized freeze follow-up above, then identify its resulting SHA.
2. Require all **11 jobs on the final release SHA** if it changes: Node 22/24/26
   Windows/Linux, four selected TypeScript consumers and bundle isolation.
   Unchanged payload checks may be reused with hashes; CI remains SHA-specific.
3. Finish the [native G3 remainder](core-readiness-1.0.md#remaining-release-steps):
   generic scene lifecycle, Canvas/viewport sizing/DPR/disposal and affected
   async/Worker data/transfer/F1/F2/waiting/control/cleanup. Retain the 26 passed
   checks, recording which artifact/SHA each native observation actually used.
4. Tag/release/npm publication require a separate instruction after the release
   gates, followed by exact-version/latest, registry consumer and provenance checks.
   Pushing this candidate alone does not trigger npm-publish.yml, which is
   configured only for published GitHub Releases.
