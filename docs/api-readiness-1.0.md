# Historical eight-entry readiness review after F2

[Русский](ru/api-readiness-1.0.md) · [Current API](current-api.md) · [Compatibility policy](api-compatibility.md) · [Support boundary](support-matrix.md#current-support-boundary)

**Current assessment, 2026-11-16:** the [four-model core review](core-readiness-1.0.md)
records the a9b93f8 candidate, completed G1/G2, partial native G3 and remaining
release steps. The text below retains the historical 2026-11-14 assessment with
0.16.0 metadata and its original 68/56 type counts. Its prospective G1–G3 wording
does not override that newer status. Raw evidence is unchanged.

**Rechecked 2026-11-14: ready to prepare a 1.0 candidate within the reviewed
boundary.** All eight entries are ready locally; no known technical blocker or
unresolved API clarification remains from F1/F2 and U1–U5. Candidate definition,
exact-candidate CI and native verification (G1–G3) remain before release.

This reviews the uncommitted working tree based on
`12173e01b9e175f18ea63c6becf41eb7724a9c56`. Package metadata remains **0.16.0**;
there is no immutable 1.0 candidate yet. This review changes documentation and
adds its report without changing API, implementation, tests, workflows,
dependencies or version. It does not commit, push, start CI or publish.

<a id="current-eight-entry-result"></a>

## Historical eight-entry result

“Ready locally” means no further mandatory API/implementation change was found
within the declared contract and environment boundary. It is not exact-candidate
certification or a guarantee for unverified browsers.

| Entry | Runtime/type-only names | Status | Reviewed contract and boundary |
| --- | --- | --- | --- |
| /playback | 6 / 10 | Ready locally | Explicit/plain-state playback, timeline, emitter, bounded rewind and async ownership/cancellation; U1 guards callbacks/getters, primary errors and idempotent dispose. ES2022-only declarations. [Reference](playback.md) |
| /scene | 3 / 5 | Ready locally | Identity/type/layers, nullable enter/exit endpoints, pure projection and bounded matching cache; application snapshots remain immutable. [Reference](scene.md) |
| /array | 4 / 10 | Ready locally | Trace/event semantics, immutable snapshots/IDs/counters/markers; shared U1 playback guard. ArrayEvent is closed under U3. [Reference](array.md) |
| /canvas | 3 / 4 | Ready locally | Renderer alias identity, copied palette, bitmap coordinates, context restoration and dispatcher reuse; caller owns sizing. Active rendering requires Canvas 2D. [Reference](array.md#canvas-rendering) |
| /canvas/viewport | 1 / 3 | Ready locally | Explicit CSS height/bitmap/transform ownership, independent width, DPR, null/invalid sizes, invalidation and disposal; explicit browser APIs. [Reference](canvas-viewport.md) |
| /player | 1 / 4 | Ready locally | Sync/history/async/Worker controls, bounded work/rewind, waiting without polling, transactional Restart and closed reports; U2 value-first RangeError and U5 error/cleanup regressions. DOM widget. [Reference](player.md) |
| /worker | 2 / 17 | Ready locally | Lazy exclusive ownership, one pull, copy/transfer, F1/F2 graph rejection, original U5 host-post errors and bounded shutdown/reporting; dedicated browser module Worker host. [Reference](worker-source-api.md#application-declarations-worker) |
| /worker/runtime | 1 / 15 | Ready locally | Explicit endpoint/source installation, input/state validation including F1/F2, cancellation/return and bounded remote diagnostics; separately checked WebWorker declarations. Matched host/endpoint versions. [Reference](worker-source-api.md#worker-declarations-workerruntime) |

Fresh symbol enumeration confirms **21 runtime names, 68 type-only exports and
56 distinct type-only names**, identical to the earlier review. The 12 common
Worker types count at both entry paths. A fresh runtime fixture checks exact
namespaces, renderer alias identity and root/private path rejection without
DOM/Worker globals. Public signatures are unchanged; the earlier U1 change to
the private state-steps.d.ts is not an exported path.

## F1/F2 and U1–U5 disposition

| Item | Current disposition | Evidence and scope |
| --- | --- | --- |
| F1 | Closed locally, unreleased | Shared WebAssembly.Memory storage rejected in input/state, including nesting/foreign instances; original eight regressions and six native cases. F2 retains Memory controls. [Fix](checks/worker-memory-fix-2026-11-14.json) |
| F2 | Closed locally, unreleased | Constructor-independent buffer branding; buffers/views/nested and cyclic graphs rejected in both directions and at receivers. Copy/transfer, retained states and cleanup preserved. [Fix](checks/worker-shared-buffer-fix-2026-11-14.json), [34 native cases](checks/worker-shared-buffer-fix-browser-2026-11-14.json) |
| U1 | Closed locally, unreleased | Reentrant headless control/getter contract, primary-error precedence, independent instances and idempotent disposal; 61 public/installed cases. [Contract](headless-reentrancy.md), [evidence](checks/u1-reentrancy-2026-11-14.json) |
| U2 | Closed locally, unreleased | Invalid widget speed uses RangeError before lifecycle guards, without coercion/effects; 55 public/installed cases cover all source kinds and time accounting. [Contract](player-speed-validation.md), [evidence](checks/u2-speed-implementation-2026-11-14.json) |
| U3 | Policy selected | Equal intended 1.x protection for eight entries; public shapes/unions, errors, loading/environment and allowed changes defined. [Policy](api-compatibility.md) |
| U4 | Documentation reconciled | EN/RU current references separated from historical checks; this recheck replaces the pre-F2 table and corrects the support-matrix introduction. [Status](current-api.md) |
| U5 | Closed locally with permanent coverage | Original host postMessage throw remains unknown; init/pull primary, cancel/late/cleanup priority and transport/async/Player reports covered by 75 public/installed cases. [Contract](worker-post-errors.md), [evidence](checks/u5-post-errors-regressions-2026-11-14.json) |

## Verification and its limits

The F2 stage's **509 passing repository tests**, installed TypeScript 6.0.3
NodeNext/Bundler consumers (separate ES2022-only, DOM and WebWorker libraries),
fresh bundle isolation and **34 native Worker cases** remain the latest completed
runtime evidence. F2's three parent tests run **121 isolated public cases**
(41/41/39), also run installed; do not add those children to 509. Globals are
hidden before import in controlled contexts; this is not a broader host-support
or browser-exploit claim.

This recheck verifies the F2 production/build/metadata baseline, all 41 built
declarations, test/runner/native provenance and unchanged U1/U2/U5 implementation
and regression files. Earlier F1 validator/private-test and package-runner hashes
are superseded by documented F2 extensions, rather than a new regression.
The full suite, installed consumers, bundle and browser were **not repeated**
for this documentation-only review. Fresh symbol enumeration is an inventory
check, not a new strict type-consumer run.

The [new machine report](checks/api-readiness-1.0-after-f2-2026-11-14.json) records fresh checks, unchanged files and
current dispositions. No exact-candidate CI, fresh registry verification or
candidate-wide native certification is claimed.

<a id="remaining-release-steps"></a>

## Historical release plan (2026-11-14)

These are release gates, not new API defects or feature prerequisites.

| ID | Step | Completion evidence |
| --- | --- | --- |
| G1 | Define and freeze the separately authorized candidate | Choose the version under U3; align package/lock/changelog and migration notes; commit all intended code/tests/docs and record immutable SHA/archive/hashes. Cover F1/F2 forbidden shared-memory rejection, U1 callback command rejection and U2 async/Worker TypeError → RangeError. Candidate metadata is not prepared here |
| G2 | Verify that exact candidate locally and in CI | Repository, installed-package and bundle checks on the candidate. All **11 configured CI jobs** pass on its SHA: six Node 22/24/26 × Windows/Linux, four TypeScript 5.0.4/5.4.5/5.9.3/6.0.3 with NodeNext/Bundler, and bundle isolation. Record actual versions/run URL/SHA; old release or pre-candidate results cannot substitute |
| G3 | Verify affected native behavior on the same candidate | In the existing Windows built-in browser boundary, record candidate/build/host hashes and focused minimal playback, scene enter/update/exit, Canvas/viewport sizing/disposal, Worker F1/F2 data/copy/transfer/cleanup and Player waiting/Pause/Next/Restart/dispose checks. Source/artifact changes invalidate affected results and require relevant checks again |
| Publication | Publish and verify only under a separate release instruction after G1–G3 | Match release tag/version to verified SHA; use the existing GitHub Release → npm workflow. Then verify workflow success, exact registry version/latest, fresh installed consumers, source/archive/digest correspondence and signature/provenance. The publish workflow does not itself enforce all 11 CI results; exact-SHA CI remains an explicit gate |

No intermediate 0.x release, new algorithm/renderer, external-user quota or
website upgrade is required. Broader browsers, Bun/Deno/CommonJS,
Node worker_threads and SharedWorker/ServiceWorker remain outside this scope.
There is no new support promise or ongoing release automation.

## Historical findings

The [original eight-entry baseline](api-readiness-0.16.0.md) and
[pre-F2 final report](checks/api-readiness-1.0-2026-11-14.json) retain their results.
The latter found six ready entries and two requiring F2 using 20 controlled
cases before the fix. The F2 closure report and this recheck supersede that open
status. Raw release/benchmark/audit JSON and historical numbers are preserved.
