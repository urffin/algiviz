# Player speed validation: selected U2 contract

[Русский](ru/player-speed-validation.md) · [Player](player.md) · [API review](api-readiness-0.16.0.md)

**Released since 1.0.0; unchanged in 1.3.1.**
[Current API](current-api.md) defines release status. The rules below apply to
the published package; dated reports retain their original verification scope.

## Scope and decision

The same `Player.setSpeed(value: number): PlayerStatus` contract applies to:

- `source`, including forward-only, bounded rewind and frame-budgeted streams;
- `history` recordings;
- `asyncSource`, including preparation, waiting and cleanup barriers;
- Worker sources connected through `asyncSource`.

This is a widget control setting. It does not configure the generator, async
adapter or Worker, and does not change the headless `advance` API. No new option,
method, status field, export, error code or error class is introduced. Initial
speed remains `1`; there is no constructor speed option.

Accept exactly primitive JavaScript numbers that are finite and strictly greater
than zero. Reject every other value synchronously with the built-in `RangeError`
from the method's realm. This includes invalid runtime types passed by JavaScript
or bypassing TypeScript: they do not receive a separate `TypeError`.

`RangeError` preserves the existing sync/history behavior and makes the rejection
independent of source choice. Local async/Worker validation now also throws
`RangeError`. The error class and rejection timing
are contractual; message text, stack, identity across different calls and a
custom code are not. This decision does not stabilize all numerical errors in
other methods or normalize application/source/DOM exceptions.

| Input | Result |
| --- | --- |
| `1`, positive fractions and custom values such as `1.5` | Accepted unchanged |
| `Number.MIN_VALUE`, `Number.MAX_VALUE` | Accepted unchanged |
| `0`, `-0`, negative numbers, `NaN`, both infinities | Synchronous `RangeError` |
| `undefined`, `null`, strings, booleans, boxed numbers, arrays, objects, bigint, symbols | Synchronous `RangeError`, without coercion |

The domain is equivalent to `typeof value === "number" && Number.isFinite(value)
&& value > 0`. Do not parse strings, unwrap objects, call conversion hooks, round,
clamp or select a nearest UI preset. The TypeScript parameter remains `number`.
No integer/safe-integer requirement, preset-only restriction or narrower upper
bound is added. The native speed picker keeps its current presets and custom
value representation; the API domain is wider than that list.

## Validation order and failure effects

For this method alone, check the value first, before disposal, active-operation
guards or preparation/cleanup availability. This retains the current order in
both controllers and is deliberately distinct from headless U1 command ordering.
For a valid value, retain the widget's existing command guards: disposal is
checked before active-operation/render/status reentrancy.

| Context | Invalid value | Valid value |
| --- | --- | --- |
| Live, idle, before Start | `RangeError`, no source acquisition | Store speed, remain idle |
| Live, paused or playing | `RangeError`, no change | Store speed, retain playback intent |
| Async preparing/waiting or cleanup pending | `RangeError`, no change | Store speed without bypassing the barrier |
| Live, finished or operational error | `RangeError`, no change | Store speed without restart or error recovery |
| Active guarded source operation, render or status callback on the same widget | `RangeError` | Existing synchronous reentrancy `Error` |
| Disposed, including its disposal notification | `RangeError` | Existing synchronous disposed `Error` |

A rejected call itself changes neither speed, status fields, frame, window,
clock baseline/debt nor playback intent. It does not acquire/read/close a source,
create or message a Worker, schedule/cancel RAF, update the DOM, notify status or
error callbacks, append a close-report error, or initiate cancellation/cleanup.
An existing pending read/cleanup may subsequently settle on its own; validation
does not freeze unrelated asynchronous work.

If a surrounding callback catches the rejection and returns normally, its outer
operation may continue. If the callback lets it escape, the outer operation
uses its existing callback-failure/cleanup rules. Thus “no effects from rejected
setSpeed” does not suppress an uncaught failure of the operation invoking that
callback. No deferred command or rejected promise replaces the synchronous throw.

## Accepted changes and time accounting

