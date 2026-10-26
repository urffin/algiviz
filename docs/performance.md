# Memory and performance

[README](../README.md) · [Русский](ru/performance.md)

## Memory and generation cost

Array operations copy the input, validate finite numbers and reject sparse inputs.
`defineArrayAlgorithm` performs this work on the first iterator `next()`;
`createArrayTrace` validates immediately. Each iterator owns its workspace.
Array steps, events, snapshots and items are frozen; immutable items can be shared
between snapshots.

Generator playback retains adjacent snapshots, not the entire history. Array
playback therefore uses O(n) snapshot memory if the caller does not retain old
frames. Generic states and algorithm-specific storage may have different costs.
Each full array snapshot still copies n slots: laziness reduces retained history,
not the cost of producing every step. Collecting steps restores the history cost.
For example, a quadratic sorting trace with O(n)-sized snapshots can take O(n³)
time and history space. Iteration is synchronous and can block the UI.

## Performance checks

Run `npm run benchmark` for 2,000-element insertion, bubble, merge and both quick-sort
variants. It reports generation of 1,000 steps, median rendering CPU time over five
100-frame samples and retained Node heap after each 5,000 playback steps, up to
25,000. Drawing uses a mock Canvas: these are CPU comparisons, not browser FPS or
GPU measurements. Heap samples use explicit GC and include the Node process;
they are diagnostics, not portable pass/fail thresholds.
