# Worker source adapter: public API design

[Русский](ru/worker-source-api.md) · [Behavior](worker-source.md) · [Async adapter](async-source-api.md) · [Player](player-async-api.md) · [Plan](optional-player-proposal.md)

## API design, 2026-11-14

The declarations below are **implemented for 0.16.0**.
Version 0.15.0 has no Worker entries.
The behavior in [the Worker contract](worker-source.md), including the 1000 ms
default shutdown grace period, remains the baseline. The transport/endpoint
and [Player integration](player-worker.md) are verified locally. Player uses the
existing asyncSource boundary without changes to its implementation or types.

Select two optional entries:

| Entry | Runtime exports | Declaration environment |
| --- | --- | --- |
| `@grundyjs/algiviz/worker` | `createWorkerSourceFactory`, `WorkerSourceError` | ES2022 + DOM (also usable in a browser Worker host with WebWorker types) |
| `@grundyjs/algiviz/worker/runtime` | `exposeWorkerSource` | ES2022 + WebWorker; do not combine DOM and WebWorker libraries |

Existing six entries do not import/re-export either entry. Existing headless
consumers still need ES2022 alone. Module evaluation must not create a Worker,
read document/self or install handlers. Importing the host entry remains safe
without browser globals; using it requires the browser Worker host.

The common declarations below live in a private, DOM-free module, re-exported
as types by both Worker entries. That module is not a third public entry.
The host and runtime declarations import it directly, not through each other.

## Common declarations

```ts
// Private shared types, publicly re-exported by /worker and /worker/runtime.
import type { AsyncSourceSignal } from "@grundyjs/algiviz/playback";

export type WorkerSourcePhase =
    | "create" | "input" | "init" | "acquire" | "next"
    | "transfer" | "serialize" | "post" | "protocol" | "worker"
    | "messageerror" | "abort-listener" | "return" | "terminate" | "teardown";

export type WorkerSourceRemotePhase =
    | "init" | "acquire" | "next" | "transfer" | "serialize"
    | "post" | "protocol" | "abort-listener" | "return" | "teardown";

export type WorkerSourceErrorCode =
    | "startup" | "protocol" | "serialization"
    | "transport" | "remote" | "cleanup";

export type WorkerSourceThrownKind =
    | "undefined" | "null" | "boolean" | "number" | "bigint"
    | "string" | "symbol" | "object" | "function";

export interface WorkerSourceRemoteError {
    readonly phase: WorkerSourceRemotePhase;
    readonly thrownKind: WorkerSourceThrownKind;
    readonly name: string;
    readonly message: string;
    readonly stack: string | null;
}

export interface WorkerSourceIssue {
    readonly origin: "host" | "worker";
    readonly phase: WorkerSourcePhase;
    readonly error: unknown;
}

export interface WorkerSourceCleanupSummary {
    readonly count: number;
    readonly first: WorkerSourceIssue | null;
}

export type WorkerSourceTermination =
    | { readonly kind: "not-created" }
    | {
        readonly kind: "acknowledged" | "forced";
        readonly terminate: "requested" | "failed";
    };

export type WorkerSourceCloseResult = (
    | { readonly kind: "completed" }
    | { readonly kind: "disposed"; readonly reason: unknown }
    | {
        readonly kind: "failed";
        readonly error: unknown;
        readonly origin: "host" | "worker";
        readonly phase: WorkerSourcePhase;
    }
) & {
    readonly termination: WorkerSourceTermination;
    readonly cleanup: WorkerSourceCleanupSummary;
    readonly lateReadError: WorkerSourceIssue | null;
};

export interface WorkerSourceShutdownOptions {
    readonly gracePeriodMs?: number | undefined;
}

export interface WorkerSourceCancellation {
    readonly kind: "restart" | "dispose" | "return" | "cancel";
    readonly message: string | null;
}

export interface WorkerSourceSignal extends AsyncSourceSignal {
    readonly reason: WorkerSourceCancellation | undefined;
    subscribe(listener: (reason: WorkerSourceCancellation) => void): () => void;
}
```

