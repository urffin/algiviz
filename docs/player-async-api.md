# Async sources in /player: integration API

[Русский](ru/player-async-api.md) · [Player](player.md) · [Adapter](async-source-api.md) · [Behavior](async-sources.md)

## 0.15.0 release candidate, 2026-11-13

The working tree implements asyncSource, waiting metadata and closed in /player
using the separate createAsyncSource adapter. **Published 0.14.0 has neither async
capability.** Existing sync/history options and synchronous command signatures
remain supported. Publication and exact-commit CI are separate.

Add `asyncSource: AsyncSourceFactory<State>` as the third exclusive source
capability. The widget constructs/owns its adapter; callers do not pass an
already-created adapter, iterator or promise. Construction invokes no factory.
Start and each actual Restart acquire fresh sessions. Timing is optional for
manual use; `rewindCapacity` and `maxStepsPerFrame` have their existing positive
safe-integer rules for both stream kinds. History still requires timing and
rejects both limits. Streams still have unknown duration and no seek slider.

## Public declarations

The declarations mirror [types.ts](../src/player/types.ts) and the public Player
class. SharedOptions is private notation, not an additional export. The entry
keeps its Player runtime export and adds one public type, PlayerCloseResult;
cancellation types remain in /playback.

```ts
import type { AsyncSourceFactory, AsyncSourceCloseResult, Frame } from "@grundyjs/algiviz/playback";

export interface PlayerLabels {
    readonly waiting?: string | undefined;
    readonly preparing?: string | undefined;
    readonly cleanup?: string | undefined;
    readonly start: string;
    readonly play: string;
    readonly pause: string;
    readonly next: string;
    readonly previous: string;
    readonly replay: string;
    readonly restart: string;
    readonly speed: string;
    readonly group: string;
    readonly controls: string;
    readonly idle: string;
    readonly paused: string;
    readonly playing: string;
    readonly finished: string;
    readonly disposed: string;
    readonly step: string;
    readonly error: string;
    readonly ready: string;
    readonly seek: string;
    readonly time: string;
    readonly stream: string;
    readonly streamHint: string;
}

export interface PlayerStatus {
    readonly waiting: boolean;
    readonly preparing: "start" | "restart" | null;
    readonly cleanupPending: boolean;
    readonly canPause: boolean;
    readonly phase: "idle" | "paused" | "playing" | "finished" | "error" | "disposed";
    readonly mode: "recording" | "stream";
    readonly started: boolean;
    readonly timed: boolean;
    readonly speed: number;
    readonly error: unknown;
    readonly hasError: boolean;
    readonly stepIndex: number | null;
    readonly progress: number | null;
    readonly positionMs: number | null;
    readonly durationMs: number | null;
    readonly canStart: boolean;
    readonly canPlay: boolean;
    readonly canNext: boolean;
    readonly canRestart: boolean;
    readonly canSeek: boolean;
    readonly canPrevious: boolean;
    readonly rewindStartIndex: number | null;
    readonly rewindEndIndex: number | null;
}

export interface PlayerCloseResult {
    readonly sources: readonly AsyncSourceCloseResult[];
    readonly errorCount: number;
    readonly firstError: {
        readonly phase: "abort-listener" | "return" | "dispose" | "onStatus" | "onError";
        readonly error: unknown;
    } | null;
}

interface SharedOptions<State> {
    readonly render: (frame: Frame<State, undefined>) => void;
    readonly viewport?: Element | undefined;
    readonly stepDurationMs?: number | undefined;
    readonly finalHoldMs?: number | undefined;
    readonly seekBar?: boolean | undefined;
    readonly autoHide?: boolean | undefined;
    readonly labels?: {
        readonly [Key in keyof PlayerLabels]?: string | undefined;
    } | undefined;
    readonly onStatus?: ((status: PlayerStatus) => void) | undefined;
    readonly onError?: ((error: unknown) => void) | undefined;
}

export type PlayerOptions<State> = SharedOptions<State> & ({
    readonly source: () => Iterable<State>;
    readonly asyncSource?: undefined;
    readonly history?: undefined;
    readonly rewindCapacity?: number | undefined;
    readonly maxStepsPerFrame?: number | undefined;
} | {
    readonly asyncSource: AsyncSourceFactory<State>;
    readonly source?: undefined;
    readonly history?: undefined;
    readonly rewindCapacity?: number | undefined;
    readonly maxStepsPerFrame?: number | undefined;
} | {
    readonly history: () => readonly State[];
    readonly source?: undefined;
    readonly asyncSource?: undefined;
    readonly stepDurationMs: number;
    readonly rewindCapacity?: undefined;
    readonly maxStepsPerFrame?: undefined;
});

export declare class Player<State> {
    constructor(container: HTMLElement, options: PlayerOptions<State>);
    get status(): PlayerStatus;
    get frame(): Frame<State, undefined> | null;
    get closed(): Promise<PlayerCloseResult>;
    start(): PlayerStatus;
    play(): PlayerStatus;
    pause(): PlayerStatus;
    next(): PlayerStatus;
    previous(): PlayerStatus;
    seek(positionMs: number): PlayerStatus;
    restart(): PlayerStatus;
    setSpeed(value: number): PlayerStatus;
    dispose(): void;
}
```

