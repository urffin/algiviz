# A minimal custom object

The [module](../examples/minimal.mjs) and [page](../examples/minimal.html) form a
standalone example. They do not import demo-player or other example infrastructure.

## Run the repository example

Run `npm install` and `npm run build`, serve the repository with a static HTTP
server, and open `/examples/minimal.html`. Reuse an existing server if available.
The page's import map resolves public package names to the local build.

## Use the module in your own application

Install `@grundyjs/algiviz` version 0.6.0 or later and copy `minimal.mjs` into your
application. A bundler resolves its two public imports from the installed package.
The repository HTML import map is only for the local build; do not copy its `dist`
paths into a bundled application.

```js
import { createTokenPlayer } from './minimal.mjs';
const player = createTokenPlayer(canvas.getContext('2d'));
player.advance(100); // elapsed playback time in milliseconds
player.dispose();   // close the generator when removing the visualization
```

The example separates three responsibilities:

1. `tokenSteps` owns the algorithm and snapshots. One emitter per iterator assigns
   indices. The application freezes its state; the emitter freezes only the wrapper.
2. `tokenRenderer` supplies the handler for the application's `token` type. Stable
   object IDs let the scene renderer pair endpoints; the handler interpolates `x`.
3. `createTokenPlayer` sets timing, recognizes the terminal event and clears/draws
   each frame. The HTML owns buttons and lifecycle cleanup.

This small state is already a scene, so it needs no projector. Larger applications
can keep domain state separate and use `createSceneProjector`, as the graph example
does. No registration of object types in the library is required.

The page advances manually to keep the integration short. For continuous animation,
call `advance(deltaMs)` from the application's animation loop, pause on hidden tabs
and honor reduced motion. Restart requires a fresh player/source. Generator mode
has no backward seeking; `createTimeline` is the alternative when retaining history
is acceptable.

`npm run test:package` copies this exact module into an isolated directory, installs
the packed library and checks initial, intermediate and final drawing coordinates,
completion and restart. This verifies package exports without repository resolution.

## A complete TypeScript integration

Continue with [custom-objects.ts](../examples/custom-objects.ts) and its
[page](../examples/custom-objects.html). Build the library, then run
`npx tsc -p examples/tsconfig.json` and open `/examples/custom-objects.html`
on the same static server. The compiled example is not shipped in the npm package.
In your own bundled application, copy the TypeScript module and import
`mountCustomObjects`; the repository import map is not needed.

The module connects two object types (`token` and `label`) to one immutable
generator. `Scene<Objects>` checks snapshot data and
`createSceneRenderer<Objects, CanvasRenderingContext2D, Event>` checks each handler.
The minimal JavaScript version uses `SceneVisualizations` through JSDoc for the
same purpose. Both examples are checked in strict mode by `npm test`.

Pass a canvas and three buttons to `mountCustomObjects(canvas, play, pause, restart)`.
It draws immediately and starts paused. Play schedules frames, Pause preserves the
current position, and Restart creates a fresh generator and stays paused. Playback
pauses when the document is hidden; reduced motion displays destination positions
without interpolation. Call the returned cleanup function when unmounting: it
cancels animation, removes listeners and disposes the generator. The sample HTML
also remounts after restoration from the browser's back/forward cache.

The canvas uses a fixed 600 × 120 bitmap, scaled by CSS. For a responsive high-DPI
integration, manage bitmap sizing and logical coordinates in the host (see the
graph walkthrough). This example deliberately keeps those details out of the
object model. The label displays the destination of the current transition;
only the token position is interpolated.

To add another type, extend `Objects`, include objects with stable unique IDs in
the snapshots and add its renderer handler. For objects that appear/disappear,
use endpoint fallbacks and `presence` in the handler. Clearing the canvas each
frame removes old drawings. Keep state independent of viewport size; introduce
`createSceneProjector` only when domain state and visual objects need to differ.

The packed-consumer check compiles this exact TypeScript module against the
installed package. Browser scheduling remains application code; no new public
library helper is required for this example.
