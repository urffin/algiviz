# Scene objects and visualizations

[README](../README.md) · [Русский](ru/scene.md)

## User-defined objects and visualizations

Define a type map with your own data, then
provide a visualization for every type. AlgiViz matches identities and dispatches
objects; your handlers decide how data becomes geometry and how it interpolates.

```ts
import { createSceneRenderer, type Scene } from "@grundyjs/algiviz/scene";

interface MyObjects {
    badge: { x: number; y: number; label: string };
}

const renderer = createSceneRenderer<MyObjects, CanvasRenderingContext2D>({
    badge(ctx, object) {
        const from = (object.previous ?? object.current)!.data;
        const to = (object.current ?? object.previous)!.data;
        const x = from.x + (to.x - from.x) * object.progress;
        const y = from.y + (to.y - from.y) * object.progress;
        ctx.save();
        try {
            ctx.globalAlpha = object.presence;
            ctx.fillText(to.label, x, y);
        } finally { ctx.restore(); }
    }
});

const before: Scene<MyObjects> = {
    objects: [{ id: "first", type: "badge", data: { x: 20, y: 30, label: "A" } }]
};
const after: Scene<MyObjects> = {
    objects: [{ id: "first", type: "badge", data: { x: 120, y: 30, label: "A" } }]
};
// Keep these states immutable. A generic timeline/player can provide this frame.
renderer.render(ctx, {
    previous: before, current: after, progress: 0.5, stepIndex: 1, event: "move"
});
```

- An object has a non-empty stable `id`, a `type`, user-defined `data` and an
  optional finite `zIndex` (default zero). IDs are unique within a snapshot. A
  retained ID cannot change type; use a new ID to replace an object of another type.
- Handlers receive `previous` and `current` objects, with `null` for a missing
  endpoint. `phase` is `enter`, `update` or `exit`. `progress` is the raw 0–1 frame
  progress. `presence` is progress on entry, 1 on update and 1−progress on exit;
  handlers may use it for opacity or scale. It is not applied automatically.
- Lower `zIndex` draws first. Ties follow the current snapshot's object order;
  removed objects follow in their previous order. The current layer wins when it
  changes. There is no implicit layout or coordinate system.
- The third handler argument exposes `scene.get(id)` for links, pointers and other
  references. It returns the referenced object's full transition, including both
  endpoints; missing references return `undefined`. The application decides how to
  handle them and how to interpolate positions or changing targets.
- `createSceneFrame(frame)` exposes the same resolved transitions without drawing.
  The registry is captured at renderer construction. Missing handlers, duplicate
  IDs, invalid progress/layers and changed types fail before any handler is called.
- Scene processing is stateless, so arbitrary seeking is supported. Handlers may
  see zero-presence objects. They are frame draws, **not guaranteed lifecycle
  callbacks**: skipping steps can skip appearances/exits entirely. Clear Canvas
  each frame; a retained SVG/DOM backend must reconcile its elements against the
  current frame, removing stale IDs itself. Save/restore Canvas state inside each
  handler. Exceptions propagate; there is no rollback of drawing already performed.
- Snapshots and user data are not cloned or deep-frozen. The author owns their
  immutability, as with generic playback. Scene indexing uses O(n) additional
  memory and layer ordering O(n log n) time per frame.

`arrayScene(snapshot)` from `/canvas` adapts an array to a `Scene<ArrayObjects>`
with `bar` objects whose data contains `item`, `index` and `held`. The built-in
array renderer uses this same dispatcher. You can provide a different `bar`
visualization using `createSceneRenderer<ArrayObjects, YourContext>`.

## State-to-scene projection

`createSceneProjector` adapts
playback frames from your state model to scenes without changing the algorithm:

```js
import { createSceneProjector } from '@grundyjs/algiviz/scene';
const projectFrame = createSceneProjector(state => ({
    objects: state.items.map(item => ({ id: item.id, type: 'node', data: item }))
}));
// Reuse the projector across renders, with either history or generator playback.
renderer.render(ctx, projectFrame(frame));
```

The projection receives only a state, not an event or progress. Use a pure
function and immutable states/scenes. Endpoints are compared with `Object.is`;
mutating a retained state or changing captured projection settings will not
invalidate the cache. Create a new projector when those settings change.
At most two endpoint projections are retained; seeking to older states may
recompute them. Events, step indices and progress are preserved. Viewport layout
and animation belong in render handlers, not in this cached projection.
The returned frame is frozen; user states and projected scenes are not cloned
or deep-frozen. Scene validation still happens in the scene renderer.
The merge example uses this adapter to avoid rebuilding two cell scenes on every
animation frame. The algorithm, object types and visual behavior remain external.