Exactly one non-undefined factory is required; explicit undefined for the other
branches remains valid. A promise-returning factory is rejected: asynchronous
initialization belongs inside `AsyncIterable` iteration. Factory inference must
preserve State in render/frame. Existing typed source/history options and full
legacy label objects remain assignable. New status fields are always present:
applications constructing complete `PlayerStatus` mocks must add them. No new
phase/mode literals or asynchronous render/status/error callbacks are introduced.
Validate source selection/callability and option values before invoking any
factory or moving the caller's viewport.

## Waiting and preparation metadata

`phase` remains `idle | paused | playing | finished | error | disposed`, and
`mode` remains `stream | recording`. For an async stream, `playing` describes
Play intent, including a suspended clock while data is unavailable.
Sync/history status at public boundaries has waiting false, preparing null and
cleanupPending false; canPause reflects its current Play intent.

- `waiting`: the foreground session has a requested source read whose settlement
  the controller has not processed. During preparation this refers to the
  candidate, not the quarantined old read. It can remain true after Pause or
  Previous; it is not copied directly from the adapter's `waiting` getter.
- `preparing`: Start/Restart is in progress, including candidate rollback or
  waiting for the old source's cleanup. It clears only when installation or
  rollback is complete. `started` means a first frame was installed at least
  once; it does not become true merely because Start accepted a request.
- `cleanupPending`: at least one owned source has begun shutdown but its cleanup
  has not settled. It can coexist with `waiting` during candidate preparation.
  A normal pending read alone is not cleanup. It blocks another factory after a
  failure; it does not stop usable cached playback of an otherwise valid session.
- `canPause`: a Play, pending manual-Next presentation, or Replay-autoplay intent
  can be cleared. It remains true while Play waits without a RAF, and can be true
  in manual mode or during Replay preparation. It is false after that intent is
  cleared, on failure and after disposal.

| Situation | phase | waiting | preparing | cleanupPending |
| --- | --- | --- | --- | --- |
| Before Start | idle | false | null | false |
| First Start awaiting its first state | idle | true | start | false |
| First state installed, paused | paused | false | null | false |
| Play waiting at the live edge | playing | true | null | false |
| Pause with that read still outstanding | paused | true | null | false |
| Paused ready value/EOF, not yet consumed | paused | false | null | false |
| Restart awaiting a candidate | old paused/finished/error phase | true | restart | possibly true |
| Candidate ready, old source closing | old paused/finished/error phase | false | restart | true |
| Failed initial preparation, candidate closing | error | false | start | true |
| Active failure, cleanup not settled | error | false | null | true |
| Disposed, physical shutdown pending | disposed | false | null | true |

Rows describe actual outstanding work: a synchronous failure/no-work closure
can skip a transient row. No new-frame/index/progress is published before the
first state. Restart preserves the old frame/window until replacement succeeds.
A failed candidate reports `hasError` while preserving the old phase/session.
Its last error remains visible through rollback until a later accepted action
clears it under existing error rules.

`waiting` does not mean all useful work is blocked. After Previous, replay can
animate cached states while the old live-edge request remains pending. Suspend
the clock only when the next required state is unavailable. Its arrival alone
does not append to/evict the rewind window or move the displayed index.

## Commands and capabilities

Commands remain synchronous and return the accepted command's current status,
not completion. Completion is observed through `onStatus`/readonly getters;
`await ui.start()` or `await ui.restart()` is not a completion API.

