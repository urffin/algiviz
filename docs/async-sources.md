# Asynchronous state sources: contract

[Русский](ru/async-sources.md) · [Development plan](optional-player-proposal.md) · [Player](player.md)

## Scope, 2026-11-13

This contract covers the standalone adapter and widget integration published
in 0.15.0. See the [release verification](releases/0.15.0.json).
Start/Pause/Restart and RAF sections below describe widget behavior;
the adapter uses next/dispose as specified in its public API.

The first async capability accepts `AsyncIterable<State>` with immutable states,
not only async generators. A separate headless adapter owns iteration; `/player`
integration is available in 0.15.0. Existing synchronous factories, return types, error delivery
and headless imports remain compatible. Recordings remain synchronous arrays.
Render and notification callbacks remain synchronous; asynchronous renderers are
outside this contract.
The separate [public adapter API/type design](async-source-api.md) now specifies
export names, the cancellation signal, read results and cleanup reports. The
[proposed widget integration API](player-async-api.md) now defines source options,
waiting/preparation metadata, controls and widget cleanup. Headless declarations
must still compile with ES2022 alone, without DOM or Node types.

## Ownership and requests

- Construction does not invoke the source factory. Start acquires a fresh private
  iterator and requests its first state. Each restart uses another factory call.
  The factory returns an async iterable directly; asynchronous initialization
  belongs inside iteration, not a promise of an iterable.
- The session owns the iterator exclusively. There is at most one unresolved
  `next()` per iterator; no prefetch, queued Next commands, implicit retry or
  default timeout. A synchronous throw and a rejected promise are both failures.
- No first frame exists until the first state arrives. Start presents that state
  paused, with index zero. Subsequent committed states have consecutive indices;
  generator return values are ignored. An empty source is a preparation error.
- No lookahead: a request after the last yielded state discovers `done`. EOF
  preserves the last frame/index. Final hold begins only when playback at the
  live edge processes that EOF; waiting or a paused EOF does not spend hold time.
- States are retained by reference, without cloning or freezing. Default
  retention is adjacent frames plus at most one uncommitted result. Optional
  rewind adds only its bounded window; no complete history is collected.

## Waiting and the playback clock

Waiting is independent of playback intent: a player may be playing or paused
while a request is pending. The future status must distinguish a pending source
request from Start/Restart preparation, including waiting for cleanup. A waiting
label must not imply completion or failure. Before the first state there is no
step index or progress. At a live-edge data stall the visible frame stays
unchanged; a background pending read does not freeze cached rewind playback.

At a transition boundary, Play requests the next unavailable state and suspends
its clock. It discards unprocessed playback time, including work-budget debt,
and accumulates no wall time while waiting. Arrival schedules a RAF; that RAF
commits the next transition at progress zero with a fresh clock baseline.
There is no jump, skipped state or catch-up for time spent waiting. Existing
100 ms clamping and speed multiplication apply only to running clock intervals.

No RAF polling is scheduled solely to await a promise. Promise completion never
starts another source read. Available rewind values can still use the existing
per-frame budget. A source read/EOF probe counts when initiated; accepting its
result does not count the same request again. Cached forward steps count as
before. Async iteration does not move CPU work off the calling thread or make a
single expensive source/render/callback interruptible.

## Controls

| Action | Selected behavior |
| --- | --- |
| Start | Requests the first state once. Repeated Start during preparation coalesces. Play/Next/Previous are unavailable until preparation finishes. No autoplay. |
| Next | Pauses and discards clock debt. Finishes a partial transition without a read; otherwise consumes a retained/ready state or requests one. An asynchronous manual result is shown at its endpoint. Repeated Next during that request coalesces into the same intent, not several steps. |
| Pause | Cancels the RAF and pending presentation intent, clears clock debt, but does not abort the source or its outstanding read. A later result occupies one ready slot without changing the frame. A later Play/Next consumes it. Start/Restart preparation still completes paused. |
| Play | Requires timing and an initialized session. Reuses a pending request or ready result instead of making another read. A pending manual Next becomes timed playback intent. Repeated Play is idempotent. |
| Previous | Pauses and moves within the retained window immediately, even with a live-edge request pending. Its eventual value stays outside the window until forward playback reaches the edge and commits it; arrival alone neither evicts history nor advances the index. |
| Speed | Changes future clock intervals, without cancelling a read or multiplying waiting time. |
| Hidden document | Same as Pause; becoming visible does not resume automatically. |
| dispose | Immediately disables controls, invalidates pending presentation/preparation, removes UI listeners/timers and preserves the last readable frame. It requests cooperative cancellation and asynchronous cleanup. Repeated disposal does not repeat either operation. |

Control methods on the existing widget remain synchronous: their returned
status describes the accepted command, not completion of asynchronous work.
Source errors arriving while merely paused still fail the current session.
Seek remains unavailable for streams. `pagehide` follows disposal.

## Restart: preparation, then replacement

1. Pause the old session and discard its clock debt. Keep its frame and rewind
   window. Create one candidate and await its first state. Repeated Restart while
   preparing coalesces; it does not create additional candidates. Other playback
   commands are unavailable until preparation completes; Pause, valid speed
   changes and disposal remain usable.
2. If the candidate factory, iterator acquisition or first request fails, report
   the preparation error and close the candidate. Preparation remains pending
   until this cleanup settles; another candidate cannot bypass it. Then restore
   the old paused session, or remain without a frame in the error state if there
   was none. Start can retry after cleanup. The old session's outstanding
   result/error is quarantined during preparation. On rollback, first report the
   candidate failure, then apply that old outcome normally: an old value stays
   ready, while an old read failure independently fails the restored session and
   is reported once. Candidate failure alone cannot destroy a usable old session.