## Application declarations: /worker

```ts
import type { AsyncSourceSignal } from "@grundyjs/algiviz/playback";
import type {
    WorkerSourceCloseResult, WorkerSourceShutdownOptions,
    WorkerSourceErrorCode, WorkerSourcePhase,
    WorkerSourceRemoteError, WorkerSourceCleanupSummary,
} from "./types.js";
export type * from "./types.js";

export interface WorkerSourceIterator<State> {
    next(): Promise<IteratorResult<State, void>>;
    return(): Promise<IteratorResult<State, void>>;
}

export interface WorkerSourceSession<State> extends AsyncIterable<State> {
    readonly closed: Promise<WorkerSourceCloseResult>;
    [Symbol.asyncIterator](): WorkerSourceIterator<State>;
}

export type WorkerSourceFactory<State> =
    (signal: AsyncSourceSignal) => WorkerSourceSession<State>;

export interface WorkerSourceOptions<Init> {
    readonly worker: () => Worker;
    readonly input: () => Init;
    readonly shutdown?: WorkerSourceShutdownOptions | undefined;
}

export declare function createWorkerSourceFactory<State, Init = void>(
    options: WorkerSourceOptions<Init>,
): WorkerSourceFactory<State>;

export interface WorkerSourceErrorOptions {
    readonly code: WorkerSourceErrorCode;
    readonly origin: "host" | "worker";
    readonly phase: WorkerSourcePhase;
    readonly remote?: WorkerSourceRemoteError | null | undefined;
    readonly cleanup?: WorkerSourceCleanupSummary | null | undefined;
}

export declare class WorkerSourceError extends Error {
    readonly name: "WorkerSourceError";
    readonly code: WorkerSourceErrorCode;
    readonly origin: "host" | "worker";
    readonly phase: WorkerSourcePhase;
    readonly remote: WorkerSourceRemoteError | null;
    readonly cleanup: WorkerSourceCleanupSummary | null;
    constructor(message: string, options: WorkerSourceErrorOptions);
}
```

`createWorkerSourceFactory` validates callable worker/input factories, options
and a finite nonnegative gracePeriodMs synchronously, without invoking either
factory. Omitted/undefined shutdown or gracePeriodMs selects 1000 ms. Zero is
valid; negative, NaN and Infinity throw RangeError, and non-numbers throw
TypeError. It snapshots configuration; later mutation of the options object
cannot change existing or future sessions from that factory.
Fractional nonnegative milliseconds are valid. Large accepted values must not
become immediate deadlines through host timer overflow; scheduling must honor
the same nominal deadline within the host timer/event-loop limitations.

State comes from an external Worker module, so TypeScript cannot infer it from
the Worker handle or prove that two independently built modules agree. Supply
`<State, Init>` explicitly. Without State information the result is unknown,
not any. With the default void input use `input: () => undefined`. The generic
does not prove cloneability, transfer safety or a runtime State/Init schema.

Each `factory(signal)` synchronously creates a fresh, single-consumer session
with a stable closed promise and one stable iterator; it performs no worker/input
factory calls. Acquiring its iterator creates no resources. First iterator next
invokes worker once, takes ownership of its fresh dedicated module Worker, then
invokes input once and posts initialization after installing handlers. This
ordering makes input-factory errors observable through cleanup of the already
owned Worker. Creation/input errors reject the read with the original local
value, including undefined. Already-aborted signals create no Worker or input;
the report is disposed/not-created with the original host reason.

