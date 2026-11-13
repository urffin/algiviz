# Asynchronous source adapter: public API

[Русский](ru/async-source-api.md) · [Behavioral contract](async-sources.md) · [Development plan](optional-player-proposal.md)

## 0.15.0 release candidate, 2026-11-13

The working tree implements one runtime export, `createAsyncSource`, and five
public types from `@grundyjs/algiviz/playback`. **These additions are not in the
published 0.14.0**. No package entry or dependency was added. Existing synchronous
APIs are unchanged; widget integration is implemented separately in /player.

The adapter owns one lazy source session. It requests plain immutable states;
it does not render, assign frame indices, run a clock, retain a rewind window or
restart itself. The consumer owns those capabilities and any one-result ready
slot. Restart creates a fresh adapter after the existing ownership/cleanup rules.
The `/player` source option and widget-level status/report types are
specified in the separate [integration design](player-async-api.md). They are not
additional headless exports; widget implementation/checks are recorded there.

## Public declarations

```ts
export interface AsyncSourceSignal {
    readonly aborted: boolean;
    readonly reason: unknown;
    subscribe(listener: (reason: unknown) => void): () => void;
}

export type AsyncSourceFactory<State> =
    (signal: AsyncSourceSignal) => AsyncIterable<State>;

export type AsyncSourceReadResult<State> =
    | { readonly kind: "value"; readonly value: State }
    | { readonly kind: "done" }
    | { readonly kind: "cancelled"; readonly reason: unknown };

export type AsyncSourceCloseResult = (
    | { readonly kind: "completed" }
    | { readonly kind: "disposed"; readonly reason: unknown }
    | { readonly kind: "failed"; readonly error: unknown }
) & {
    readonly cleanupErrors: readonly {
        readonly phase: "abort-listener" | "return";
        readonly error: unknown;
    }[];
    readonly lateReadError: { readonly error: unknown } | null;
};

export interface AsyncSource<State> {
    readonly signal: AsyncSourceSignal;
    readonly waiting: boolean;
    readonly closed: Promise<AsyncSourceCloseResult>;
    next(): Promise<AsyncSourceReadResult<State>>;
    dispose(reason?: unknown): void;
}

export declare function createAsyncSource<State>(
    factory: AsyncSourceFactory<State>,
): AsyncSource<State>;
```

The handle is not an `AsyncIterable`, `AsyncIterator` or playback `Player`.
Its result has an explicit cancellation branch rather than an iterator's terminal
return value. There is no public `return()`, `throw()`, `reset()` or per-read
cancellation option; only the owner disposes the whole session.

## Construction and next()

`createAsyncSource(factory)` synchronously checks that the factory is callable,
otherwise throwing `TypeError`. It does not invoke it or acquire an iterator.
`signal` and `closed` have stable identity from construction; reading them or
`waiting` does not start work. The factory receives that same signal on the first
`next()`. It returns `AsyncIterable<State>` directly, not a promise or synchronous
iterable. Initialization belongs inside iteration.

All factory/acquisition/read/protocol errors reject the read promise, preserving
the original thrown/rejected value. Adapter-generated protocol errors use
`TypeError`; a first result of `done` uses `RangeError` for an empty source.
Observed natural EOF, including an empty source, needs no additional `return()`.
`undefined` is a valid yielded state and a valid rejection value: discriminate
the result/error wrappers, never the payload's truthiness.

| Situation | next() result |
| --- | --- |
| Live session, no read pending | Acquires lazily if needed and requests exactly one value. No prefetch. |
| Read still pending | Returns the **same promise object**. Does not queue another step or call the iterator again. |
| State arrives | Resolves to `value`. The adapter retains no replay/current-state history. |
| EOF after at least one value | Resolves to `done`; closes naturally. Later calls resolve to `done` without I/O. |
| Operational failure | Rejects promptly with the primary error, without waiting for cleanup. Later calls reject with that same error value without I/O. |
| Disposed session | Resolves to `cancelled`, with the first disposal reason, without I/O. |
| dispose wins before the pending read settles at the adapter | That shared public promise resolves promptly to `cancelled`; the underlying iterator request remains observed until settlement. |

