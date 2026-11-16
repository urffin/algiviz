# Explicit steps in Player: selected design contract

[Русский](ru/player-step-source.md) · [Current Player](player.md) · [Quickstart comparison](quickstart-comparison.md) · [Compatibility policy](api-compatibility.md)

**Selected 2026-11-16; implemented locally, unpublished.**
stepSource and isTerminal are available in this working copy. Published 0.16.0
and candidate 5e2fd18 do not contain them. The design record below is historical.

## Source and frame model

Add one synchronous capability, **stepSource**, mutually exclusive with source,
history and asyncSource. It is a synchronous factory returning a fresh
Iterable<Step<State, Event>> on Start/Restart. An already-created player, iterator,
Promise, async-only iterable or array of retained history is not a replacement
for the factory. A factory may return a fresh array as its iterable; it is still
stream playback, not an inferred recording.
Async explicit steps and explicit-step recordings are outside this first
contract. Existing asyncSource/history remain state-only; no Worker integration
or extra release prerequisite is inferred from this design.

stepSource requires **isTerminal(step): boolean**. The predicate belongs only to
this branch; supplying it with source/history/asyncSource is a configuration
error. Exactly one non-undefined factory must be callable;
explicit undefined for the unused branches remains valid. No shape detection,
automatic event.type === 'done', or dependency on /array is introduced.

render and the frame getter expose **Frame<State, Event>**, with State endpoints,
the current step's Event and supplied index. They never expose nested ArrayStep
states in this mode. The intended quickstart connection is:

```ts
// Local unreleased API; install the working-copy archive.
const player = new Player(container, {
  viewport: canvas,
  stepSource: () => minimum([7, 3, 5, 2, 6]),
  isTerminal: step => step.event.type === 'done',
  render: draw,
});
```

The existing minimum generator and draw(ArrayFrame) then connect directly.
Its explicit text result is still application-owned; the new capability does
not make the stock array renderer retain a completed highlight.

## Public type direction

Reuse Step and Frame from /playback. Extend the existing names to
Player<State, Event = undefined> and PlayerOptions<State, Event = undefined>.
The class frame getter is Frame<State, Event> | null, and the step predicate
receives Readonly<Step<State, Event>>. Inference from stepSource must preserve
State/Event in render, isTerminal and frame without explicit type arguments.

Old one-parameter usages and pretyped source/history/asyncSource options remain
assignable with event typed undefined. State-only runtime modes still emit
undefined, even if the State object itself contains state/event properties.
An explicitly chosen Event type that cannot include undefined must reject a
state-only source: Player<number, string> cannot promise string events from
source: () => [1]. Event = never is not an escape hatch. A widened explicit Event
may cover undefined; it does not change the state-only runtime value.

The new branch retains viewport, labels, callbacks, timing, rewindCapacity and
maxStepsPerFrame. It adds no status/report field, phase/mode literal, label role,
runtime export, factory helper or new error class. The event generic must be
threaded through internal controls/sessions; explicit steps retain their Event.

## Admission, indices and terminal classification

Each successful read produces an object-like step. Capture its core envelope
in order: index, state, event. index must be a primitive finite number: wrong
type gives TypeError; NaN/infinity gives RangeError before state/event access.
Negative, fractional, repeated and nonconsecutive finite indices are allowed.
Time and navigation use sequence position, never differences between indices.
State/Event values, including undefined, have no application-schema validation.
An invalid yielded step, acquired iterator or next() result is TypeError at the
point it is observed; this does not add validation of return() results.
An iterator result must be object-like; its done flag follows ordinary iterator
truthiness. A truthy done before a terminal step is therefore early EOF.

Store a shallow immutable core envelope and pass it to isTerminal. Its state
and event retain their references; no deep clone/freeze of application values
occurs. Do not promise producer-wrapper identity or extra wrapper properties.
The producer may reuse its envelope, provided retained State/Event values stay
immutable. Envelope getters run during admission under the control guard;
application getter exceptions preserve their original unknown value.