3. Once the candidate has a first state, retire and cancel the old session. Await
   its cleanup before installing/rendering the candidate's first frame, paused.
   The candidate performs no further reads during this wait. A failure closing
   the old iterator fails replacement, closes the candidate and preserves the
   last readable frame; the retired old session cannot be resumed.

This cleanup barrier bounds ownership to one old session and one candidate,
rather than accumulating abandoned iterators across restarts. Consequently an
uncooperative old source can delay Restart indefinitely, even when the new first
state is ready. The UI remains responsive and can be disposed. Disposal abandons
presentation immediately; it cannot force the source's underlying work to stop.
Errors from an already retired request never affect a replacement session.
Cleanup already pending after an earlier failure is also a barrier before a new
factory call. The same bound covers failed preparations and recovery attempts,
not only successful restarts. Logical disposal is still immediate and does not
claim that physical cleanup has finished.

## Cancellation and cleanup

The factory receives a per-session cooperative cancellation signal. Pause and
Previous do not cancel it. Retirement after successful candidate preparation,
fatal failure and disposal do. Cancellation is latched before notifying the
source, happens once, and prevents every subsequent read/presentation for that
session. A signal listener failure cannot prevent invalidation or other cleanup.

If iteration has not ended naturally, request `return()` at most once when
present, **after the outstanding `next()` settles**. Iterator methods never run
concurrently. Observe every pending request and cleanup promise, even after
retirement; late values are discarded and late rejections are handled. Natural
`done` releases ownership without an additional `return()`.
Each `next()` must settle with an iterator-result object; an invalid result is
a source error. An implemented `return()` must settle with `done: true` for
successful cleanup under this contract. A nonterminal/invalid return result is a
cleanup error; the adapter does not drain values yielded during cleanup. Without
`return()`, only signal-based release is available. A cleanup report confirms
that owned calls settled, not that arbitrary external resources were released.

Cancellation is not forced interruption. If a source ignores its signal and
never settles, neither iterator cleanup nor Restart is guaranteed to complete.
No timeout or successful-close result is fabricated. Source-owned resources
must react to cancellation if bounded shutdown is required.

Logical disposal and physical cleanup are separate. The async adapter and widget
must expose an awaitable cleanup result, which settles only after owned requests
and cleanup have settled. It resolves with diagnostics, including cleanup
failures, rather than creating an unobserved rejection. The widget's existing
`dispose(): void` does not become a promise. Its final disposed notification may
run synchronously; no later render/status/error callbacks may run. Later cleanup
errors are available through the cleanup result, not callbacks after disposal.

## Errors and race ordering

- Factory/acquisition/empty-source failures follow preparation/rollback rules.
  A later active-source failure is terminal: pause, preserve the readable frame,
  invalidate the session, request cleanup and deliver the original error once.
  There is no automatic retry; a fresh Start/Restart is explicit recovery.
- Source, render and status-callback failures outrank failures caused by their
  cleanup. Secondary failures remain in cleanup diagnostics. A cleanup-only
  failure is reported as such; a failed candidate cannot destroy a usable old
  session. Notification failures are not recursively sent to `onError`.
- Cancellation initiated by the owner is normal control flow. An active source
  rejecting with an error named `AbortError` is still an error unless its session
  was actually cancelled; the error's name alone is not cancellation evidence.
- Process commands and settlements serially, checking session identity and the
  latest presentation intent before committing. Pause before settlement prevents
  that result being shown; disposal before settlement prevents all later
  callbacks. A result committed before Pause remains visible. Restart rollback
  reactivates only the preserved old session, never a retired one.
- Headless pull promises reject with their primary operational failure. The
  widget observes asynchronous failures and reports them through status/onError;
  async notification failures are captured in diagnostics. It does not turn
  them into detached promise rejections. Existing synchronous behavior is intact.
  Mutating the widget from its render/status callbacks remains prohibited;
  reading status is allowed.

## Acceptance cases for a later implementation

Use controlled promises, instrumented iterators and a deterministic scheduler:

1. Deferred first value, empty source, factory/acquisition/next throws/rejections,
   finite and infinite sources, ignored return value and extra EOF probe.
2. One read in flight; repeated commands coalesce; no prefetch/polling; Play and
   manual Next differ at arrival; wait discards debt and restarts at progress zero.
3. Pause/Previous before and after settlement; ready-slot bound, rewind eviction,
   EOF/final hold, speed, hidden document and work-budget accounting.
4. Restart candidate failure and rollback, old result/error during preparation,
   successful/failed cleanup barriers, repeated Restart, old cleanup rejection
   and a never-settling old request. At most two owned iterators, including retries.
5. Dispose during first read, playback, candidate preparation and old cleanup;
   double dispose, cooperative/noncooperative cancellation, serialized return,
   late rejection handling, invalid/nonterminal iterator results and no callbacks
   after logical disposal.
6. Primary/cleanup/notification error precedence and synchronous reentrancy guards;
   ES2022-only headless consumers, existing sync tests and package isolation.

The standalone [adapter API and local results](async-source-api.md) are now
implemented/documented: 19 adapter tests, all 244 repository tests, installed
package consumers and bundle isolation passed at the headless stage. Widget
integration is now also implemented: the [API and results](player-async-api.md)
record 265 passing tests, installed-package checks and 13 native browser checks.