`waiting` is true while a public read is unresolved, including acquisition; it
becomes false before its result/rejection is delivered. Logical disposal clears
it immediately even if the underlying request/cleanup remains pending. Thus
`waiting: false` does not imply `closed` has settled. There is no status callback.

Promise settlement cannot be undone. If `value` settled before disposal but its
consumer continuation runs later, that continuation can still receive the value.
The widget must check session identity and presentation intent before displaying
it. Pause/Previous do not dispose the adapter: they reuse the outstanding promise
and stage its result in the consumer. Do not call `next()` again on each paused
settlement or in a promise loop; that would explicitly request more source data.

The adapter observes its internal iteration/cleanup promises. The caller must
still await or handle the promises it obtains from `next()`; there is no detached
error callback, implicit retry or timeout.

## Cancellation signal

`AsyncSourceSignal` is a small DOM-free protocol, **not** a platform `AbortSignal`.
It has no EventTarget, AbortController or Node type dependency. There is no
public controller; the adapter is the only cancellation owner.

- Initially `aborted` is false and `reason` is undefined. `dispose(reason)` sets
  both before notifying listeners. Omitted reason is also undefined; distinguish
  cancellation using `aborted`. A fatal source failure aborts with its primary
  error as the reason. Natural EOF does not abort.
- Cancellation is one-way. The first terminal event wins: later dispose calls
  cannot change a reason, failure, completion or report. Pause never aborts.
- `subscribe` registers a synchronous listener; its returned unsubscribe is
  idempotent and does not throw. Separate subscriptions are separate registrations.
  At abort, invoke still-registered listeners in registration order, at most once;
  removing a listener before its turn suppresses it. One listener's exception is
  recorded as `abort-listener` and cannot stop the remaining notifications/cleanup.
- Subscribing after abort invokes the listener immediately with the latched
  reason and returns a no-op unsubscribe. An exception from this direct late
  invocation propagates from `subscribe`, without changing an existing report.
  Non-callable listeners throw `TypeError`. Async listeners are unsupported.
- Natural closure releases registered listeners without notification; subsequent
  subscriptions on that naturally completed signal return a no-op. Terminal
  reports never remain mutable to collect future user-initiated subscription errors.

A browser application can bridge explicitly; this example needs DOM types,
whereas the adapter declarations above need only ES2022:

```ts
const source = createAsyncSource(async function* (signal) {
    const controller = new AbortController();
    const unsubscribe = signal.subscribe(reason => controller.abort(reason));
    try {
        const response = await fetch("/states/first", { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        yield await response.json() as unknown;
    } finally {
        unsubscribe();
    }
});
```

Passing `AsyncSourceSignal` directly as `fetch`'s signal is deliberately not part
of the API. Platforms without AbortController can implement another cooperative
bridge. A factory that throws before transferring an iterator remains responsible
for resources it acquired but did not transfer.

## dispose() and closed

`dispose(reason?)` invalidates the session synchronously, cancels a pending public
read as above and starts cooperative shutdown. It is idempotent and does not
throw source/listener/return errors: those belong in `closed`. Disposing before
the first read never invokes the factory. It cannot undo an already settled read.

`closed` is one stable promise per adapter. It never rejects and never starts
work by itself. It remains pending until EOF, fatal failure or disposal initiates
closure **and every owned acquisition/read/return operation has settled**. If
the consumer stops reading before EOF, it must dispose to initiate closure.
If a source ignores cancellation forever, `closed` may remain pending forever;
neither the cancelled public read nor logical disposal waits for it.

