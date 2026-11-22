# AlgiViz 1.7.0

[Русский](ru/release-1.7.md) · [Current API](current-api.md) · [Environments](support-matrix.md#current-support-boundary)

AlgiViz 1.7.0 adds `stepHistory` to `Player`. A synchronous factory returns a
dense, nonempty array of explicit steps. The recording retains the event
and original index of every step. During time seeking, `frame.event` and
`frame.stepIndex` come from the step that supplies `frame.current`.
[Full history of steps](player.md#full-history-of-steps).

Restart calls the factory again. If the factory or validation fails,
playback pauses and the previous recording, position and frame remain
available. The `onError` callback receives the original failure.

The [bubble sort browser check](../test/step-history-array-browser.html)
passes the frame directly to the stock Canvas renderer to highlight a
swap during seeking. The [heap sort example](examples.md#heap-sort-with-player)
uses `stepHistory` for one Player that synchronizes an array and a tree.
The frame carries the heap event and the array panel gets its own event
from the shared snapshot. [Two panels in one Player](player-multiple-panels.md).

## Compatibility and environments

Import `PlayerStepHistoryOptions<State, Event>` from `/player` to annotate
an options object for the new constructor overload. The same constructor
continues to accept the four existing `PlayerOptions` branches, including
state-only `history`, whose `frame.event` is `undefined`. Existing source
narrowing and type inference still work.

The package has 16 ESM entry points and no runtime dependencies. The new
option uses the existing DOM and timing requirements for `/player`.
The examples and browser checks live in the repository.

[Changelog](../CHANGELOG.md)

## Publication

Released on November 22, 2026. All 11 CI jobs passed on the tagged commit.
The npm registry served 1.7.0 as `latest`. The English and Russian READMEs
and changelog matched the tagged files byte for byte. The registry README,
registry signature and provenance attestation also passed verification.
[GitHub Release](https://github.com/urffin/algiviz/releases/tag/v1.7.0) ·
[npm 1.7.0](https://www.npmjs.com/package/@grundyjs/algiviz/v/1.7.0)