The factory result is assignable to `AsyncSourceFactory<State>`:
`createAsyncSource(factory)` and `new Player(..., { asyncSource: factory, ... })`
need no new option. The transport iterable is not itself an AsyncSource or
Player: no next/read-result/dispose controls are added to its session object.
Direct iterator consumers must serialize next/return; concurrent next calls
on the transport iterator are rejected rather than queued. Public same-promise
coalescing belongs to createAsyncSource. Return initiates the shared shutdown
and resolves with done or rejects with the cleanup summary error. Its next and
return take no arguments; there is no public throw channel or next input. The
narrow iterator interface declares return as required rather than inheriting
AsyncIterator's optional return/throw methods.
After EOF, next returns done without I/O. After operational failure it rejects
with the same latched primary error. After owner abort/return it awaits shutdown
and returns done, or rejects its actual cleanup failure, without another pull.
Return before the first next creates no Worker or input and closes not-created;
repeated return observes the same shutdown rather than repeating side effects.

The factory keeps no current-session getter, report array or closed promise for
all future restarts. To observe every transport result, wrap its call, attach a
handled continuation to that session's closed, and return the same session.
Observer failures belong to that continuation's caller; they are not source or
player errors. No library-owned onSession/onClose callback is introduced.

## Worker declarations: /worker/runtime

```ts
import type { WorkerSourceSignal } from "./types.js";
export type * from "./types.js";

export type WorkerStateFactory<Init, State> = (
    input: Init, signal: WorkerSourceSignal,
) => Iterable<State> | AsyncIterable<State>;

export type WorkerTransferSelector<State> =
    (state: Readonly<State>) => readonly ArrayBuffer[];

export interface WorkerSourceEndpointOptions<Init, State> {
    readonly scope: DedicatedWorkerGlobalScope;
    readonly source: WorkerStateFactory<Init, State>;
    readonly transfer?: WorkerTransferSelector<State> | undefined;
}

export declare function exposeWorkerSource<Init, State>(
    options: WorkerSourceEndpointOptions<Init, State>,
): void;
```

Install once, explicitly in the dedicated module Worker entry. It validates
scope/source/transfer and installs the endpoint synchronously, without calling
source or next before a valid initialization. A second recognized installation
on that scope throws before attaching more handlers. There is no returned
controller, local dispose or ownership of the surrounding global scope: the
host owns cancellation/termination. The endpoint removes its own handlers when
closing, sends the terminal acknowledgement and awaits host termination.

Source returns a sync/async iterable directly, not a promise of one. Prefer the
async iterator protocol if present; an invalid present async method is an error,
not a fallback to sync. User initialization/CPU work happens inside the Worker.
The application still validates received Init data. Missing/mismatched endpoint
or silent self.close has the behavioral contract's waiting/cancellation limits.

WorkerSourceSignal has the existing synchronous subscription semantics, with a
narrowed, clone-safe reason. The initial reason is undefined; after abort it is
one frozen WorkerSourceCancellation descriptor. The host string reasons
`"player:restart"` and `"player:dispose"` map to restart/dispose; direct iterator
return maps to return; other owner reasons map to cancel. Message contains only
a host string reason truncated to 4096 UTF-16 code units, otherwise null. No
arbitrary reason object/stringifier crosses the channel. The original unknown
reason remains on the host. Listener failures are counted without skipping
other listeners or the serialized return.

## Buffer transfer

Omitting transfer or supplying undefined copies states. A synchronous selector
is called exactly once for each yielded state, including the first; an empty
list copies that emission. It is never called for EOF/return values. Readonly
is shallow: the selector must not mutate the state or any referenced storage.
An async selector is unsupported. A thrown selector error becomes a remote
operational failure with phase transfer.

Only reachable, attached, non-shared ArrayBuffers may be listed, once each.
Passing typed-array views themselves, other transferable resources, duplicates,
unreachable or detached buffers is a serialization/transfer error, with no clone
retry. SharedArrayBuffer/views are rejected throughout the supported data graph.
Structural TypeScript types, especially older ArrayBuffer declarations, cannot
enforce these brand/reachability rules; runtime checks remain mandatory.
In TypeScript 5.0.4 even a Uint8Array can structurally satisfy ArrayBuffer; its
acceptance by that compiler does not make the view a valid transfer-list item.
The selector result is copied before posting so later list mutation cannot
change the transfer. Initialization has no transfer selector and is copy-only.
The host never transfers a received/retained snapshot back.

