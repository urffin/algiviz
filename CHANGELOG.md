# Changelog

## Unreleased

## 1.3.1 — 2026-11-20

Documentation-only patch; runtime, declarations, all fourteen exports, dependencies
and examples are unchanged from 1.3.0. No migration is required.

- Reconcile EN/RU README, API, environment and example references with the completed
  1.3.0 release; /grid and /canvas/grid remain available since 1.3.0.
- Correct stale pre-1.0 availability statements for stepSource, array results and
  U1/U2/Worker contracts; retain original dated verification evidence.
- Record the actual 1.3.0 CI/npm/provenance/README receipt, close its release gates
  and explicitly separate historical design/preparation reports from current guarantees.
- Link current release and patch notes instead of treating candidate reports as
  the current release status. Inspect packaged EN/RU README and changelog before publication.

[Patch notes](https://github.com/urffin/algiviz/blob/master/docs/release-1.3.1.md).

## 1.3.0 — 2026-11-20

Released from 90b26f8 after all eleven CI jobs. Exact npm 1.3.0, latest at
verification, fresh installation, registry signature, source-bound provenance
and registry/packaged EN/RU README were verified.

This compatible minor adds two independent ESM entries. The twelve existing
entry implementations, export records, dependencies and Player API are unchanged;
existing imports need no migration. Grid imports require 1.3.0.
[Changes, migration and verification](https://github.com/urffin/algiviz/blob/master/docs/release-1.3.md).

- Add headless /grid: createGridTrace, gridScene and 22 types for fixed-shape
  dense generic grids. Apply replacements or distinct writes with marks/captions
  atomically; preserve state identity, step index and lifecycle on errors.
- Add unique result-cell selections and ordered paths preserving repeats,
  stable namespaced coordinate scene IDs, strict validation, original exceptions
  and guards against recursive trace control. Values remain application-owned.
- Add optional /canvas/grid: createGridRenderer and five types. Fit square cells
  with inset borders; explicitly present generic values, fit measured labels and
  captions, preserve green result priority and crossfade ordered paths outside
  text. Caller owns Canvas/viewport/DPR; restore context state and preserve primary
  host errors, including falsy throws. Clear transparent backgrounds on replay.
- Add a separate repository Grid BFS example with shortest-distance captions,
  a green shortest path, unreachable/zero-move cases, history/bounded rewind,
  Restart and cleanup. Preserve the earlier maze. Algorithms and examples are
  application code, not package exports or shipped files.
- Add permanent grid/Canvas/Player/BFS regressions, strict installed consumers,
  independent/lazy bundle checks and repeatable native raster/control fixtures.
- Reconcile EN/RU README, API, environment and example documentation; clarify
  Scene versus SceneFrame lookup and include all fourteen imports. Preserve
  historical reports and keep exact-SHA CI/publication gates separate.

## 1.2.1 — 2026-11-20

Documentation-only patch. Runtime implementations, declarations, twelve export
paths and dependencies are unchanged from 1.2.0; no migration is required.

- Correct EN/RU README and packaged changelog: /tree and /canvas/tree are released
  since 1.2.0, with stable IDs, atomic edits, layout, captions and green results.
- Reconcile current API, compatibility, environment and example references;
  record completed 1.2.0 publication and preserve dated evidence.
- Document the future /grid public API and optional Canvas boundary in the
  repository. No grid implementation, package entry or renderer is included.

[Patch notes](https://github.com/urffin/algiviz/blob/master/docs/release-1.2.1.md).

## 1.2.0 — 2026-11-19

Released from 8e1f50b after all 11 CI jobs. Exact npm 1.2.0, latest, a fresh
installation, registry signature and source-bound provenance were verified.
This compatible minor release adds two independent ESM entries. The ten released
1.1.0 entry implementations, dependencies and Player API are unchanged; existing
imports need no migration. Tree imports require 1.2.0.
[Release verification](https://github.com/urffin/algiviz/blob/master/docs/release-1.2.md) ·
[Historical preparation/migration](https://github.com/urffin/algiviz/blob/master/docs/candidate-1.2.md).

- Add headless `/tree`: `createTreeTrace`, `treeScene` and 29 types for
  rooted ordered/binary trees. Support stable explicit node/link IDs, sparse
  binary slots, atomic topology edits, marks, snapshot-owned captions, results
  and complete caller-owned layout. Removed IDs cannot be reused within a trace;
  retirement history grows with distinct committed IDs, independently of rewind.
- Project stable namespaced tree nodes/links through existing steps, frames and
  scenes. Existing Player supports completion, bounded rewind, history seeking,
  Restart and cleanup without new controls or changes to its public API.
- Add optional `/canvas/tree`: `createTreeRenderer` and four types for
  ordered/binary layout, optional empty slots, endpoint-attached relation
  crossfades, measured secondary labels/captions and persistent green results.
  Render recorded layout with caller-owned sizing/DPR and preserve context state
  and original host errors. Omit secondary decorations when no safe placement exists.
- Include the full empty-slot stroke in viewport/collision/caption reservations
  (T1), preserving 4 px viewport and 2 px neighbor safety. Add five permanent
  regression groups and refresh native Canvas and example acceptance.
- Add a separate binary-tree insertion/right-rotation example using the stock
  renderer and Player, including green results, rewind and fresh Restart traces.
  Preserve the detailed custom traversal. Algorithms remain application-owned;
  examples are not package exports or shipped in the npm archive.
- Reconcile EN/RU API, compatibility, environment and example documentation,
  preserving dated reports and the completed 1.1.0 release receipt.

## 1.1.0 — 2026-11-17

Released from 629defe with [verified publication](https://github.com/urffin/algiviz/blob/master/docs/release-1.1.md).
This compatible minor release adds two independent ESM entries. The eight
1.0.0 entry implementations, export names, dependencies and environment boundary
are unchanged; existing imports require no migration. Graph imports require
1.1.0 and are not available in 1.0.0. Exact npm 1.1.0, latest and provenance
were verified after successful CI and the publishing workflow.

- Add headless `/graph`: `createGraphTrace`, `graphScene` and typed immutable
  snapshots. Support fixed topology, stable explicit node/edge IDs, directed and
  undirected edges, loops, parallel edges and finite signed weights. Algorithms,
  adjacency indexing and layout computation remain application-owned.
- Add persistent open-string marks, explicit independent result selections,
  complete layout updates and atomic validation. Existing steps, scenes and
  Player support completion, bounded rewind, Restart and cleanup without a new
  control API.
- Add optional `/canvas/graph`: `createGraphRenderer` draws arrows, deterministic
  parallel/antiparallel lanes and loops, persistent green results and endpoint
  interpolation. Validate before drawing and restore context state after host
  failures. Applications own logical size, CSS and bitmap sizing.
- Add snapshot-owned vertex captions: initial text, atomic mark patches and
  clearing. Canvas auto/hidden placement uses real text bounds and avoids
  nodes, edges and labels; captions are omitted when no safe position exists.
  Old graph snapshots without caption fields remain accepted.
- Keep two BFS examples: detailed custom scene with animated queue, distances
  and path markers, and a separate stock graph renderer page. Both use shared
  BFS states and standard Player, preserve green results, bounded stream rewind,
  applied-input Restart and cleanup. BFS remains an example, not a package export.
- Reconcile EN/RU README, quickstart, learning path, API/environment references
  and CI instructions. The minimum-search quickstart uses published npm 1.0.0;
  graph example pages use the repository build.

See [candidate notes](https://github.com/urffin/algiviz/blob/master/docs/candidate-1.1.md) for historical preparation scope; see the release verification above for completed gates.

## 1.0.0

Released from 3977c78. Promote the eight existing ESM entries to the common 1.x
compatibility policy: /playback, /scene, /array, /canvas, /canvas/viewport,
/player, /worker and /worker/runtime. Runtime export names/dependencies are
unchanged; public types/options include explicit Player steps and array results.
The earlier candidate/CI reports for 5e2fd18, a9b93f8 and 76f76ed describe their
own preparation stages; they are not the release status of current 1.0.0.

### Explicit steps and array results

- Add the exclusive `stepSource: () => Iterable<Step<State, Event>>` branch and
  required synchronous `isTerminal` predicate to `/player`. Infer State/Event in
  `Player<State, Event = undefined>`, `PlayerOptions` and render/frame. Capture
  immutable step envelopes, classify each new position once, retain terminal
  metadata during bounded rewind and close the iterator once at its completed
  terminal endpoint. No extra EOF click or read beyond terminal; premature EOF
  is an operational RangeError. Existing state-only branches keep undefined events.
- Add `done({ result: [position] })` and type-only `ArrayDoneOptions` to `/array`.
  Store copied, frozen, unique `resultItemIds` in the final snapshot, preserving
  the existing done event, counters and sorted-region semantics. Reject malformed
  collections/lengths and invalid positions before committing completion.
- Add optional `/canvas` palette role `result`, green by default. Color priority
  is held > active > result > sorted > ordinary bar; rendering remains stateless
  through repaint, seeking, rewind and Restart. Existing unmarked traces and
  six-role palettes keep their behavior and structural compatibility.
- Make minimum search with stock Canvas rendering and standard Player controls
  the EN/RU quickstart. The fixed nonempty example uses 31 JS lines, one renderer
  and no frame conversion. Preserve plain-state/pre, manual createArrayPlayer,
  and scenes/interpolation as progressive learning stages. These algorithms
  belong to examples, not new package algorithm exports.

### Migration from 0.16.0

- **PlayerOptions union change:** source/history/asyncSource are joined by
  stepSource. Existing source selection remains explicit; update exhaustive
  source/asyncSource/else-history narrowing to handle all four branches. The
  defaulted event generic does not make this closed-union widening nonbreaking
  under U3. No existing application has to opt in to explicit steps or results.
- **U1 — observable control change:** createPlayer, createStatePlayer and
  createArrayPlayer now reject same-instance nextStep/advance/initial dispose
  entered from render, isTerminal, source callbacks or step getters with a
  synchronous Error before side effects. Issue commands after the outer callback
  returns. Frame/finished reads, other idle players and repeated dispose after
  logical disposal remain allowed. Uncaught callback errors retain primary-error
  and at-most-once cleanup behavior.
- **U2 — error-class change:** Player.setSpeed uses synchronous RangeError for
  every invalid value across sync/history/async/Worker sources; async/Worker
  previously used TypeError. Accept only primitive finite positive numbers,
  without coercion. Validation runs before lifecycle guards and changes no
  playback state on rejection. Update catch branches relying on TypeError.
- See the [English migration guide](https://github.com/urffin/algiviz/blob/master/docs/migration-1.0.md)
  and [Russian guide](https://github.com/urffin/algiviz/blob/master/docs/ru/migration-1.0.md)
  for before/after examples, disposal and validation ordering.

### Fixes and contract coverage

- **F1/F2:** reject shared storage in Worker input/state and receiver graphs,
  including WebAssembly.Memory, buffers, typed views, DataView, foreign instances
  and nested/cyclic containers. Recognize shared buffers without a global
  SharedArrayBuffer constructor; retain ordinary ArrayBuffer copy/transfer,
  prior snapshots and cleanup. No WebAssembly allocation fallback is introduced.
- **U5:** retain original host postMessage exceptions as unknown for init/pull;
  preserve primary/disposal precedence and report cancel failures as cleanup.
  Add permanent falsy/opaque-throw, error-priority and close-report coverage.
- Add permanent repository and installed-package regressions for U1/U2/F1/F2/U5;
  reconcile EN/RU references and retain dated audit/release evidence separately.
  The selected U3 policy covers types, closed unions, errors and environments
  equally for all eight entries. No browser/host support expansion is claimed.

## 0.16.0 — 2026-11-14

- Add optional `/worker` and `/worker/runtime` entries for standalone dedicated
  module Worker state sources, with lazy exclusive ownership, one pull at a time,
  validated session/request messages and compatibility with `createAsyncSource`.
- Add explicit ArrayBuffer transfer, clone-safe bounded remote errors, finite
  cooperative shutdown grace and a separate never-rejecting transport report.
  Preserve actual cleanup failures through the existing async return barrier.
- Compile DOM host and WebWorker declarations separately, preserving the
  headless entry graph.
- Connect Worker factories through Player's existing asyncSource option. Verify
  waiting without RAF polling, Pause/staged Next, transactional Restart and
  synchronous UI disposal with deferred Worker cleanup. Add EN/RU guidance,
  installed-package type/runtime checks and native control/keyboard verification.
- Verify 304 repository tests, installed NodeNext/Bundler consumers, independent
  host/runtime bundles and 20 standalone plus 25 Player/Worker native checks.

## 0.15.0 — 2026-11-13

- Add `createAsyncSource` and five public types to `/playback` for lazy
  `AsyncIterable<State>` sessions, shared pending reads, DOM-free cooperative
  cancellation, immediate logical disposal and observable asynchronous cleanup.
- Add exclusive `asyncSource` to `/player`, with optional timing, bounded rewind
  and per-frame work limits. Preserve pending reads on Pause, coalesce Next,
  freeze the clock at data stalls and prepare Restart before closing the old
  session. Replay autoplays only while its intent remains current.
- Extend `PlayerStatus` with `waiting`, `preparing`, `cleanupPending` and
  `canPause`; add optional waiting/preparation/cleanup label roles and
  `PlayerCloseResult`/`closed`. Phase/mode literals and synchronous commands
  remain unchanged. Complete application-owned status mocks must add the four
  new required metadata fields.
- Keep cleanup diagnostics bounded and distinguish late cancelled-read errors
  from actual cleanup failures. Dispose removes UI immediately; the close report
  waits for owned source calls and UI teardown. Sources ignoring cancellation
  can delay physical cleanup/Restart indefinitely.
- Verify 265 repository tests, strict installed consumers, private paths, bundle
  isolation and 13 built-in-browser checks, including keyboard controls.

## 0.14.0 — 2026-11-13

- Add `createRewindBuffer` and `RewindBuffer<T>` to `/playback` for bounded
  manual navigation over synchronous iterable values, with lazy forward reads,
  buffered replay and explicit source ownership. Capacity includes current.
  Existing forward-only playback contracts are unchanged.
- Add opt-in `rewindCapacity` to `/player` streams, Previous controls and inclusive
  `rewindStartIndex`/`rewindEndIndex` status fields. Replay buffered values before
  resuming the source, preserve timed playback/final holds and reset on restart.
- Add opt-in `maxStepsPerFrame` to timed `/player` streams. Bound next-step
  requests per RAF, carry unprocessed playback time forward and reset it on
  manual navigation/pause/restart. Reuse core timing without limiting headless
  `advance`; account for final hold time only once when carrying debt.
- Cache matching and draw ordering for one immutable scene endpoint pair per
  renderer. Keep standalone matching uncached, validation and retained frames
  independent, and cache storage bounded to the active pair.
- Reuse the array renderer's scene dispatcher across frames. Keep per-call draw
  data isolated, with command/pixel parity and paired CPU/memory measurements.
  Interpolation gains do not establish faster cache misses or every workload.

## 0.13.0 — 2026-11-13

- Add independent `/canvas/viewport` with createCanvasViewport and three public
  types for CSS-content sizing, DPR caps, coalesced invalidation and disposal.
- Use the public helper in BFS, binary search and the native browser fixture.
- Check strict installed consumers, private paths, DOM-free imports and lazy
  bundle isolation without changing existing module output.

## 0.12.0 — 2026-11-12

- Add optional `/player` with the `Player` constructor and typed options, status and
  labels. Keep existing entry points independent of UI code and DOM declarations.
- Support lazy plain-state streams and explicit finite recordings, optional
  seeking, media controls, auto-hide, scoped lifecycle cleanup and multiple widgets.
- Add strict installed-package consumers and raw/minified bundle-isolation checks
  for existing-only, static UI and dynamic UI imports. No runtime dependencies.

## 0.11.2 — 2026-11-05

- Avoid argument-count limits when scaling large arrays in the Canvas renderer.
- Isolate Canvas composite, filter and shadow settings alongside transform/alpha;
  restore caller settings even when drawing throws.
- Reject invalid frame progress before drawing; preserve the zero-sized bitmap no-op.
- Require a valid light/dark theme at runtime and allow explicitly undefined colors
  with exactOptionalPropertyTypes. Preserve the createSortRenderer compatibility alias.
- Document Canvas coordinates, context ownership, scene adaptation, color priority
  and error behavior in English and Russian; add renderer and packed-consumer regressions.

## 0.11.1 — 2026-11-05

- Validate both numeric positions in array swap/shift before reading or mutating
  the trace, rejecting invalid JavaScript arguments without losing item identities
  or changing snapshots, counters, markers or the next step index.
- Allow explicitly undefined sorted-region inputs with exactOptionalPropertyTypes,
  matching the existing runtime behavior of preserving the current marker.
- Document array guarantees in English and Russian: fixed length, one held item,
  trace-local IDs, immutable snapshots, counters and author-supplied sorted markers.
- Add an application-owned object lifecycle example and expand playback completion,
  strict type and installed-package consumer checks. No new public exports.

## 0.11.0 — 2026-11-02

- Add createStatePlayer() for lazy playback of plain immutable states without
  step wrappers, event fields or an isTerminal predicate.
- Consume one state per request without lookahead. A request after the final
  state detects exhaustion, preserves the last frame and index, and completes
  playback or starts an explicitly configured final hold.
- Support manual and timed playback, infinite sources, disposal and source errors.
- Simplify the interactive minimal example and English/Russian READMEs; update
  the highlighted GIF to show the extra completion request.

## 0.10.0 — 2026-10-27

- Default finalHoldMs to zero for generic and array players.
- Make stepDurationMs optional for manual nextStep playback; advance(0) redraws,
  while positive timed advancement requires an explicit duration.
- Allow array players to omit the options object entirely.
- Simplify the minimal example and both READMEs; refresh the highlighted GIF.
- Preserve explicit timing behavior and timeline requirements.

## 0.9.0 — 2026-10-27

- Add player.nextStep() for exact manual stepping in generic and array players.
- Finish an in-progress transition without reading another snapshot; at a boundary,
  consume one next snapshot. Complete terminal holds without extra source reads.
- Preserve rendering, disposal and error handling contracts; avoid rounding errors
  when mixing timed advancement with manual steps.
- Update the minimal example, English/Russian READMEs and highlighted GIF to use nextStep().

## 0.8.3 — 2026-10-27

- Streamline English and Russian READMEs around installation and a minimal example.
- Add a GIF showing code execution highlights alongside actual Canvas states.
- Move API reference, algorithm details, performance and publishing instructions
  into linked documentation; add contributor guides.
- No runtime API or behavior changes.

## 0.8.2 — 2026-10-27

- Add a self-contained minimal usage example to both English and Russian READMEs.
- Link an interactive walkthrough of generator states, playback and custom drawing.
- Add repository examples with sequential code highlighting and explicit startup.
- No runtime API or behavior changes; examples remain outside the npm package.

## 0.8.1 — 2026-10-26

- Use Array-prefixed internal types in public declarations and make
  createArrayRenderer the canonical function name, retaining createSortRenderer
  as the identical compatibility alias.
- Allow explicit undefined palette roles with exactOptionalPropertyTypes,
  matching the existing runtime fallback to theme defaults.
- Verify the full runtime export inventory, private-path rejection, all public
  types and headless compilation against the installed package.
- Add a strictly typed custom-object starter and optimize merge example drawing.
- Expand application-owned BFS examples and add DFS with a call stack and
  backtracking. Algorithms remain outside the npm package.

## 0.8.0 — 2026-10-19

- Add partial custom colors to the Canvas array renderer and its compatible alias,
  with exported ArrayPalette, ArrayPaletteOverrides and ArrayRendererOptions types.
- Preserve theme defaults and isolate copied overrides per renderer instance.
- Add theme presets, six color controls and palette reset to Sorting lab without
  restarting playback or changing the current frame.

## 0.7.1 — 2026-10-15

- Update package description and keywords for custom algorithm visualizations.
- Improve the README introduction, demo links and standalone integration guide.
- Add a BFS GIF preview exported with CanvasTake, hosted on GitHub.
- No runtime API or behavior changes.

## 0.7.0 — 2026-10-15

- Breaking: remove the deprecated /core entry point and bundled insertion/bubble
  algorithms. Application-owned examples use /array; playback adapters now live there.

- Preserve source step indices in generic timeline frames, matching generator playback.
- Preserve primary playback errors when iterator cleanup also fails; standalone
  cleanup failures still propagate.

## 0.6.0 — 2026-10-14

- Add an application-owned graph BFS example with custom vertices, edges and queue
  entries, shortest distances, disconnected components and both playback modes.
- Add createStepEmitter to /playback for per-iterator step numbering and frozen
  wrappers; snapshot copying and state/event immutability remain author-owned.
- Use the helper in graph and merge examples, and document custom graph integration.

## 0.5.1 — 2026-10-14

- Update the README around the current public API and examples; remove migration
  instructions and detailed legacy API documentation.
- Correct demo input limits and clarify playback, snapshot memory and rendering.
- No runtime API or behavior changes.

## 0.5.0 — 2026-10-14

- Cache immutable array and quick-sort scene projections and avoid repeated scale/layout
  calculations and hidden text styling on dense charts; add a reproducible CPU/heap benchmark.
- Add application-owned Lomuto and three-way quick-sort demos with shared playback
  controls and limits (64 history values or 2,000 generator values).
- Move the tree cursor along edges through shared ancestors in Canvas and SVG.

- Add a retained SVG tree renderer alongside Canvas, with layer ordering and seek-safe element cleanup.

- Add createSceneProjector to adapt immutable state frames with a two-endpoint cache; use it in the merge example.

- Run tests and isolated package-consumer checks on pushes and pull requests,
  using Node.js 22/24 on Linux and Windows.

- Share array generation controls and validation across insertion, bubble and merge demos.

- Support forward-only generator playback in the merge sort example without retaining history.

- Add an application-owned merge sort example using scene/playback, with a main
  array and buffer, stable identity labels, seeking and accessible playback controls.

## 0.4.0 — 2026-10-09

- Verify the packed npm archive in an isolated TypeScript consumer before publishing.

- Add `/scene` with typed user-defined object data and visualization handlers,
  identity matching, enter/update/exit transitions, layers and reference lookup.
- Render array bars through the scene dispatcher and expose `arrayScene`.
- Add an external tree traversal demo defining its own nodes, edges and pointer.

- Add algorithm-free `/array` and `/playback` entry points: user-defined generators,
  validated array operations, generic states/events and optional rendering callbacks.
- Add `highlight` events and `createArrayRenderer`; existing rendering names remain available.
- Move demo algorithms into application-owned examples using only the public API.
  Old `/core` algorithm exports remain deprecated compatibility adapters.
- Preserve all original insertion/bubble traces; premature exhaustion now reports
  a missing terminal step rather than a missing done event.

## 0.3.0 — 2026-10-09

- Extend `SortEvent` with `swap` and `pass`, and `SortSnapshot` with optional
  `sortedSuffixLength`. Consumers with exhaustive event switches must handle
  the new event types. Existing insertion-sort traces remain unchanged.

- Share input validation, item identities, immutable snapshots and operation
  counters between sorting algorithms; document adding an algorithm internally.

- Add stable bubble sort with `bubbleSortSteps` and `iterateBubbleSortSteps`,
  adjacent swaps, sorted suffix tracking and early exit after a pass without swaps.
- Render both swapped items and the sorted suffix; select either algorithm in
  the demo with history or generator playback.

## 0.2.0 — 2026-10-09

- Move the held key horizontally along the baseline without lifting it above the array;
  remove the redundant key label while retaining its color highlight.

- Expand the demo with history/generator playback, array input, generation and speed
  controls; hide individual bar labels on dense charts.

- Add `createSortPlayer` for forward-only playback with bounded snapshot storage,
  interpolated canvas-compatible frames, final hold and iterator cleanup.

- Add `iterateInsertionSortSteps` for lazy immutable snapshots without retaining history.
- Keep `insertionSortSteps` compatible by collecting the shared generator implementation.

## 0.1.0

- Stable, immutable insertion sort traces with item identities and operation counters.
- A seekable timeline with interpolated frames and final hold.
- Stateless light and dark canvas rendering.
- ESM and TypeScript declarations; no runtime dependencies.
