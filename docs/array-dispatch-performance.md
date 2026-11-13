# Array dispatcher reuse

[Русский](ru/array-dispatch-performance.md) · [Original priorities](performance-baseline-0.13.0.md#optimization-order)

The local implementation was verified on 2026-11-13. `createArrayRenderer` now
creates one scene dispatcher per instance, allowing interpolated frames to reuse
its single-pair matching cache. Each render passes a fresh drawing callback as
the dispatch context, capturing current dimensions, Canvas, palette, progress,
event and state. The dispatcher does not retain that callback. Nested rendering
on another Canvas preserves outer-frame inputs; drawing errors still pass through
the existing Canvas-state restoration `finally`.

## Comparison boundary

The baseline is an exact copy of `src/canvas/index.ts` at
`25040d157527e7564bde088b3c5b76bdcc398ecf`, stored in
`test/fixtures/array-dispatch-before.ts`. The existing TypeScript dependency
transpiles it without downloads. Both versions import the same current /scene,
isolating this /canvas change from the earlier scene optimization. The frozen
fixture also makes regression tests independent of CI checkout depth.
Reports record SHA-256 hashes of sources, build and harness. Final source/build
hashes were checked against the native report after the final build.

Insertion/bubble sort, 24/2,000 reverse-ordered items. The existing bounded
profiler samples up to 16 pairs from a trace prefix, with 8 frames per pair.
Cases cover one repeated pair, interpolated playback, changing pairs, exact
manual steps and reverse seeking. Each case runs before/after and after/before,
with warmup and seven samples. Measurements run separately from tests/builds.

Windows x64, AMD FX-8350, Node 22.17.0; embedded Chromium 157, DPR 1, visible
document, main bitmap 960 × 540. Browser zoom was unchanged. Pixel readback
before timing may influence the Canvas backend; backend flags were not set.
Times measure CPU/Canvas submission, not FPS or GPU completion. Node uses a
counting mock Canvas.

## Results

Milliseconds per frame, before → after. Ranges are the two medians from opposite
execution orders, not confidence intervals. Node columns show the second
independent run; the first is also retained and informs the variability findings.

| Case | Node, repeated pair | Node, playback | Canvas, repeated pair | Canvas, playback |
| --- | --- | --- | --- | --- |
| insertion-24 | 0.042–0.044 → 0.028–0.031 | 0.047–0.054 → 0.033–0.036 | 0.338–0.375 → 0.309–0.334 | 0.325–0.378 → 0.325–0.406 |
| bubble-24 | 0.044–0.055 → 0.027–0.029 | 0.047–0.047 → 0.033–0.035 | 0.363–0.477 → 0.352–0.369 | 0.400–0.414 → 0.338–0.344 |
| insertion-2000 | 1.924–1.970 → 0.833–0.893 | 2.306–2.327 → 1.260–1.295 | 2.288–2.650 → 1.550–1.613 | 5.694–6.116 → 5.194–5.641 |
| bubble-2000 | 1.993–2.073 → 0.911–1.067 | 2.484–2.602 → 1.279–1.301 | 2.000–2.113 → 1.388–1.463 | 5.863–6.213 → 5.200–5.266 |

Large-array native playback became about 8–15% cheaper in corresponding paired
measurements. Small-scene gains are less stable: insertion-24 did not improve.
The cache benefits multiple draws of one pair.

Misses have no consistent speedup and can regress. Bubble-2000 changing-pair
Node results in the second run: 4.081 → 4.314 and 3.748 → 4.405 ms;
native Canvas: 3.675 → 3.775 and 3.500 → 3.525 ms. In the first Node run,
insertion-2000 changed from 5.28–5.55 to 7.24–7.76 ms; in the second it changed
from 3.94–4.42 to 3.79–3.94 ms. This variation does not establish absence of
miss-path regressions. Manual steps and seeking also give mixed results.
All cases, including regressions, are retained in the raw reports.

[Node 1](benchmarks/array-dispatch-node.json) ·
[Node 2](benchmarks/array-dispatch-node-repeat.json) ·
[Native Canvas](benchmarks/array-dispatch-browser.json).

## Correctness and memory

Command-level regressions compare the old implementation across all four real
sorting windows and edge cases: resized/switched Canvas, changed events for the
same endpoints, held/highlight/sorted-prefix/suffix priority, zero/negative values,
empty arrays, entering/exiting objects, varying progress and seeks. Tests cover
dark/light/custom palettes, immutable inputs, nested render, a mid-draw exception
and recovery. All **696 native pixel comparisons** passed, with caller Canvas
settings restored.

Both Node runs additionally stream 4,000 pairs of 512 items through each version,
forcing GC every 1,000 pairs. WeakRefs to sampled obsolete snapshots and the last
context/event/frame clear. Both versions retain two active snapshots through
the existing projector, then zero after dropping the renderer. Second-run heap:

| Version | After 1,000 / 2,000 / 3,000 / 4,000 pairs, MiB |
| --- | --- |
| Before | 35.056 / 35.064 / 35.066 / 35.087 |
| After | 35.130 / 35.146 / 35.165 / 35.166 |

These numbers include the whole process and TypeScript. The roughly 0.08 MiB
difference on this data shape is not an isolated cache-size measurement.
Ownership inspection plus these samples support bounded O(n) retention, rather
than proving all traces leak-free.

Final `npm test` (193 tests), `npm run test:package` and `npm run test:bundle`
passed. Public API, version and dependencies are unchanged. Publication and
new-commit CI were not performed in this work.

The next candidate in the original plan is profiling native drawing command
categories before choosing decoration caching or batching; it is not started here.