## Error surface and bounded diagnostics

Ordinary local throws from application factories are preserved as unknown;
instanceof WorkerSourceError is therefore not a test for every possible failure.
Transport-generated and normalized remote errors use that class. Its codes are:

| code | Meaning |
| --- | --- |
| startup | Observable Worker startup/load failure before readiness. |
| protocol | Version, envelope, session/request/phase or iterator-protocol failure. |
| serialization | Payload validation, structured clone or transfer failure. |
| transport | Observable worker execution/messageerror or channel-post failure. |
| remote | A worker source factory/acquisition/next or selector threw/rejected. |
| cleanup | One summary error for actual remote/host cleanup failures. |

Origin and phase distinguish the location/action; phase init is worker factory
execution, input is the host input factory, and create is the host Worker
factory. Native Worker error/messageerror need not contain a remote descriptor;
the native event object is not kept as an unbounded report value. Remote source
errors have a descriptor. When known, invalid protocols/serialization use those
specific codes instead of remote. These tags do not automatically retry work.

The remote descriptor preserves thrownKind, even for undefined/null; it does not
carry the arbitrary thrown object. Name/message/stack are best-effort strings
bounded to 128/4096/16384 UTF-16 code units respectively; unavailable stack is
null, name defaults to Error or ThrownValue, and message has a fixed safe
fallback. Guard property access and never invoke a custom stringifier. Descriptors
and constructor-provided metadata are validated/snapshotted into readonly
wrappers; Error.message/stack retain ordinary Error behavior. Constructing a
WorkerSourceError creates no transport and does not send a message.
Invalid tags, descriptor shapes or inconsistent metadata throw TypeError;
invalid numeric cleanup counts throw RangeError. A remote descriptor requires
worker origin and the same phase as the error; code remote requires a descriptor.
Code cleanup requires a positive summary count and its first issue's origin/phase.
Other errors have cleanup null. Supplied descriptor strings are bounded as above.

Cleanup summary count is a nonnegative safe integer (saturating at MAX_SAFE_INTEGER);
zero means first null, a positive count means one first issue. Host error values
are retained by reference, remote errors use normalized local errors. The first
issue follows observation order, not cross-thread wall-clock ordering. No array
of all errors, raw events, payloads or historical sessions is retained. One
cleanup WorkerSourceError carries that summary in its cleanup field, with code
cleanup and the first issue's origin/phase; it does not erase a primary error.

## closed: outcome and termination are different

The session's closed exists before any read, never rejects and does not start
work. It resolves only after a terminal outcome, settlement of owned host calls,
timers/listeners/subscriptions teardown and a terminate request/failure report.
Until EOF/error/abort/return initiates closure it remains pending. There is no
claim of a physical browser Worker exit notification.

| Field | Selected meaning |
| --- | --- |
| kind completed | Transport observed natural EOF, including empty EOF, and released itself. The outer createAsyncSource still rejects an empty source with RangeError. |
| kind disposed, reason | Owner abort/return won. Host reason is preserved by reference; direct return without owner abort uses undefined. |
| kind failed, error, origin, phase | Active operational failure won; same primary local value/local normalized error as the failed transport read, including undefined. Origin/phase retain context even for a non-Error local value. |
| termination.kind not-created | No Worker handle was transferred; no terminate field exists. |
| termination.kind acknowledged | A valid remote close acknowledgement was processed before forced termination, possibly including real cleanup failures. |
| termination.kind forced | No valid acknowledgement before the non-extendable grace deadline; forced termination was attempted. This alone is not a cleanup error. |
| termination.terminate requested / failed | terminate returned normally / threw; neither is a physical exit confirmation. A thrown terminate is also an actual cleanup issue. |
| cleanup | Actual failures from remote abort/return and local closing protocol/post/termination/teardown, including failures observed before a forced stop. |
| lateReadError | First genuine operational read failure observed after cancellation, or null. It excludes normal cancellation/termination and replaying the cleanup summary into the outer adapter. |

