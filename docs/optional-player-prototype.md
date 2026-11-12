# Optional player prototype

[Proposal](optional-player-proposal.md) · [Interactive page](../examples/optional-player.html)

Implemented on 2026-11-12 after documentation commit `0d1490f`. This is local
example code for evaluating integration and lifecycle behavior. It is not a new
package export, a release or a replacement for the existing teaching walkthrough.

The prototype was committed at `12f8fb3`. Its implementation has since moved to
`src/player` in the working tree, with the [unreleased `/player` reference](player.md)
and [bundle-isolation evidence](player-bundle-check.md). The observations below
record the prototype stage; they do not replace checks of the new package entry.

## What is reusable

- [Controller, now in src/player](../src/player/controller.ts)
  uses only public `/playback`. It owns either a lazy plain-state session or an
  explicitly provided recording, advancement, speed, frame scheduling, status
  and source cleanup. It has no DOM
  dependency and receives its scheduler from the view.
- [Mounting, now in src/player](../src/player/mount.ts) mounts one player shell
  containing the caller's viewport and an integrated, auto-hiding overlay panel,
  using its owner document/window. It has no fixed IDs,
  global DOM lookup or import-time DOM access. Text labels are configurable;
  styles are prefixed and created only when mounted. Two instances are independent.
- [optional-player-demo.mjs](../examples/optional-player-demo.mjs) owns the circle,
  graph traversal, snapshots, Canvas drawing, retained SVG objects and diagnostic
  counters. Those domain/rendering choices do not enter the controller or view.

At the prototype stage the modules/page were outside the npm allowlist. The
working-tree promotion now adds `dist/player` and its export; the domain demo
page remains example-only. The original four entry points remain unchanged.

## Integration and behavior

Assuming a container with a Canvas/SVG child, immutable-state factory and draw callback:

```js
const { Player } = await import('@grundyjs/algiviz/player');
const ui = new Player(container, {
  viewport: canvas,
  source: () => states(),
  render: draw,
  // stepDurationMs: 1000, // enable timed Play/Pause and speed
});
// On application teardown:
ui.dispose();
```

The supplied `viewport` must be a direct child of the container. Mounting embeds
that same element in the shell and adds its panel without creating a source or
changing Canvas bitmap dimensions. The drawing node is not cloned or recreated.
Omitting `viewport` retains a controls-only integration. The interactive page
uses the integrated layout for both Canvas and SVG; diagnostics and teardown
buttons are in a separate, initially collapsed section.

The panel uses small inline SVG icons with accessible names and hover titles,
an elapsed/total playback-time display for recordings, speed on the right and
Replay in the Play position after completion. Icons have no external assets.

With a viewport, controls overlay its lower edge instead of adding a footer row.
After Start, two seconds without activity hide the panel by fading it and
disabling its pointer hit area. Moving the pointer, a tap/pointer press or keyboard
activity reveals it. Controls stay visible before Start, for errors, while the
pointer is over the panel, during a held pointer/slider interaction, while the
speed selector is focused and during keyboard focus inside the player. Leaving
the interaction releases the hold and schedules hiding again. Phase changes
briefly reveal the panel, including completion. Frame updates do not reset the
inactivity timer or pause playback.

Hidden controls remain in the accessibility tree and tab order; focus reveals
them. No click-to-play handler intercepts the caller's visualization. Reduced
motion removes the fade. Teardown cancels the hide timer and interaction
listeners, including when source cleanup throws. `autoHide: false` keeps the
ordinary always-visible footer; controls-only mounting without a viewport also
keeps that footer. The overlay viewport has a 160 px minimum height to leave
room for wrapped controls in narrow layouts; Canvas bitmap dimensions stay
application-owned.

Choose exactly one input factory:

- `source: () => states()` is forward-only streaming. It retains adjacent
  snapshots and does not know total duration. Its seek bar and Previous button
  are always hidden, even with `seekBar: true`. The stream badge describes the
  source capability, not a claim of live network video.
