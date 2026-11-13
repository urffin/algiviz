# Bounded backward navigation

[Русский](ru/rewind-buffer.md) · [Playback](playback.md)

Added in 0.14.0 to `/playback`: `createRewindBuffer` and the type
`RewindBuffer<T>`. A synchronous `Iterable<T>` can supply plain states, explicit
steps or any other immutable values. No DOM, renderer or timing is required.

```js
import { createRewindBuffer } from '@grundyjs/algiviz/playback';

function* states() {
    for (let x = 0; ; x += 10) yield Object.freeze({ x });
}
const history = createRewindBuffer(states(), { capacity: 3 });
console.log(history.current);       // { x: 0 }; construction reads one value
history.next();                     // { x: 10 }
history.next();                     // { x: 20 }
history.previous();                 // { x: 10 }; no source read
history.next();                     // { x: 20 }; replay, no source read
history.next();                     // { x: 30 }; source resumes
console.log(history.startPosition); // 1; x = 0 has been evicted
history.dispose();
```

## Window and navigation

`capacity` is required and must be a positive safe integer. It counts all
retained values, including `current`: capacity 1 allows forward playback with
no backward step. Storage grows as values arrive, up to that capacity; no full
history is collected. Buffered navigation and eviction take O(1) work; growing
the ring is amortized O(1), excluding the source's own `next()`/`return()` work.
Retention is O(capacity × value size),
subject to shared data and references held by the source or application.

| Member | Meaning |
| --- | --- |
| `current` | Current value, retained by reference |
| `position` | Current zero-based sequence position |
| `startPosition`, `endPosition` | Inclusive retained window |
| `canPrevious` | There is an older retained value |
| `canNext` | There is a newer retained value or source exhaustion is still unknown |
| `sourceEnded` | A source request has returned `done: true` |
| `previous()` | Return the older retained value; at the start, return current |
| `next()` | Replay the next buffered value, otherwise request one source value; at the known end, return current |
| `dispose()` | Close the unfinished source once and discard history, retaining current |

Backward navigation does not rewind the running algorithm, undo its side effects
or regenerate states. Forward replay consumes buffered values before reading the
source again. The window moves only when a new value arrives at its right edge;
moving backward or replaying does not evict values. There is no branching, reset,
arbitrary seek, full-history mode or asynchronous source in this adapter.

No lookahead occurs. Reading the last yielded value leaves `canNext` true;
another request discovers exhaustion without changing current/position. At that
point `sourceEnded` stays true even while navigating backward. `canNext` becomes
true again when newer buffered values can be replayed. Generator return values
are ignored. An empty source throws `RangeError` during construction.

Values are not cloned or frozen. Keep state/event data immutable. Explicit
`Step` objects retain their own `index`, `event` and `state` unchanged; adapter
positions count sequence order and do not replace `Step.index`.

## Rendering and ownership

Render the returned values with application controls. For an exact scene step:

```js
const steps = createRewindBuffer(myTraversal(), { capacity: 64 });
const step = steps.current; // myTraversal yields Step<Scene<MyObjects>, MyEvent>
renderer.render(context, {
    previous: step.state,
    current: step.state,
    progress: 1,
    stepIndex: step.index,
    event: step.event
});
```

Interpolation, playback time and rendering remain caller-owned. This handle is
not an iterator or a `Player`, so it cannot be passed directly as a `/player`
source or used to rewind an existing forward-only player. The browser widget
now integrates a buffer through its opt-in `rewindCapacity` option; see
[bounded streaming navigation](player.md#bounded-streaming-navigation-0140).
Full recorded histories can use `createTimeline`.

The adapter acquires one iterator after validating capacity and immediately
requests its first value. It owns that iterator; do not advance it independently.
Restart by disposing the adapter and constructing another with a fresh source.
Early disposal calls iterator `return()` if present. Natural exhaustion releases
the iterator without calling `return()` again. Repeated disposal is harmless.

After disposal, `current` and `position` remain readable; the window collapses
to `[position, position]`, both navigation flags are false, and navigation throws.
`sourceEnded` records natural exhaustion only, not cancellation or failure.
A source/result-access error disposes the adapter, preserves the last committed
current/position and attempts cleanup without replacing the primary error.
A standalone cleanup error propagates once, after the adapter is disposed.
Reentrant commands from source callbacks are rejected; read-only inspection is
allowed, and repeated disposal from an already running cleanup is harmless.

See [contract tests](../test/rewind-buffer.test.mjs). Run
`node --expose-gc scripts/check-rewind-memory.mjs --output rewind-memory.json`
for sampled retention checks at capacities 3/64 over 10,000 new values each.

## Local verification, 2026-11-13

All 204 repository tests passed, including 11 adapter tests and 5,120 short
navigation sequences checked against a full-history reference. Installed-package
runtime/types passed with TypeScript 6.0.3, NodeNext and Bundler, including
ES2022-only consumers without DOM. Bundle isolation passed. The
[retention report](benchmarks/rewind-buffer-memory.json) records zero surviving
sampled evicted values, exactly capacity active values, one retained current
after disposal while rewound, a released source iterator and zero active values
after dropping the adapter. Heap figures are process diagnostics, not thresholds
or proof about references retained by arbitrary application sources. Version,
publication and new-commit CI were not changed/performed in this work.