Outside guarded callbacks and disposal, a valid value applies even before Start,
in manual mode, during preparation/cleanup, at EOF or after an operational error.
It returns the ordinary synchronous `PlayerStatus` snapshot with the stored speed
and performs ordinary status/UI publication. No snapshot identity is promised.
Exceptions from that publication retain existing callback-error handling; U2
does not turn them into validation errors or promise a new rollback boundary.

An accepted change:

- stores the exact number, without reading a state, rendering a frame or changing
  position, progress, rewind history or source ownership;
- keeps Play/manual-Next/Replay intent, pending requests and preparation/cleanup;
  it neither starts nor pauses playback and never sends speed to the Worker;
- resets the wall-clock baseline, including when the new speed equals the old
  speed; already accumulated playback milliseconds remain unchanged and are not
  multiplied again;
- applies to subsequent wall-clock intervals after the baseline is established.
  The existing 100 ms real-time clamp remains before multiplication. Waiting
  time is not accumulated or replayed at the new speed;
- preserves existing error/hasError and does not recover a failed session.

The setting survives Start, Pause, Next/Previous, seek and Restart, including
async candidate installation. None of these controls resets it to `1`. Manual
Next is still one transition: speed neither enables Play without timing nor
changes manual navigation. A finished session needs its ordinary restart/replay.
In manual mode the speed picker remains hidden even though setSpeed is usable.

All finite positive boundary values remain valid even if later time arithmetic
overflows or cannot make representable progress. A later non-finite delta/debt
uses existing operational-error rules; validation does not precompute future
deltas, close a source or impose a hidden speed ceiling. No real-time pacing or
floating-point precision guarantee is added.

## Implementation acceptance

Public `/player` regressions in [player-speed.test.mjs](../test/player-speed.test.mjs)
cover source/history/asyncSource/Worker, stream options omitted/enabled, manual
streams and timed playback, and usable commands after caught failures.

| Scenario | Required observation |
| --- | --- |
| Numeric invalid values and runtime wrong types, including a throwing conversion hook | The same built-in RangeError, no coercion, no effects from the rejected call |
| Minimum/maximum finite positive numbers, fractions and non-preset values | Exact stored value and returned status; custom UI value; no eager arithmetic or source acquisition |
| Idle, paused, playing, partial transition, finished and error | Correct acceptance/rejection without implicit navigation, Play/Pause, restart or error clearing |
| Async Start/Restart preparation, blocked Play/Next, ready slot and delayed cleanup | One existing request/intent remains; no cancellation, extra pull, barrier bypass or replay of waiting time |
| Invalid/valid calls from guarded render/status/source callbacks and after disposal | Value-first precedence; caught rejection is harmless; uncaught callback failure follows the existing outer failure path |
| Speed change while RAF is pending, repeated equal value, bounded-work debt | Baseline reset, no extra/cancelled RAF, existing debt unchanged, new intervals use the new factor |
| Manual navigation, Pause/resume, seek, Restart and candidate installation | Speed persists; manual controls and capability rules are unchanged |
| Huge accepted value followed by non-finite playback arithmetic | Acceptance first; only the later operation fails under ordinary error/cleanup rules |
| Worker-backed idle/waiting playback | Same host-side validation; no speed protocol, new Worker, message or transfer |
| Public package consumers | Existing declarations/exports and source-option inference unchanged; installed-package runtime regressions and NodeNext/Bundler pass |

## Evidence and next step

The historical [design report](checks/u2-speed-contract-2026-11-14.json) records
read-only probes before implementation, including all four source configurations,
runtime types, valid boundaries and callback/disposal precedence. These are
baseline observations, not acceptance of unified errors. Worker probes here stay
idle and deliberately verify that no Worker is created; they do not certify
transport behavior during active playback.

The local change replaces async-controller TypeError with RangeError; the sync
controller already satisfied the contract. No public declaration, export, version
or dependency changes. All 55 new public regressions pass; the full repository
suite has 428 passing tests. Worker integration uses the real adapter and endpoint
over an in-process cloned-message transport, including delayed requests/cleanup;
it is not a new native browser/Worker verification. Results for the installed
archive and bundle isolation are in the [implementation report](checks/u2-speed-implementation-2026-11-14.json).

U2 shipped in 1.0.0. The dated reports above retain their original scope;
[current API](current-api.md) defines present guarantees and release status.
