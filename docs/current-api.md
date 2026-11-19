# Current API and verification status

[Русский](ru/current-api.md) · [Compatibility](api-compatibility.md) · [Environments](support-matrix.md#current-support-boundary) · [1.2 release](release-1.2.md)

**Released 2026-11-19.** Baseline: **1.2.0**, 8e1f50b3fb0a565e1634066ebd9e3e32dd0ced1f.
All **12 entries, 27 runtime names, 128 type-only exports (116 distinct)** are published.
Package and both lockfile root versions are 1.2.1 for the
[documentation-only patch](release-1.2.1.md); the 1.2.0 API is unchanged.
The [1.2.0 release receipt](releases/1.2.0.json)
records CI 11/11, OIDC publication, exact npm/latest, a fresh install and signature/
provenance from the completed release task. This closure performs no fresh lookup.
Existing ten imports need no migration; tree imports require 1.2.0.

## Published surface and future design

| Scope | Current status |
| --- | --- |
| Array/playback/scenes/Player/Worker | Released since 1.0.0; F1/F2, U1/U2/U5, stepSource/isTerminal and done({ result }) are stable contracts |
| /graph and /canvas/graph | Released since 1.1.0: fixed topology, IDs, marks/captions/results and stock Canvas |
| /tree | Released since 1.2.0: createTreeTrace, treeScene and 29 types; atomic edit, ordered/binary slots and retirement |
| /canvas/tree | Released since 1.2.0: createTreeRenderer and four types; layout, empty slots, relation crossfades, captions and green results; T1 closed before release |
| Examples | Custom and stock BFS/tree pages remain separate; example algorithms are not package exports |
| Future /grid | [Public contract](grid-api.md): fixed shape, coordinates, generic values, atomic operations, result and path; no implementation/exports |
| Future /canvas/grid | Backend boundary only in grid contract; complete renderer API remains to be designed |
| List | [Architecture sketch](linked-list-contract.md); no entry |

## Entry reference map: twelve published paths

| Entry | Reference | Status |
| --- | --- | --- |
| /playback | [Playback](playback.md), [rewind](rewind-buffer.md), [async](async-source-api.md) | 1.0.0; unchanged in 1.2.0 |
| /scene | [Scene](scene.md) | 1.0.0; unchanged in 1.2.0 |
| /array | [Array](array.md), [result](array-result.md) | 1.0.0; unchanged in 1.2.0 |
| /canvas | [Array Canvas](array.md#canvas-rendering) | 1.0.0; unchanged in 1.2.0 |
| /canvas/viewport | [Viewport](canvas-viewport.md) | 1.0.0; unchanged in 1.2.0 |
| /player | [Player](player.md), [explicit steps](player-step-source.md), [async](player-async-api.md), [Worker](player-worker.md) | 1.0.0; unchanged in 1.2.0 |
| /worker | [Worker source](worker-source-api.md) | 1.0.0; unchanged in 1.2.0 |
| /worker/runtime | [Worker endpoint](worker-source-api.md#worker-declarations-workerruntime) | 1.0.0; unchanged in 1.2.0 |
| /graph | [Graph API](graph-api.md), [captions](graph-node-captions.md) | 1.1.0; released |
| /canvas/graph | [Renderer](graph-api.md), [placement](graph-node-captions.md) | 1.1.0; released |
| /tree | [Tree API](tree-api.md) | 1.2.0; released |
| /canvas/tree | [Tree Canvas](tree-canvas-api.md) | 1.2.0; released |

## Verification and next work

All [11 CI jobs](https://github.com/urffin/algiviz/actions/runs/44607527511) and the
[publish workflow](https://github.com/urffin/algiviz/actions/runs/44608620588) passed
on 8e1f50b. Exact 1.2.0/latest, all twelve imports and signature/provenance passed.
All 106 dist files match the candidate after newline normalization; 105 match
byte-for-byte. See [release 1.2](release-1.2.md) for details.
Candidate and dated implementation/native evidence retains its historical scope.
The immutable npm 1.2.0 README/changelog retained stale candidate status; this
repository documentation corrects it without replacing the published archive.

Next: [grid API](grid-api.md). Declarations are checked in isolation; no module
or package stub is added. Complete Canvas options/signatures must be chosen
before renderer implementation. Grid/list require no core API changes.

## Reading historical evidence

Dated documents/JSON retain their original scope. Old local/candidate/0.16.0
status refers to that verification stage, not current 1.2.0 availability. Use
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