Call isTerminal exactly once for each newly admitted sequence position, after
capture and before presentation/window insertion. It must synchronously return
a primitive boolean: no truthy coercion or awaiting a Promise. Wrong return type
is TypeError; a thrown value is preserved. Cache the classification with that
entry. Redraw, frame reads, hold, Pause and buffered replay never call it again.
A repeated object/index at another position is a new admission. The predicate
must classify data, not schedule commands or use call count as an algorithm.

The first terminal classification seals the stream's logical tail: never request
another next(), including while interpolating or rewinding. Complete its current
transition normally, then call the owned iterator's return at most once. Code
after the terminal yield is not guaranteed to run; use finally for cleanup.
finalHoldMs starts at the completed endpoint after source closure. Terminal
discovery alone does not prematurely end interpolation or the hold.

Empty input and EOF before any accepted terminal step are **RangeError**.
There is no implicit final step or EOF fallback. A single terminal first step
has previous === current and progress 1; with zero hold Start finishes it.
Infinite nonterminal sources are allowed; disposal closes them early.

## Control behavior

| Control | stepSource behavior |
| --- | --- |
| Construction/status | Validate configuration before factory calls or viewport movement. Mount idle without reading or rendering the source. Capture option callbacks; no async preparation |
| Start | Acquire one fresh candidate, read/classify its first entry and install it. Display that frame paused, or finished if already terminal with zero hold. Repeated Start does not create a new source |
| Next | Pause and clear clock debt. Complete a partial transition without reading, or request at most one next entry at a boundary. A terminal endpoint with zero hold finishes in that same command, without an EOF click. At a terminal endpoint, Next completes any remaining hold |
| Play | Requires timing and an initialized usable session. Interpolate by sequence order; stop after the terminal transition and hold. Finished sessions are not implicitly restarted |
| Pause/hidden document | Stop scheduling and discard pending time, preserving the current frame, admitted terminal classification and source ownership. No implicit return or extra read |
| Previous | Only with rewindCapacity; pause, discard a partial transition and show the preceding retained entry at progress 1. No factory/predicate call. At the oldest retained position it is a no-op |
| Restart/Replay | Pause and prepare a fresh candidate before retiring the old source. Restart stays paused (or finishes a singleton terminal); Replay requests autoplay only after successful preparation and when timing allows it. Reset the window, classifications and debt |
| Speed/reduced motion | Keep U2 primitive finite-positive/value-first RangeError rules and existing clock accounting. Reduced motion changes presentation, not logical terminal/hold timing or event/index |
| seek | Still unavailable: this is stream mode with unknown duration, not a recording |
| dispose | Logical stop before cleanup; release iterator/window ownership, stop RAF and remove UI. Idempotent, without another terminal check, next(), render or later notification. The last readable frame may retain application data |

Status remains mode stream, positionMs/durationMs null, waiting false,
preparing null and cleanupPending false at normal public boundaries. Existing
capability rules apply; Previous may remain available after completion when
earlier entries are retained. frame/status.stepIndex preserve step.index.
rewindStartIndex/rewindEndIndex remain absolute **zero-based sequence positions**,
not custom step indices. ArrayTrace uses matching positions/indices, but arbitrary
Step indices need not lie numerically inside the displayed retained range.

## Rewind, work and ownership

rewindCapacity counts admitted entries, including current. Store the full core
step and its terminal bit; bounded replay uses original event/index and never
re-runs isTerminal. Once terminal is discovered it remains the buffered tail;
no values after it are read. If Previous interrupts its transition, ownership
lasts until its first completed endpoint or disposal. Replaying it after closure
does not return the original iterator again, and restarts its final hold.

maxStepsPerFrame keeps its existing request-count meaning: new and buffered
advance requests count, while rendering/predicate calls are not a time budget.
It does not add prefetch, skip entries or interrupt one expensive callback.
Accepted terminal endpoints/holds need no EOF probe. Keep the existing RAF
wall-clock clamp, one presentation per RAF and debt-reset/speed rules.
Retained-entry bounds are not byte limits or limits on application references.

