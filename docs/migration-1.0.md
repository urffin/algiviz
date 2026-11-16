# Migrating from 0.16.0 to 1.0.0

[Русский](ru/migration-1.0.md) · [Compatibility policy](api-compatibility.md) · [Candidate status](candidate-1.0.md)

**1.0.0 is a locally prepared, unpublished candidate.** These notes describe its
changes from published 0.16.0. Exact-candidate CI and native checks remain before
release. No new public method, option, status field, type or export is required.
The eight ESM import paths and the lack of runtime dependencies are retained.

## U1: issue headless commands after callbacks return

This applies to `createPlayer`, `createStatePlayer` and `createArrayPlayer`.
Calling the same player's `nextStep()`, `advance(...)` or first `dispose()` from
its active synchronous callback/getter now throws built-in `Error`, before a
second read/render, frame/time change or disposal. The protected interval includes
`render`, `isTerminal`, iterator acquisition/`next`/`return`, result/step getters
and synchronous helpers they call. A `frame` read that enters a step getter is
also protected. Even `advance(0)` or a command on a finished player rejects there.

Before, a render callback could enter playback again or a generator could fail
through overlapping iterator use. Do not rely on those results. For example,
this same-instance command is rejected in 1.0:

```js
let player;
player = createStatePlayer([0, 1, 2], {
  render(frame) {
    draw(frame);
    if (frame.current === 1) player.nextStep();
  },
});
player.nextStep(); // render enters another command and throws
```

Record an intent in the callback and execute it after the outer command returns:

```js
let requestNext = false;
const player = createStatePlayer([0, 1, 2], {
  render(frame) {
    draw(frame);
    requestNext = frame.current === 1;
  },
});
player.nextStep();
if (requestNext && !player.finished) {
  requestNext = false;
  player.nextStep();
}
```

Applications can instead schedule work for a later microtask/event, checking
their own lifecycle and handling later errors. The library adds no queue and
does not await callback promises. Do not use an uncaught async callback as a
substitute for a synchronous control loop.

`frame` and `finished` remain readable, and a different idle player can be
controlled. Prefer the callback's frame/step argument for its current candidate;
reads are not a transaction or cleanup barrier. Once logical disposal has
started, repeated `dispose()` is a no-op, including from its own cleanup. The
first dispose from normal terminal source closure is still a guarded command:
source closure and logical player disposal are distinct.

An inner rejection caught by application code does not fail the outer operation.
If it escapes through a command callback, that operation follows the existing
failure/disposal rules, preserves the primary exception and attempts owned
cleanup at most once. For `nextStep`/`advance`, reentrancy rejection precedes
argument validation; dispose checks already-disposed idempotence first. An idle
frame getter error alone does not automatically dispose the player.

This is the headless contract, not a change to `/player` guards or to the
coalescing reads of `createAsyncSource`. See the [complete U1 contract](headless-reentrancy.md).

## U2: handle invalid widget speed as RangeError

`Player.setSpeed(value: number)` now has the same error contract for `source`,
`history` and `asyncSource`, including Worker-backed sources. Sync/history already
used `RangeError`; async/Worker used `TypeError` in 0.16.0. Update error-specific
handlers on those paths:

```js
try {
  ui.setSpeed(speed);
} catch (error) {
  if (error instanceof RangeError) showInvalidSpeed();
  else throw error;
}
```

Only primitive finite numbers greater than zero are accepted, including positive
fractions and finite extremes. Zero, negative zero, negatives, NaN, infinities,
strings, boxed numbers and other runtime types synchronously throw `RangeError`
without coercion, rounding or clamping. Exact messages are not a stable contract.

Validation comes first, even in render/status callbacks, during preparation or
cleanup, and after disposal: an invalid value yields `RangeError`; a valid value
still obeys the existing lifecycle/reentrancy guards. Rejection itself does not
change speed/frame/intent/time debt, notify callbacks, acquire/read/close a source,
create/message a Worker or schedule RAF. If it escapes from a surrounding
callback, that outer operation still applies its normal failure rules.

The parameter, result type, initial speed `1` and valid speed/time accounting
are unchanged. This does not change headless `advance` or configure the generator
or Worker. See [U2](player-speed-validation.md) for the complete matrix.

## Worker data and errors

F1/F2 enforce the existing ban on shared mutable storage. Input/state graphs
containing shared WebAssembly.Memory, its buffer, shared typed views/DataView or
nested/cyclic wrappers now fail serialization, including when SharedArrayBuffer
is unavailable at import. Replace forbidden shared storage with application-owned
ordinary snapshots; creating a view on shared storage does not copy its bytes:

```js
const bytes = Uint8Array.from(new Uint8Array(memory.buffer));
// bytes.buffer is an ordinary ArrayBuffer snapshot.
```

The application coordinates any concurrent writers when creating its snapshot.
Ordinary copy/explicit ArrayBuffer transfer and retained host snapshots keep
their contracts. Invalid serialization remains terminal, without a hidden retry
or restoration of already affected sender resources.

U5 adds permanent coverage of existing error behavior, not a new wrapper:
application and host postMessage throws can be any `unknown` value, including
`undefined`; `instanceof WorkerSourceError` is not a catch-all. Init/pull preserve
the original throw with host/post report context. A later cancel/cleanup failure
does not replace an earlier primary; inspect the separate close report for
cleanup. See [Worker error contract](worker-post-errors.md).

## Stable surface and remaining verification

The [common policy](api-compatibility.md) protects all eight entries equally in
1.x, including public structural shapes, closed unions, error precedence and
documented ownership/timing. Optional entry loading does not mean experimental.
There is no root/CommonJS export, public internal deep path or cross-version
Worker protocol promise. Host and endpoint use the same package version.
The environment boundary is retained; candidate preparation adds no new browser,
compiler, Node worker_threads, SharedWorker or ServiceWorker guarantee.

Follow [candidate status](candidate-1.0.md) for the remaining exact-SHA CI/native
checks. These notes do not state that 1.0.0 has been published.
