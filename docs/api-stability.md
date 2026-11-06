# API stabilization before 1.0

Updated 2026-11-06 against published **0.11.2**, release commit
[`b7f46ade478c25738ac77a3023fb4cd6c0b3995e`](https://github.com/urffin/algiviz/commit/b7f46ade478c25738ac77a3023fb4cd6c0b3995e).

The technical recommendations from the export, minimal API, array and Canvas
audits are implemented and released. No remaining finding from these audits
requires an API redesign or a new feature. **1.0 remains deferred**: readiness
for long-term compatibility, a defined support matrix and checks of the actual
future candidate are separate from completion of these technical tasks.
The owner's website and video production are current real-use evidence. External
feedback is welcome when available, but is not a prerequisite for 1.0.
This plan does not authorize a 1.0 release or a website upgrade.

## Readiness of the four modules

“Technically ready” means the reviewed contract is documented and covered by the
checks below. It does not mean 1.0 has been approved or every integration tested.

| Module | Status at 0.11.2 | Scope and evidence |
| --- | --- | --- |
| `/playback` | Technically ready | Lazy explicit steps or plain states, manual/timed controls, timelines and step emission. Completion, indices, disposal and error precedence are covered by [contract tests](../test/playback-contract.test.mjs) and the [completion matrix](../test/playback-completion-matrix.test.mjs). See the [reference](playback.md) and [minimal API audit](minimal-api-audit.md). |
| `/scene` | Technically ready | Backend-independent matching and dispatch, stable IDs, layers, nullable enter/exit endpoints and bounded projection caching. [Scene](../test/scene.test.mjs), [projector](../test/scene-projector.test.mjs) and [object lifecycle](../test/object-lifecycle.test.mjs) tests cover custom types and retained backends. See the [reference](scene.md). |
| `/array` | Technically ready after 0.11.1 | Optional fixed-length numeric trace with one held item. Invalid swap/shift positions preserve identities and state; input markers allow explicit undefined. [Validation regressions](../test/array-validation.test.mjs), strict consumers and [RU/EN guarantees](array.md#array-model-guarantees) close the [array audit](array-api-audit.md) recommendations. |
| `/canvas` | Technically ready after 0.11.2 | Optional array scene adapter and full-frame bitmap renderer. Large-array scaling, paint-state isolation, early progress validation, theme validation and undefined colors are covered by ten [Canvas contract tests](../test/canvas-contract.test.mjs) and strict consumers. [RU/EN documentation](array.md#canvas-rendering) closes the [Canvas audit](canvas-api-audit.md) recommendations. |

The references have linked Russian versions. The audits preserve their original
findings and dated follow-ups; their historical defect descriptions are not a
list of unresolved defects in 0.11.2.

## Compatibility boundary to preserve

- Keep the four ESM entry points. There are 14 runtime names (13 distinct
  functions) and 23 type-only exports, recorded in the [public export audit](public-exports-audit.md).
  There is no root/CommonJS export; `/core` and bundled algorithms were removed
  in 0.7.0. Keep `createSortRenderer` as the identical `createArrayRenderer` alias.
- Algorithms, domain types, immutable snapshot production, layout, controls and
  scheduling belong to the application. New application-owned algorithm examples
  do not change the package API or by themselves require a minor package version.
- Players read their first step/state during construction and invoke the render
  callback immediately when supplied. `nextStep()`
  completes the current transition or requests one next snapshot at a boundary;
  `advance(0)` redraws without reading. Positive timed advancement requires
  `stepDurationMs`; player `finalHoldMs` defaults to zero. Timeline timing stays explicit.
- `createPlayer` requires an explicit terminal predicate; `createArrayPlayer`
  recognizes `done`. `createStatePlayer` detects exhaustion on the following
  request without lookahead. Its final yielded state is not known to be last until
  that request. Preserve the documented difference in `previous` at the final
  boundary; nonzero final holds can require another manual click.
- Explicit-step players and timelines preserve source indices, including
  non-contiguous indices. Plain-state playback numbers states from zero.
  Timelines copy the history array, retain its objects and clamp finite sample
  times; they have no mutable playback cursor.
- Disposal closes the source at most once, preserves the readable frame and
  rejects further advancement. Restart uses a new source. Source, predicate and
  render errors retain precedence over cleanup failures; standalone cleanup
  failures propagate.
- Generic state, event and scene data are retained without deep cloning/freezing.
  The emitter freezes only its step wrapper. Array traces produce immutable
  snapshots; `arrayScene` freezes scene wrappers but retains item references.
- Scene IDs are unique per snapshot and retain their type between endpoints.
  Handlers receive nullable endpoints and raw progress; presence is advisory.
  Handlers are frame draws, not guaranteed lifecycle callbacks. Retained DOM/SVG
  backends must remove stale objects even when intermediate frames are skipped.
- Preserve array item identities, operation/event meanings and counter semantics.
  Sorted-region markers are author annotations, not proof of sorting. Adding a
  public event variant requires compatibility review for exhaustive user switches.
- Canvas palette overrides are copied at construction. Changing the theme or
  palette uses a new renderer and redraws the same frame. Preserve held → active
  → sorted → ordinary-bar priority and the required light/dark theme.

## Verification completed for the current baseline

| Check | Result and evidence |
| --- | --- |
| Build, type checks and tests | `npm test` passed all **127 tests**, including 2186 original array traces, playback completion/lifecycle coverage and ten Canvas regressions. |
| Installed tarball | `npm run test:package` passed. It checks the complete runtime inventory, private/root/`/core` rejection, alias identity, every public type, strict `exactOptionalPropertyTypes`, runtime consumers and compilation of the TypeScript starter. See the [export fixture](../test/package-exports.mjs) and [consumer](../test/package-consumer.ts). |
| Headless separation | The [headless fixture](../test/package-headless.ts) compiles `/playback`, `/scene` and `/array` with ES2022 and no DOM/ambient types. `/canvas` declarations intentionally require DOM types. |
| Exact release CI | [Run 41932170508](https://github.com/urffin/algiviz/actions/runs/41932170508) passed on Windows/Linux with Node 22/24 at `b7f46ad`, including the packed consumer in all four jobs. |
| Release and npm | [v0.11.2](https://github.com/urffin/algiviz/releases/tag/v0.11.2) targets that exact SHA. [Publishing workflow](https://github.com/urffin/algiviz/actions/runs/41932362639) succeeded; npm version 0.11.2, matching `gitHead`, `latest` and provenance were verified on 2026-11-05. |

Additional integration evidence has a narrower scope than the release CI:

- The JavaScript starter passes strict `checkJs`; the TypeScript starter defines
  two custom object types, a lazy source, controls and cleanup. The packed
  consumer compiles it against the installed package.
- Live browser verification of [object lifecycle](../examples/object-lifecycle.html)
  completed on 2026-11-02: enter/update/exit, empty scenes, mixed controls, early
  disposal with preserved drawing, restart and the extra completion request.
- An isolated application outside this repository installed the **published
  0.11.0 registry tarball**, not a local link. Its custom card/heading types and
  retained SVG backend passed browser checks for partial entry/exit, stale-node
  removal, mixed controls, disposal, restart and exhaustion. This was an
  integration authored by us, not feedback from an independent user or a browser
  verification of 0.11.2.
- Native Canvas probes for the 0.11.2 fixes confirmed matching pixels with
  inherited composite/filter/shadow settings, context restoration, rejection of
  invalid progress before pixel changes and preservation of inherited clipping.
  These complement the mock-based regressions; they do not certify browsers or FPS.
- On 2026-11-06 the owner reported that adding the latest video visualizations
  required no library API changes. This supports the application-owned algorithm
  and visualization boundary in actual use. It is owner-reported evidence, not
  a new website-version, browser or video-pipeline verification in this chat.

Independent usage is currently unknown. Finding additional users and collecting
their reviews is optional; it does not block stabilization or replace the
existing integration evidence.

The current release's successful CI does not certify a later 1.0 candidate.

## Deliberate limits and deferred work

- Iteration is synchronous. There is no AsyncIterable, worker execution, RAF
  scheduler or automatic cap on elapsed time. Long generation or large advance
  calls can block the host; applications control scheduling and elapsed time.
- Generator playback retains adjacent snapshots, but snapshot creation and
  application-owned data still cost memory/time. Each array emission copies n
  slots; full history deliberately retains every snapshot. The two-endpoint
  projector cache requires pure projections and immutable inputs; mutation does
  not invalidate it.
- `/array` supports finite numbers, fixed length and at most one held item.
  IDs are trace-local; applications namespace combined traces. Dynamic length,
  arbitrary value types and multiple held items are not promised by this model.
- `/canvas` uses bitmap coordinates and an identity transform. The application
  owns CSS/bitmap sizing and DPR and provides a context without restricting clip.
  Only the documented paint settings are normalized. Invalid color strings are
  delegated to Canvas; arbitrary handwritten snapshots are not fully validated.
  Restoring context settings does not roll back pixels after a drawing error.
- Scene indexing uses O(n) additional memory and layer ordering O(n log n) time
  per frame. Removing the large-array argument-count failure is not a performance
  guarantee. Earlier heap/mock-Canvas measurements remain diagnostics described
  in [performance](performance.md), not browser FPS or portable thresholds.
- Highlight membership and per-frame dispatcher allocation remain optional
  optimization candidates. Benchmark a concrete workload before changing them.
  Automatic controllers, localization/formatting options, configurable easing
  and pixel-perfect output guarantees are not prerequisites for 1.0.
- CI verifies Node 22/24 and emitted ES2022 code; it does not establish support
  for every browser, TypeScript version or Node release. Any broader support
  promise needs its own scope and evidence. The [support matrix](support-matrix.md)
  separates current checks, proposed coverage and remaining verification.
- Website upgrades and compatibility checks remain deferred by the user and
  belong in the website chat. They are not silently added to this release plan.

## What remains before 1.0, in order

1. **Define and verify the support matrix.** Use the [matrix](support-matrix.md)
   to record Node, TypeScript and browser versions, module-resolution modes and
   actual results. Distinguish the library runtime from repository tooling and
   standalone-demo requirements. Confirm proposed targets before advertising them.
2. **Make an explicit compatibility decision.** Review the four module contracts
   and deliberate limits above, use the owner's website/video experience and the
   completed integrations to assess authoring friction, and decide whether to
   support these APIs long-term within the verified support scope.
   Resolve any blocking findings first; otherwise continue compatible 0.x patches.
   External feedback can inform this decision when available; waiting for new
   users, a fixed number of reviews or additional algorithm examples is not required.
   There is no scheduled 1.0 date or automatic promotion after a patch release.
3. **Verify an authorized 1.0 candidate.** Update version/lockfile/changelog,
   run `npm test` and `npm run test:package`, and require successful CI on that
   exact SHA. Perform focused browser checks of minimal playback, object lifecycle
   and Canvas palette/context behavior within the chosen browser support scope.
   Record the actual versions and results; older browser checks are not new ones.
4. **Publish only with explicit authorization.** Use the GitHub Release workflow
   for the checked SHA, then verify npm's exact version, `latest` and provenance.
   Website work remains separately authorized and coordinated in its own chat.

The next preparation step is verifying the proposed support matrix.
No unresolved required code change is identified by the completed audits.
