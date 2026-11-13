# Bounded streaming controls: local browser checks

Checked 2026-11-13 using the embedded browser and the local compiled public
`/player` entry through `examples/optional-player.html`. One agent-opened tab was
used. No external browser or debugger was attached. This does not establish
support for other browser products, historical versions or a published tarball.

| Scenario | Observed result |
| --- | --- |
| Deferred initialization | Loading/remounting controls does not create a source; Start shows state 0 with Previous disabled. |
| Capacity 3 over five states | After four Next clicks the range is 2–4 and five values have been yielded. |
| Pointer and keyboard Previous | Clicking Previous, then activating it with Enter, reaches state 2. Previous disables at the boundary; yield count stays 5. |
| Play through buffered values | Completion still has five yields from one source, closed once. |
| Previous after completion | Returns to state 3, paused, with the same closed source and retained range. |
| Restart | Creates a fresh source and window; subsequent backward/forward navigation reuses its values. |
| Previous during Play | Returns to a paused retained state without additional yields; scheduling stops. |
| Disposal while rewound | Source closes once; controls disappear while the SVG drawing remains. Remount is idle and does not read. |
| Independent Canvas recording | Recording Next/Previous keeps the known duration and moves its slider 1000 → 0 → 1000 ms independently of the SVG stream. |

The final observation shows the stream paused at state 3 with window 2–4,
three created sources, thirteen total yielded values and three closed sources.
The recording remains paused at state 1 / 1000 ms. Console warning/error logs
were empty. [Source hashes and observations](benchmarks/player-rewind-browser.json)
identify the checked working copy.

All 213 repository tests passed, including nine new integration regressions for
bounded manual/timed streams, partial transitions, final holds, large advances,
capacity-one/singleton boundaries, failure precedence, restart and scoped DOM.
Installed-package runtime and TypeScript 6.0.3 consumers passed under NodeNext
and Bundler, including headless imports. Bundle isolation passed.

The [retention diagnostic](benchmarks/player-rewind-memory.json) streams 10,000
new states at capacities 3 and 64 with repeated Previous/Next operations. Sampled
evicted values are collected, the active count equals capacity, and disposal
while rewound releases the source/window while preserving one state in the last
readable frame. Dropping the controller releases that final state. Heap samples
include the process and are diagnostic; application-retained frames can of
course keep their own states alive.

Reproduce the memory check after building:

```sh
node --expose-gc scripts/check-player-rewind-memory.mjs --output player-rewind-memory.json
```

See [English contract](player.md#bounded-streaming-navigation-0140) and
[Russian contract](ru/player.md). Version/publication and exact-new-commit CI
were not changed or performed in this work.
