# Headless player reentrancy: selected U1 contract

[Русский](ru/headless-reentrancy.md) · [Playback](playback.md) · [API review](api-readiness-0.16.0.md)

**Selected and implemented locally on 2026-11-14; unreleased.** Released 0.16.0
does not enforce U1. The working tree now implements the contract below without
changing public signatures, exports, package version or dependencies. The earlier
local Worker fix remains independent of U1. Implementation evidence follows.

## Scope and decision

Apply the same rule to `createPlayer`, `createStatePlayer` and
`createArrayPlayer`. The protected commands are `nextStep()`, every
`advance(deltaMs)` (including zero), and `dispose()`.

An instance rejects a command entered while that same instance already has an
active synchronous operation or is executing application code on its behalf.
Rejection is a synchronous built-in `Error`, before another iterator call,
render, predicate, time/frame update or disposal takes place. There is no command
queue, coalescing, implicit deferral or new public error class/code. Exact error
messages are not a stable contract.

`frame` and `finished` remain readable. Commands on a different idle instance
are allowed. Once logical disposal has started, repeated `dispose()` is a no-op,
including during its own source cleanup. This exception does not make an initial
`dispose()` from render/source/predicate callbacks legal.

This does not replace the contracts of `/player`, `createRewindBuffer` or
`createAsyncSource`. In particular, the async adapter continues coalescing its
pending/reentrant reads. Timelines, emitters and scene dispatch are outside U1.

## Which application calls are covered

`isTerminal` is a synchronous test and may be evaluated multiple times for a
step. U1 adds no once-per-step predicate/getter guarantee beyond the existing
source-read and render contracts.

The protected interval includes construction/initialization and the full
dynamic extent of a command: source acquisition and reads, terminal checks,
rendering and cleanup. It ends only when the outer operation returns or throws,
after any synchronous cleanup. A rejected inner call does not acquire/release
the outer operation's protection.

Covered application code includes:

- `render(frame)` and `isTerminal(step)`;
- the source's iterator factory and `next()`/`return()`, including generator body
  and `finally` code entered by those calls;
- accessors/callables read or invoked by the player to acquire or use the source,
  including callback-option getters, iterator methods, result `done`/`value`, and step fields;
- ordinary synchronous functions called by that application code, including
  event dispatch/listener calls that return before the outer operation ends.

A `frame` read may itself evaluate application-supplied step-field getters.
Such getters also cannot enter a command on the same player, even when the outer
entry was only a `frame` read. Nested read-only inspection remains allowed; it
does not unlock an enclosing operation. This closes an accessor path around the
rule without promising that recursive application getters terminate.

Factory initialization still reads/renders the first value synchronously. The
new handle is unavailable until the factory returns; no early-handle callback
is introduced. A captured older player's handle denotes that older instance,
not the new instance being constructed.

If initialization fails, the factory returns no handle. Cleanup is attempted
only for an iterator already acquired/owned; no readable frame is promised for
an unsuccessful construction. The usual primary-error precedence still applies.

The player owns its iterator. Calling that iterator's methods independently is
outside the ownership contract; command protection does not proxy or intercept
arbitrary calls made directly to application objects.

## Command matrix

| Context of an attempted same-instance call | `nextStep()` / `advance(...)` | `dispose()` | `frame` / `finished` |
| --- | --- | --- | --- |
| No operation active, not disposed | Existing manual/timed rules | Begins logical disposal, then cleanup | Allowed |
| Active render, predicate, source read/acquisition or another command | Synchronous Error | Synchronous Error | Allowed |
| Source `return()` during normal terminal completion, not logically disposed | Synchronous Error | Synchronous Error | Allowed |
| Source cleanup after explicit disposal or an operational failure has latched disposal | Synchronous Error | No-op | Allowed |
| Idle and already disposed | Existing disposed Error | No-op | Allowed |
| Step getter evaluated by a `frame` read | Synchronous Error | Error unless already logically disposed | Allowed |

For `nextStep`/`advance`, active-operation rejection precedes argument or disposed
validation. Thus even `advance(0)`, `advance(NaN)` and commands on a finished
player are rejected inside a callback. Outside that interval, the existing
validation behavior remains: an invalid delta/manual positive advance rejects
without consuming data or automatically disposing an otherwise usable player.
For `dispose`, already-logically-disposed idempotence takes precedence.

Closing the source at a terminal boundary is distinct from logical player
disposal. A player may still redraw/complete its final hold after source closure.
Therefore a first dispose from that normal-completion return callback is rejected;
it is not silently treated as an already performed disposal.

## Read-only observations

Reading does not request another source value, advance time, re-run rendering or
call `isTerminal`. Frames retain the existing immutable wrapper and referenced
snapshot contract; getter identity and deep cloning are not promised.

During callbacks, reads observe the state available at that point of the outer
operation. Source reads, candidate terminal checks, source closure and rendering
are different stages: `frame`/`finished` are not a transaction or cleanup barrier.
Use `isTerminal(step)`'s argument for the candidate and `render(frame)`'s argument
for the chosen drawing. A later stage may change the player's observations.
There is no new promise of rollback to the last successfully rendered frame.