| Report field | Meaning |
| --- | --- |
| `kind: "completed"` | Natural EOF after at least one state. `cleanupErrors` is empty and `lateReadError` is null. |
| `kind: "disposed", reason` | Owner cancellation won; reason is retained by reference, including undefined. A late source rejection cannot change this to failed. |
| `kind: "failed", error` | An active factory/acquisition/read/empty-source failure won. Error is the same primary value rejected by `next()`, not a cleanup wrapper or duplicate notification. |
| `cleanupErrors` | Failures of abort listeners and iterator return, in observation order. A throwing return getter/call, rejected return or invalid/nonterminal return result all use phase `return`. These are actual cleanup failures; a replacement must not silently treat cleanup as successful. |
| `lateReadError` | Null, or one boxed rejection/protocol error observed from the underlying pending request after cancellation. Diagnostic only: it does not fail cancellation/Restart, replace the primary error or generate another read rejection. Boxing preserves a rejection of undefined. Late values are discarded without being retained in the report. |

If the iterator has not naturally ended, call its optional `return()` once, after
an outstanding `next()` settles. Never overlap iterator methods. A return result
must be an object with `done: true`; otherwise record a `TypeError` cleanup error.
Do not drain values yielded during cleanup. No return method is not itself an
error; external resource release is then the source's responsibility via its
signal. The report confirms settlement of owned calls, not arbitrary resource
release. A cleanup-only failure leaves `kind: "disposed"` with nonempty
`cleanupErrors`, rather than masquerading as an active source failure.

Report objects, diagnostic wrappers and the diagnostic array are immutable;
states, reasons and thrown values are not cloned or deeply frozen. The adapter
does not retain a lifetime history of sessions; each report belongs to one adapter.
The future widget must consume reports without reporting a primary error twice
or issuing callbacks after logical disposal. Its cleanup barrier must inspect
`cleanupErrors`, not interpret every `lateReadError` as failure to close.

## Design-stage type checks

Historical design-only check on 2026-11-13: TypeScript 6.0.3 accepted the exact declaration block
with positive and negative in-memory consumers under NodeNext and Bundler, both
with ES2022-only/no ambient types and separately with the DOM bridge. All four
checks passed. EN/RU declaration and bridge blocks are identical. No files were
emitted and no adapter was implemented. These checks verify proposed types, not
installed-package exports or runtime behavior.

Check inference for async generators/custom async iterables; exhaustive narrowing
of all read/close branches; undefined states/errors/reasons; readonly fields and
diagnostics; rejection of sync/promise factories, signal mutation and iterator
usage. Compile declarations/consumers with ES2022 and no ambient types under
NodeNext and Bundler, plus the explicit bridge under DOM types.

Runtime acceptance requires same-promise coalescing, prompt read
cancellation with delayed cleanup, first-terminal-event ordering, late rejection
diagnostics versus actual return errors, listener ordering/unsubscription/errors,
natural/empty EOF, and the adapter cases from the behavioral contract. These are
covered by the implementation checks below; widget cases remain separate.
Type checking declarations alone does not verify runtime behavior.

## Implementation and local verification

Implemented in [async-source.ts](../src/playback/async-source.ts) and exported
through `/playback`. All **244 tests** passed, including **19 async-source tests**.
The [adapter tests](../test/async-source.test.mjs) use controlled promises to check
shared waiting, prompt public cancellation with delayed physical cleanup,
serialized iterator methods, first-terminal-event races, late failures versus
cleanup errors, empty/natural EOF, listener ordering and reentrant disposal.
They also passed with `--unhandled-rejections=strict`.

A fresh install of the locally packed archive passed the exact runtime-export
inventory and private-path rejection, strict ES2022-only headless and DOM/runtime
consumers under TypeScript 6.0.3 in NodeNext and Bundler. All 19 adapter tests also
passed against that installed archive. The DOM consumer verifies an explicit
AbortController bridge. Browser ESM bundle-isolation checks passed. These are
local package checks, not a release or exact-commit CI result. Widget controls, RAF waiting and native UI checks are recorded separately
in the [integration API](player-async-api.md).
