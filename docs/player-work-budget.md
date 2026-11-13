# Stream work per animation frame

[Русский](ru/player-work-budget.md) · [Player](player.md)

## Contract selected before implementation, 2026-11-13

Add opt-in `maxStepsPerFrame` to source-backed `/player` options. It is a positive
safe integer. Omitted or explicitly undefined preserves current scheduling.
It applies to timed Play; manual controls remain synchronous. Recordings reject
the option: they sample an already available timeline without iterating steps.

One RAF callback may request at most that many next steps. A cached rewind value
and an end-of-source probe both count as one request. Initialization still reads
one value on Start. Manual Next completes the current transition or requests one
next step, regardless of the RAF limit. No lookahead or full history is added.

Each RAF adds its elapsed time, after the existing 100 ms wall-clock clamp and
speed multiplication, to pending playback milliseconds. Advance processes as
much as the request limit allows. Any remaining playback time carries into later
RAFs; no state is skipped. A partially entered transition may finish and a known
terminal hold may advance without another request. Render/status publish once per
RAF, after its bounded work; there is never a synchronous loop draining all debt.

Under sustained overload playback may lag behind wall time. The backlog is one
number, not queued snapshots. Once incoming playback time is low enough it can
catch up. Non-finite accumulated time is an operational error, with normal cleanup.
The step limit is a work-count ceiling, not a millisecond deadline or FPS promise:
one source call, render or callback can still block the browser.

Pause, Next, Previous, seek, restart, completion, error and disposal cancel the
pending RAF as applicable and discard unprocessed time. Resume begins from the
last presented frame. A rejected restart preserves that frame/session, paused,
without the old backlog. Hidden-tab pause follows the same rule. Speed changes
reset the wall-clock baseline but keep existing pending playback milliseconds;
that debt is not multiplied by the new speed again.

Source order, absolute stream indices, interpolation, rewind-window eviction,
known/unknown completion, final holds, failure precedence and ownership are
preserved. Headless `/playback` `advance(deltaMs)` still consumes its full request;
the budget is an internal engine facility selected only by the browser widget.
No new public factory or status field is required.

## Verification scope

Check per-RAF source/replay/probe counts, large deltas and speed, eventual parity
with unbounded playback once debt is drained, partial transitions and holds,
manual controls while behind, pause/resume, speed changes, restart rejection,
source/render/status/cleanup errors, disposal and rewind integration. Check both
the public DOM widget and installed-package types, with no DOM dependencies
introduced into headless imports. Native checks use the embedded browser.

## Implementation and local results

Implemented without new public exports or status fields. The private playback
engine checks a per-advance read allowance only when supplied by opted-in widget
sessions. The shared plain-state iterator adapter preserves existing cleanup
semantics. The controller holds one pending-time number. Final-hold accounting
subtracts consumed hold time before recording a remainder, preventing repeated
consumption of the same milliseconds on later RAFs.

All **225 tests** passed, including 12 budget regressions. Coverage includes
per-RAF limits, fractional durations and drained-debt frame parity, rewind replay,
EOF probes and holds, manual controls, speed changes, hidden-document pause,
restart success/rejection, failure precedence and accumulated-time overflow.
Installed-package consumers passed TypeScript 6.0.3 under NodeNext and Bundler,
including ES2022 without DOM and rejection of the budget option on headless
players/recordings. Bundle isolation passed.

Native checks used the embedded Chromium 157, DPR 1, visible document,
`stepDurationMs: 1`, speed 16×, `rewindCapacity: 8`, `maxStepsPerFrame: 2`.
Observed maxima were two step requests and two source requests per RAF;
the fixture recorded 420 total renders and zero RAF-limit violations. Pause stopped a long
stream at state 804 after 805 source requests. Two Previous operations (including
Enter activation), then Next, ended at state 803 with the same request count.
A fresh six-state source finished with its 50 ms hold; replaying its known final
state did not read it again. Restart/disposal closed the appropriate source once;
remount stayed idle without reading. The saved final observation is a new paused
session at state 1, four total source factories, 815 requests and three already
closed sources. One source remains intentionally active in that paused widget.
Console warning/error logs were empty.

[Native observations and source/build hashes](benchmarks/player-work-budget-browser.json).
Reproduce using `node scripts/serve-player-work-budget.mjs --output report.json`
and the printed local test URL. This verifies operation counts and controls,
not browser FPS, a CPU time ceiling or other browser products/versions.

The [rewind ownership check](benchmarks/player-work-budget-rewind-memory.json)
was repeated after changing the shared engine: sampled evicted values and source
iterators are released at capacities 3/64 over 10,000 new values. This diagnostic
uses manual navigation, with budgeting disabled; it checks retention regression,
not per-RAF counts. The pending budget itself stores only numbers by inspection.

These implementation checks preceded publication. Version 0.14.0 was then
published after exact-commit CI; see the [release verification](releases/0.14.0.json).
