# Bounded scene matching cache: speed and memory

[Scene contract](scene.md#renderer-matching-cache) · [Русский](ru/scene-cache-performance.md)

Local, unreleased implementation checked on 2026-11-13. Profiling baseline and
documentation were committed separately at `32b0ee0`; no package version or public
export was added. The previous implementation is the exact source from published
0.13.0, `443892cf050cf313defcf055cf28318741502946`. Current source hashes and
measurement metadata are in [paired results](benchmarks/scene-cache-comparison.json).

## Implementation and retained ownership

Each `createSceneRenderer` owns one optional cache slot containing the previous
scene, current scene, ordered matches and an ID-to-position map. Identity equality
of both immutable scenes allows reuse. A miss validates both endpoints, type
continuity and the captured registry before replacing that slot. Invalid progress
is rejected on every call. There is no global cache, historical map or cache of
events, contexts or resolved frames. Registry lookup still occurs during drawing.

Each render creates a fresh frozen transition array and frame, with current
presence/progress, step index, event and frame-local linked lookup. Reentrant
drawing uses its local plan and cannot change an outer frame. A callback error
propagates and does not roll back drawing. Retained frames continue owning their
endpoint objects, as before. The renderer keeps the last successful pair until
replacement or release; there is no additional dispose requirement.

The standalone `createSceneFrame` retains its direct uncached construction path;
it does not allocate an intermediate reusable plan. Validation indexing is shared
with the renderer. Neither API clones/deep-freezes user scenes; mutation is not
an invalidation mechanism. New snapshots need new scene identities.

## Checks

- All 190 repository tests passed. Six new regressions cover fresh metadata and
  retained frames, linked lookup, layers/ties, enter/exit boundaries, seeking/new
  identities, invalid cache hits/replacements, registry isolation, reentrancy and
  callback failures. Standalone validation remains per call.
- The paired benchmark verifies every resolved transition, ordering, metadata
  and ID lookup against the released implementation across the real-example window.
- Speed comparisons run in one Node 22.17.0 process, alternating before/after then
  after/before. Workloads are the same fixed scenes from the baseline. Each phase
  uses seven samples and the existing warmup/batching policy. Callbacks count
  dispatch and perform linked lookup; no Canvas is involved in this isolated test.
- Memory streams 4,000 pairs with 512 objects per scene and payload arrays,
  sampling after each 1,000 pairs with three explicit GC passes separated by jobs.
  WeakRefs track obsolete scene wrappers and the active pair. Source ownership
  review additionally confirms that only one plan slot exists. Heap includes the
  whole process/TypeScript tooling, not just the cache. This is a retention check,
  not an allocation-rate, peak-memory or portable heap-threshold claim.
- Full real-renderer Node and native Canvas measurements are separate runs, not
  a controlled old/new comparison in one browser. Native replay checks compare
  captured Canvas commands to their own rendered frame, while the transition
  comparison above supplies the released-output reference. Timings overlap and
  measure CPU submission, not FPS/GPU. Existing baseline caveats still apply.

Installed-package consumer checks and all twelve viewport contract tests passed via
`npm run test:package`. Bundle-isolation checks passed via `npm run test:bundle`;
optional UI/viewport modules remain deferred and headless imports still execute.

## Results

Time is ms/call. Ranges show the two round medians, not confidence intervals. **1216 resolved frames** matched the release.

| Workload | Objects | Same pair: before → after | Eight frames/pair: before → after | Speedup, eight frames |
| --- | --- | --- | --- | --- |
| insertion-24 | 24–24 | 0.018–0.021 → 0.005–0.005 | 0.019–0.021 → 0.006–0.006 | 3.061–3.325× |
| insertion-2000 | 2000–2000 | 1.701–1.798 → 0.375–0.455 | 1.551–1.705 → 0.474–0.488 | 3.270–3.493× |
| merge-24 | 48–48 | 0.036–0.037 → 0.009–0.009 | 0.037–0.041 → 0.013–0.020 | 2.001–2.884× |
| merge-2000 | 4000–4000 | 3.279–3.421 → 0.675–0.714 | 3.335–3.341 → 0.969–1.012 | 3.295–3.449× |
| BFS-layers | 17–19 | 0.016–0.017 → 0.004–0.004 | 0.017–0.017 → 0.006–0.006 | 2.791–3.040× |
| boids-64 | 65–65 | 0.056–0.063 → 0.013–0.013 | 0.057–0.061 → 0.018–0.019 | 2.977–3.429× |
| boids-192 | 193–193 | 0.154–0.161 → 0.037–0.037 | 0.156–0.157 → 0.051–0.052 | 2.997–3.082× |
| boids-192-inspect | 210–213 | 0.165–0.198 → 0.040–0.044 | 0.164–0.167 → 0.055–0.057 | 2.887–3.030× |
| sand-320 | 321–321 | 0.323–0.329 → 0.065–0.068 | 0.334–0.370 → 0.098–0.099 | 3.413–3.748× |
| sand-1800 | 1801–1801 | 1.839–1.863 → 0.363–0.379 | 1.819–1.849 → 0.560–0.561 | 3.240–3.303× |

Cache misses and standalone calls are not expected to improve consistently. For example, insertion-2000 with a different pair every call measured 1.460–1.554 → 1.445–1.687 ms; one round was slower. Its standalone control measured 1.337–1.381 → 1.315–1.401 ms. Small scenes can show overhead and visible scatter. Standalone retains its original direct algorithm; this cache targets repeated frames.

| Implementation | Heap after 1,000 / 2,000 / 3,000 / 4,000 pairs, MiB | Old scenes after GC | Active / after dropping renderer |
| --- | --- | --- | --- |
| before | 33.381 / 33.392 / 33.392 / 33.393 | 0 / 0 / 0 / 0 | 0 / 0 |
| after | 33.733 / 33.734 / 33.735 / 33.744 | 0 / 0 / 0 / 0 | 2 / 0 |

For this data shape, the active pair and plan add about 0.35 MiB to the retained process heap. Growth from 1,000 to 4,000 pairs was about 0.01 MiB, with obsolete scene wrappers collected. Two active scenes remain while the renderer lives; none remain after dropping it. This combines observed retention and ownership review, not a mathematical proof from four samples.

| Workload | Node mock before → after, ms | Native Canvas before → after, ms |
| --- | --- | --- |
| insertion-24 | 0.058 → 0.049 | 0.406–0.572 → 0.322 |
| insertion-2000 | 2.806 → 2.354 | 6.200–7.031 → 5.984 |
| merge-24 | 0.217 → 0.140 | 0.722–0.756 → 0.703 |
| merge-2000 | 6.095 → 2.300 | 10.909–11.131 → 8.459 |
| BFS-layers | 0.123 → 0.057 | 0.245–0.247 → 0.225 |
| boids-64 | 0.245 → 0.146 | 0.372–0.384 → 0.270 |
| boids-192 | 1.208 → 0.423 | 0.978–1.028 → 0.994 |
| boids-192-inspect | 0.696 → 0.449 | 0.866–1.194 → 0.697 |
| sand-320 | 0.790 → 0.407 | 2.381–2.772 → 2.328 |
| sand-1800 | 3.369 → 1.694 | 9.366–9.834 → 8.737 |

All ten final-build Canvas replay checks passed, with no console warnings/errors. DPR 1, bitmap 960 × 540, embedded browser, unchanged zoom. Full-renderer comparisons are observational, not an isolated cache effect. Similar Boids times do not negate matching gains: drawing and generation remain. Mock-Canvas CPU time must not be presented as browser FPS.

[Paired CPU + memory](benchmarks/scene-cache-comparison.json), [real Node](benchmarks/scene-cache-real-node.json), [native Canvas](benchmarks/scene-cache-real-browser.json).

## Decision and remaining scope

Keep the single-pair renderer cache: it removes repeated matching/order work from
interpolation while maintaining O(n) retained storage and fresh frame semantics.
Cache misses still validate and build a plan; do not promise gains when endpoints
change every call, during exact manual stepping, or when a renderer is recreated.

The standard array renderer currently constructs its scene dispatcher per frame,
so it cannot reuse this cache across calls. Reusing that dispatcher is a separate
experiment. No changes to /canvas, domain algorithms, scheduling, projection-cache
size, dependencies or publication were made in this work.
