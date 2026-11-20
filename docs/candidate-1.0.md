# Updated 1.0.0 candidate

[Русский](ru/candidate-1.0.md) · [Migration](migration-1.0.md) · [Current API](current-api.md)

**Post-release status:** 1.0.0 is published; stepSource, array results, F1/F2
and U1–U5 are part of the stable API since 1.0.0. [Current index](current-api.md)
describes 1.3.1. The earlier verification stages and their original limits
follow as historical evidence; old pending release items do not describe current
availability.

**G3 evidence commit follow-up, 2026-11-16:** the verified native report and
EN/RU status updates are included in the authorized documentation commit/push.
The commit first adding the G3 record identifies this evidence revision; all 11
CI jobs must succeed on that resulting SHA. The native run remains identified
as 76f76ed, with unchanged code/payload reusable by hash. No new native run,
tag, Release or npm publication is part of this follow-up.

**Current acceptance, 2026-11-16:** the documentation candidate is
**76f76eda83d796b04fd3c8ec84c1c1caee0fd03c**, committed/pushed with all
[11 exact-SHA CI jobs successful](https://github.com/urffin/algiviz/actions/runs/43945251321).
The remaining native G3 scope now passes **133/133 checks** in the user-opened
built-in Windows browser: scenes, Canvas/viewport, real DPR change, async/Worker
data, controls and cleanup. [G3 record](checks/candidate-1.0.0-g3-76f76ed-2026-11-16.json).
The [freeze check](checks/candidate-1.0.0-docs-freeze-2026-11-16.json) and earlier
a9b93f8 records keep their original stage scope. The 75-file installed payload
and code remain identical. The native-check task left G3 evidence/status edits
for the subsequent commit follow-up above; tag/Release/publication remain unauthorized.

**Updated 2026-11-16; unpublished.** This candidate includes explicit Player
steps, array result markers and the simplified minimum quickstart, in addition
to F1/F2 and U1–U5. It replaces the earlier candidate **5e2fd18**. That commit's
11 successful CI jobs are historical and do not certify these changes.

The earlier code candidate a9b93f8 passed [its own CI](https://github.com/urffin/algiviz/actions/runs/43860619331)
and 26 native stepSource/result/control checks. Those native observations are
retained by exact payload equivalence, without relabeling their run SHA. The
[consolidated core review](core-readiness-1.0.md) records four compatible future
model sketches and its historical pre-freeze gate table. Current G1/G2 and the
remaining G3 completion are identified above. No tag or publication is performed.
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

1. G1/G2 and the selected G3 scope are complete for 76f76ed. Commit/push the
   verified native evidence/status docs under the follow-up above.
2. Require all **11 jobs on the final release SHA** if it changes: Node 22/24/26
   Windows/Linux, four selected TypeScript consumers and bundle isolation.
   Unchanged payload checks may be reused with hashes; CI remains SHA-specific.
3. Retain the 133-check G3 record and earlier 26-check scope with their actual
   source/artifact hashes. Documentation-only commits can reuse unchanged native
   payload checks; changed code/artifact requires affected checks again.
4. Tag/release/npm publication require a separate instruction after the release
   gates, followed by exact-version/latest, registry consumer and provenance checks.
   Pushing this candidate alone does not trigger npm-publish.yml, which is
   configured only for published GitHub Releases.
