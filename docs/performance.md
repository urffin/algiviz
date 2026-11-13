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

## Profiling real examples

Run `npm run benchmark -- --profile --output profile-node.json` to measure
real insertion/merge, BFS, Boids and sand generators, scene projections, matching,
dispatch and renderers. This uses a counting mock Canvas in Node. Build first,
serve the repository over local HTTP and open `test/profile-browser.html` for
the same workloads with native Canvas; press the run button and expand the JSON
report. Native import maps resolve the locally compiled public entry points.
No external browser debugging is required.

The bounded diagnostic window samples adjacent state pairs from a source prefix,
then exercises eight interpolation frames per pair. It does not collect a full
trace. Timed series continue through the window instead of resetting to its first
frame. Generation measures a separate fresh 16-state prefix, including startup.
Seven samples, adaptive batching, warmup, selected indices and environment are
recorded. Render timings include matching/projection; stages overlap. Do not add
or subtract them as an exact breakdown. Canvas command replay verifies one
captured frame per workload by byte-for-byte pixel comparison before measuring
command submission. Neither backend reports FPS, GPU completion or a portable
performance threshold. Run benchmarks serially, outside test/build activity.

See the [0.13.0 baseline and optimization priorities](performance-baseline-0.13.0.md).

## Scene matching cache experiment

Run `npm run benchmark -- --scene-cache --output scene-cache.json` for paired
CPU comparisons against the released 0.13.0 scene implementation read from Git.
The script transpiles that exact source into a temporary module using the
existing TypeScript dependency; it does not install or fetch a package. The
baseline release commit must exist in the local Git history. Both implementations
run in the same process, in alternating order, on the same real-example scenes.
It checks resolved frames against the release, measures repeated/interpolated/
changing pairs and uncached calls, then streams 4,000 pairs with forced GC and
WeakRefs. Heap samples include the process and are diagnostic, not thresholds.
See the [results and cache lifetime review](scene-cache-performance.md).

## Array dispatcher reuse

`npm run benchmark -- --array-dispatch --output array-dispatch.json` compares
`createArrayRenderer` before/after dispatcher reuse. A frozen fixture from
`25040d1` supplies the baseline; both versions use the same current /scene.
Paired CPU measurements cover a repeated pair, interpolated playback, changing
pairs, exact manual steps and reverse seeking. Forced-GC checks separately track
snapshot retention and collection of Canvas contexts, frames and events.

For native Canvas, run
`node scripts/benchmark-array-dispatch.mjs --serve --output array-dispatch-browser.json`
and open `http://127.0.0.1:8765/test/array-dispatch-browser.html` in the embedded
browser. The button compares pixels, restored Canvas settings and CPU time, then
saves JSON through the local server. See [results and limits](array-dispatch-performance.md).
