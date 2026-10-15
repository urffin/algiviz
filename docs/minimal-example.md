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

The minimal integration needs no additional generic helper: snapshot policy,
geometry and controls are application choices; step numbering and object dispatch
are already provided by the library.