| Command | Async-stream behavior |
| --- | --- |
| Start | One initial request, then show index zero paused. Repeats coalesce; no Play/Next queue before the first frame. After a failed initial preparation and settled cleanup, Start retries. |
| Play | Requires timing and an initialized valid session. Reuses the one pending request/ready result. Repeated Play is idempotent. A pending manual Next becomes timed Play intent. Finished sessions are not implicitly restarted. |
| Next | Pauses and discards clock debt. Completes a partial transition without reading, otherwise consumes one cached/ready state or requests one state. A delayed manual result is shown at progress 1. Repeats during that read coalesce. Next during waiting Play changes the intent to one manual endpoint. |
| Pause | Clears Play/manual-Next/Replay presentation intent and clock debt, without disposing the adapter. An outstanding result becomes one ready slot. Start/Restart preparation still completes paused. Pause is safe even when no intent remains. |
| Previous | Pauses and moves within the retained window immediately, including while a source read is pending. A late result stays outside the window until forward playback reaches its edge. No factory call or cancellation. |
| Restart | Pauses and prepares one candidate; repeats coalesce and clear any Replay-autoplay intent. Prepare before retiring the old session, then await its cleanup before installation. Candidate failure rolls back only after candidate cleanup settles. No autoplay. |
| Speed | Positive finite values apply to future intervals, including after preparation. A valid change is allowed during preparation; it never cancels a request or scales waiting time. |
| seek | Still unavailable for either stream kind. Recordings keep their current synchronous seek behavior. |
| dispose | Immediately clears all intents/preparation, disables controls and removes UI resources. Source shutdown proceeds separately; repeated dispose is a no-op. No later render/status/error callbacks. |

During preparation or a failed-session cleanup barrier, applicable Play/Next/
Previous commands return unchanged status instead of queuing work. Existing
invalid capability/argument errors still apply, e.g. untimed Play, stream seek,
Previous without rewind, non-finite speed. Pause and valid speed changes remain
usable. Start/Restart coalesce an existing preparation; they cannot bypass a
cleanup barrier by creating another adapter. Calls after disposal and mutations
from render/status callbacks retain existing rejection rules.

`canStart` requires no installed frame, no preparation/cleanup barrier and a live
widget. `canRestart` requires `started`, no preparation/cleanup barrier and a live
widget. During preparation both are false, even though repeated programmatic
commands coalesce. `canPlay`/`canNext` require a usable unfinished installed
session, no preparation or recovery barrier; Play additionally needs timing.
They can stay true during an outstanding read: a command may reuse/change its
intent. `canPrevious` additionally needs a preceding retained value. Stream
`canSeek` is always false. In a disposed widget every capability is false.

The timed UI Replay button is an explicit restart-then-Play intent, not a change
to programmatic `restart()`. After successful preparation/presentation, Play
starts only if that Replay intent is still current, the document is visible and
the widget is live. Pause, programmatic Restart, error, hidden-document pause
or disposal clears it. Preparation continues paused if Replay is cancelled.

At a live-edge wait, discard work-budget debt and freeze the playback clock.
Do not schedule RAF polling. A Play result schedules a RAF that starts the next
transition at progress zero and resets the baseline. Ready/cached states use
normal timing/budgeting; source reads/probes count at initiation, not again at
settlement. EOF and final holds follow the existing behavioral contract, without
spending hold time on Pause/waiting. Hidden documents pause without automatic
resume; reduced motion does not add reads. Async iteration does not offload CPU.

## Labels and accessible controls

Optional new roles use English defaults: `waiting: "Requesting state"`,
`preparing: "Preparing playback"`, `cleanup: "Waiting for source cleanup"`.
Omitted/undefined roles keep defaults; supplied values must be nonempty strings.
Old complete `PlayerLabels` objects remain valid because only new roles are
optional. Old required roles and partial-override behavior remain unchanged.

The Play/Pause control uses `canPause` before phase/Replay checks. This keeps
Pause visible and enabled for a pending manual Next even without step timing,
and during Replay preparation. Otherwise the control offers Replay only when
finished/timed and restart is available; ordinary Play follows `canPlay`.
There is no new Cancel button. Preparation/cleanup keep disabled controls visible
and the panel pinned; a background data request alone does not pin an overlay.

Keep the existing phase/step summary and stream badge. Expose metadata through
a polite live status message, with priority cleanup, preparation, then source
request. Do not replace the phase label or announce on each RAF. Stage `aria-busy`
reflects preparation or an actual data stall, not merely a background pending read
during cached playback. Per-RAF render/status stays bounded; `onStatus` also
reports accepted commands and changed async state, without polling.

## Errors, disposal and the closed report

