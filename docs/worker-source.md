# Worker source adapter: behavioral contract

[Русский](ru/worker-source.md) · [Async behavior](async-sources.md) · [Adapter API](async-source-api.md) · [Player integration](player-async-api.md) · [Plan](optional-player-proposal.md)

## Design stage, 2026-11-14

This selects behavior for the browser Worker transport over the 0.15.0
async-source contract. The transport/endpoint are **added in 0.16.0**;
version 0.15.0 has no Worker entries. The separate
[public API and implementation checks](worker-source-api.md) records names,
entries, options, reports and current verification. [Player integration](player-worker.md)
uses the existing asyncSource boundary and is also included in 0.16.0.

The host side supplies an `AsyncIterable<State>` to the existing
`AsyncSourceFactory<State>` boundary, forwarding its `AsyncSourceSignal`.
`createAsyncSource` remains the owner of public reads/cancellation; `/player`
continues using `asyncSource`, with no fourth source option or new phase/mode.
The worker side owns state generation. Rendering, frame timing, ready slots and
rewind remain on the host. There is no promise of faster rendering or lower
total memory/copy cost.

## Scope and ownership

- One session exclusively owns one **dedicated browser module Worker** and one
  iterator in it. SharedWorker, ServiceWorker, Node worker_threads, pools,
  multiplexing and borrowed/pre-existing Worker handles are outside this scope.
- The application supplies a synchronous factory returning a fresh Worker. It
  owns the URL, module entry, imports and browser/bundler/CSP configuration.
  Functions, closures and algorithm implementations are not sent as messages;
  the worker entry installs the matching protocol endpoint and source factory.
- Construction, status reads and mounting are lazy. The Worker factory is called
  only by the first source read. Disposal before it creates nothing. After a
  Worker is returned, ownership transfers to the transport, including failure
  before initialization completes. A factory that throws before transferring a
  handle must clean up anything it acquired. Reusing a live or terminated handle
  violates the contract; a recognized reuse fails before taking new ownership
  and must not terminate or disturb the existing owner.
- Acquire the host iterable/iterator facade before entering Worker-producing
  code. Its first next creates the Worker; creation/initialization failures
  reject that read. An outer createAsyncSource therefore already owns an
  iterator whose return can await cleanup. Throwing out of facade acquisition
  after secretly creating a Worker would bypass that barrier and is forbidden.
- The worker factory accepts initialization data and a worker-local cooperative
  signal, and directly returns `Iterable<State>` or `AsyncIterable<State>`.
  Async initialization belongs inside iteration. Each session acquires once;
  `next()` and optional `return()` never overlap in the worker.
- Initialization data is supplied anew for each session and cloned when its
  initialization message is posted. The application must not mutate it during
  serialization. Restart never resends a detached host input buffer.
- Teardown removes owned listeners, subscriptions and timers and requests
  `terminate()` at most once for a returned Worker, including after natural EOF
  or a cooperative close acknowledgement. No Worker is kept idle for reuse.

At most one current/retiring Worker and one prepared candidate are owned per
player. A candidate creates no extra pool. References/reports from older sessions
are released under the existing bounded-report rules.

## Requests and protocol boundaries

1. Before posting initialization, install message, error and messageerror
   handlers. Initialization negotiates the protocol version and session identity;
   readiness acknowledges iterator acquisition, not a yielded state. The first
   public read stays pending through startup and readiness.
2. Each pull has a monotonically increasing safe-integer request ID within a
   unique session. Exactly one unresolved state request is allowed. Repeated
   public reads share `createAsyncSource.next()`'s promise; they send no additional
   pulls. There is no prefetch, batch, queued Next, retry or read/startup timeout.
   ID exhaustion fails rather than wrapping into a live/old ID.
3. A pull invokes worker `next()` once and produces exactly one value, EOF or
   operational-error response. `undefined` is a value. Iterator return values
   are ignored. EOF is discovered by the additional pull after the last value;
   an empty source remains the existing first-read `RangeError`.
4. Protocol envelopes carry a reserved namespace, version, session and applicable
   request ID. Their shape, phase and response kind are checked before payload
   delivery. A malformed, duplicate, unsolicited or wrong-request response for
   the live session is a protocol failure, not another frame. Version mismatch
   fails initialization; nothing falls back to executing the source on the host.
