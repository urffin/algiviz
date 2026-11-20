# API stabilization before 1.0

**Post-release status:** 1.0.0 is published; stepSource, array results, F1/F2
and U1–U5 are part of the stable API since 1.0.0. [Current index](current-api.md)
describes 1.3.1. The earlier verification stages and their original limits
follow as historical evidence; old pending release items do not describe current
availability.

**Core review, 2026-11-16:** [all four future model sketches fit](core-readiness-1.0.md)
without core changes. The [1.0.0 documentation candidate](candidate-1.0.md)
76f76ed is in origin with all 11 CI jobs successful. Its remaining native G3
scope passes [133 checks](checks/candidate-1.0.0-g3-76f76ed-2026-11-16.json), alongside
the retained 26-check stepSource/result/control scope on the identical payload.
The evidence/status docs follow their own commit and exact-SHA CI; publication
is separately authorized.
Earlier review/status sections retain their stage scope.

**Post-F2 readiness recheck, 2026-11-14:** all eight entries are ready locally,
with no known technical blocker or unresolved API clarification in the reviewed
boundary. [Current assessment](api-readiness-1.0.md) and [fresh evidence](checks/api-readiness-1.0-after-f2-2026-11-14.json)
verify the closed F1/F2 and U1–U5 status. G1–G3 candidate definition/verification
and separately authorized publication remain. API, implementation and version
are unchanged by this recheck; this is not a release approval.

**Current U3/U4 status, 2026-11-14:** the [eight-entry status index](current-api.md)
separates published 0.16.0 from local F1/U1/U2 and the historical reports. U4 is
closed as documentation reconciliation; [U5 now selects original post throws](worker-post-errors.md).
Permanent U5 regressions pass locally; the subsequently found F2 is now fixed. The [common compatibility policy](api-compatibility.md)
([Русский](ru/api-compatibility.md)) now defines the intended 1.x guarantees,
error/type/environment boundaries and 0.x/1.x change rules. This documentation
decision changes no implementation and authorizes no release. F1/U1/U2 remain
implemented locally, unreleased; actual candidate verification remains.
The dated four-module/release evidence below is history within its stated scope,
not a different policy for optional modules. U3 evidence is in the
[policy report](checks/u3-compatibility-policy-2026-11-14.json).

U5 follow-up: all **503 tests** pass, including **75 permanent public regressions**
also run against the installed archive with strict NodeNext/Bundler consumers.
Identity, init/pull/cancel, getter phases, primary/late/cleanup priority and
transport/async/Player reports are covered without production changes. See
[regression evidence](checks/u5-post-errors-regressions-2026-11-14.json).

## Historical release context and follow-ups