An acknowledged report does not imply cleanup count zero. A not-created report
may be disposed (abort before first read) or failed (Worker factory threw).
Creating a candidate does not reset or mutate an old session's promise/report.
Reports, termination records, descriptors, summaries and issue wrappers are
readonly snapshots; original host state/reason/error values are not deep-frozen.

The shared shutdown deadline starts once at abort/return/operational failure;
repeats do not extend it.
Acknowledgement/deadline races follow host callback observation order: an
acknowledgement processed before the termination action wins; replies after it
cannot reopen the transport. The nominal timeout is not a real-time guarantee.
At natural EOF the iterator is already done;
host teardown/terminate happens before delivering done. Cancellation during an
outstanding transport read keeps it pending until shutdown completes; actual
cleanup failure must reject it and the subsequent return with the shared
cleanup error, so outer cleanupErrors receives it. A successful forced stop can
settle that cancelled internal read with done without changing the outer
disposed result. Operational errors still reject promptly before cleanup.

An idle transport error is latched and starts shutdown, but a pull-only consumer
observes it on its next request. The transport report can settle earlier; outer
createAsyncSource.closed still needs its own EOF/failure/disposal. After logical
widget disposal there are no new UI callbacks; a separately attached session
closed continuation remains application-owned. Existing AsyncSourceCloseResult
and PlayerCloseResult fields and callback/error counting rules are unchanged.

## Application example

```ts
import { Player } from "@grundyjs/algiviz/player";
import { createWorkerSourceFactory } from "@grundyjs/algiviz/worker";

interface Init { readonly count: number }
interface State { readonly step: number; readonly values: ArrayBuffer }
declare function draw(values: Float64Array, progress: number): void;

const factory = createWorkerSourceFactory<State, Init>({
    worker: () => new Worker(new URL("./states.worker.js", import.meta.url), {
        type: "module",
    }),
    input: () => ({ count: 128 }),
    shutdown: { gracePeriodMs: 1000 },
});

const player = new Player<State>(document.querySelector<HTMLElement>("#demo")!, {
    asyncSource(signal) {
        const session = factory(signal);
        void session.closed.then(report => {
            console.info(report.kind, report.termination.kind, report.cleanup.count);
        }).catch(error => console.error("Report observer failed", error));
        return session;
    },
    render(frame) { draw(new Float64Array(frame.current.values), frame.progress); },
    stepDurationMs: 200,
    rewindCapacity: 4,
});

player.start();
// On application teardown: player.dispose(); await player.closed;
```

The observer is optional; passing factory directly as asyncSource is valid.
For standalone consumption, pass it to createAsyncSource and dispose that
adapter; return values remain value/done/cancelled as in 0.15.0.

## Dedicated module Worker example

```ts
import { exposeWorkerSource } from "@grundyjs/algiviz/worker/runtime";

interface Init { readonly count: number }
interface State { readonly step: number; readonly values: ArrayBuffer }

exposeWorkerSource<Init, State>({
    scope: self as DedicatedWorkerGlobalScope,
    source: function* (input, signal) {
        if (!Number.isSafeInteger(input.count) || input.count < 1)
            throw new RangeError("Expected a positive count");
        for (let step = 0; step < input.count; step++) {
            if (signal.aborted) return;
            const values = new Float64Array(input.count);
            values[step] = step;
            yield { step, values: values.buffer };
        }
    },
    transfer: state => [state.values],
});
```

These are type-checked application examples. Native verification below covers
the standalone adapter, not Player integration or performance. The source allocates fresh storage because transfer detaches its
old buffer. Algorithms, rendering and worker module deployment remain owned by
the application.

## Design-stage verification

Type-check the common declarations and unchanged headless consumers with ES2022
alone; check host declarations, the existing player consumer and new positive /
negative cases with DOM; check the endpoint/source/transfer/signal with WebWorker
alone. Use strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess, types
empty, skipLibCheck false and noEmit, under NodeNext and Bundler. Check both
TypeScript 5.0.4 and the repository's 6.0.3. EN/RU declaration/example blocks must
match. Results are recorded after these design checks; no real Worker lifecycle
is certified by compiling declarations. Native/runtime acceptance remains in
the behavioral contract; standalone implementation results follow below.