## Errors, replacement and cleanup

Wrong source selection/callability, missing/wrong isTerminal and incompatible
options throw configuration TypeError/RangeError before factory/DOM effects,
under the current option validation domains. Option getters may throw original
application values. Do not normalize source/predicate/render throws or infer
failure presence from truthiness.

Factory/acquisition/first-read/admission/predicate failures are preparation
failures. Attempt candidate cleanup once and preserve the previous usable
session/window/frame paused. Initial failure leaves Start retryable. No promise
of rolling back source-factory side effects is made.
Once a candidate is prepared, retire the old source before presenting the new
frame. An old return failure prevents installation, closes the candidate and
leaves a failed widget with its readable old frame. A render failure after
installation is an operational failure, not a rollback to the retired source.

Later read, early EOF, predicate, render or terminal-return failures stop and
close the affected session under existing sync-widget rules: preserve the
primary in error/hasError, notify onError after cleanup and return status from
the command. Operational failures are not newly rethrown by Next/Start/Restart;
exceptions from application notification callbacks follow existing propagation
and diagnostics. RAF failures do not create detached promise rejections.

Cleanup cannot replace an earlier primary, including undefined. Standalone
dispose cleanup failure propagates after UI cleanup, recorded with the existing
dispose diagnostic phase. No drain, retry, asynchronous return barrier or new
return-result validation is introduced. Player.closed remains the never-rejecting
**widget disposal** report, not natural source completion; sync steps add no
AsyncSourceCloseResult to its sources list.

Same-instance mutating calls from source/admission getters, isTerminal, render
or status callbacks are guarded under current widget rules. Reads of committed
frame/status are allowed; use the predicate's captured step for its candidate.
Repeated dispose after logical disposal is harmless. U2 invalid speed validation
still wins before lifecycle/reentrancy rejection. No automatic command queue or
support for asynchronous callbacks is added.

## Compatibility and acceptance

This is a public API extension, not a fix to the current quickstart. It widens
the exported source-selection union: existing source/async/else-history narrowing
can break. Under U3's union/public-type rules this design is classified as
breaking even when opt-in; a defaulted generic alone does not prove compatibility.
Before 1.0 publication it can be reviewed in a **new separately authorized 1.0
candidate**, with new exact-SHA CI/native evidence. After stable publication,
this closed-union widening requires the policy's breaking-release treatment;
it must not silently ship as a minor under an “optional option” label.
Candidate 5e2fd18, its archive and previous CI are historical. This working copy
changes the implementation, declarations and quickstart; new exact-SHA release
checks remain required before any publication.

| Acceptance group | Required observation |
| --- | --- |
| Types | State/Event inference and direct array renderer, exact frame getter, legacy options/default undefined event, all four exclusive branches and negative configurations; full selected compiler/resolution matrix |
| Terminal | First/single terminal, late terminal, positive hold/manual skip, pause mid-transition, no trailing reads, empty/early EOF and falsy throws |
| Admission | Getter order/errors, finite arbitrary/repeated indices, reused producer envelope, State/Event reference identity, boolean return validation and cached classification per position |
| Lifecycle | Preparation rollback, old/candidate return failures, render/status/onError precedence, callback reentrancy, early/idempotent dispose and disposal-report timing |
| Rewind/work | Capacities 1/N, evictions, ordinal window bounds versus custom indices, terminal replay without predicate/source calls, RAF budget/debt/speed and reduced motion |
| Integration | Minimum quickstart without frame bridge or extra EOF click; all existing source/history/async/Worker behavior, declarations, exports and loading boundaries preserved |

An isolated design-type probe passed TypeScript 6.0.3 strict NodeNext/Bundler,
including eight negative cases and the broken prior exhaustive narrowing. It is
not a compiled runtime declaration, full
compiler-matrix check, implementation regression suite or native verification.
[Design record](checks/player-step-source-contract-2026-11-16.json).

Implementation results: [local report](checks/player-step-source-implementation-2026-11-16.json).
