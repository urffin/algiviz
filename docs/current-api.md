# Current API and verification status

[Русский](ru/current-api.md) · [Compatibility](api-compatibility.md) · [Environments](support-matrix.md#current-support-boundary) · [1.1 readiness](graph-readiness-1.1.md)

**Reviewed 2026-11-17.** The release baseline is 1.0.0 from commit 3977c78, with
eight entries. The working tree adds /graph and /canvas/graph in **candidate
1.1.0**; package.json and both root lockfile versions are 1.1.0. The candidate
is not published. [Candidate notes](candidate-1.1.md) describe local acceptance
and the exact-SHA CI gate. No fresh npm latest lookup is claimed here.

F1/F2, U1/U2/U5, stepSource/isTerminal and done({ result }) are in 1.0.0.
They are no longer local unpublished differences. See [1.0 migration](migration-1.0.md)
for upgrades from 0.16.0. All eight original source entries and export-map records
are unchanged since 3977c78; graph features use two new independent paths.

## Published versus local

| Scope | Current status |
| --- | --- |
| Release baseline | 1.0.0: 8 entries, 21 runtime names, 69 type-only exports, 57 distinct types |
| Working tree | 10 entries, 24 runtime names, 95 type-only exports, 83 distinct types |
| /graph | Implemented locally, unpublished: createGraphTrace, graphScene and 22 types; fixed topology, IDs, marks, captions, results and atomic validation |
| /canvas/graph | Implemented locally, unpublished: createGraphRenderer and 4 types; arrows/loops/parallel lanes, interpolation, green results, captions and explicit logical size |
| BFS | Two application examples with shared algorithm/Player: [detailed](../examples/graph.html) and [stock renderer](../examples/graph-player.html); no library algorithm export |
| Tree/grid/list | [Contract](tree-contract.md) and [core-fit](grid-contract.md) [reviews](linked-list-contract.md) only; no new entries or implementations |

## Entry reference map: eight released and two local

| Entry | Reference | Status |
| --- | --- | --- |
| /playback | [Playback](playback.md), [rewind](rewind-buffer.md), [async](async-source-api.md) | 1.0.0; unchanged |
| /scene | [Scene](scene.md) | 1.0.0; unchanged |
| /array | [Array](array.md), [result](array-result.md) | 1.0.0; unchanged |
| /canvas | [Array Canvas](array.md#canvas-rendering) | 1.0.0; unchanged |
| /canvas/viewport | [Viewport](canvas-viewport.md) | 1.0.0; unchanged |
| /player | [Player](player.md), [explicit steps](player-step-source.md), [async](player-async-api.md), [Worker](player-worker.md) | 1.0.0; unchanged |
| /worker | [Worker source](worker-source-api.md) | 1.0.0; unchanged |
| /worker/runtime | [Worker endpoint](worker-source-api.md#worker-declarations-workerruntime) | 1.0.0; unchanged |
| /graph | [Graph API](graph-api.md), [captions](graph-node-captions.md) | Local, intended 1.1.0 |
| /canvas/graph | [Renderer](graph-api.md), [placement](graph-node-captions.md) | Local, intended 1.1.0 |

## Verified state and next steps

Retained implementation evidence: 595 repository tests, installed consumers with
TypeScript 5.0.4/5.4.5/5.9.3/6.0.3 (NodeNext/Bundler, ES2022/DOM/WebWorker), 26
bundle variants, 31 automatic Canvas cases and 7 BFS-page control checks.
[Caption evidence](checks/graph-node-captions-implementation-2026-11-17.json) records
these sources; [the final review](graph-readiness-1.1.md) verifies source identity
and evidence limits. This is not exact-SHA CI for a future 1.1.0 commit or a new
promise for every browser/font.

Version/lockfile/changelog/release-facing documentation are prepared for 1.1.0.
The candidate must be committed/pushed and all 11 CI jobs must pass on its exact
SHA. Tag/GitHub Release, publishing workflow and npm version/latest/provenance
checks remain a separately authorized next stage.
See [1.1 readiness](graph-readiness-1.1.md) for gates and check-reuse conditions.

## Reading historical evidence

Dated documents/JSON retain their original scope. Old local/candidate/0.16.0
status refers to that verification stage, not current 1.0.0 availability. Use
this index for release-baseline status.

- [1.0 candidate](candidate-1.0.md), [core readiness](core-readiness-1.0.md), [migration](migration-1.0.md).
- F1/F2: [Memory bypass](checks/worker-memory-fix-2026-11-14.json), [missing SharedArrayBuffer](checks/worker-shared-buffer-fix-2026-11-14.json).
- U1/U2/U5: [reentrancy](headless-reentrancy.md), [speed](player-speed-validation.md), [host postMessage](worker-post-errors.md).
- [Initial graph](checks/graph-implementation-2026-11-17.json), [initial Canvas](checks/graph-canvas-implementation-2026-11-17.json), [captions](checks/graph-node-captions-implementation-2026-11-17.json).

Headless entries use ES2022 declaration libraries; Canvas/Player/viewport/Worker
host use DOM, endpoint uses separately checked WebWorker libraries. Optional
imports do not access DOM globals; calls require their actual hosts. No root,
CommonJS or deep imports are added. Optional loading is not experimental status;
new entries receive equal 1.x protection when released. Worker wire format is
private; host and endpoint use matched package versions.
