# API stabilization before 1.0

Updated 2026-11-05 for 0.11.1; the original review used 0.11.0 (4f0f9cc).
This is a preparation plan, not authorization to publish 1.0.

Decision on 2026-10-26: defer 1.0 and release the compatible changes as 0.8.1.
Continue validating the API through new application-owned visualizations before
committing to long-term compatibility. New examples alone do not require a minor
package version. The checks below remain preparation criteria, not a release date.

## Public boundary

Keep `/playback`, `/scene`, `/array` and `/canvas`. Algorithms, domain types,
snapshot ownership, layout and browser controls remain application-owned.
The deprecated `/core` export and bundled algorithms were removed in 0.7.0.
No algorithm registration or automatic deep cloning is needed.

## Contracts to preserve

| Area | Current contract and evidence |
| --- | --- |
| Playback | Synchronous lazy iteration; adjacent snapshots retained. createPlayer requires an explicit terminal predicate; createStatePlayer detects exhaustion on the following request without lookahead. |
| Controls | nextStep completes one transition; advance(0) redraws. Positive timed advance requires stepDurationMs; finalHoldMs defaults to zero for players. Timeline timing remains explicit. |
| Timeline | Copies the step array, retains its objects; timing uses array position; finite sample times are clamped. Completion uses history length, with no terminal predicate. |
| Indices | Explicit-step player and timeline preserve source step.index (including 10, 25, 90). createStatePlayer numbers states from zero. The emitter provides consecutive indices for explicit steps. |
| Lifecycle | Dispose closes at most once, leaves the frame readable and rejects further advancement. Restart creates a fresh source. |
| Errors | Source, predicate and render errors survive cleanup failures; standalone cleanup failures propagate. Covered by playback-contract tests. |
| Ownership | Generic states/events are not cloned or frozen. The emitter freezes only the step wrapper. Array operations produce immutable snapshots. |
| Scenes | Stable unique IDs, fixed type per ID, layer ordering, explicit enter/update/exit transitions. Handlers are frame draws, not lifecycle callbacks. |
| Projection | Pure state-to-scene mapping with at most two endpoint projections retained; viewport geometry stays in handlers. |
| Palette | Six semantic array colors; partial overrides copied at renderer creation. Theme changes redraw the same frame with a new renderer. |
| Packaging | Four ESM entry points, no root/CommonJS export; packed consumer checks declarations and absence of /core. |

## Completed preparation

- Standalone JavaScript starter passes strict checkJs.
- Complete TypeScript starter has two object types, lazy source, controls and cleanup.
- Packed consumer compiles the TypeScript starter against the installed tarball.
- 105 tests and the packed-consumer check passed for 0.11.0; its exact release SHA passed CI.
- nextStep, optional timing and createStatePlayer were validated on circles,
  graphs, finite/infinite sources, cleanup and manual/timed playback.
- Website update to 0.8.0 was reported complete by the user; site work stays in its chat.
- CI configuration covers Windows/Linux and Node 22/24. Local validation does not
  replace a successful CI run on a future release candidate.

## Performance evidence and limits

On this machine, 2,000-element reverse inputs retained roughly 5.7-5.9 MiB of
Node heap after explicit GC between 5,000 and 25,000 generator steps. This includes
the process and is diagnostic, not a universal memory bound. Ownership inspection
confirms adjacent player states and a two-endpoint projector cache.

Merge rendering of two 2,000-cell rows fell from about 10.9 to 7.2 ms per frame
in the CPU-only mock Canvas benchmark after batching Canvas state scopes and
per-frame geometry. Visible draw calls matched for 6,840 frames with reverse seeks,
multiple widths, duplicate and signed values. These figures are not browser FPS.

Generator mode avoids accumulated history but still pays snapshot allocation and
synchronous generation costs. Large advance calls can block the host; applications
should cap elapsed time. Full history intentionally retains snapshots. No worker,
async source or automatic scheduling guarantee is proposed for 1.0.

## Remaining release gates, in order

Follow-up on 2026-11-02: object-lifecycle.html covers enter/update/exit, empty scenes,
mixed controls and early disposal. playback-completion-matrix.test.mjs now compares
timed frames and manual completion with final holds of 0 and 75 ms, including
endpoint references, non-contiguous source indices, redraw, closure and repeated calls.
The installed-package headless fixture now explicitly covers createStatePlayer,
nextStep, omitted timing and undefined events with exactOptionalPropertyTypes.
No public declaration or runtime change was required by this follow-up.

Visual browser verification completed on 2026-11-02: enter/exit, mixed controls,
early disposal with preserved drawing, restart, empty scenes and the extra completion
request were checked in the live object-lifecycle page, with no browser errors.

An isolated consumer outside the repository installed the published 0.11.0 registry
tarball (not a local link). It defines application-owned card/heading types, projects
domain states into scenes and renders retained SVG nodes using only /playback and
/scene. Browser checks passed for partial enter/exit, mixed controls, removal of stale
SVG nodes, disposal, restart and exhaustion. SVG markup was identical before/after
early disposal. This validates an isolated application, not independent-user feedback.
Website integration remains deferred by the user; no site change was made.

The [public export audit](public-exports-audit.md) records the inventory and
recommended compatibility decisions. Declaration cleanup shipped in 0.8.1;
createStatePlayer extends the inventory in 0.11.0. The [minimal API audit](minimal-api-audit.md)
records completed simplifications and the next independent visualization check.
Candidate CI and consumer integration checks remain release gates.

1. Completed: declaration/export review. Keep the four entry points and identical
   createSortRenderer compatibility alias; no required runtime change was found.
   Follow-up: the [array API audit](array-api-audit.md) found a JavaScript argument
   validation defect in swap/shift with held. The 0.11.1 fix, prepared on 2026-11-03,
   validates both indices and adds conservation/atomicity regressions. SortedRegions
   also accepts explicit undefined in the input type. Valid-call signatures need no redesign;
   verification of the exact future release candidate remains required.
   The array reference now documents fixed length, one held item, trace-local IDs,
   immutable snapshots, counters and sorted-region markers in English and Russian.
   Local 0.11.1 checks passed all 117 tests and the installed-package consumer.
   The [canvas API audit](canvas-api-audit.md), completed on 2026-11-05 against
   0.11.1, recommends replacing a spread-based maximum that fails on large valid
   arrays, defining Canvas context isolation, validating progress before drawing,
   accepting colors: undefined in input types and rejecting invalid themes.
   The working fix on 2026-11-05 addresses these recommendations without changing
   exports, adds ten Canvas contract regressions and documents the RU/EN behavior.
   All 127 tests and the installed-package consumer passed; native Canvas probes
   confirmed pixel equality and context restoration. Candidate CI remains required.
2. Completed: contract reconciliation and coverage. 113 tests, packed consumers
   and CI passed at 59172ea; completion boundaries and state-player types are covered.
3. Completed: live custom-object example and isolated published-package SVG consumer.
   Website validation stays deferred and belongs in the website chat.
4. Before any stabilization release, explicitly decide whether the current contracts
   are ready for long-term support. No further feature is required by this audit;
   feedback from actual external users has not been collected.
5. After a release is authorized, run tests/packed-consumer checks and verify CI for
   that exact candidate. Publish 1.0 only on explicit user authorization.

A browser controller may be considered later if independent integrations reveal
repeated needs. The new starter alone does not justify expanding the package API.