`finished` denotes playback completion, not disposal. Retained snapshots remain
application-owned and immutable while used. Reading remains legal after failure
or disposal, subject to ordinary errors from application-supplied field getters.

## Caught and uncaught errors

| Situation | Outer result |
| --- | --- |
| Callback catches the rejected inner command and returns a valid result | Outer operation continues with its normal read/render/timing behavior. The rejected command itself has no playback effect. |
| Rejection escapes render, predicate, source acquisition/read or step access during a command | Existing operational-error handling: logically dispose, attempt the owned cleanup at most once, preserve the readable frame and rethrow the same primary value. No extra render/read is introduced. |
| Source cleanup also throws while handling an earlier failure | Preserve the earlier primary value, including undefined. Do not retry return. |
| Standalone explicit disposal cleanup throws, including an uncaught rejected command | Disposal remains terminal; propagate that cleanup error once. A later dispose is harmless. |
| Normal-completion return callback leaves a rejected command uncaught | Treat it as a standalone cleanup failure; the outer operation fails/disposes. The source is not returned a second time. |
| An application getter throws out of an otherwise idle frame read | Propagate the read error and release the read's protection; the read itself does not automatically dispose the player. If it escapes through an active command's callback, that outer command applies its normal failure handling. |

No rollback of application side effects is promised. A successfully caught inner
Error is not a hidden fatal flag. Conversely, an uncaught error is not swallowed
merely because it began as a reentrancy rejection. If the callback replaces it
by throwing another value, ordinary primary-error rules apply to that value.

During explicit disposal, logical disposal is latched before reading/calling
`return`. Repeated dispose inside that cleanup is a no-op; next/advance remain
rejected. The same idempotence applies to cleanup after a failure. Iterator
methods must not overlap, and existing early-close/natural-EOF distinctions
remain intact. No synchronous cleanup-result validation/draining policy is added.

A source's own `finally`, running inside its `next()`, is still part of the
active source call. The engine can latch failure only after that call throws
back to it; a first dispose before then remains a reentrancy error. Application
code may replace its own exception in `finally` under ordinary language rules.

## Other instances and deferred commands

If A's callback calls idle B, B may run normally. If B synchronously calls back
into A, A's commands are rejected until A's outer call finishes; reading A is
allowed. Uncaught errors propagate through each instance's existing failure
handling; catching B's error in A's callback lets A continue normally.

Application-scheduled microtasks/timers that run after the outer operation ends
are separate commands. They may run if the player remains usable, or fail under
its disposed/validation rules. The application handles those later errors.
Callbacks are synchronous hooks: the player does not await returned promises or
collect errors from application-scheduled work. No new scheduling API is added.

## Implementation acceptance

The following acceptance groups are covered by the public-API regression suite
[test/playback-reentrancy.test.mjs](../test/playback-reentrancy.test.mjs):

| Case | Required observation |
| --- | --- |
| Each protected command from render, predicate, next/method/result getter and synchronous helper | Inner Error before mutation, iterator entry or extra drawing; include advance(0), invalid delta and already-finished playback. |
| Caught rejection for explicit steps, plain states and array playback | Outer result and read/render counts match a non-reentrant control, including partial transitions and final holds. |
| Uncaught rejection from render/predicate/source | Terminal failure, preserved primary identity/readable frame, cleanup at most once, no iterator overlap or later implicit drawing. |
| Natural terminal return: caught/uncaught next, advance and initial dispose | Correct continuation or cleanup failure respectively; a closed source is not confused with a disposed player. |
| Explicit dispose/failure cleanup: repeated dispose plus caught/uncaught advance | Idempotence, no return retry, terminal state before callbacks; cleanup cannot replace an earlier failure. |
| Accessor invoked by an idle frame read; nested reads | Mutation rejected, no implicit read-error disposal, protection released on success/throw; subsequent independent commands work. |
| A → B, A → B → A, including errors caught at either level | Per-instance isolation rather than a global lock. |
| Callback-scheduled work after return/throw | Ordinary independent commands; no internal queue/await behavior. |
| Initialization and baseline playback | Initial render/acquisition timing unchanged, no early handle; preserve source indices, EOF/holds, validation, error precedence and source ownership. |
| Published declarations and package consumers | No new method, option, status field, error code/class or export; strict installed consumers and affected `/player` paths still pass. |

The earlier audit example returning frame 1 while the stored frame becomes 2
describes the unguarded published baseline. The guarded implementation rejects
that nested command; it is not a queued second step.

## Local implementation, 2026-11-14

The shared playback engine protects commands, initialization and frame-field
reads per instance. Logical disposal is latched before cleanup. The private
plain-state adapter now defers return to its owning engine instead of cleaning
up inside a generator failure before the engine can latch disposal. It releases
the original source reference during acquisition and its owned iterator on
closure or EOF.

The public regression suite covers 61 cases across explicit steps, plain states
and arrays, with caught/uncaught callbacks, getters, terminal/explicit/failure
cleanup, primary-error precedence, other instances, deferred work and native
generator behavior. The earlier 59-case baseline run failed 41 cases before
the fix. Final full-suite, installed-package and declaration checks are recorded
in [verification data](checks/u1-reentrancy-2026-11-14.json). Only the private
state-steps declaration changes to IterableIterator; no package-exported type
or function signature changes. Publication remains deferred.
