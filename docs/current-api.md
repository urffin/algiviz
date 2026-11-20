# Current API and verification status

[Русский](ru/current-api.md) · [Compatibility](api-compatibility.md) · [Environments](support-matrix.md#current-support-boundary) · [1.3.0 release/migration](release-1.3.md) · [1.3.1 patch](release-1.3.1.md)

**Package version 1.3.1; API unchanged from 1.3.0:** 14 entries, 30 runtime names, 155 type-only exports
(143 distinct). /grid adds createGridTrace, gridScene and 22 types;
/canvas/grid adds createGridRenderer and five types. The twelve existing entries
are unchanged and need no migration. Grid imports require 1.3.0 or newer.

The functional release baseline is **1.3.0 / 90b26f8**. All eleven CI jobs,
publication, exact/latest, fresh installation, signature, provenance and README
were verified; [release notes](release-1.3.md) and the [receipt](releases/1.3.0.json)
record the facts. Documentation patch **1.3.1 / d61829d** is also published
and verified: all eleven CI jobs, exact/latest, fresh installation, signature/
provenance and README. [Patch notes](release-1.3.1.md) · [Actual receipt](releases/1.3.1.json).

## Entry reference map: fourteen paths

| Entry | Reference | Status/first version |
| --- | --- | --- |
| /playback | [Playback](playback.md), [rewind](rewind-buffer.md), [async](async-source-api.md) | 1.0.0; unchanged in 1.3.1 |
| /scene | [Scene](scene.md) | 1.0.0; unchanged in 1.3.1 |
| /array | [Array](array.md), [result](array-result.md) | 1.0.0; unchanged in 1.3.1 |
| /canvas | [Array Canvas](array.md#canvas-rendering) | 1.0.0; unchanged in 1.3.1 |
| /canvas/viewport | [Viewport](canvas-viewport.md) | 1.0.0; unchanged in 1.3.1 |
| /player | [Player](player.md), [explicit steps](player-step-source.md), [async](player-async-api.md), [Worker](player-worker.md) | 1.0.0; unchanged in 1.3.1 |
| /worker | [Worker source](worker-source-api.md) | 1.0.0; unchanged in 1.3.1 |
| /worker/runtime | [Worker endpoint](worker-source-api.md#worker-declarations-workerruntime) | 1.0.0; unchanged in 1.3.1 |
| /graph | [Graph API](graph-api.md), [captions](graph-node-captions.md) | 1.1.0; released |
| /canvas/graph | [Renderer](graph-api.md), [placement](graph-node-captions.md) | 1.1.0; released |
| /tree | [Tree API](tree-api.md) | 1.2.0; released |
| /canvas/tree | [Tree Canvas](tree-canvas-api.md) | 1.2.0; released |
| /grid | [Grid API](grid-api.md) | 1.3.0 |
| /canvas/grid | [Grid Canvas](grid-canvas-api.md) | 1.3.0 |

## Examples and verification

The separate [Grid BFS](examples.md#grid-bfs-shortest-path) uses /grid,
/canvas/grid and Player for distances, a green shortest path, history/bounded
rewind and Restart. The earlier maze, custom/stock graph BFS and both tree pages
remain separate. Application algorithms are not exports or npm-shipped files.

The [readiness review](grid-readiness-1.3.md) covers R0 and documentation D1/D2.
[Candidate preparation](checks/candidate-1.3.0-2026-11-20.json) records R1/R2:
version/lockfile, exact archive, fresh tests/installed consumers/bundles,
packaged EN/RU README/changelog checks and native evidence identity.
The earlier [18 renderer](checks/grid-canvas-browser-2026-11-20.json) and
[23 BFS UI checks](checks/grid-player-example-2026-11-20.json) are reused for
unchanged runtime; the HTML changes only version text. Old reports are not
rewritten as fresh runs. Browser support is not expanded.

R3 and R4 for 1.3.0 are complete: [all eleven jobs](https://github.com/urffin/algiviz/actions/runs/44642599848)
on the exact SHA and the [publication receipt](releases/1.3.0.json). These results
do not automatically certify later versions. Linked-list support remains an
architecture sketch, not an entry.

## Reading historical evidence

Dated documents/JSON retain their original scope. Old local/candidate/0.16.0
status refers to that verification stage, not the API contract of 1.3.0. Use
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