- `history: () => savedStates` explicitly supplies a dense, finite array of plain
  states. It requires `stepDurationMs`; the adapter uses the public timeline API
  and retains the recording. It supports Previous and time seeking. The player
  never collects an arbitrary iterable to obtain this capability.

`seekBar: false` optionally hides a recording's slider without removing its
programmatic seeking capability. With the default `true`, the slider is shown
only for a recording and stays disabled until Start establishes its duration.
Native range input supports pointer and keyboard seeking; seeking pauses Play.
Recordings require memory for the full history, unlike streaming.

Start invokes the chosen factory and displays the first state, paused. A
recording is materialized only by its explicit factory at this point. Streaming
manual mode needs no timing and hides Play/speed.
Next completes an existing transition or requests one next state at a boundary.
Next during Play pauses scheduling first. A request after the last yield detects
exhaustion for streams, retains the last frame and disables Next without removing
the button. A recording knows its final state and completes at its duration;
it does not require a subsequent exhaustion request.
`finalHoldMs` defaults to zero and has the core player's documented behavior.

Restart prepares a new source before closing the old one and shows its first
frame paused. Failed preparation retains the old session and reports the error;
render/source failures stop scheduling and close the failed session. If closing
the old session fails, the already prepared candidate is also closed. Cleanup
failures do not replace a primary rendering/source failure. Standalone disposal
cleanup errors propagate after UI cleanup.

The handle exposes `status`, `frame`, `start()`, `play()`, `pause()`, `next()`,
`previous()`, `seek(positionMs)`, `restart()`, `setSpeed()` and `dispose()`.
Previous/seek reject streaming sources. Status includes `mode`, `canSeek`,
`canPrevious` and recording-only `positionMs`/`durationMs`; unavailable times are
null. A recording can seek back after completion. UI Replay creates a new session
and starts Play; programmatic `restart()` still creates a paused first frame.
`onStatus` observes status changes,
including the initial idle state; `onError` receives operational failures after
cleanup. Render/status callbacks are observational: synchronous mutation of the
same controller from inside them is rejected. This restriction and callback
surface remain prototype choices to review before a public API is added.

Disposal is idempotent. It closes the source once, cancels RAF, removes its
listeners and shell, and restores the supplied viewport at the shell's position
in the caller's container before removing the shell. The caller's drawing and
other children are preserved, including when source cleanup throws. Handles
remain disposed; remounting embeds the same drawing node with new idle controls.
Hidden tabs pause without automatically resuming. Reduced motion redraws the
same raw frame at its current endpoint without consuming a state. Timed playback
caps a wall-clock delta at 100 ms before speed multiplication, intentionally
discarding long stalls rather than accumulating catch-up work. It cannot interrupt
one expensive synchronous source operation.

The demonstration page dynamically imports the view only after its connect
button. Its host remounts idle widgets after BFcache restoration; the widget
itself disposes on pagehide. Production navigation/remount policy remains the
host application's responsibility.

## Verification

- `npm test`: **170 passed**, including 25 new prototype tests in
  [optional-player.test.mjs](../test/optional-player.test.mjs). The public build
  and existing type checks passed. The most recent complete run includes the
  speed, viewport ownership, recording/stream and auto-hide interaction regressions.
- Tests cover deferred source creation, no lookahead, the extra completion
  request, infinite sources, exact mixed controls, final hold, natural completion,
  wall-clock clamping, source/render/status failures, failed replacement,
  cleanup-error precedence, retry, disposal, multiple instances, hidden tabs,
  reduced motion, pagehide and arbitrary positive speed labels without an
  ever-growing option list.
- Integrated viewport regressions verify the same drawing node, panel inside the
  shell, lazy initialization, restoration between caller siblings, listener
  cleanup even when closing the source throws, and rejection of an unrelated
  viewport before moving any DOM or reading any source.
- The view tests exercise the actual module against a small DOM/event harness;
  they establish ownership and cleanup, not browser layout or accessibility.
  Importing the modules in the Node tests requires no DOM globals.
