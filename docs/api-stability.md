# API stabilization before 1.0

Audit date: 2026-10-15. Candidate inspected: da28b52.
The index and cleanup fixes below are implemented in the working tree after
0.6.0; the remaining checklist is proposed policy, not behavior promised by 0.6.0.

## Public boundary

Keep `/playback` (steps, frames, player, timeline, emitter), `/scene` (custom
objects, dispatch, projection), `/array` (optional array operations) and `/canvas`
(optional drawing). Algorithms, domain types, snapshot policy, layout and controls
belong to applications. Do not add algorithm registration or automatic deep cloning.

## Contract audit

| Contract | Current evidence | Remaining work before stability |
| --- | --- | --- |
| Lazy playback | player tests cover on-demand consumption, early closure, final hold and timeline equivalence | Add direct generic tests independent of legacy wrappers |
| Completion | Generic player requires an explicit terminal step; truncated sources throw and close | Document that timeline uses array length, not terminal predicates |
| Disposal | Idempotent closure; advance after disposal throws; last frame remains readable | Preserve this behavior in the public contract |
| Errors | Source and renderer failures close the iterator; invalid deltas do not consume | Primary error preserved during cleanup (fixed after 0.6.0); direct tests include predicate errors |
| Seeking | Timeline clamps finite time, rejects non-finite time and copies the input array | Document shallow ownership: step/state/event objects are retained |
| Step indices | Player and timeline preserve step.index (fixed after 0.6.0) | Regression coverage uses noncontiguous indices |
| Immutability | Emitter freezes wrapper; state/event isolation remains application-owned | Keep this explicit; do not imply deep freezing |
| Scenes | IDs, types, zIndex, progress and missing handlers validated; projector retains two endpoints | Keep stable IDs and state-only projection as documented requirements |
| Distribution | Package consumer exercises exported types and standalone example outside the repo | Retain Windows/Linux and Node 22/24 CI |

## Discrepancies reproduced in 0.6.0 and fixed after it

1. Two steps with indices 10 and 20 at time 50 ms (100 ms per step) produce
   `stepIndex: 20` from createPlayer and `stepIndex: 1` from createTimeline.
   Implemented resolution: preserve the supplied step.index in both. Timeline timing
   continues to depend on array position, not the index value. Equivalence tests cover nonzero/noncontiguous indices, boundaries and final hold.
2. A custom iterator whose next() throws `source failure` and whose return()
   throws `cleanup failure` currently surfaces only the cleanup error.
   Implemented resolution: preserve the primary source/render/predicate error when
   cleaning up after failure. An explicit dispose or otherwise successful terminal
   closure should still surface a cleanup failure. Test construction, advance,
   terminal closure and repeated disposal; cleanup must run at most once.

## Legacy /core

Recommendation: remove the deprecated public entry point in a clearly announced
pre-1.0 breaking release, after internal dependencies and known consumers migrate.
Do not remove it in a patch release or delete the directory blindly.

Order of work:

1. Move array playback adapters and shared types to array-owned modules. Update
   Canvas imports; verify declarations do not require the legacy entry point.
2. Move generic playback contract tests from legacy wrappers to `/playback` or
   `/array`; retain dedicated compatibility tests while `/core` exists.
3. Check known consumers (including the website in its own chat) for `/core` imports.
4. Remove the public export and bundled sorting compatibility implementations in
   the designated breaking release; update package-consumer expectations and notes.

## Release gates

- [x] Preserve source index semantics with regression coverage.
- [x] Preserve primary errors during cleanup with regression coverage.
- [x] Document source lifecycle, termination, time boundaries and snapshot ownership.
- [x] Decouple supported entry points and playback tests from legacy implementation modules.
- [ ] Migrate known consumers, then remove `/core` in a pre-1.0 breaking release.
- [ ] Verify installed-package types, exports and standalone integration in CI.
- [ ] Exercise a pre-1.0 candidate in the website and existing custom examples.
- [ ] Publish 1.0 only after these contracts are settled; no date is assigned yet.

Array adapters now live in /array and Canvas uses array-owned types. Legacy
/core re-exports the adapters; dedicated compatibility and legacy algorithm tests
remain. Generated JavaScript and declarations for supported entry points no longer
reference core modules. Next: verify known consumers before scheduling removal.

## 0.7.0 preparation

The deprecated /core export and bundled compatibility algorithms are removed in
0.7.0. Insertion/bubble invariant tests now exercise application-owned examples.
The package allowlist includes only array, playback, scene and canvas, so stale
local build files cannot reintroduce legacy modules into the tarball. Package
verification checks both their absence and rejection of the removed import.

The website video-tool migration was reported complete in site commit ad05191;
its push and deployment were not confirmed here. Validate the candidate against
that migrated consumer before publishing. This document does not authorize release.
