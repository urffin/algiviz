# Optional player and optimization directions

Assessment dated 2026-11-12, after `273b292` and its successful ten-job CI.
This proposes a public package API, not a release decision. The existing four
module contracts remain the stabilization baseline. A local example-only
[prototype](optional-player-prototype.md) now demonstrates the first scope;
there is still no `/player` npm entry point.

## Release value of the current changes

Since published 0.11.2, `src`, `package.json` and `package-lock.json` have no
changes. Boids, sand, the shared controller, tests and most documentation live
only in the repository. The package allowlist includes the two READMEs, whose
new catalog rows would appear in a fresh npm archive.

A documentation-only **0.11.3** is reasonable if refreshing the npm README is
useful now. Its notes must state that the runtime/declarations are unchanged;
installing it will not install the new demo files. A patch is not necessary to
use examples already available on GitHub. If an optional public player is the
next deliverable, combining the README updates with **0.12.0** avoids a separate
documentation-only release. A new public entry point/function is a feature under
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

Conceptual use, **not a currently available export**:

```js
const { mountPlayer } = await import('@grundyjs/algiviz/player');
const ui = mountPlayer(container, {
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
  require `stepDurationMs`. Autoplay is opt-in and separate from initialization.
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
| Optional player | Removes repeated scheduling and control wiring; the strongest demonstrated need | Prototype on the minimal walkthrough and one different domain before adding the export. |
| Canvas viewport helper | Consolidates repeated CSS/bitmap size, DPR and resize handling seen in custom examples | Opt-in browser helper with explicit coordinate semantics and teardown; do not silently change the existing renderer's bitmap contract. |
| Bounded rewind adapter | Allows a few backward steps while retaining a configured window of generator states | Only if needed: make history loss, replay, source ownership and the O(window × state size) cost explicit. Do not change forward-only core semantics. |
| Cooperative scheduling / later worker adapter | Keeps long-running generation from monopolizing the UI | A controller can yield between operations, but cannot interrupt one expensive synchronous iterator.next(). Async/worker sources need a separate cancellation/error/serialization design. |

## Optimization candidates from the current code

These are code-inspection hypotheses, not measured speedups or required fixes.
Start with separate generation/projection/dispatch/drawing measurements on a
representative workload. Existing `scripts/benchmark.mjs` uses a mock Canvas;
it does not report real browser FPS or GPU work.

| Area | Current cost and candidate | Contract to preserve |
| --- | --- | --- |
| `/scene` | `createSceneFrame` indexes both endpoints, forms ID sets and sorts transitions for every render. Cache the matching/order plan for the same immutable endpoint pair in a renderer, bounded to the active pair. | New progress/event metadata and immutable retained frames; validation before dispatch; type/ID errors and stable layer ordering. Standalone calls need not acquire global caches. |
| `/canvas` | `createArrayRenderer.render` constructs a scene renderer and registry each frame. Consider reusing a dispatcher with explicit per-frame data. | Independent renderer instances and correct callback context; no stale dimensions, palette, frame or event. |
| Array highlights | Each bar calls `event.itemIds.includes(id)`: n bars with h highlighted IDs cost O(nh) membership work. Build/cache one Set per immutable highlight event for O(n + h) membership work. | Existing held/active/sorted color priority and event semantics; benchmark because small h may not justify the setup cost. |
| Canvas drawing | Full repaint and labels can dominate actual browser time. Measure dense and labeled scenes separately before batching or caching static decoration. | Pixel behavior, paint order and context restoration; dirty-region rendering needs a distinct contract for arbitrary custom draws. |
| Source generation | Each array emission copies O(n) slots. Reusing unchanged immutable items is already allowed; delta traces or mutable buffers would change snapshot/retention semantics. | Do not mutate old states to reduce allocation. Structural sharing or a delta format needs separate evidence and design. |
| Scheduling | One large synchronous `advance(deltaMs)` can consume many steps. Put optional bounded work/yielding in the browser controller first. | The core advance call still accounts for its requested time. A time clamp changes playback speed; an accumulator/yield policy must be explicit. One expensive step remains synchronous. |

Boids neighbor grids and sand-specific cell batching are application-example
optimizations. They should not become domain algorithms inside the library.
Prioritize improvements demonstrated by profiling; avoid adding public options
or weakening immutable snapshot guarantees solely for speculative speedups.
