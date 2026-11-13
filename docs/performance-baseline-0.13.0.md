# Real-example performance baseline: 0.13.0

[Performance guide](performance.md) · [Русский](ru/performance-baseline-0.13.0.md)

Measured 2026-11-13 (Moscow), using the unchanged library at release commit
`443892cf050cf313defcf055cf28318741502946`. The profiling harness is new
repository-only diagnostic code, not part of that release or the npm runtime.
Its SHA-256 is recorded with the raw results. No optimization was applied.

## Method and boundaries

- Real example modules: reverse insertion/merge at 24 and 2,000 values; BFS layers
  (8 vertices, 9 edges); Boids at 64/192 agents plus 192-agent inspection; funnel
  sand at 320/1,800 particles, fixed seeds. These fit the example generator limits.
- Up to 16 adjacent pairs sampled from the first 128/1,000 sorting steps, first
  128 BFS steps (or exhaustion), or first 48 simulation steps. Exact retained
  indices/counts are in JSON. Generation measures startup and a separate fresh
  16-state prefix; it does not time the full algorithm.
- Eight progress values per pair; inspection uses exact states as the real demo
  does. Timed indices continue across batches, with enough operations across the
  seven samples to cover the window. No full trace or unbounded cache is retained.
- Each phase warms for at least 30 ms, adapts toward 12 ms batches up to 65,536
  calls, then records seven batch means and their median/min/max. Some batches
  fall below the target after calibration; JSON explicitly records this. Sub-ms
  figures are aggregate estimates, not individual-call precision.
- Generation, uncached mapping, cached same-pair mapping, advancing projection,
  matching, counting dispatch and complete real renderers are measured separately.
  Complete renderer phases overlap the other phases. Never sum them or infer
  drawing time by subtraction. Counting mock callbacks also have instrumentation
  overhead; native and mock results are not a controlled Canvas-only difference.
- Native Canvas uses a 960 × 540 bitmap at DPR 1 in embedded Chromium (reported
  Chrome/157.0.0.0), document visibility visible. Zoom was unchanged; Chrome was
  not used. Node is 22.17.0 on Windows x64, AMD FX-8350, eight logical CPUs.
- Canvas replay captures actual renderer calls/properties for one fixed frame
  per workload and verifies every pixel byte before timing. It includes replay
  dispatch and Canvas command submission, without geometry/matching. It does not
  wait for GPU completion. Pixel readbacks may affect Canvas backend selection in later
  phases/runs; no backend flags were forced. It is a diagnostic comparison, not a pixel guarantee
  across browsers.
- Runs are serial, with no simultaneous benchmark/test/build. Host scheduling,
  GC, JIT, Canvas buffering and thermal/load variation remain uncontrolled. There
  is no FPS, heap-allocation profile, DPR sweep, mobile result, full-trace timing
  or portable pass/fail threshold in this baseline. Earlier retained-heap checks
  remain separate evidence.

## Measurements

Milliseconds per operation. Browser columns show the range of medians from two serial runs, not confidence intervals. Node is one run. Full seven-sample distributions, all phases and environment:

[Node](benchmarks/0.13.0-node.json), [Canvas 1](benchmarks/0.13.0-browser.json), [Canvas 2](benchmarks/0.13.0-browser-repeat.json).

| Workload | Objects | Generation/state, browser | Matching, browser | Renderer, browser | Canvas replay | Renderer, Node mock |
| --- | --- | --- | --- | --- | --- | --- |
| insertion-24 | 24–24 | 0.002–0.002 | 0.013–0.017 | 0.406–0.572 | 0.337–0.481 | 0.058 |
| insertion-2000 | 2000–2000 | 0.037–0.040 | 1.097–1.116 | 6.200–7.031 | 1.237–1.350 | 2.806 |
| merge-24 | 48–48 | 0.002–0.002 | 0.026–0.028 | 0.722–0.756 | 0.700–0.813 | 0.217 |
| merge-2000 | 4000–4000 | 0.033–0.041 | 2.278–2.575 | 10.909–11.131 | 2.175–2.350 | 6.095 |
| BFS-layers | 17–19 | 0.003–0.003 | 0.010–0.010 | 0.245–0.247 | 0.219–0.255 | 0.123 |
| boids-64 | 65–65 | 0.494–0.525 | 0.039–0.045 | 0.372–0.384 | 0.281–0.306 | 0.245 |
| boids-192 | 193–193 | 2.450–2.725 | 0.095–0.104 | 0.978–1.028 | 0.728–1.050 | 1.208 |
| boids-192-inspect | 210–213 | 2.669–2.775 | 0.116–0.124 | 0.866–1.194 | 0.556–0.697 | 0.696 |
| sand-320 | 321–321 | 0.134–0.137 | 0.173–0.176 | 2.381–2.772 | 0.919–0.994 | 0.790 |
| sand-1800 | 1801–1801 | 0.242–0.283 | 0.950–0.972 | 9.366–9.834 | 3.800–4.400 | 3.369 |

The 4,000 objects in merge-2000 are two 2,000-cell rows (main and auxiliary), not a new input limit.

Large-merge matching costs 2.28–2.58 ms in the browser and 3.51 ms in Node; insertion-2000 costs about 1.10 ms and 1.50 ms. This measured core cost merits a bounded-cache experiment. It does not explain all renderer time: changing pairs, geometry and drawing remain significant. Boids-192 spends 2.45–2.73 ms per generated state versus 0.98–1.03 ms for browser rendering; generation is a separate example-level target. Same-pair cached projection costs around 0.0003–0.0004 ms, while a new pair still needs projection.

All 20 Canvas replay checks passed. After fixing a missing /array import-map entry, there were no new console warnings/errors. Variation is visible: insertion-24 rendering changed from 0.572 to 0.406 ms, and Boids inspection from 0.866 to 1.194 ms. Use this baseline to choose an experiment, not to promise throughput.


## Optimization order

Progress on 2026-11-13: items 1 and 2 have local implementations with
[scene-cache results](scene-cache-performance.md) and
[array-dispatcher results](array-dispatch-performance.md). The list below records
the original baseline priorities. Item 3 remains an optional investigation of
specific Canvas renderers. Subsequent general library development moved to the
separate [bounded-navigation adapter](rewind-buffer.md); see the
[current development status](optional-player-proposal.md#bounded-navigation-follow-up).

1. Prototype a bounded immutable-endpoint matching/order cache inside a scene
   renderer. Dense insertion, merge and sand make matching a useful package-level
   target. Retain only the active pair; create fresh transition metadata for each
   progress/event. Preserve complete validation before callbacks, stable layers,
   enter/exit/type errors, retained-frame immutability and independent instances.
   Standalone `createSceneFrame` need not gain global caching. Measure retained
   memory and repeat the same native/Node cases before accepting the prototype.
2. Check dispatcher reuse in `createArrayRenderer` after the matching experiment.
   The current measurements do not isolate allocation enough to promise a gain.
   Preserve current palette/context semantics and do not retain stale frame data.
3. Treat native drawing separately: small labeled scenes and dense sand have
   significant command costs. Consider static decoration or batching only after
   profiling call categories and validating pixels/order. Domain-specific sand
   batching and Boids neighbor search belong to examples, not the core library.
4. Cached projection is already cheap for an unchanged pair; increasing its
   bounded cache or adding public tuning knobs has no evidence here. Boids
   generation needs an application algorithm review before a core API change.
   A cooperative controller cannot interrupt one synchronous iterator call.

These are next-step proposals, not measured speedups or authorization for another
stage. Public APIs, dependencies and package version remain unchanged.