- The initial forward-only embedded Windows Chromium UI check recorded 14 observations: no widgets before
  connecting, two idle widgets with zero source reads after connecting, circle
  start/manual steps/exhaustion, graph Play/Pause and Next interruption, restart,
  speed, early disposal, remount, natural completion and independent controls.
  The initial page-wiring error found during this pass was corrected before the
  completed checks. Console warning/error results were empty.
- Removing the circle's controls while the graph was playing closed only the
  circle's source. The retained **510 × 147** Canvas screenshot interior, inset
  four CSS pixels, matched exactly after decoding the before/after JPEG captures.
  This verifies visible preservation at that viewport, not the raw backing store.
  SVG attributes and counters were retained after its controls were removed.
- Local task artifacts contain `browser-result.json`, `canvas-preservation.json`,
  `prototype.jpg` and the complete `npm-test.log`. The small later UI correction
  for programmatic non-preset speed labels is covered by the final automated test;
  the interactive run used the supplied speed presets.
- The integrated-panel follow-up recorded five further browser observations in
  `integrated-browser-result.json` and saved `integrated-player.jpg`: two embedded
  viewports/panels with zero initial reads, manual/timed controls, independent
  disposal and restoration, and successful remount of both. Canvas retained its
  600 × 180 bitmap dimensions and visible circle; SVG retained four vertices and
  its active-node attributes. CSS sizing may change when the outer shell is
  removed; the earlier screenshot equality result belongs to the original
  controls-only check. No warning/error console entries were returned.
- The media-panel pass recorded seven observations in `media-browser-result.json`
  and saved `media-player.jpg`: deferred recording/source creation, slider End/Home
  and PageUp, step backwards, Play/Pause icon/name changes, seeking that pauses
  Play without recreating history, streaming Next with no seek/Previous, and
  Replay followed by natural completion. The recording displayed 0:03 / 0:03 at
  completion and captured a new four-state recording on Replay; the streaming
  source was unaffected. No warning/error console entries were returned.
- Automated recording tests additionally cover slider opt-out, post-completion
  seeks, clamping, final hold, singleton history, array/timing validation and
  failed recording preparation preserving the prior session. An iterable passed
  as history is rejected without being iterated.
- Auto-hide regressions additionally cover timer expiry while playback continues,
  pointer reveal, panel hover, keyboard versus pointer focus, native speed-picker
  focus, held touch/drag and release/cancellation, persistent error visibility,
  late callbacks after disposal and `autoHide: false`.
- The auto-hide browser pass recorded six observations in
  `autohide-browser-result.json`, with `autohide-hidden.jpg` and
  `autohide-visible.jpg`. Both panels hid after inactivity; moving/clicking the
  recording viewport revealed only that instance without consuming states.
  Keyboard focus on the slider kept controls visible beyond the two-second
  deadline; releasing focus allowed hiding again. The stream continued playing
  with hidden controls (state 2, three yields, zero closes). The recording player
  measured **162 px** high both before and after hiding, with a **160 px** viewport:
  no footer space was reserved. Console warning/error results were empty.
  Touch/held-drag behavior is unit-tested, not a claim of physical-phone testing.

The observations above did not test an installed UI package, production bundle,
accessibility audit or broad browser matrix. The later package/type/bundle checks
are recorded separately in the current reference/report. Exact-commit CI for the
public-entry implementation is still pending.

## What this simplifies, and what remains

The integration has one mount call instead of caller-written button wiring,
RAF scheduling, status updates, source restart and cleanup. The generator and
drawing still belong to the user. An already minimal manual `createStatePlayer`
plus one Next button is short; the widget's main benefit is a complete reusable
UI and lifecycle. Keep the instructional example for understanding the core API.

The prototype supports plain-state streaming and explicit finite recordings.
There is no explicit-step adapter, async source, worker, autoplay, editor or export.
The public API naming/types, callback/reentrancy policy, styling/CSP policy and
the scope of further adapters still need review.

The entry point, typed API, installed consumers and bundle fixtures are now
prepared in the working tree. Review that implementation and require successful
exact-commit CI before any authorized release. Package version/publication remain
separate steps.
