# Optional browser player

[README](../README.md) · [Русский](ru/player.md)

**Unreleased:** `/player` is prepared in the working tree after the prototype
commit `12f8fb3`. Published 0.11.2 does not contain this entry point. The package
version has not been bumped and no release has been published.

`@grundyjs/algiviz/player` provides the `Player` class and the type-only exports
`PlayerOptions`, `PlayerStatus` and `PlayerLabels`. It imports
only playback code. Existing modules do not import the UI or its styles.

## Mount on demand

Start with an HTML container containing a Canvas, SVG or other drawing element.
Provide immutable states and your rendering callback:

```ts
const { Player } = await import('@grundyjs/algiviz/player');
const ui = new Player(container, {
  viewport: canvas,
  source: function* () {
    for (const x of [40, 200, 360, 560]) yield { x };
  },
  render(frame) { draw(frame.current.x); },
  stepDurationMs: 1000,
});
// During application teardown:
ui.dispose();
```

The `viewport` is optional and must be a direct child of the supplied HTMLElement
container. Mounting moves that same element into the shell; disposal restores it
without clearing its drawing or changing Canvas bitmap dimensions. The caller
owns the drawing element, layout, resize/DPR handling and render backend.

The constructor creates controls and reports idle status without invoking the state
factory. Start displays the first state, paused. There is no implicit autoplay.
The [interactive example](../examples/optional-player.html) uses Canvas recording
and SVG streaming with independent widgets.

## Select one source capability

| Option | Retention and controls |
| --- | --- |
| `source: () => Iterable<State>` | Reads lazily, retains adjacent snapshots, unknown duration. Next requests one state or completes a partial transition. A request after the last yield detects exhaustion. No Previous or seeking. Timing is optional for manual use. |
| `history: () => readonly State[]` | Explicit dense, nonempty recording retained in full. Requires positive `stepDurationMs`. Supports Previous, time seeking and a known duration; completion is known at the final boundary. The factory is not called before Start. |

Exactly one factory is required. An iterable is never silently collected to
enable seeking. Both factories must support restart; each invocation supplies a
fresh session. The generic state shape is inferred from the factory.

```ts
const ui = new Player(container, {
  history: () => savedStates,
  render: draw,
  stepDurationMs: 500,
  seekBar: false, // Hide the recording slider; seeking capability is retained.
});
```

`finalHoldMs` defaults to zero. `seekBar` defaults to true and never forces a
slider onto a stream. Recordings use `createTimeline` internally; seeking clamps
finite times and pauses playback. It does not recreate the recording. Invalid
non-finite positions are rejected before affecting a usable session.

## Controls and status

The `Player<State>` instance exposes readonly `status` and `frame`, plus `start`, `play`, `pause`,
`next`, `previous`, `seek(positionMs)`, `restart`, `setSpeed` and `dispose`.
Commands return the new `PlayerStatus`; `dispose` returns void. The frame is null
until initialization and remains readable after disposal. Its event is undefined.

Status includes phase, mode, started/timed flags, speed, error/hasError, frame
index/progress and `canStart`, `canPlay`, `canNext`, `canRestart`, `canSeek`,
`canPrevious`. Recording position/duration are milliseconds; unavailable values
are null. Unsupported stream Previous/seek and invalid speeds throw without
consuming the source. Positive finite speeds are accepted, including custom ones.

Restart shows a paused first frame. The UI Replay button restarts and then plays;
programmatic `play()` does not restart an already completed session. Timed Play
requires `stepDurationMs`. Next during Play pauses and completes one transition.
Hidden documents pause and do not automatically resume. Per-frame wall-clock
delta is capped at 100 ms before speed multiplication; long stalls are discarded.
This synchronous scheduler cannot interrupt one expensive iterator operation.

`onStatus` is synchronous, including idle reporting before the `Player` constructor returns.
Render/status callbacks must not synchronously change the same widget; reentrant
commands are rejected. `onError` receives operational failures after cleanup;
exceptions thrown by this application callback propagate. Source preparation
failure preserves the old paused session. Source/render/status failures close the
failed session, preserve the readable frame and stop scheduling. Cleanup errors
do not replace an earlier operational failure. Standalone dispose cleanup errors
propagate after DOM/listener/timer cleanup.

## Presentation and ownership

With a viewport, controls overlay the lower edge and hide after two seconds of
inactivity after Start. Pointer activity, taps and keyboard focus reveal them.
Panel hover, a held pointer/drag, keyboard focus, a focused speed picker, initial
idle and errors keep them visible. Hidden controls remain keyboard-accessible.
Reduced motion removes the fade and displays current endpoints without changing
the raw frame or consuming states. `autoHide: false`, or no viewport, uses a
permanent footer. The overlay stage has a minimum height of 160 CSS pixels.

`labels` accepts known `PlayerLabels` roles as partial overrides. Values must be
nonempty strings; omitted and explicitly undefined values preserve defaults.
Overrides are copied. English defaults, inline SVG icons and native controls
require no localization, icon, font or UI-framework dependencies.

Styles are created in a prefixed style element only when mounting. Host CSP must
permit those styles; there is no nonce/stylesheet injection API in this version.
CSS custom properties customize `--player-border`, `--player-stage`,
`--player-panel`, `--player-text`, `--player-accent` and `--player-error`.

Dispose is idempotent and owns only its session, RAF, interaction listeners,
inactivity timer and shell. Caller siblings and the last drawing survive.
Each mounted widget disposes on pagehide; hosts remount on BFcache restoration
or application navigation as needed. Multiple widgets do not share playback state.

## Loading and verification boundary

Importing `/player` is safe without DOM globals; mounting requires a real DOM
container and its window, with RAF/matchMedia for the browser behavior. Its
declarations need DOM types. `/playback`, `/scene` and `/array` keep their existing
ES2022-only headless consumers. No root or CommonJS entry point is added.

The npm archive includes optional player files and therefore grows. Existing
entry-only bundles should contain no UI. On-demand `import()` permits a separate
chunk; the application's bundler/preloading configuration controls actual fetch
timing. Run the installed-tarball checks:

```sh
npm test
npm run test:package -- --resolution all
npm run test:bundle
```

The bundle fixture checks raw/minified ESM output from the installed tarball,
existing-only byte equality against the same four modules without `/player`,
static UI imports, and dynamic-import initial/deferred dependency graphs. It also
executes the minified outputs and lazy loader in Node without DOM globals.
This is a concrete esbuild configuration, not a guarantee about every bundler.

Working-tree verification on 2026-11-12: **172 tests passed**. Installed consumers
passed TypeScript 5.0.4, 5.4.5, 5.9.3 and 6.0.3 in NodeNext/Bundler modes, including
the unchanged no-DOM fixtures, inferred source types, rejected conflicting inputs,
recording timing and DOM-free UI imports. [Bundle results](player-bundle-check.md)
record the exact sizes and byte-equality check. The browser example was verified
through the public import map: deferred initialization, recording seek/end,
stream Play/Next, disposal preserving four SVG nodes and successful remount.
That visual check preceded the constructor rename; constructor behavior is
covered by the updated instance, lifecycle and installed-consumer checks.
Console warnings/errors were empty. Browser-tool access was briefly interrupted
by a tab-limit approval check; the agent test tab was closed and verification
completed in an existing tab within the limit. No additional browser product is
certified by this embedded-host check. Exact-commit remote CI is pending.