Before implementation on 2026-11-14, **12 design-stage compiler configurations passed**, with zero
diagnostics: TypeScript 5.0.4 / 6.0.3 × NodeNext / Bundler × headless / DOM host /
WebWorker. The checks used these three declaration blocks and both examples,
the existing headless/player consumers and 29 new shared negative cases;
6.0.3 additionally rejects a typed-array view as an ArrayBuffer list item.
5.0.4's structural acceptance of that view was confirmed and recorded as a
runtime-validation requirement. Inference, unknown State by default, factory
compatibility, explicit undefined, mandatory return/no input or throw channel,
realm isolation, readonly metadata and report narrowing passed. No files were
emitted, package dependencies changed or Worker executed.

## Standalone implementation and verification

Implemented locally on 2026-11-14 in [the host entry](../src/worker/index.ts)
and [the Worker endpoint](../src/worker/runtime.ts), without changing /player or
the core async adapter. These entries are included in 0.16.0. Runtime declarations
compile with WebWorker separately through [tsconfig.worker.json](../tsconfig.worker.json);
host declarations use DOM. Existing imports remain isolated from both entries.

The transport snapshots data with native structuredClone before inspecting the
actual wire graph and posting it. This evaluates source accessors once and
prevents a getter from substituting shared memory after validation. Default
copying includes preflight and postMessage copying; no zero-copy or general
performance improvement is claimed. Explicit transfers move buffers through
that snapshot and the message; a later failure does not roll detachment back.
Native structuredClone is required; there is no polyfill or JSON fallback.

One API clarification adds teardown to WorkerSourceRemotePhase, so failure
removing worker-side handlers retains its real phase. Invalid iterator return
results retain protocol classification within cleanup diagnostics. Normalizing
arbitrary thrown values also handles a Proxy trapping getPrototypeOf, without
escaping as a detached rejection. Forced shutdown stays distinct from actual
cleanup errors and never masquerades as a cooperative acknowledgement.

Verification of this standalone stage:

- **293 repository tests passed**, including **27 public Worker tests** and an
  ID-boundary check. Controlled cases cover protocol identity/order, copy and
  transfer validation, hostile exceptions, default/zero/large deadlines,
  cancellation/EOF races, serialized/failed/stuck return, handle reuse, listener
  teardown and stable bounded reports.
- A fresh local archive passed exact runtime exports/private paths and strict
  ES2022-only headless, DOM host and WebWorker consumers with TypeScript 5.0.4
  and 6.0.3 in NodeNext/Bundler. All 27 Worker cases also passed against the latest
  installed local archive with strict unhandled-rejection handling. Host/runtime
  module imports were checked in Node without Worker/DOM globals.
- Browser ESM bundle checks passed: old entries and UI graphs exclude Worker
  code, host/runtime entries do not pull in each other's endpoint, and dynamic
  import produces deferred Worker chunks.
- The built-in browser passed **20/20 native dedicated module Worker checks**:
  input copying, sender detachment, retained snapshots, clone graphs, remote /
  serialization/load errors, cooperative cancellation, cleanup diagnostics,
  forced next/return/CPU-loop shutdown, silent exit and startup cancellation.
  Unexpected errors/rejections and remaining owned Workers were zero. The
  [native report](checks/worker-source-browser-2026-11-14.json) records source,
  compiled-module and fixture SHA-256 hashes. Fixture isolation enables the
  shared-memory rejection case; the adapter itself does not require shared memory.

Run `node scripts/serve-worker.mjs` after building to repeat native checks in the
built-in browser. Those checks cover a local build, not an npm release or a
general browser-version support claim. The subsequent [Player integration](player-worker.md)
passed 304 repository tests and 25 native control/keyboard/disposal checks.
It uses asyncSource directly, with no new Player options or runtime dependency.
