# Current API and verification status

[Русский](ru/current-api.md) · [Compatibility](api-compatibility.md) · [Environments](support-matrix.md#current-support-boundary) · [1.1 release](release-1.1.md)

**Released 2026-11-17.** The release baseline is **1.1.0** from
629defe2eb570034ea368d736c1e5fdf74ea3502. All ten entries, including /graph and
/canvas/graph, are published. The release metadata at that stage was 1.1.0.
The [release receipt](releases/1.1.0.json) records successful exact-SHA CI and
publication, fresh exact-version/latest lookup, installation and provenance.
This documentation closure reuses the completed release task's observations.
The working copy additionally implements unpublished /tree and /canvas/tree:
**12 local entries, 27 runtime names, 128 type-only exports (116 distinct)**,
in the unpublished [1.2.0 candidate](candidate-1.2.md). Package and both lockfile
root versions are now 1.2.0.

F1/F2, U1/U2/U5, stepSource/isTerminal and done({ result }) have been released
since 1.0.0. The original eight implementations/export records are unchanged in
1.1.0; existing imports need no migration. Graph imports require 1.1.0.

## Published surface and future design

| Scope | Current status |
| --- | --- |
| Release baseline | 1.1.0: 10 entries, 24 runtime names, 95 type-only exports, 83 distinct types |
| /graph | Published: createGraphTrace, graphScene and 22 types; fixed topology, IDs, marks, captions, results and atomic validation |
| /canvas/graph | Published: createGraphRenderer and 4 types; arrows, loops, parallel lanes, interpolation, results and captions |
| BFS | Two repository examples, [detailed](../examples/graph.html) and [stock](../examples/graph-player.html); no algorithm package export |
| /tree | [Implemented locally, unpublished](tree-api.md): createTreeTrace, treeScene and 29 types; atomic topology edit, explicit layout, ordered/binary slots and retirement |
| /canvas/tree | [Implemented locally, unpublished](tree-canvas-api.md): createTreeRenderer and four types; ordered/binary layout, empty slots, attached relation crossfades, captions and green result. [T1 is closed](tree-readiness-1.2.md) with full painted-square safety bounds |
| Tree examples | [Stock insertion/rotation and Player](../examples/tree-player.html), plus the preserved [custom traversal](../examples/tree.html) |
| Grid/list | [Grid](grid-contract.md) and [list](linked-list-contract.md) architecture sketches only; no entries |

## Entry reference map: ten published paths

| Entry | Reference | Status |
| --- | --- | --- |
| /playback | [Playback](playback.md), [rewind](rewind-buffer.md), [async](async-source-api.md) | 1.0.0; unchanged in 1.1.0 |
| /scene | [Scene](scene.md) | 1.0.0; unchanged in 1.1.0 |
| /array | [Array](array.md), [result](array-result.md) | 1.0.0; unchanged in 1.1.0 |
| /canvas | [Array Canvas](array.md#canvas-rendering) | 1.0.0; unchanged in 1.1.0 |
| /canvas/viewport | [Viewport](canvas-viewport.md) | 1.0.0; unchanged in 1.1.0 |
| /player | [Player](player.md), [explicit steps](player-step-source.md), [async](player-async-api.md), [Worker](player-worker.md) | 1.0.0; unchanged in 1.1.0 |
| /worker | [Worker source](worker-source-api.md) | 1.0.0; unchanged in 1.1.0 |
| /worker/runtime | [Worker endpoint](worker-source-api.md#worker-declarations-workerruntime) | 1.0.0; unchanged in 1.1.0 |
| /graph | [Graph API](graph-api.md), [captions](graph-node-captions.md) | 1.1.0; released |
| /canvas/graph | [Renderer](graph-api.md), [placement](graph-node-captions.md) | 1.1.0; released |

## Verification and next work

All [11 CI jobs](https://github.com/urffin/algiviz/actions/runs/44164521486) passed
on the released SHA. The [publish workflow](https://github.com/urffin/algiviz/actions/runs/44165469767)
succeeded; npm exact 1.1.0/latest, a fresh install, all 86 dist files and
cryptographic registry signature/provenance were verified. The [receipt](releases/1.1.0.json)
records counts and limits; implementation/native evidence remains historical.

The 1.1 release gates are complete. Local [tree](tree-api.md) and [tree Canvas](tree-canvas-api.md)
are checked separately, including native Canvas. The [stock insertion/rotation example](../examples/tree-player.html)
is added alongside custom traversal. The [1.2.0 review](tree-readiness-1.2.md) is complete:
[T1 is corrected](checks/tree-t1-fix-2026-11-19.json), and affected Canvas/example
acceptance is refreshed. The [1.2.0 candidate](candidate-1.2.md) records local
preparation and archive verification. All 11 jobs must pass on its final commit
before a separately authorized release; 1.2.0 is unpublished.
The candidate/readiness documents retain their preceding preparation scope.

## Reading historical evidence

Dated documents/JSON retain their original scope. Old local/candidate/0.16.0
status refers to that verification stage, not current 1.1.0 availability. Use
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