Async operational errors stop scheduling and notify `onError` promptly, before
physical cleanup finishes. Each primary operational failure is reported once;
secondary cleanup/notification failures remain diagnostic. Active errors still
surface on Pause. Candidate/old-read
quarantine and rollback follow the behavioral contract. Late-read diagnostics do
not fail replacement; actual `cleanupErrors` do. Source retirement/disposal pass
`"player:restart"`/`"player:dispose"` as adapter disposal reasons. A fatal consumer
failure disposes with its original error; the signal's type remains `unknown`.
Existing synchronous source/history error and callback propagation stay intact.

`closed` is one stable, never-rejecting promise per widget, available in every
mode. It resolves only after **logical widget disposal**, all owned source
shutdown, final notifications and DOM/listener/timer teardown settle. EOF/error
alone does not resolve it: a live widget may restart. It can remain pending
forever for an uncooperative source. `dispose(): void` remains synchronous;
existing synchronous disposal failures still propagate after teardown and are
also recorded. Async failures after disposal go only into the report.

- `sources` contains the reports of async adapters held at logical disposal,
  including already-completed current adapters: current/retiring first, candidate
  second, at most two. Sync/history widgets have an empty array. Results from
  previously released sessions are not accumulated in a lifetime journal.
- `errorCount` counts observed source-cleanup, notification and teardown failures
  across the widget lifetime; `firstError` retains only the first such occurrence.
  Consume each adapter report once: its cleanup failures are counted once even
  when that report also appears in `sources`. Primary source/render errors are
  already delivered operationally and are not counted again; a thrown onStatus
  is counted as a notification failure even when it is the primary operation
  failure. Late read errors are diagnostics, not cleanup failures or new errors.
- Async notification exceptions are recorded, without recursive `onError` or
  detached rejection. Synchronous propagation remains as above. Retain only one
  error wrapper plus a count, rather than all historical notification failures.
- Report/arrays/wrappers are immutable; user error/reason values are not cloned.
  Final notifications and UI teardown run during synchronous disposal; subsequent
  async settlements cause no callbacks or UI mutations. Readonly
  `status.cleanupPending` can become false when shutdown settles, without another
  notification; observe `closed` for that final completion.

## Design-stage declaration checks

Type-check inference, mutual exclusion and explicit undefined, old typed options
and full labels, unchanged phase/mode/method types, new status/report narrowing
and readonly guarantees in NodeNext/Bundler with strict DOM consumers. Headless
imports must stay DOM-free. These declaration checks cannot verify behavior.

Before implementation on 2026-11-13, TypeScript 6.0.3 passed all four in-memory checks: NodeNext and
Bundler with the proposed DOM declarations, the current widget consumer fixture
and positive/negative async cases; both resolutions also passed the existing
ES2022-only headless fixture with no DOM/Node ambient types. The checks include
legacy typed options/labels, explicit undefined label overrides, async State
inference, exclusive factories, synchronous commands and readonly cleanup data.
EN/RU declaration blocks match. No files were emitted or runtime code changed.

Future runtime checks must cover initial/candidate waits, command coalescing and
intent changes, manual Pause controls, cached playback with a pending read, EOF/
holds, work limits and baseline reset, rollback/cleanup barriers, Replay races,
errors/callback precedence, disposal in every stage, bounded reports and no late
callbacks. Native checks use the built-in browser for controls/keyboard/status
announcements. Implementation results are recorded below.

## Implementation and verification

Separate async controller/session code keeps the synchronous playback engine
unchanged. A bounded Map window stores available states, alongside one uncommitted
read result. Logical disposal and physical source/UI closure are separate.
Diagnostics retain a count/first error and at most two source reports at disposal.

All **265 repository tests** passed, including **21 public-widget async tests**
with controlled promises and a deterministic scheduler. The same 21 tests passed
from a fresh local archive installation with strict unhandled-rejection checks.
TypeScript 5.0.4 and 6.0.3 NodeNext/Bundler consumers passed for headless ES2022-only and DOM
code, source inference, readonly metadata/reports and invalid options. Private
paths remain closed; browser ESM bundle isolation passed.

The [native report](benchmarks/player-async-browser-2026-11-13.json) records
**13/13** passing checks in the built-in browser at DPR 1: real controls/live
labels, manual Pause, staged values, restart/rollback and deferred disposal, plus
native Enter activation for Start/Next/Pause. Twelve checks are fixture-driven;
the thirteenth records the separately performed keyboard sequence. One deliberate
candidate failure was reported; unexpected errors/unhandled rejections were empty.
Source/build/fixture hashes match. These are local checks, not browser
certification, a screen-reader audio test, publication or exact-commit CI.
