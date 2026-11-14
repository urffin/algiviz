# Optional player and optimization directions

Assessment dated 2026-11-12, after `273b292` and its successful ten-job CI.
This proposes a public package API, not a release decision. The existing four
module contracts remain the stabilization baseline. A local example-only
[prototype](optional-player-prototype.md) demonstrated the first scope and was
committed at `12f8fb3`. Implementation commit `fa22032` adds the
[0.12.0 `/player` entry](player.md), absent in 0.11.2.

## 0.16.0 release candidate, 2026-11-14

The owner requested review, commit and publication after successful CI. The
candidate includes the optional Worker transport/endpoint and Player integration
through asyncSource, with no Player/core runtime changes. Package and both root
lockfile version fields are 0.16.0. Duplicate export/private-path test entries
were removed during review; source/build/fixture hashes still match the 20-case
standalone and 25-case native Player/Worker reports.

All 304 repository tests, installed-package NodeNext/Bundler consumers and
bundle isolation passed for 0.16.0. Publication must wait for all
exact-candidate CI jobs, then use the stable GitHub Release/OIDC workflow. npm
exact/latest, provenance, signatures and a fresh registry consumer must be
verified afterwards. The separate 1.0 compatibility decision remains open.

## 0.15.0 released and verified

[0.15.0](https://github.com/urffin/algiviz/releases/tag/v0.15.0) was published on
2026-11-13 at `c0fa84345a60e9b49ab55de0a1eae4335b7c9221`, adding the headless
async adapter and asyncSource widget integration described below. All 265 local
tests, installed consumers and 13 native browser checks passed. All eleven
[exact-commit CI jobs](https://github.com/urffin/algiviz/actions/runs/43470187735)
passed before publication; the [publishing workflow](https://github.com/urffin/algiviz/actions/runs/43470555545)
also passed. npm exact/latest, source/digest provenance, registry signature and
attestation, fresh NodeNext/Bundler consumers and 40 strict async cases were
verified. All 56 published build files match after CRLF/LF normalization.
[Verification data](releases/0.15.0.json) closes this release stage. Worker
transport and the 1.0 compatibility decision remain separate next directions;
no further stage or publication is started by this record.

## Worker contract stage, 2026-11-14

The owner requested a behavioral contract, without implementation. The
[Worker source contract](worker-source.md) ([Русский](ru/worker-source.md)) now
selects exclusive lazy ownership of a fresh dedicated module Worker, one pull in
flight, versioned session/request validation, default structured-clone copying
and explicit worker-to-host ArrayBuffer transfer. Shared memory is excluded.
It preserves the 0.15.0 asyncSource/player controls and transactional Restart.
Shutdown attempts cooperative cleanup, then termination after a configurable
finite grace period (default 1000 ms); forced versus acknowledged shutdown is
observable separately from actual cleanup errors. Closed must not resolve ahead
of transport teardown, including EOF and cancellation during a read.

This is a design document, not a checked runtime implementation. Acceptance
cases include native Worker cloning/transfer/termination, error and intent races,
cleanup reporting and the two-Worker ownership bound. The separate
[API/type design](worker-source-api.md) now selects host/worker factories, transfer
selection, shutdown options, errors and per-session completion reports. No
implementation or release is started; the separate 1.0 decision remains open.

## Worker API design stage, 2026-11-14

The [public API/types](worker-source-api.md) ([Русский](ru/worker-source-api.md))
select /worker for createWorkerSourceFactory/WorkerSourceError and
/worker/runtime for exposeWorkerSource. A callable host factory is compatible
with AsyncSourceFactory and returns one iterable session with its own closed
report. Explicit worker-side ArrayBuffer selection, shutdown grace options,
clone-safe reasons/errors, bounded cleanup and termination outcomes are typed.
No new Player option, core re-export, callback journal or runtime code is added.

All twelve design-stage compiler configurations passed: TypeScript 5.0.4/6.0.3,
NodeNext/Bundler, ES2022-only headless, DOM host and WebWorker. Both examples,
existing headless/player consumers and positive/negative cases passed with
noEmit. TypeScript 5.0.4's structural ArrayBuffer/view ambiguity is recorded;
runtime brand/reachability/shared-memory checks remain mandatory. This does not
certify a real Worker lifecycle. Proposed next step is standalone transport and
endpoint implementation, beginning with controlled request/shutdown cases and
then native Worker acceptance. Implementation/release remains a separate task;
the current scope is API design only.

## Standalone Worker implementation, 2026-11-14

The owner authorized implementation without /player integration. /worker and
/worker/runtime are now implemented locally, unreleased: lazy exclusive Worker
ownership, one pull, native clone snapshots/ArrayBuffer transfer, bounded remote
errors, cooperative/forced shutdown and honest per-session closed reports.
Actual cleanup errors pass through createAsyncSource's return barrier. DOM host
and WebWorker declarations compile separately; old modules do not import either
entry. WorkerSourceRemotePhase additionally includes teardown so endpoint
listener-removal failures keep their real phase.

All 293 repository tests passed, including 27 public Worker cases and one ID
boundary check. Installed-package NodeNext/Bundler consumers passed with
TypeScript 5.0.4 and 6.0.3, separately for headless/DOM/WebWorker environments;
public exports/private paths and strict installed Worker runtime cases passed.
Bundle checks cover existing/UI isolation, independent host/runtime graphs and
dynamic Worker loading. The built-in browser passed 20 native dedicated-module
Worker cases with no unexpected errors and no remaining owned Workers; the
[report](checks/worker-source-browser-2026-11-14.json) records source/build hashes.

This standalone stage left /player and the core async adapter unchanged. The
subsequent owner-authorized control integration is recorded below. No commit
or publication is started by this record.

## Worker/Player integration, 2026-11-14

The owner authorized connecting the Worker adapter to /player and checking
waiting, Pause, Next, Restart and dispose. The [integration guide](player-worker.md)
([Русский](ru/player-worker.md)) passes createWorkerSourceFactory as asyncSource.
No Player/core implementation, source option, phase or command changes are needed.
Transport shutdown remains observable through each Worker session's closed,
separately from PlayerCloseResult.

All 304 repository tests passed, including 11 controlled integration cases.
Those cases also passed against installed local archives. Strict TypeScript
5.0.4/6.0.3 NodeNext/Bundler consumers passed, including direct factory inference,
synchronous commands and separate completion reports. Existing headless and
DOM/WebWorker separation checks passed. Bundle isolation also passed joint
deferred loading of /player and /worker. The built-in browser passed 25 native
checks, including actual Enter activation and final disposal: at most two owned
Workers, zero unexpected errors and zero remaining Workers/RAF. The
[report](checks/player-worker-browser-2026-11-14.json) records source/build hashes.

Next proposed step is accumulated-change review and, only when requested, a
versioned release candidate with exact-commit CI and registry verification.
These local results do not publish a release or make the separate 1.0 decision.

## 0.14.0 released and verified

[0.14.0](https://github.com/urffin/algiviz/releases/tag/v0.14.0) was published on
2026-11-13 at `3e5bc02cd7d711549d7f3213edbae423bf5cf209`. It combines the
single-pair scene matching cache, array dispatcher reuse, standalone rewind
buffer, streaming Previous controls and opt-in per-RAF work budgeting. Earlier
raw performance/native reports retain their historical measurement hashes.

All 225 local tests, installed-package consumers, bundle isolation and the
performance benchmark passed. All eleven [exact-candidate CI jobs](https://github.com/urffin/algiviz/actions/runs/43417615630)
passed before the release was created. The [publishing workflow](https://github.com/urffin/algiviz/actions/runs/43417927790)
then passed for that same SHA.

At that publication, npm exact version and latest were 0.14.0; gitHead, tarball integrity and SLSA source
commit/workflow/tag match the release. A fresh registry installation passed the
runtime export/private-path inventory, strict headless and DOM consumers, and
runtime integration checks. All 48 published build files match the local candidate
after CRLF/LF normalization. `npm audit signatures` verified one registry signature
and one attestation. [Verification data](releases/0.14.0.json) records the results.

This release stage is complete. The next development direction is specified in
the proposed [asynchronous-source behavioral contract](async-sources.md)
([Русский](ru/async-sources.md)), dated 2026-11-13: waiting, control intents,
transactional restart, cooperative cancellation, cleanup and error precedence.
The [public adapter API/types](async-source-api.md)
([Русский](ru/async-source-api.md)) were implemented before 0.15.0 publication:
one factory and five types for DOM-free cancellation, shared reads and observable
cleanup. All 244 tests passed, including 19 adapter cases; those 19 also passed
from a fresh local archive installation with strict unhandled-rejection handling.
Exact exports/private paths, TypeScript 6.0.3 ES2022-only headless and DOM/runtime
consumers in NodeNext/Bundler, and browser ESM bundle isolation passed.
Published 0.14.0 has no async adapter. At that headless stage, /player was unchanged.
The [widget integration API](player-async-api.md)
([Русский](ru/player-async-api.md)) was then implemented: exclusive
asyncSource, four status fields, manual Pause/Replay intents, optional label roles
and bounded PlayerCloseResult/closed. The synchronous playback engine is unchanged.
All 265 tests passed, including 21 public async-widget cases; those 21 also passed
from a fresh local archive with strict rejection checks. TypeScript 5.0.4 and 6.0.3
NodeNext/Bundler DOM/headless consumers, private paths and bundle isolation passed.
The built-in browser records 13/13 checks, including native Enter activation, with
matching source/build hashes and no unexpected errors.
This implementation and its 0.15.0 publication are complete and verified above.
Worker transport and the 1.0 compatibility decision remain separate.

## Current progress

0.12.0 was released at `9160f81`; all eleven
[candidate CI jobs](https://github.com/urffin/algiviz/actions/runs/43205252404)
and the publication workflow passed. npm version, latest, source commit,
provenance and a fresh registry installation were verified. The introductory
README and RU/EN guide were then updated at `79229ce`, also with eleven CI jobs passing.

The [runnable README circle](../examples/getting-started.html) now uses the public
`Player` with no custom control wiring. Embedded-browser checks on 2026-11-12
covered Start, all four positions, exhaustion on the additional request, Restart
and usable idle controls after navigating away and back; console warnings/errors
were empty. The actual module was also checked with the existing DOM harness for
pagehide cleanup, preservation of the drawing, and a single fresh idle instance
on `pageshow` with `persisted: true`. These are local-build checks within the
existing browser boundary. All 172 repository tests passed.

The Canvas viewport sizing audit and an example-only prototype are now complete:
see the [contract and checks](canvas-viewport-prototype.md)
([Русский](ru/canvas-viewport-prototype.md)). BFS and binary search share CSS-content
sizing, DPR handling and cleanup; all 182 tests and eleven
[CI jobs](https://github.com/urffin/algiviz/actions/runs/43219455052) passed at `7ba76ba`.
The [accepted contract](canvas-viewport.md) ([Русский](ru/canvas-viewport.md))
fixes `createCanvasViewport` and the independent `/canvas/viewport` entry.
**0.13.0 is published** at `443892cf050cf313defcf055cf28318741502946`, adding
`/canvas/viewport` as the sixth entry. The [release](https://github.com/urffin/algiviz/releases/tag/v0.13.0),
[eleven-job CI](https://github.com/urffin/algiviz/actions/runs/43326519526) and
[publishing workflow](https://github.com/urffin/algiviz/actions/runs/43327210001)
completed successfully. Registry version/latest, gitHead, provenance source/digest,
registry signature and attestation were verified. A fresh registry install passed
exact exports, all twelve viewport tests, strict DOM/headless consumers and
DOM-free import; the published helper matches the browser-checked implementation.

Canvas viewport stages:

1. **Design fixed:** one runtime factory and three types; CSS-content coordinates,
   explicit height/context ownership, invalidation, errors and terminal disposal.
   No re-export through `/canvas` or `/player`; the first scope has no bitmap mode.
2. **Browser checks complete for the recorded hosts:** twelve native visibility
   checks passed in the embedded browser at DPR 1. Desktop Chrome native zoom
   passed on 2026-11-13 with DPR 1 through 2.5, capped/uncapped bitmap sizing,
   preserved source reads and restored original scale. All twelve cases passed
   at 1.25, 2.5 uncapped/capped and restored 1, including repeat execution.
   Physical HiDPI displays remain unverified. See the
   [follow-up](canvas-viewport-prototype.md#native-chrome-zoom-follow-up).
3. **Package implementation and native checks complete:** commit `a05bd48` adds
   TypeScript, the sixth explicit entry, installed consumers, private-path rejection
   and existing/direct/dynamic bundle checks. All eleven
   [CI jobs](https://github.com/urffin/algiviz/actions/runs/43323095050) passed.
   The compiled public entry passed five twelve-case native runs on 2026-11-13,
   including capped high DPR, hidden zoom and restoration of the original scale.
   See the [package check](canvas-viewport-prototype.md#native-checks-after-package-transfer).
4. **0.13.0 released and verified:** exact-commit CI, stable GitHub Release, npm
   latest/provenance/signatures and a fresh registry installation passed.
   This stage is complete; the separate 1.0 decision remains deferred.

## Current profiling stage

Baseline profiling is complete on 2026-11-13: ten real-example scenarios in Node
and two serial native embedded-Canvas runs, with all twenty pixel-replay checks
passing. See the [RU/EN report and raw samples](performance-baseline-0.13.0.md).
All 184 repository tests passed after adding the diagnostics. The measurements
record baseline costs before choosing an optimization. Use actual
insertion/merge, BFS, Boids and sand generators, scene mappers and renderers at
small/labeled and dense inputs within each example's limits. Separate generation,
uncached/cached projection, matching and matching plus counting dispatch. Measure
complete real renderers with a mock Canvas in Node and native Canvas in the
browser; these stages overlap and must not be summed or subtracted as a precise
painting cost. Record input, frame-selection policy, warmup, sample distributions,
Canvas size, environment and implementation SHA. Native Canvas timings are CPU
submission costs, not FPS or GPU completion.

Following the owner's explicit instruction, the bounded scene matching cache is
now implemented locally and remains unreleased. Each renderer retains only the
last validated immutable pair; standalone matching is uncached. Paired speed,
real-renderer checks and a 4,000-pair retained-memory check are recorded in the
[RU/EN report](scene-cache-performance.md). All 190 tests, installed-package
consumers and bundle-isolation checks pass. The final native build passed ten
pixel-replay checks with no console warnings/errors. Metadata, linked
lookup, validation-before-dispatch, reentrancy and retained-frame immutability
are covered; no new public entry, option, dependency or disposal method was added.

Array dispatcher reuse is also implemented locally with
[paired measurements, pixel checks and retained-memory results](array-dispatch-performance.md).
Native Canvas command profiling remains an optional /canvas investigation;
its benefits are specific to those renderers, rather than a required next step
for arbitrary user visualizations.

## Bounded navigation follow-up

On 2026-11-13 the owner approved a standalone adapter first, with widget controls
outside that scope. `/playback` now implements `createRewindBuffer` and
`RewindBuffer<T>` for immutable synchronous iterable values. Its
[RU/EN contract](rewind-buffer.md) covers the capacity-inclusive-current window,
sequence positions, replay without source reads, exhaustion and source ownership.
At that standalone stage, existing players, timing and browser controls were unchanged.

All 204 repository tests passed, including 11 adapter tests and 5,120 reference
navigation sequences. Installed-package consumers passed with TypeScript 6.0.3
under NodeNext and Bundler, including ES2022-only/headless compilation and the
new exact export/private-path checks. Bundle isolation passed. The
[10,000-value retention diagnostic](benchmarks/rewind-buffer-memory.json) passed
at capacities 3 and 64: evicted sampled values were collected; disposal while
rewound kept only current, then dropping the adapter released current as well.
The source iterator was released and closed once.

The standalone adapter and subsequently authorized widget integration shipped
in 0.14.0. Source-backed `/player` accepts opt-in `rewindCapacity`,
shows Previous plus the retained range, and reports `rewindStartIndex` and
`rewindEndIndex`. Previous pauses and restores an exact retained snapshot;
Next/Play replay before reading new values. Existing timing is reused, including
final holds, and restart creates a fresh buffer/source. No time seeking or full
history is inferred for a stream.

All 213 repository tests passed, including nine new widget integration cases.
Installed-package TypeScript 6.0.3 consumers passed NodeNext and Bundler; bundle
isolation passed. The [widget retention diagnostic](benchmarks/player-rewind-memory.json)
passed with capacities 3/64 over 10,000 new states and repeated direction changes.
[Embedded-browser checks](player-rewind-checks-2026-11-13.md) verified the actual
button, keyboard operation, window limits, replay/read counts, restart, disposal,
remount and independent recording controls, with no console warnings/errors.

Next, review the new opt-in contract and checked changes before deciding on a
release or another development direction. No subsequent implementation or
publication is started by this record.

## Stream work-budget follow-up

The owner authorized contract-first implementation on 2026-11-13. The
[RU/EN contract](player-work-budget.md) was recorded before source changes.
Opt-in `maxStepsPerFrame` now bounds timed stream next-step requests per RAF,
including buffered replay and exhaustion probes. Remaining playback milliseconds
carry forward. Pause/manual navigation/restart/error/dispose discard that debt;
speed changes preserve it in playback units. Recordings reject the stream option,
and headless advance remains unbounded. One heavy call is still synchronous.

All 225 tests passed, including 12 added budget regressions, strict installed
NodeNext/Bundler consumers and bundle isolation. Native Chromium checks at
1 ms/step, 16× speed and a limit of 2 observed maxima of two next-step requests
and two underlying source requests per RAF, with zero recorded violations.
Pause, manual buffer replay, completion/hold, restart/dispose and remount passed.
[Raw native evidence](benchmarks/player-work-budget-browser.json) contains hashes
and counters. The [rewind memory regression](benchmarks/player-work-budget-rewind-memory.json)
was also rerun after shared-engine changes; it uses manual navigation with no
RAF budget, checking the existing retention/cleanup contract.

This stage shipped in 0.14.0; see the release verification above. Async sources
and worker transport remain separate possible directions. The implementation
stage itself did not publish a release; publication was subsequently authorized
and verified separately.

## Historical release assessment after 0.11.2

At the proposal stage after published 0.11.2, `src`, `package.json` and `package-lock.json` had no
changes. Boids, sand, the shared controller, tests and most documentation live
only in the repository. The package allowlist includes the two READMEs, whose
new catalog rows would appear in a fresh npm archive.

A documentation-only **0.11.3** is reasonable if refreshing the npm README is
useful now. Its notes must state that the runtime/declarations are unchanged;
installing it will not install the new demo files. A patch is not necessary to
use examples already available on GitHub. If an optional public player is the
next deliverable, combining the README updates with **0.12.0** avoids a separate
documentation-only release. A new public entry point/class is a feature under
this project's 0.x release convention, even if old imports remain unchanged.
[SemVer](https://semver.org/spec/v2.0.0.html) leaves 0.y.z APIs in development;
this patch/minor distinction records the project's compatibility intent.

## Why a player is useful library development

`examples/demo-player.mjs` already repeats useful integration work: RAF timing,
speed, play/pause, restart, stepping, history capabilities, hidden-tab behavior
and reduced-motion presentation. Applications should not need to reproduce all
of that just to animate their own states. An optional convenience layer would
reduce integration code while keeping algorithms, snapshots, layout and drawing
application-owned. Its value is the reusable control contract and cleanup, not
additional algorithms or preset scenes.

The demo controller is evidence for the need, not a public implementation ready
to copy. It requires fixed document IDs, owns global listeners, hardcodes English
labels and offers no complete UI teardown. A reusable module needs scoped DOM,
multiple independent instances, configurable labels and explicit ownership.

## Proposed entry point and loading boundary

Use an optional **`@grundyjs/algiviz/player`** entry point. The existing
`/playback` stays the headless playback engine. The new module internally
separates scheduling/session management from DOM controls; a second public
controller-only entry point is not needed for the first iteration.

Dependency direction: `/player` imports `/playback`. Existing entry points must
not import or re-export `/player`. The UI must not pull in `/array`, `/canvas`,
algorithms, a framework, icons or fonts. Its caller supplies a renderer callback,
which may target Canvas, SVG, DOM or another host.

Usage from **0.12.0**:

```js
const { Player } = await import('@grundyjs/algiviz/player');
const ui = new Player(container, {
  viewport: canvas,
  source: () => states(),
  render: draw,
  stepDurationMs: 400,
});
// On application teardown:
ui.dispose();
```

The separate entry point keeps UI code outside the dependency graph of ordinary
headless imports. Calling `import()` on demand lets native ESM or an appropriately
configured bundler load it when needed; static import alone does not make a
module lazy. See [webpack's code-splitting documentation](https://webpack.js.org/guides/code-splitting/#dynamic-imports).
Actual chunk placement and preloading depend on the host build, so verify real
consumer output instead of promising a universal byte count.

The **npm archive and installed package will grow** because they contain the
optional files. A consumer bundle that imports only the existing entry points
should contain no new UI code or styles. These are different size guarantees.
If even npm installation size must remain separate, use a companion package
instead; that adds version/dependency coordination and is unnecessary for the
browser-bundle goal alone.

Add the new path to both `exports` and the package `files` allowlist. Avoid DOM
access and global effects during module evaluation. Create scoped UI/styles and
listeners only when mounting; leave existing headless type consumers unchanged.
If shipping a CSS asset, explicitly account for its side effects in packaging
and consumer tests rather than relying blindly on today's `sideEffects: false`.

## First useful scope

- Start, Play/Pause, Next, Restart, speed and a short status. Labels are
  configurable without an internationalization dependency; native controls have
  accessible names and keyboard operation scoped to the focused instance. The
  player can embed a caller-provided Canvas/SVG/DOM viewport with an auto-hiding
  overlay panel and restore the same element on teardown. Keyboard focus and
  active interaction keep controls visible; `autoHide: false` selects a permanent
  footer. Drawing remains application-owned.
- A factory for fresh plain-state iterables, using `createStatePlayer`. No eager
  collection, hidden lookahead or mandatory step/event wrappers. For the proposed
  default, Start creates the source and shows the first frame; mounting alone
  does not consume it. Manual playback works without timing; timed controls
  require `stepDurationMs`. Autoplay remains outside the first implementation.
- Streaming playback has unknown total duration, no invented percentage or seek
  bar, and exhaustion detected by the existing extra request. Next stays visible
  while temporarily disabled; after completion Restart remains available.
- Following the owner's media-player feedback, the local prototype also supports
  an explicitly supplied finite array of plain states, adapted through
  `createTimeline`. This recording has Previous, playback time and a seek bar;
  `seekBar: false` hides the bar. Never turn an arbitrary generator into full
  history automatically. A later explicit-step adapter can use `createPlayer`
  with a terminal predicate.
- A returned handle supports pause/restart/dispose and observable UI status for
  integration. It owns only its subtree, listeners, RAF and source; disposal is
  idempotent, preserves the caller's last drawing and closes the source once.
- Hidden tabs pause without an unbounded catch-up burst. Reduced motion changes
  presentation, not state order. Failures stop scheduling and report through a
  defined callback/status without leaking candidate or replaced sessions.

Do not include GIF/video export, algorithm selection, graph layout, paint tools,
an editor or rendering presets in the first player. Those have separate owners
and would turn a small convenience layer into an application framework.

Before publishing, test two independent instances, manual/timed controls,
infinite/finite sources, mixed Next/Play, restart, failed initialization,
render/source/cleanup failures, disposal and unmount. Keep the existing no-DOM
consumer checks; add DOM consumers for the new entry point and SSR-safe import
checks. Use actual bundle fixtures for existing-only imports, static UI imports
and lazy UI imports, including CSS and shared-module placement. Measure raw,
minified and compressed sizes in the recorded build configuration. Verify the
mounted UI in the supported browser host; old smoke results do not cover it.

## Other useful additions, in priority order

| Candidate | Concrete benefit | Boundary |
| --- | --- | --- |
| Optional player | Shipped in 0.12.0; removes repeated scheduling and control wiring | The README circle, Canvas recording and SVG stream exercise the public API; preserve the headless and deferred-loading boundaries. |
| Canvas viewport helper | Shipped in 0.13.0; consolidates repeated CSS/bitmap size, DPR and resize handling | Opt-in browser helper with explicit coordinate semantics and teardown; do not silently change the existing renderer's bitmap contract. |
| Bounded rewind adapter | Shipped in 0.14.0 as `/playback`'s `createRewindBuffer`; [contract and checks](rewind-buffer.md) | Capacity includes current; replay does not reread the source. Opt-in `rewindCapacity` integrates it with `/player` controls and window status. |
| Cooperative scheduling / async sources | Work budgeting shipped in 0.14.0; asyncSource shipped in 0.15.0 | One expensive call remains uninterruptible on its executing thread. Preserve [budgeting](player-work-budget.md) and [async ownership/control](async-sources.md) contracts. |
| Worker adapter | Transport/endpoint and [Player controls](player-worker.md) included in the 0.16.0 candidate | Owner authorized publication after exact-commit CI. Verify the registry afterwards; preserve fresh ownership, one pull, transfer and bounded shutdown. |

## Optimization candidates from the current code

The scene matching cache now has [measured local results](scene-cache-performance.md).
The remaining rows are code-inspection hypotheses, not measured speedups or required fixes.
Start with separate generation/projection/dispatch/drawing measurements on a
representative workload. Existing `scripts/benchmark.mjs` uses a mock Canvas;
it does not report real browser FPS or GPU work.

| Area | Current cost and candidate | Contract to preserve |
| --- | --- | --- |
| `/scene` | Implemented locally: a renderer caches the matching/order plan for one immutable endpoint pair. Standalone `createSceneFrame` remains uncached. See the speed/memory report above. | New progress/event metadata and immutable retained frames; validation before dispatch; type/ID errors and stable layer ordering. Standalone calls need not acquire global caches. |
| `/canvas` | Implemented locally: `createArrayRenderer` reuses its scene dispatcher and matching cache; per-call drawing inputs remain separate. See [paired measurements and correctness checks](array-dispatch-performance.md). | Independent renderer instances and correct callback context; no stale dimensions, palette, frame or event. Cache misses still rebuild the matching plan. |
| Array highlights | Each bar calls `event.itemIds.includes(id)`: n bars with h highlighted IDs cost O(nh) membership work. Build/cache one Set per immutable highlight event for O(n + h) membership work. | Existing held/active/sorted color priority and event semantics; benchmark because small h may not justify the setup cost. |
| Canvas drawing | Full repaint and labels can dominate actual browser time. Measure dense and labeled scenes separately before batching or caching static decoration. | Pixel behavior, paint order and context restoration; dirty-region rendering needs a distinct contract for arbitrary custom draws. |
| Source generation | Each array emission copies O(n) slots. Reusing unchanged immutable items is already allowed; delta traces or mutable buffers would change snapshot/retention semantics. | Do not mutate old states to reduce allocation. Structural sharing or a delta format needs separate evidence and design. |
| Scheduling | One large synchronous `advance(deltaMs)` can consume many steps. Put optional bounded work/yielding in the browser controller first. | The core advance call still accounts for its requested time. A time clamp changes playback speed; an accumulator/yield policy must be explicit. One expensive step remains synchronous. |

Boids neighbor grids and sand-specific cell batching are application-example
optimizations. They should not become domain algorithms inside the library.
Prioritize improvements demonstrated by profiling; avoid adding public options
or weakening immutable snapshot guarantees solely for speculative speedups.