The following dated records describe their release/stage, not a new check of the
working tree. The original four modules had the **0.11.2** baseline, release commit
[`b7f46ade478c25738ac77a3023fb4cd6c0b3995e`](https://github.com/urffin/algiviz/commit/b7f46ade478c25738ac77a3023fb4cd6c0b3995e).
Repository verification now includes
[`273b292`](https://github.com/urffin/algiviz/commit/273b292a6fa01dfaeb1717b6bbb7a4b149b4e6c9)
with Boids, falling sand and the shared demo controller. Those demos leave the
four baseline module contracts unchanged; 0.12.0 adds the optional UI below.

The optional-player prototype was committed at `12f8fb3`; implementation commit
`fa22032` adds the **0.12.0 `/player`** entry point and passed all eleven
[CI jobs](https://github.com/urffin/algiviz/actions/runs/43203994982). Its
[contract](player.md), [bundle checks](player-bundle-check.md) and new DOM types
are additional to the four-module published baseline below. They do not reopen
closed core findings or authorize publication; the new contract and exact-commit
CI need their own review before release.

Canvas viewport follow-up: prototype `7ba76ba` passed all 182 tests and eleven
[CI jobs](https://github.com/urffin/algiviz/actions/runs/43219455052). Its
[accepted contract](canvas-viewport.md) selects the independent `/canvas/viewport`
entry, one runtime factory and three types. The repository implements that entry
for 0.13.0, which now publishes all six entries. Twelve native visibility checks passed at
DPR 1. On 2026-11-13 desktop Chrome real zoom checks also passed through DPR 2.5,
with caps, unchanged source reads and restoration of the original scale. Those
native checks were repeated against the compiled public entry at `a05bd48`: five
twelve-case runs passed. Implementation [CI](https://github.com/urffin/algiviz/actions/runs/43323095050)
also passed all eleven jobs. The [0.13.0 release](https://github.com/urffin/algiviz/releases/tag/v0.13.0)
at `443892c` passed its exact-commit CI, publishing workflow, registry provenance
and signatures, fresh-install runtime and type checks. That release stage is
closed. The real-example profiling baseline is now recorded in the
[report](performance-baseline-0.13.0.md); it identifies a bounded matching-cache
experiment without changing the public API or starting implementation. See the
[plan](optional-player-proposal.md#current-profiling-stage). Existing `/canvas` keeps
bitmap coordinates; no compatibility decision for 1.0 is implied.

The technical recommendations from the export, minimal API, array and Canvas
audits are implemented and released. No remaining finding from these audits
requires an API redesign or a new feature. **1.0 remains deferred**: readiness
for long-term compatibility and checks of the actual future candidate are
separate from completion of these technical tasks. The current support boundary
is recorded in the [matrix](support-matrix.md#current-support-boundary).
The owner's website and video production are current real-use evidence. External
feedback is welcome when available, but is not a prerequisite for 1.0.
This plan does not authorize a 1.0 release or a website upgrade.

0.14.0 bounded-navigation follow-up: `/playback` adds `createRewindBuffer`
and `RewindBuffer<T>` as a separate synchronous-value adapter. Its
[contract](rewind-buffer.md) records capacity, replay/history loss, exhaustion
and source ownership. `/player` now optionally integrates it through
`rewindCapacity` with Previous controls and window status. Existing forward-only
playback and the published 0.13.0 contracts are unchanged. This addition requires its own compatibility
review before any long-term API promise.

0.14.0 publication follow-up: [release](https://github.com/urffin/algiviz/releases/tag/v0.14.0)
`3e5bc02` passed all eleven exact-commit CI jobs and the publishing workflow.
npm/latest, source/digest provenance, registry signature/attestation and a fresh
registry installation were verified. That release published
17 runtime names and 30 type-only names across the same six entries.
See [verification data](releases/0.14.0.json). This closes 0.14.0 publication;
the deliberate 1.0 compatibility decision below remains open.

0.15.0 publication follow-up: `/playback` now additionally exports
`createAsyncSource` and five types in the published package (18 runtime names and
36 type-only names across the same six entries, including PlayerCloseResult). The [adapter contract and
local checks](async-source-api.md) cover lazy async iteration and cleanup;
existing playback engines remain synchronous. The separate [widget integration](player-async-api.md)
now supports asyncSource with waiting/control/cleanup contracts. Release
`c0fa843` passed all eleven CI jobs, publication, npm/latest provenance, fresh
registry consumers, signature and attestation checks. All 56 published build
files match after CRLF/LF normalization. See [verification data](releases/0.15.0.json).
The long-term 1.0 compatibility decision remains separate.

2026-11-14 Worker follow-up: the [behavioral contract](worker-source.md)
([Русский](ru/worker-source.md)) specifies an optional transport over the existing
asyncSource boundary. The 0.16.0 release adds two optional entries while
preserving the existing six entries and support boundary. The separate [public API/type design](worker-source-api.md)
([Русский](ru/worker-source-api.md)) now selects /worker and /worker/runtime,
compatible factories, transfer, errors and shutdown reports. The entries and
[Player integration](player-worker.md) are implemented and verified for 0.16.0.
The existing asyncSource boundary needs no Player/core changes. Current checks
include 304 repository tests and 25 native Player/Worker checks, in addition to
the standalone adapter evidence. All eleven exact-commit CI jobs, publication,
fresh registry consumers and signature/provenance checks passed; all 68 published
build files match after newline normalization. See [release verification](releases/0.16.0.json).
Worker transport is not a prerequisite for 1.0.

## U2 implemented locally, 2026-11-14

The [selected U2 contract](player-speed-validation.md)
([Русский](ru/player-speed-validation.md)) accepts primitive finite positive
numbers and selects built-in RangeError for all invalid values across
source/history/asyncSource/Worker, without coercion. Value validation precedes
disposal/reentrancy checks and has no effects when rejected. Accepted changes
retain pending playback time and intent, reset the wall-clock baseline and
remain usable during async preparation/waiting/cleanup. The document defines
lifecycle/error precedence and implementation acceptance cases.

The async controller now uses RangeError; the synchronous controller already
satisfied U2. All 428 repository tests pass, including 55 new public U2 cases
also checked against the installed archive with strict NodeNext/Bundler consumers.
Tests cover invalid runtime types, caught/uncaught callbacks, disposal ordering,
waiting/preparation/cleanup, clock baselines and bounded-work debt. Worker cases
use the real adapter/endpoint with an in-process cloned-message transport.
No public declarations, exports, version or dependencies change. See
[implementation evidence](checks/u2-speed-implementation-2026-11-14.json).
The [design evidence](checks/u2-speed-contract-2026-11-14.json) remains a historical
before-implementation snapshot. U3/U5 are selected, U4 reconciled and U5 regressions pass; the release
readiness decision remain open; publication remains deferred.

## U1 implemented locally, 2026-11-14

The selected [U1 contract](headless-reentrancy.md) ([Русский](ru/headless-reentrancy.md))
is implemented locally, unreleased. Same-instance commands are rejected before
mutation; frame reads, other instances and repeated dispose after logical stop
retain their defined behavior. A private plain-state adapter lets the engine
latch disposal before source cleanup. All 373 tests passed, including 61 new U1
cases. Public declarations/signatures are unchanged; only the private state-steps
declaration changes. See [implementation evidence](checks/u1-reentrancy-2026-11-14.json).
The earlier design record below is retained as history; no version/publication
change is implied. U2 is now implemented and U3 selected as described above;
U5 is selected and permanently covered locally; release readiness remains; U4 is reconciled.

## Historical U1 headless reentrancy decision, 2026-11-14

The [selected U1 contract](headless-reentrancy.md) ([Русский](ru/headless-reentrancy.md))
selects synchronous rejection of commands reentered on the same active headless instance, while
allowing reads, other idle instances and idempotent disposal after logical stop.
The document defines cleanup/error precedence and the future acceptance matrix.
This is a design decision, not implemented enforcement or a publication. U1 is
no longer undecided: /playback and /array now require the selected guard behavior
to be implemented/verified before treating that contract as available.

## F1 fix follow-up, 2026-11-14

The owner-authorized shared Memory fix is implemented locally, unreleased, with
no public API/version change. The common validator checks the native Memory
backing store, including foreign realms and nested data. All 312 tests, installed
NodeNext/Bundler consumers and 32 public Worker cases passed. Six native Worker
checks confirm rejection in both directions and preserved copy/transfer. See the
[review follow-up](api-readiness-0.16.0.md) and [native report](checks/worker-memory-fix-browser-2026-11-14.json).
The original review below describes published 0.16.0; it is retained as history.

## Historical eight-entry API review, 2026-11-14

The [0.16.0 API readiness review](api-readiness-0.16.0.md) now covers all eight
public entries and supersedes the earlier four-module-only readiness assessment
for the next 1.0 decision. Three entries are ready within their documented
boundary, three need contract clarification and the two Worker entries require
implementation changes. Shared WebAssembly.Memory bypasses the shared-memory
rejection in both directions (confirmed with native Workers). Host postMessage
exceptions expose a separate ambiguity between identity preservation and
WorkerSourceError normalization; this is a contract clarification.

The review additionally records headless callback reentrancy, source-dependent
Player speed error classes, compatibility policy and stale documentation as
clarifications. It changes no production API, version or dependencies and does
not publish or start fixes. Address the confirmed isolation finding before
deciding that the complete API is ready for 1.0; the historical checks below remain evidence for
their stated scope, not a denial of the new findings.

## Historical readiness of the four modules

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

This section records the historical four-module baseline and later additions.
The [U3 policy](api-compatibility.md) now applies equally to all eight entries;
historical export counts below do not redefine the current inventory.

- Keep the four baseline ESM entry points. There are 14 runtime names (13 distinct
  functions) and 23 type-only exports, recorded in the [public export audit](public-exports-audit.md).
  There is no root/CommonJS export; `/core` and bundled algorithms were removed
  in 0.7.0. Keep `createSortRenderer` as the identical `createArrayRenderer` alias.
  The 0.12.0 `/player` adds only `Player` and three type-only names, for
  totals of 15 runtime names / 26 type-only names. Existing entry points do not
  import it. See the [player reference](player.md).
  The 0.13.0 `/canvas/viewport` adds one factory and three types (16 runtime
  names / 29 type-only names), with no re-exports through existing modules.
- Algorithms, domain types, immutable snapshot production and layout belong to
  the application. Controls/scheduling can be application-owned or delegated to
  the optional browser widget; headless playback has no mandatory DOM/RAF layer.
  New application-owned algorithm examples
  do not change the package API or by themselves require a minor package version.
- Headless players read their first step/state during construction and invoke the render
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

## Historical verification of the four-module baseline

| Check | Result and evidence |
| --- | --- |
| Build, type checks and tests | The published baseline passed **127 tests**. The repository now passes **145 tests**, including eight Boids tests, nine sand tests and one additional shared-controller timing case. Existing coverage includes 2186 original array traces, playback completion/lifecycle and ten Canvas regressions. |
| Installed tarball | `npm run test:package` passed. It checks the complete runtime inventory, private/root/`/core` rejection, alias identity, every public type, strict `exactOptionalPropertyTypes`, runtime consumers and compilation of the TypeScript starter. See the [export fixture](../test/package-exports.mjs) and [consumer](../test/package-consumer.ts). |
| Headless separation | The [headless fixture](../test/package-headless.ts) compiles `/playback`, `/scene` and `/array` with ES2022 and no DOM/ambient types. `/canvas` declarations intentionally require DOM types. |
| Exact release CI | [Run 41932170508](https://github.com/urffin/algiviz/actions/runs/41932170508) passed on Windows/Linux with Node 22/24 at `b7f46ad`, including the packed consumer in all four jobs. |
| Expanded compatibility CI | [Run 42171367290](https://github.com/urffin/algiviz/actions/runs/42171367290) passed at `b2d6c62` on 2026-11-06: six Node 22/24/26 jobs on Windows/Linux and four TypeScript 5.0.4/5.4.5/5.9.3/6.0.3 consumer jobs on Ubuntu/Node 24. See the [support matrix](support-matrix.md) for exact scope. |
| Latest repository CI | [Run 43163212052](https://github.com/urffin/algiviz/actions/runs/43163212052) passed all ten jobs at `273b292` on 2026-11-12: the 145-test suite and packed consumer on six Node/OS targets, plus all four TypeScript consumer jobs. This includes the committed examples and controller changes; it is not a new npm release. |
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
- A further [embedded-browser check on 2026-11-06](browser-checks-2026-11-06.md)
  passed six smoke groups and the interactive minimal walkthrough on reported
  Chromium 157. Lifecycle interactions were partially checked; tool timeouts
  interrupted early-disposal preservation/restart checks and Sorting lab was
  not reached. The [2026-11-12 follow-up](browser-checks-2026-11-12.md) completed
  those scenarios: early-disposal drawing preservation, restart/exhaustion and
  Sorting lab controls passed, with no warning/error console entries. It covers
  the current working-copy demos in embedded Chromium, not branded desktop
  products or a full historical-version matrix.
- The [Boids and falling-sand review](boids-sand-review.md) passed local tests,
  packed-consumer and embedded-browser UI checks on 2026-11-12. Both simulations
  define their own state, objects and visualizations using existing public APIs.
  Their inspected predictions, replay, mode limits, editing and error handling
  required no package API changes. Their commit and exact-commit CI are complete.

Independent usage is currently unknown. Finding additional users and collecting
their reviews is optional; it does not block stabilization or replace the
existing integration evidence.

The current release's successful CI does not certify a later 1.0 candidate.

## Deliberate limits and deferred work

- Headless playback engines remain synchronous. A separate 0.15.0
  `createAsyncSource` adapter accepts AsyncIterable without a worker or scheduler.
  The optional browser widget adds RAF with its documented 100 ms wall-clock
  clamp and optional `maxStepsPerFrame` request budgeting with carried playback
  time. It cannot interrupt one expensive iterator operation. Long generation
  or large core advance calls can block the host. Applications control whether
  to use the widget or provide their own scheduling and elapsed time.
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
- Uncached scene indexing uses O(n) additional memory and layer ordering
  O(n log n) time. Since 0.14.0 the scene renderer caches only the last immutable
  endpoint pair; resolving each frame remains O(n). Its [speed/memory checks](scene-cache-performance.md)
  preserve standalone validation and the existing snapshot contract. Removing the large-array argument-count failure is not a performance
  guarantee. Earlier heap/mock-Canvas measurements remain diagnostics described
  in [performance](performance.md), not browser FPS or portable thresholds.
- Array dispatcher reuse shipped in 0.14.0; [measurements](array-dispatch-performance.md)
  remain historical evidence for their workloads. Highlight membership and native
  Canvas costs are possible further investigations, not required API work.
  Automatic controllers, localization/formatting options, configurable easing
  and pixel-perfect output guarantees are not prerequisites for 1.0.
- CI verifies Node 22/24/26 and emitted ES2022 code; it does not establish support
  for every browser, TypeScript version or Node release. Any broader support
  promise needs its own scope and evidence. The [support matrix](support-matrix.md)
  separates current checks, proposed coverage and remaining verification. All ten
  jobs in the first expanded Node/TypeScript run passed; named browser products
  and historical browser versions remain separate unverified targets.
- Website upgrades and compatibility checks remain deferred by the user and
  belong in the website chat. They are not silently added to this release plan.

## What remains before 1.0, in order

The [current core review](core-readiness-1.0.md) leaves no known API/implementation
blocker after all four model sketches. The [support scope](support-matrix.md#current-support-boundary)
is retained; broadening it and implementing new structures remain optional work.

1. **G1/G2 on 76f76ed are complete.** Origin matches and all 11 exact-SHA jobs
   pass. Review and separately commit/push the new native evidence/status docs
   if included in the release. This native task creates no commit or version change.
2. **Verify the final release SHA.** If documentation changes the SHA, require
   all 11 jobs on the final commit. Reuse unchanged local/payload checks with
   explicit hashes, without claiming another SHA's CI as its own.
3. **Retain the completed native G3 evidence.** The remaining 133 cases passed
   on 76f76ed in the existing Windows browser boundary, including actual DPR
   change and zero remaining Workers/RAF. Keep the earlier 26-case run's real
   SHA and payload equivalence. Recheck affected observations after code/artifact
   changes; documentation-only commits may reuse the unchanged native payload.
4. **Publish only under a separate instruction after G1–G3.** Match tag/version
   and the checked SHA; use GitHub Release → npm and verify workflow success,
   exact version/latest, fresh registry consumers and signature/provenance.
   The publishing workflow does not enforce all 11 CI jobs itself. Website
   work remains separately authorized.

F1/F2 and U1–U5 are resolved in the unpublished candidate. Publication remains
deferred; the [current gate list](candidate-1.0.md#remaining-release-gates)
records completed G1/G2/G3 for 76f76ed and the pending evidence documentation.
The historical four-module audits identified
no remaining required code change within their historical scope. A
separate [optional-player proposal](optional-player-proposal.md) evaluates useful
0.x development and optimization work; it is not a new prerequisite for 1.0 or
an authorization to implement or publish it.
