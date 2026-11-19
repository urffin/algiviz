# Quickstart: find a minimum on Canvas

[README](../README.md) · [Русский](ru/getting-started.md) · [Compare both examples](quickstart-comparison.md)

Run a real one-pass algorithm on [7,3,5,2,6]. AlgiViz records array operations,
draws the bars and supplies the standard Player panel. Your code owns the loop,
comparison condition and text result. The stepSource and done({ result }) APIs
below are available in released 1.0.0.

The example uses a fixed nonempty array. It has no user input or empty-array
branch.

## 1. Install

Use Node.js **22.12 or newer** and npm for the pinned [Vite dev tool](https://vite.dev/guide/#manual-installation).
This is a demo-tool requirement, not a new AlgiViz runtime requirement.
Start in a parent directory for a new app; no AlgiViz checkout is required.
In PowerShell or a POSIX shell:

```sh
mkdir algiviz-quickstart
cd algiviz-quickstart
npm init -y
npm install --save-exact @grundyjs/algiviz@1.0.0
npm install --save-dev --save-exact vite@8.3.8
```

The AlgiViz version is pinned for reproducibility. Vite belongs only to the demo
app. This quickstart also works with 1.1.0; it needs neither graph entry.
Graph entries are published in 1.1.0; repository example pages use a local build.

## 2. Copy one file

Create **index.html** in algiviz-quickstart and copy this complete file:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AlgiViz · Find a minimum with Player</title>
  <style>
    body { max-width: 760px; margin: 32px auto; padding: 16px; font: 16px/1.5 system-ui; }
    canvas { display: block; width: 100%; height: auto; }
    button { padding: 8px 16px; font: inherit; }
  </style>
</head>
<body>
  <h1>Find a minimum with Player</h1>
  <p>Press Start, then Next state. The done step marks the minimum in green and finishes playback. Restart starts a fresh search.</p>
  <div id="player"><canvas width="720" height="300" aria-label="Array values and compared elements"></canvas></div>

  <p id="result" role="status">Press Start</p>
  <p>Compare highlights two bars; highlight marks the minimum found so far. The final minimum stays green. The input is not reordered.</p>
  <script type="module">
import { Player } from '@grundyjs/algiviz/player';
import { createArrayTrace } from '@grundyjs/algiviz/array';
import { createArrayRenderer } from '@grundyjs/algiviz/canvas';

const container = document.querySelector('#player');
const canvas = container.querySelector('canvas');
const ctx = canvas.getContext('2d');
const result = document.querySelector('#result');

function* minimum(values) {
  const array = createArrayTrace(values);
  result.textContent = 'Searching…';
  yield array.start();
  let min = 0;
  yield array.highlight([min]);
  for (let i = 1; i < array.length; i++) {
    yield array.compare(min, i);
    if (array.at(i).value < array.at(min).value) min = i;
    yield array.highlight([min]);
  }
  result.textContent = 'Minimum: ' + array.at(min).value;
  yield array.done({ result: [min] });
}

const renderer = createArrayRenderer({ theme: 'light' });
const player = new Player(container, {
  viewport: canvas,
  stepSource: () => minimum([7, 3, 5, 2, 6]),
  isTerminal: step => step.event.type === 'done',
  render: frame => renderer.render(ctx, frame),
});
  </script>
</body>
</html>
```

## 3. Run and inspect

```sh
npx vite --host 127.0.0.1 --port 5173 --strictPort
```

Open **http://127.0.0.1:5173/**. Keep the terminal running; Ctrl+C stops it.
Use the HTTP address, not a file double-click. If the port is occupied, select
another port in both the command and browser address.

Start draws the initial array. Next state advances one visible operation:
compare highlights the two compared bars; highlight marks the current minimum.
The final done state keeps the minimum bar green and displays **Minimum: 2**, with **4 comparisons** and **0 writes**.
The bars stay in their original order. The done step finishes the widget. Restart creates a new generator and resets the result.

## Why this code is here

- createArrayTrace owns immutable snapshots and counters. compare records an
  operation; the JavaScript less-than condition makes the actual decision.
  array.at(i).value reads the number; the item also has an ID for highlighting.
- createArrayRenderer owns Canvas drawing. We do not mark the array as sorted:
  finding its minimum neither sorts it nor writes array cells.
- Player reads explicit steps through stepSource and passes Frame directly to the Canvas renderer.
  isTerminal accepts done as the final step; no extra read or frame adapter is needed.
  See the [stepSource contract](player-step-source.md).
- The generator writes Searching… before start and the final value before done.
  Its local min index already identifies the answer; rendering only draws Canvas.
  Set the result before yielding done: terminal steps close the generator.
  The fixed input is nonempty; equal minima keep the first.
- done({ result: [min] }) records the answer in the final snapshot. The stock
  renderer keeps that bar green, without a custom snapshot, event conversion or
  second renderer. Restart restores the normal colors.
- Call player.dispose() when removing the app. This example is forward-only;
  seekable annotations should be part of each frame's application state.

## Learn in smaller steps

The [progressive tutorial](learning-path.md) starts with plain states and pre,
then uses createArrayPlayer with one button, then the standard panel above.
[Compare the complete alternatives](quickstart-comparison.md) for the API and control differences. Continue with [scenes and interpolation](minimal-example.md) afterwards.
The [repository preview](../examples/getting-started.html) adds page lifecycle
handling; [minimum-player.html](../examples/minimum-player.html) is the comparison version.
