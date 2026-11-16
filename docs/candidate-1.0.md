# Updated 1.0.0 candidate

[Русский](ru/candidate-1.0.md) · [Migration](migration-1.0.md) · [Current API](current-api.md)

**Updated 2026-11-16; unpublished.** This candidate includes explicit Player
steps, array result markers and the simplified minimum quickstart, in addition
to F1/F2 and U1–U5. It replaces the earlier candidate **5e2fd18**. That commit's
11 successful CI jobs are historical and do not certify these changes.

The current instruction authorizes reviewing, committing, pushing to origin and
waiting for all 11 CI jobs on the resulting SHA. It does not authorize a tag,
GitHub Release or npm publication. The published baseline remains
[0.16.0](releases/0.16.0.json).

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

The commit containing that report fixes the new source. Its SHA is determined
after commit, avoiding a self-referential embedded SHA. The subsequent CI result
must identify that exact commit and the complete job list. Live runs are visible
in [CI](https://github.com/urffin/algiviz/actions/workflows/ci.yml); the completion
report for this task provides the exact SHA and run URL. No CI success is inferred
from this pre-commit document.

## Remaining release gates

1. G1: commit this refreshed candidate and verify origin has the same SHA.
2. G2: require all **11 jobs on that SHA**: Node 22/24/26 on Windows/Linux, four
   selected TypeScript versions with NodeNext/Bundler consumers, and bundle isolation.
   A skipped, cancelled or failed job is not success. Complete G1/G2 in this task.
3. G3: focused native checks of the same candidate in the existing Windows
   built-in-browser boundary remain before release. Earlier F1/F2 native reports
   are historical; the later built-in-browser service_info timeouts are not a
   native pass. This does not prevent the authorized candidate push/CI check.
4. Tag/release/npm publication require a separate instruction after the release
   gates, followed by exact-version/latest, registry consumer and provenance checks.
   Pushing this candidate alone does not trigger npm-publish.yml, which is
   configured only for published GitHub Releases.
