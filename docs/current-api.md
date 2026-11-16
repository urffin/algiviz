# Current API and verification status

[Русский](ru/current-api.md) · [Compatibility policy](api-compatibility.md) · [Support boundary](support-matrix.md#current-support-boundary) · [Final readiness review](api-readiness-1.0.md)

**Documentation reconciled under U4, 2026-11-14.** This is the common status index
for all eight entries. API references describe the working-tree contract and
mark local changes explicitly. They do not make those changes available in npm.

**Post-F2 readiness recheck, 2026-11-14:** all eight entries are ready locally
within the reviewed boundary; no known technical blocker or unresolved API
clarification remains from F1/F2 and U1–U5. [Current review](api-readiness-1.0.md)
and [fresh evidence](checks/api-readiness-1.0-after-f2-2026-11-14.json) replace the pre-F2 open status. Next are G1
candidate definition, G2 exact-SHA CI and G3 native candidate verification, then
separately authorized publication/registry checks. This is not a release approval.

**Candidate update, 2026-11-16:** package/lock metadata is now **1.0.0**, locally
prepared and unpublished. [Candidate status](candidate-1.0.md) records preparation
checks and remaining exact-SHA CI/native gates; [migration](migration-1.0.md)
explains U1/U2, explicit-step source narrowing and optional array-result changes.
The refreshed candidate replaces 5e2fd18; its own commit, origin push and all
11 exact-SHA CI jobs are authorized in the current preparation task.
The [new preparation report](checks/candidate-1.0.0-explicit-steps-2026-11-16.json)
records the checks; earlier CI/native results retain their original scope.
The 2026-11-14 audit/F2 evidence below retains its
stage-specific hashes and package metadata.

## Published versus local

| Scope | Current status |
| --- | --- |
| Published package | **0.16.0**; [exact-release evidence](releases/0.16.0.json) describes its commit/archive, CI and registry checks |
| F1 | **Implemented locally, unreleased:** reject shared backing storage through `WebAssembly.Memory` as well as SharedArrayBuffer/views in Worker input/state graphs. Published 0.16.0 has the Memory bypass. [Fix](checks/worker-memory-fix-2026-11-14.json), [native evidence](checks/worker-memory-fix-browser-2026-11-14.json) |
| U1 | **Implemented locally, unreleased:** guard reentrant headless commands/getters; preserve reads, other instances, primary errors and idempotent dispose after logical disposal. [Contract](headless-reentrancy.md), [verification](checks/u1-reentrancy-2026-11-14.json) |
| U2 | **Implemented locally, unreleased:** every invalid widget speed throws RangeError without coercion/effects, before lifecycle guards. Published 0.16.0 async/Worker uses TypeError. [Contract](player-speed-validation.md), [verification](checks/u2-speed-implementation-2026-11-14.json) |
| U3 | **Policy selected:** equal intended 1.x protection for all eight entries; [public/type/error/environment and release rules](api-compatibility.md). This is not a 1.0 release approval |
| U4 | **Documentation reconciled:** this index and linked references separate current guarantees from dated evidence; [documentation verification](checks/u4-documentation-2026-11-14.json) |
| U5 | **Contract selected and permanently covered locally:** original host postMessage throw is preserved as unknown; report gives host/post context, cancel failure is cleanup. [Contract](worker-post-errors.md), [75 public/installed regressions](checks/u5-post-errors-regressions-2026-11-14.json). No production change needed |
| F2 | **Implemented locally, unreleased:** reject shared buffers/views and nested input/state graphs without the SharedArrayBuffer constructor. Captured intrinsic branding needs no WebAssembly fallback or shared allocation. [Fix](checks/worker-shared-buffer-fix-2026-11-14.json), [native evidence](checks/worker-shared-buffer-fix-browser-2026-11-14.json) |
| Player explicit steps | **Implemented locally, unpublished:** [stepSource/isTerminal](player-step-source.md), Event frames and terminal/rewind/work/cleanup. Candidate 5e2fd18 and its CI do not cover these changes |
| Array result markers | **Implemented locally, unpublished:** [done({ result })](array-result.md), ArrayDoneOptions, resultItemIds and colors.result. The quickstart uses one renderer and fixed nonempty input |

The pre-implementation quickstart stage passed 520 tests (11 example checks).
New implementation results are in the local report linked below.

F1/F2/U1/U2 do not change public signatures/exports. At the F2 stage verification had
**509 passing repository tests**. Three parent tests run **121 isolated public
F2 cases** (41/41/39) with the constructor present, absent, and absent together
with WebAssembly. The same cases pass against installed archives; strict
TypeScript 6.0.3 NodeNext/Bundler consumers and fresh bundle isolation also pass.
The focused native built-in browser check passes **34 cases** in isolated iframe
and dedicated module Worker contexts with zero owned Workers left. Hidden globals
are controlled test configurations, not a claim about every browser deployment.

F2 changes only the common Worker data validator in production; all 41 built
declaration files, exports, package metadata and dependencies remain unchanged
from the pre-F2 tree. Historical U4/U5/audit records retain their scope. No new
CI/registry certification, version change or publication is claimed.

## Eight-entry reference map

The current inventory is **21 runtime names, 69 type-only exports, 57 distinct
type-only names**. Shared Worker types count at both entry paths. See the full
[inventory and compatibility rules](api-compatibility.md#public-surface).

| Entry | Current reference | Released baseline and local difference |
| --- | --- | --- |
| `/playback` | [Playback](playback.md), [rewind](rewind-buffer.md), [async adapter](async-source-api.md) | Rewind published in 0.14.0, async in 0.15.0; local U1 protects synchronous headless engines |
| `/scene` | [Scene objects, matching and projection](scene.md) | Bounded renderer matching cache published in 0.14.0; pure projection/immutable endpoint rules unchanged |
| `/array` | [Array model/playback](array.md) | Existing trace/event semantics; local U1 applies to createArrayPlayer; ArrayEvent is a closed union under U3 |
| `/canvas` | [Canvas rendering](array.md#canvas-rendering) | Dispatcher reuse published in 0.14.0; alias identity, theme/palette and context-restoration rules unchanged |
| `/canvas/viewport` | [Viewport](canvas-viewport.md) | Published in 0.13.0; independent of playback, CSS/DPR ownership as documented |
| `/player` | [Widget](player.md), [async integration](player-async-api.md), [Worker integration](player-worker.md) | Published UI/rewind/budget/async/Worker integration; local U2 unifies speed errors. Headless U1 is a separate guard contract |
| `/worker` | [Behavior](worker-source.md), [host API](worker-source-api.md#application-declarations-worker) | Published in 0.16.0; local F1/F2/U5 covered; no public API change |
| `/worker/runtime` | [Endpoint API](worker-source-api.md#worker-declarations-workerruntime) | Published in 0.16.0; local F1/F2 cover shared initialization/state validation; no public API change |

ESM export-map paths are public; root/CommonJS and internal deep paths remain
outside the supported surface. Declaration libraries and active runtime hosts
are distinct: headless ES2022, DOM for Canvas/widget/host, separately checked
WebWorker declarations for the endpoint. The [U3 environment policy](api-compatibility.md#environments-and-loading)
retains the recorded target boundary without adding a browser/version promise.
Optional entry loading does not make an entry experimental. Host and endpoint
use matched package versions; their wire format is private.

## Reading historical evidence

- Files under `releases/` verify the stated published version and SHA; they do
  not certify later local changes. Published 0.16.0 had **304** repository tests.
- Files under `checks/` record the named audit/design/implementation stage and
  hashes. For example, U1 had **373** tests at that stage; U2 later had **428**.
  The original eight-entry audit table intentionally remains a 0.16.0 snapshot.
- Benchmark JSON and paired-performance reports retain their original source
  hashes, workloads and numbers. Scene caching/dispatcher reuse were unreleased
  during the 0.13.0-based measurements and shipped in 0.14.0 afterwards.
- Older export/array/Canvas/minimal audits and design-stage declaration checks
  are historical findings/results, not new counts or still-unimplemented features.
- A mock transport, Node Canvas stub, native browser run, installed archive and
  exact-release CI each establish only their recorded scope. U4 adds none of
  those runtime or environment claims.

Current contract/status links take precedence over stage-specific planning
language when assessing the working tree. Historical numbers and raw results
are retained rather than rewritten. U5 is selected and permanently covered
locally. F2 is now corrected and permanently covered; G1–G3 candidate
definition/CI/native verification remain before 1.0. This review starts no release.

stepSource implementation checks: [local report](checks/player-step-source-implementation-2026-11-16.json). Earlier reports above retain their stage-specific scope.

Later quickstart output simplification: 33 JS lines, with the generator writing
the result before yielding done and render only drawing Canvas. API/production
code is unchanged; 542 tests and EN/RU Vite builds pass. [Stage report](checks/quickstart-result-2026-11-16.json).

The next quickstart stage keeps the final minimum bar green on done (43/45 JS
lines for Player/manual). The logical event stays done; rendering uses minimumId
from the final snapshot. API is unchanged; 542 tests and EN/RU Vite builds pass.
[Stage report](checks/quickstart-green-minimum-2026-11-16.json).

The current quickstart uses the stock result marker and 31 JS lines in both
variants; only the example drops its empty-input branch. Library empty-result
support remains. [Implementation checks](checks/array-result-implementation-2026-11-16.json).
