# Current API and verification status

[Русский](ru/current-api.md) · [Compatibility](api-compatibility.md) · [Environments](support-matrix.md#current-support-boundary) · [1.7.0 release notes](release-1.7.md)

**Version 1.7.0** has 16 entry points, 34 runtime exports and 190 type-only
exports (178 distinct names). It adds `stepHistory` through a constructor
overload with `PlayerStepHistoryOptions`. `PlayerOptions` retains its four
source branches.

The [1.6.0 publication receipt](releases/1.6.0.json) records verification for
the previous release.

## Entry reference map

| Entry | Reference | Status/first version |
| --- | --- | --- |
| /playback | [Playback](playback.md), [rewind](rewind-buffer.md), [async](async-source-api.md) | 1.0.0 |
| /scene | [Scene](scene.md) | 1.0.0 |
| /array | [Array](array.md), [result](array-result.md) | 1.0.0 |
| /canvas | [Array Canvas](array.md#canvas-rendering), [item labels](array.md#custom-item-labels) | 1.0.0, item labels since 1.6.0 |
| /canvas/viewport | [Viewport](canvas-viewport.md) | 1.0.0 |
| /player | [Player](player.md), [explicit steps](player-step-source.md), [full step history](player.md#full-history-of-steps), [async](player-async-api.md), [Worker](player-worker.md) | 1.0.0, `stepHistory` since 1.7.0 |
| /worker | [Worker source](worker-source-api.md) | 1.0.0 |
| /worker/runtime | [Worker endpoint](worker-source-api.md#worker-declarations-workerruntime) | 1.0.0 |
| /graph | [Graph API](graph-api.md), [dynamic topology](graph-dynamic-topology.md), [captions](graph-node-captions.md) | 1.1.0, dynamic edits since 1.5.0 |
| /canvas/graph | [Renderer](graph-api.md), [transitions](graph-dynamic-canvas.md), [placement](graph-node-captions.md) | 1.1.0, opt-in topology transitions since 1.5.0 |
| /tree | [Tree API](tree-api.md) | 1.2.0 |
| /canvas/tree | [Tree Canvas](tree-canvas-api.md) | 1.2.0 |
| /grid | [Grid API](grid-api.md) | 1.3.0 |
| /canvas/grid | [Grid Canvas](grid-canvas-api.md) | 1.3.0 |
| /list | [List API](list-api.md) | 1.4.0 |
| /canvas/list | [List Canvas](list-canvas-api.md) | 1.4.0 |

## Example and verification

The [heap sort example](examples.md#heap-sort-with-player) uses `stepHistory`
to seek through synchronized array and tree snapshots. The [1.7.0 readiness
review](readiness-1.7.md) records the example and compatibility checks.

## Reading historical evidence

Dated documents/JSON retain their original scope. Old local/candidate/0.16.0
status refers to that verification stage. For the API contract of 1.7.0, use
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
