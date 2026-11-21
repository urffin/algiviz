# Two panels in one Player

[Русский](ru/player-multiple-panels.md) · [Player reference](player.md)

Use one source, one Player and one snapshot per logical step. The snapshot
contains the state of both panels and any text or totals that should follow
playback. Both panels then use the same step, progress and playback controls.
See the [Kruskal example](../examples/kruskal.html) and the
[BFS graph and queue example](../examples/graph-queue.html).

## Capture one snapshot per step

**Kruskal** marks the edge under consideration in the input graph. On acceptance,
it also adds that edge to the forest with the same ID. The generator updates the
traces first, then wraps the input graph step and the current forest snapshot in
one state. When an edge would form a cycle, the forest snapshot is reused.
[Source](../examples/kruskal.mjs).

```js
function describe(step, forest, totalWeight, message) {
    return Object.freeze({
        ...step, state: Object.freeze({ graph: step.state, forest, totalWeight, message }),
    });
}
```

**BFS** starts from a traversal step whose `state.visual` holds the graph
snapshot. The queue adapter starts a linked-list trace with the first FIFO
state, updates it on discovery or dequeue, and closes it on `finished`.
Between these operations it reuses the current list snapshot. The adapter
extends the original state with `queueVisual` and keeps the original step index
and event.
[Source](../examples/graph-queue-session.mjs).

```js
yield Object.freeze({
    ...step,
    state: Object.freeze({ ...step.state, queueVisual: trace.state }),
});
```

Capture immutable snapshots before yielding each step. An unchanged panel can
reuse its snapshot by reference, and its trace may emit fewer steps than the
source consumed by Player. The sequence of yielded steps defines playback order.

## Project the Frame for each renderer

Call both renderers from the same `render(frame)` callback. For each panel,
extract its snapshot from **both** `previous` and `current`, preserving
`progress`, `stepIndex` and `event`. The app-local function below expresses
the projection both examples perform. Each renderer receives the context and
logical size of its own Canvas.
[Kruskal rendering](../examples/kruskal-demo.mjs) ·
[BFS graph renderer](../examples/graph-player-view.mjs) ·
[BFS queue renderer](../examples/graph-queue-demo.mjs).

```js
function projectFrame(frame, select) {
    return {
        ...frame,
        previous: select(frame.previous),
        current: select(frame.current),
    };
}

function renderKruskal(frame) {
    graphRenderer.render(graphContext, projectFrame(frame, state => state.graph), graphSize);
    forestRenderer.render(forestContext, projectFrame(frame, state => state.forest), forestSize);
}

function renderBfs(frame) {
    graphRenderer.render(graphContext, projectFrame(frame, state => state.visual), graphSize);
    queueRenderer.render(queueContext, projectFrame(frame, state => state.queueVisual), queueSize);
}
```

## Connect playback and resize

Put both Canvas elements in a wrapper that is a direct child of the Player host.
Pass the wrapper as `viewport`. The following setup uses `kruskalSteps` from
the example and the render callback above. For BFS, use a factory that calls
`graphQueueSteps` with the selected input and identify the terminal step with
`step.event.kind === 'finished'`. [Explicit step sources](player-step-source.md).

```js
import { Player } from '@grundyjs/algiviz/player';

const sourceOptions = mode === 'history'
    ? { history: () => Array.from(kruskalSteps(), step => step.state) }
    : { stepSource: kruskalSteps, isTerminal: step => step.event.type === 'done', rewindCapacity: 8 };

const player = new Player(host, {
    ...sourceOptions,
    viewport: panes,
    stepDurationMs: 650,
    render: renderKruskal,
});
player.start();
```

With `stepSource`, Previous restores both panels within the retained window.
With `history`, Seek also shows intermediate frames. History stores the states
and leaves `frame.event` undefined, so keep messages, queue order and totals in
the shared snapshot. Restart shows the initial snapshot again. A generator
factory creates fresh traces for each run.

When a Canvas changes size, measure it and redraw the current `player.frame`
if available. This keeps both panels at the same playback position. On teardown,
dispose the Player and each Canvas viewport.
[Canvas viewport](canvas-viewport.md).