5. Unrelated messages outside the namespace are ignored; messages for another
   session or an already retired transport cannot settle a live request. After
   cancellation, in-flight state replies are discarded, while only applicable
   close/error messages are processed for shutdown diagnostics. Listeners are
   removed after shutdown, not left to collect a message history.

No state schema validator is implied by a TypeScript generic: the application
owns State semantics. Protocol validation and serialization constraints are
separate from validating an application's graph, array or simulation model.

## Serialization and snapshot ownership

Initialization and states use structured clone, with **copying by default**;
there is no JSON round trip or custom codec in the first scope. Functions/DOM
nodes and other non-cloneable values fail serialization. Custom prototypes,
methods, object identity across messages and arbitrary error properties are not
preserved promises. Use explicit stable IDs to match objects between states.
The browser rules are specified by [structured serialization](https://html.spec.whatwg.org/multipage/structured-data.html#structuredserializewithtransfer).

Worker-to-host state transfer may explicitly opt into an `ArrayBuffer` transfer
list selected on the worker side for that emission. Initialization remains
copy-only. Buffers must be unique, attached, non-shared and reachable from the
state (directly or through views); the list is validated before posting. Other
transferable resource types are deferred. A transfer detaches the sender's
buffer; generation must allocate/replenish its own storage before reuse. Failed
serialization/transfer is terminal for the session, without a hidden clone retry
or a promise to restore already affected sender resources.

SharedArrayBuffer and views backed by it are excluded, including inside nested
containers, and must be rejected before accepting/posting supported payloads.
There is no shared mutable state or automatic transfer-back/buffer pool. The
supported data graph must be checked with cycle handling; this is not a constant
time validation promise. State schema validation remains application-owned.

Each received state becomes a host snapshot retained by reference under existing
rules, without another clone or deep freeze. The application must treat it as
immutable. In particular, buffers in visible, previous, ready or rewind states
must never be detached or sent back by the adapter. The ready/window bounds
limit the number of retained snapshots, not bytes; large messages can still cost
host serialization/deserialization time and memory.

## Errors and observable failure

| Failure | Selected result |
| --- | --- |
| Worker factory throws, startup/import/load error, version mismatch, initialization clone error | First read rejects; preparation rolls back after candidate cleanup. |
| Worker source factory/acquisition/next failure, invalid iterator result, state serialization/transfer failure | The corresponding read rejects once; stop further pulls and begin shutdown. |
| Host postMessage throws, observable Worker error/messageerror, invalid live protocol response | Terminal transport failure; reject a pending read promptly and begin shutdown. |
| Error while no read is pending | Latch the first error and begin shutdown immediately. The next read rejects with it. No unsolicited player callback is added to the pull-only async contract. |
| Worker abort listener/return failure or host teardown failure | Actual cleanup failure; retain it in cleanup diagnostics, even if the Worker is subsequently terminated. |
| Owner cancellation wins before delivery | Normal cancellation, not a new onError. Late values are discarded; genuine late failures remain diagnostic. |

Local thrown values retain their identity through `createAsyncSource` as before.
A remote thrown value cannot retain cross-thread identity: transmit a bounded,
clone-safe descriptor with origin/phase and best-effort name/message/stack, then
reject with one local error representing it. Do not depend on cloning the thrown
object itself, running its custom stringifier or preserving its prototype/cause.
Distinguish an absent value from a thrown `undefined`. Descriptor field names,
length limits and the public error type are settled at the API stage.

Serialization of a state failing must trigger a small clone-safe error response;
if even that cannot be sent, surface an uncaught worker failure where the host
can observe it. No recursive error-posting loop or automatic restart is allowed.
An error named AbortError alone is not owner cancellation. First observed
terminal outcome wins; cleanup cannot replace a primary operational failure.

A browser Worker has no general host-side exit acknowledgement. Silent
`self.close()`, a missing endpoint or a source that never answers can leave a read
pending; no heartbeat/default read timeout is invented. Explicit owner shutdown
still follows the finite grace policy below. External termination/reconfiguration
by the application while the adapter owns the Worker is unsupported.

## Cancellation, shutdown and completion

Owner abort or iterator return starts one shared, idempotent shutdown operation.
Abort is observed through a signal subscription immediately, even while a remote
read is pending; it must not wait for `createAsyncSource` to call iterator return.
Stop sending pulls and accepting values first. Send at most one cancellation
message, signal the worker-local source, then serialize its optional return after
the outstanding worker next settles. Natural EOF does not call return again.
An implemented return must complete with `done: true`; cleanup is not drained.

Cancellation reasons remain the original `unknown` value on the host. The wire
uses a clone-safe control description; it never tries to post an arbitrary host
reason, DOM signal or callback. The worker-local reason is that description,
not the identical host object. Cancellation delivery/normalization cannot block
fallback termination because a reason is non-cloneable.

The selected shutdown policy is cooperative cancellation followed by forced
termination after a **1000 ms default grace period**, configurable to another
finite nonnegative millisecond duration; zero requests immediate termination.
Infinity is excluded in this first contract. One deadline starts at the first
shutdown request, including startup cancellation; subsequent calls, messages and
cleanup phases do not extend it. A cooperative acknowledgement is valid only
after the acquired iterator's outstanding calls and cancellation listeners have
settled, with actual cleanup failures included. Then request terminate and finish
host teardown without waiting for the deadline. No acknowledgement by the deadline
means request terminate and discard that transport's remaining remote work.

The deadline uses host timers; it is not a real-time guarantee while the host is
suspended or blocked. Forced termination cannot promise execution of worker
finally blocks or remote external-resource cleanup. The browser's
[worker termination](https://html.spec.whatwg.org/multipage/workers.html#terminate-a-worker)
does not provide an awaitable confirmation of those effects.

Forced termination at the configured deadline is an expected shutdown outcome,
not by itself a cleanup error or proof of graceful cleanup. Already observed
listener/return/protocol/teardown failures remain failures. The transport needs a
stable, never-rejecting per-session completion report distinguishing no Worker
created, cooperative acknowledgement and forced shutdown, termination
requested/failed, and bounded error diagnostics (count and first error, no
lifetime journal). The [API design](worker-source-api.md) specifies these
declarations and observation through each factory result's closed promise.
It resolves after all owned host promises/timers/listeners settle and termination
has been requested or its failure recorded; it claims no physical exit signal.
Late operational read errors remain diagnostic. An invalid applicable close
acknowledgement is instead a cleanup/protocol failure, not a successful close.

### Compatibility with createAsyncSource.closed

The public pending read is cancelled promptly by `createAsyncSource.dispose()`;
the underlying transport read and return must still represent shutdown honestly:

- With a cancelled transport read outstanding, discard its late state and keep
  that underlying call pending until shutdown finishes. Successful shutdown can
  then resolve it with done. This is not natural EOF delivered to the user: the
  outer adapter's disposed outcome has already won.
- If shutdown has an actual cleanup failure, reject that underlying call and
  make iterator return await/reject with the same shared shutdown failure.
  The outer adapter then observes a late diagnostic and an actual return cleanup
  failure. The cleanup failure is counted once, not as a second onError.
- Without an outstanding read, iterator return directly awaits the same shutdown
  and reports actual cleanup failure by rejection. Repeated return never starts
  another cancellation/termination operation.
- For natural EOF, release the transport before resolving the done response:
  `createAsyncSource` skips return after EOF and must not close ahead of Worker
  teardown. Operational read errors may reject promptly; their subsequent return
  remains the cleanup barrier.

Thus neither a cancelled request nor an early done reply can make outer closed
claim settled cleanup while owned transport work remains. No change to existing
AsyncSourceCloseResult/PlayerCloseResult fields is required: actual cleanup
failures use their existing return diagnostics. The separate transport report
explains forced versus acknowledged termination without redefining those types.
Multiple remote cleanup failures are summarized by one return error carrying
their count/first failure; the outer widget counts that one return occurrence,
not each remote detail again.

## Player controls, Restart and dispose

| Action | Worker behavior |
| --- | --- |
| Start | Lazily create one Worker; await initialization and first state; present paused. |
| Next / Play | Pull at most one unavailable state; coalesce or change presentation intent under the existing async contract. No autonomous worker stepping. |
| Pause / hidden document / Previous | Do not cancel or terminate the Worker. A pending reply may occupy one ready slot; cached rewind playback remains usable. No automatic resume. |
| Speed | Changes playback timing, not generation speed or waiting time. |
| Restart / Replay | Prepare a fresh Worker and first state before retiring the old one; then await old shutdown before installation. Restart installs paused; Replay autoplays only if its intent remains current. |
| dispose | Invalidate immediately, cancel both owned transports, remove UI and preserve the last readable frame. Asynchronous source/transport reports observe shutdown; no later render/status/error callbacks. |

Restart repeats coalesce. At most two Workers exist through candidate preparation,
old shutdown and failed-candidate rollback; another factory cannot bypass a
cleanup barrier. A failed candidate is stopped before the old paused session is
restored. Its old pending read/error remains quarantined and is applied normally
on rollback. A successful candidate performs no further pulls while the old
Worker is closing. Old late replies can never change the candidate's frame.

If the old Worker needs forced termination but has no actual cleanup failure,
replacement may proceed and the transport report identifies the forced stop.
If old cleanup actually fails, existing replacement-failure rules apply: close
the candidate, preserve the last readable frame, and do not resume the retired
old session. Dispose during any of these stages stops both Workers without
installing the candidate. UI disposal stays synchronous and idempotent; the
widget's stable closed promise also waits for source cleanup and UI teardown.

There are no new waiting phases or timers for presentation. Existing waiting,
preparing, cleanupPending, canPause, RAF suspension, final holds, work budgeting
and bounded rewind continue to apply. A frame budget limits pulls; it cannot
bound the CPU duration of a worker step or host clone/render operation.

## Acceptance and implementation evidence

Use a controlled transport/timer harness first, then real dedicated module
Workers in the built-in browser. Mock transport tests do not certify native
cloning, detachment, load/error events or termination.

1. Laziness, disposal before first read, fresh/exclusive Worker ownership,
   startup/version failure, reentrant cancellation during creation, and failed
   acquisition cleanup; acquire the host facade before creating resources so
   outer closed observes startup cleanup. Existing ES2022-only imports remain
   Worker/DOM-free.
2. One pull in flight, same-promise public coalescing, undefined state, finite /
   empty / infinite sources, extra EOF probe, no prefetch/retry, request-ID
   exhaustion and synchronous/asynchronous worker iterators.
3. Protocol namespace/version/session/phase/ID validation, duplicate and
   unsolicited replies, stale messages, readiness without pre-reading, late
   errors and errors with no pending pull. Missing/silently closed endpoint
   waits until cancellation; no fake error event is assumed.
4. Copy isolation, stable-ID semantics, cyclic cloneable graphs, init cloned per
   session, non-cloneable input/state/error, bounded fallback descriptors;
   ArrayBuffer transfer and sender detachment, reachable/duplicate/detached
   transfer validation, shared-memory rejection, and retained rewind buffers
   remaining readable after subsequent requests and shutdown.
5. Pause/Next/Play intent races, paused arrivals and errors, background read with
   cached replay, no wait-time debt, speed/hidden-document/EOF/hold/budget parity.
6. Cooperative shutdown with serialized return, ignored signal, synchronous
   infinite loop, never-settling next/return, grace zero/default/custom, one
   non-extendable deadline, acknowledgement/deadline/error races, actual cleanup
   failure despite termination, and one terminate request per owned Worker.
7. Closed never settles before transport release, including natural/empty EOF
   and cancellation during a read; actual cleanup errors reach outer return
   diagnostics rather than only lateReadError. No detached rejection or callback
   after disposal; reports distinguish forced from cooperative shutdown.
8. Restart success, candidate failure, old read/error quarantine and rollback,
   forced old shutdown with successful replacement, actual old cleanup failure,
   repeated Restart/Replay/Pause/dispose races; at most two owned Workers and no
   lifetime accumulation of reports/listeners/messages.

The standalone implementation and controlled/native acceptance are recorded in
the [API reference](worker-source-api.md). Subsequent [Player integration](player-worker.md)
is also verified through the existing asyncSource boundary for 0.16.0.
