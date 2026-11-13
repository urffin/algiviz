# Optional player and optimization directions

Assessment dated 2026-11-12, after `273b292` and its successful ten-job CI.
This proposes a public package API, not a release decision. The existing four
module contracts remain the stabilization baseline. A local example-only
[prototype](optional-player-prototype.md) demonstrated the first scope and was
committed at `12f8fb3`. Implementation commit `fa22032` adds the
[0.12.0 `/player` entry](player.md), absent in 0.11.2.

## 0.14.0 release candidate

The owner authorized review, commit/push and publication after exact-candidate CI
on 2026-11-13. Version 0.14.0 combines the single-pair scene matching cache,
array dispatcher reuse, standalone rewind buffer, streaming Previous controls
and opt-in per-RAF stream work budgeting. Existing headless advance semantics
and default forward-only widgets are preserved. Raw performance and native
reports below retain the historical versions/hashes measured at each stage.

Preparation includes all 225 tests, installed-package and bundle checks, the
performance benchmark, consistent package/lockfile versions and reviewed release
notes. Publish through the stable GitHub Release only after all eleven CI jobs
pass for the exact versioned commit, then verify npm/latest and provenance.

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

The standalone adapter and subsequently authorized widget integration are complete
locally and unreleased. Source-backed `/player` accepts opt-in `rewindCapacity`,
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

This stage is complete locally and unreleased. Next, review the accumulated
changes and prepare an exact versioned candidate/CI before publication. Async
sources and worker transport remain separate possible directions. No release
was authorized or published as part of this implementation request.

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
| Bounded rewind adapter | Implemented locally as `/playback`'s `createRewindBuffer` for synchronous iterable values; [contract and checks](rewind-buffer.md) | Capacity includes current; replay does not reread the source. Existing forward-only players are unchanged. Opt-in `rewindCapacity` now integrates the buffer with `/player` controls and window status. |
| Cooperative scheduling / later worker adapter | Local `maxStepsPerFrame` limits stream advancement per RAF and carries playback-time debt; [contract and checks](player-work-budget.md) | One synchronous source/render call remains uninterruptible. Async/worker sources still need a separate cancellation/error/serialization design. |

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
