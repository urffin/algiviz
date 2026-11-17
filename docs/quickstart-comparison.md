# Comparing the minimum-search quickstarts

[Русский](ru/quickstart-comparison.md) · [Current quickstart](getting-started.md)

Both complete examples use the same input [7,3,5,2,6], one-pass minimum search,
createArrayTrace operations and standard Canvas renderer. Both retain an explicit
“Minimum: 2” result and a green bar for the selected minimum.
The algorithm does four comparisons and no array writes; it does not reorder input.

| | Standard Player | createArrayPlayer |
| --- | --- | --- |
| Runnable example | [minimum-player.html](../examples/minimum-player.html) | [minimum-manual.html](../examples/minimum-manual.html) |
| JavaScript lines, including blanks, excluding HTML | 31 | 31 |
| Explicit import paths | 3: player, array, canvas | 2: array, canvas |
| Playback connection and lifecycle lines | 6 | 7 |
| Initial rendering | Start requests the first state | Construction renders immediately |
| Controls | Built-in Start, Next state and Restart | One application-owned Next step button |
| Completion | done shows the answer and finishes playback | done finishes playback and disables the button |
| Frame connection | Direct ArrayFrame through stepSource | Renderer receives ArrayFrame directly |
| Restart | Built in, fresh generator | Reload the example; application owns any additional controls |

## What the newcomer learns in both

The algorithm owns the loop and comparison condition. compare records a visible
comparison and increments its counter; it does not return an ordering result.
highlight marks the current candidate. start/done delimit the trace. The trace
creates immutable snapshots and stable item IDs; Canvas drawing is delegated.

The generator writes Searching… at the start and the final answer before
yielding done, using its local min index. The render callback only draws Canvas;
it stores no result or highlight history. This example is forward-only. Seekable
annotations should belong to each frame's application state.

The fixed input is nonempty. done({ result: [min] }) records the answer;
one stock renderer keeps the chosen bar green. There is no custom final
snapshot, second renderer, event conversion or value lookup by ID.

## Selected main example

Player remains the main quickstart: standard Start, Next and Restart with Canvas rendering
connected directly through stepSource. isTerminal explicitly recognizes done.
createArrayPlayer remains a learning stage with one app-owned button; pre
introduces arbitrary output.

The [implemented contract](player-step-source.md) is available in 1.0.0.
The quickstart installs that exact published npm version into a separate app.
The historical pre-stepSource comparison measured 54/47 lines and required a
frame bridge and EOF click in Player; those limitations are now removed.

**Available in 1.0.0:** [done({ result })](array-result.md) replaces the previous
43/45-line final-highlight workaround. Using the fixed nonempty input reduces
both variants to 31 lines including blanks (28 nonblank lines in the main quickstart).
