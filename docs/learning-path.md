# From plain states to an algorithm visualization

[Русский](ru/learning-path.md) · [Complete minimum-search quickstart](getting-started.md) · [Compare the alternatives](quickstart-comparison.md)

The main quickstart already shows the target: an actual minimum search on Canvas
with standard controls. Use these smaller stages to understand each connection.
Repository pages use the local build/import map; the main quickstart supplies
exact commands for a separate app with the published package.

## 1. Ordinary states, ordinary output

Open [pre-states.html](../examples/pre-states.html), with [its source](../examples/pre-states.mjs).
A generator yields [3,1,2], [1,3,2] and [1,2,3]. Player supplies controls; render
sets pre.textContent to JSON.stringify(current). There is no algorithm or array
operation API yet. New arrays are independent snapshots, not mutations of one
previously yielded array.

This stage teaches yield → state → render and demonstrates that Player does not
require Canvas. Start is lazy, another Next state discovers EOF, and Restart
calls a fresh source factory. Use player.dispose() on teardown.

## 2. A real algorithm and one manual button

Open [minimum-manual.html](../examples/minimum-manual.html). It uses the same
minimum generator and Canvas renderer as the [main quickstart](getting-started.md).
The trace takes care of snapshots/IDs/counters, and the standard renderer draws
the array. Only the loop and comparison condition implement the algorithm.

To turn the copied main quickstart into this variant, remove its Player import,
add createArrayPlayer to its /array import, and put a button after the player div:

```html
<button id="next">Next step</button>
```

Keep minimum, renderer, ctx and result. Replace the new Player block with:

```js
const next = document.querySelector('#next');
const player = createArrayPlayer(minimum([7, 3, 5, 2, 6]), { render: frame => renderer.render(ctx, frame) });
next.onclick = () => {
  player.nextStep();
  next.disabled = player.finished;
};
window.addEventListener('pagehide', () => player.dispose(), { once: true });
```

Construction draws the start frame immediately; there is no Start action.
The array player gives the renderer an ArrayFrame directly and recognizes done as
terminal, so no frame bridge or extra EOF click is needed. The app owns the
button and any additional controls. On unmount, clear its onclick and dispose
the player; reloading this standalone page starts a fresh search.

## 3. Standard controls through Player

The [main quickstart](getting-started.md) uses stepSource and isTerminal.
Player receives ArrayTrace steps and passes ArrayFrame directly to the renderer. done
finishes playback in the same Next command, with no frame bridge or EOF click.
Start is lazy; Restart creates a new generator. These APIs are available in
1.0.0; follow the npm installation in the quickstart.

## 4. Your own visual objects and interpolation

Continue with [minimal.mjs](../examples/minimal.mjs) and the
[scene/interpolation walkthrough](minimal-example.md). That example introduces
stable object IDs, types, explicit events and interpolated drawing. It moves
beyond the supplied array renderer; its retained filename is not an instruction
to start there.
