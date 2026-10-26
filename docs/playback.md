# Playback and steps

[README](../README.md) · [Русский](ru/playback.md)

## Custom structures and renderers

`/playback` does not know arrays, sorting, Canvas, or event names. A source yields
`Step<State, Event>` objects with a numeric `index`, immutable
`state` and `event`. Supply `isTerminal` to identify the final step and
`render` to draw each interpolated frame using any rendering technology:

```js
import { createPlayer, createTimeline } from "@grundyjs/algiviz/playback";

const player = createPlayer(myTraversal(), {
    stepDurationMs: 300,
    finalHoldMs: 1000,
    isTerminal: step => step.event.kind === "finished",
    render: frame => drawGraph(frame.previous, frame.current, frame.progress, frame.event)
});
```

Both engines preserve the supplied index; it need not start at zero or be
contiguous. Timing follows source order. `createStepEmitter` provides consecutive
zero-based numbering for convenience.

The render callback is optional. Without it, read `player.frame` and render
manually. `createTimeline(steps, timing)` supports seeking with the same generic
frame shape; call your renderer with its `sample(timeMs)` result. The generic
engine does not clone or freeze user states; that is the source's responsibility.
It retains adjacent snapshots only; the timeline retains the supplied history.
Custom array events or tree/graph operations can use this contract and a custom
renderer. The scene API dispatches individual objects; there is no built-in
graph/tree algorithm or operation set.

## Playback contracts

Playback retains application snapshots without cloning them; keep steps, state and
events immutable while they are in use. A timeline copies the input array only.
Timeline timing follows array position, and finite sample times are clamped to its
range. Generator playback requires an explicit terminal step; an early end throws.
`dispose()` closes the source at most once, keeps the last frame readable and
prevents further advancement. Restart uses a fresh source.

Timeline `stepIndex` preserves the source `step.index`,
matching the player. If source consumption, a terminal predicate or rendering
throws, cleanup is attempted without replacing that primary error. A standalone
cleanup error from disposal or normal completion still propagates.

## Step emission helper

`createStepEmitter` from `/playback` creates steps. It removes manual step numbering and freezes the step wrapper:

```js
import { createStepEmitter } from '@grundyjs/algiviz/playback';

function* counter() {
    let count = 0;
    const emit = createStepEmitter(() => Object.freeze({ count }));
    yield emit('start');
    count++;
    yield emit('done');
}
```

Create the emitter inside each iterator. Its callback runs once per emission;
indices start at zero and failed captures do not consume an index. The helper
does not clone or freeze state/event data, infer terminal events or store history.
The callback must produce isolated immutable snapshots; immutable shared structures
can be reused. Returning a mutable workspace directly does not make it a snapshot.

## Playback and rendering

Array players and timelines use the same frame shape as generic playback:
`previous`, `current`, `progress`, `stepIndex` and `event`.
A frame describes the transition into the current step; that step's state is the
state after its operation.

| API | Behavior |
| --- | --- |
| `createArrayPlayer(iterable, options)` | Array playback; recognizes the `done` event |
| `createPlayer(iterable, options)` | Generic playback; requires `isTerminal(step)` |
| `createArrayTimeline(steps, timing)` / `createTimeline(steps, timing)` | Retained history with `durationMs` and `sample(timeMs)` |
| `createArrayRenderer({ theme: "dark" \| "light" })` | Full-frame Canvas array rendering |
| `createSceneRenderer(handlers)` | Dispatches custom objects to your visualization handlers |
| `createSceneProjector(project)` | Adapts immutable state endpoints to scenes with a bounded cache |

Players read the first step at construction and expose `frame`, `advance(deltaMs)`,
`finished` and `dispose()`. The initial frame has progress 1.
`advance` accepts finite, non-negative elapsed playback time; zero consumes no steps.
Pause by not advancing. Apply speed by multiplying elapsed time.
The optional render callback runs initially and on every advance.

The source must reach a terminal step. The player closes the iterator after its
final transition and becomes finished after `finalHoldMs`. Premature exhaustion,
source errors and render errors propagate and close the iterator.
`dispose()` closes early and can be repeated; the frame remains readable, but
advancing a disposed player throws. Restart with a new iterator and player.

Timelines require an array of steps. Step i completes at `i * stepDurationMs`;
`finalHoldMs` extends the last frame. Sampling clamps finite times to the timeline
range and rejects non-finite times. There is no seeking or known total duration
in generator playback.

Animation scheduling belongs to your application. For example:

```js
const player = createArrayPlayer(reverse.iterate([1, 2, 3, 4]), options);
let last;
let requestId;
let paused = false;
let speed = 1;

function tick(now) {
    const delta = last === undefined ? 0 : Math.min(100, now - last);
    last = now;
    if (!paused) player.advance(delta * speed);
    renderer.render(ctx, player.frame);
    if (!player.finished) requestId = requestAnimationFrame(tick);
}
requestId = requestAnimationFrame(tick);
// On teardown: cancelAnimationFrame(requestId); player.dispose();
// To replay after finishing, create a new player and schedule a new loop.
```

This is an alternative to the player setup in the array example in the array guide, reusing
its `reverse`, `options`, `ctx` and `renderer` (see the [array example](https://github.com/urffin/algiviz/blob/master/docs/array.md)). Large deltas consume intervening steps
synchronously, so cap elapsed time or pause on hidden tabs to avoid a long catch-up.
