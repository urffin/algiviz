# Grid readiness for 1.3.0

[Русский](ru/grid-readiness-1.3.md) · [Current API](current-api.md) · [Grid API](grid-api.md) · [Grid Canvas](grid-canvas-api.md) · [BFS example](examples.md#grid-bfs-shortest-path) · [Machine review](checks/grid-readiness-1.3-2026-11-20.json)

**Candidate follow-up, 2026-11-20:** package.json and both root lockfile versions
are now 1.3.0. [Candidate notes](candidate-1.3.md) and the
[preparation record](checks/candidate-1.3.0-2026-11-20.json) supersede the older
version and R1/R2 status. R3 is checked after commit/push on the final SHA;
R4 (tag/publication) is outside this task. Dated stages below remain historical.

**Reviewed 2026-11-20; local, unpublished.** /grid and /canvas/grid are ready for
candidate preparation within the contracts below. No unresolved API decision or
known implementation blocker was found. D1 (README import list) and D2
(Scene/SceneFrame lookup wording) are corrected in EN/RU. R0 is complete; R1–R4 remain open. This review changes
documentation only: no implementation, API, version, lockfile, commit, push,
CI, tag, Release or publication changes.

## Scope and version decision

The recorded release baseline is **1.2.1 / c398d2d**, a documentation patch over
1.2.0. Its 53 implementation sources and twelve export records are unchanged;
all twelve public entry declarations match the installed 1.2.1 archive byte for
byte. The additions are independent entries, so **1.3.0 is a compatible minor
target**. Package.json and both root lockfile version fields are still 1.2.1.

| Surface | Released 1.2.1 | Working copy |
| --- | ---: | ---: |
| Entry paths | 12 | 14 |
| Runtime names | 27 | 30 |
| Type-only exports | 128 | 155 |
| Distinct type-only names | 116 | 143 |

/grid exports createGridTrace, gridScene and 22 types. /canvas/grid exports
createGridRenderer and five types. Existing imports need no migration. New grid
imports will require 1.3.0 after publication; npm 1.2.1 contains neither entry.
Their first release receives the same 1.x compatibility protection, without an
experimental tier. Dependencies, build tools and existing Player APIs are unchanged.

GridFrame's second generic is Event. GridEvent's four cases, GridObjects' two
kinds and renderer enums are closed sets; roles are open strings. No root/CJS
or private deep imports, new Player controls, built-in BFS, maze wall model,
sparse grid, shape-changing edit, SVG or OffscreenCanvas backend is added.

## Readiness matrix

| Area | Result | Evidence and boundary |
| --- | --- | --- |
| Public API/types | Ready | Emitted declarations match EN/RU code; 22 + 5 types, readonly/generic boundaries, ES2022 versus DOM requirements and private paths checked |
| Coordinates/values | Ready | Fixed shape, dense row-major opaque values, explicit undefined, zero-area shapes, dimensions/product/list ceilings and coordinate validation |
| Trace/atomicity | Ready | start/edit/mark/done lifecycle; replacement or distinct writes with marks/captions; deterministic errors, original/falsy exceptions and reentrancy; failed commands preserve state identity, index and phase |
| State/result/scenes | Ready | Canonical marks/captions; unique selected cells and ordered paths with repeats; stable namespaced coordinate IDs, no phantom cells/path objects, cloned state-only snapshots |
| Canvas layout | Ready | Square cells, 4 CSS px painted margin, inset borders, arithmetic preflight and matching endpoint shapes; caller owns bitmap/DPR/viewport |
| Presentation/text | Ready | Capture both endpoints before current-only row-major presenter calls; no implicit String(Value); measured label/caption fitting, safe omission and path exclusion around text |
| Paths/green result | Ready | Snapshot membership outranks role/presenter fills; discrete current styles, exact-sequence path comparison, raw-progress crossfade, singleton/repeated/hidden paths and transparent redraw |
| Host/errors/recovery | Ready within contract | Validate before callbacks/painting; acquired saves restored in reverse order, primary/falsy exception priority, busy reset and ordinary bitmap/context reset; input context must be unclipped |
| BFS/Player | Ready | Default 10-move path, unreachable and zero-move outcomes; immutable/lazy source, independent shortest-distance oracle, both modes, rewind/seek, Restart and cleanup; old maze unchanged |
| Package/loading | Ready for candidate preparation | Independent exports, safe Node import/construction, installed consumers, no unrelated backend/trace loading, lazy chunks and private path rejection; test archive still versioned 1.2.1 |
| Documentation | Reconciled | Current local versus published status, EN/RU declarations/code, example catalogue and remaining gates agree; dated reports keep their historical scope |
| Exact 1.3.0 candidate/CI | Pending | No 1.3.0 archive, candidate commit or exact-SHA CI result yet; R1–R4 below |

No technical blocker remains open within this reviewed scope. The size ceilings
are validation limits, not frame-time or memory guarantees. Values remain
application-owned opaque references. Result paths do not validate adjacency,
walls or shortest-path optimality; those policies belong to the BFS example.

## D1: README import-list correction

The install paragraphs listed ten imports and omitted the already published
/tree and /canvas/tree, while the module tables correctly listed twelve. Both
EN/RU paragraphs now enumerate all twelve published paths. Grid paths remain
explicitly local/unpublished and require a local build/archive. No released
archive or historical JSON is rewritten, and no new package API is introduced.

## D2: distinguish Scene and SceneFrame lookup

The projection text now explicitly states that gridScene returns Scene with
objects; get(id) belongs to SceneFrame after createSceneFrame or during dispatch.
The earlier shorthand scene.get could imply a method on gridScene output.
Declarations and implementation already followed this distinction.

## Verification and evidence reuse

- **708/708 repository tests**, including 30 grid, 23 Grid Canvas and seven BFS
  regression groups. The example includes **672** obstacle/open-endpoint cases
  checked with independent repeated edge relaxation. This successful run is
  reused after verifying source, test and example hashes; documentation links
  and import lists receive fresh static checks in this review.
- Fresh installed-package **TypeScript 6.0.3**, NodeNext and Bundler, passes
  **456 runtime regressions**. Consumers for **5.0.4, 5.4.5 and 5.9.3** in both
  resolution modes are reused for identical sources, declarations and fixtures.
  The 456 cases exclude application examples, which are not shipped in npm.
- **42 bundle variants** are reused after checking the scripts, source hashes
  and recorded report. Independent/lazy grid entries do not load other backends;
  unrelated imports do not acquire grid code. This is isolation, not a speed claim.
- Native acceptance is reused for identical implementation, compiled runtime
  and fixtures: **18 renderer checks**, including 12 theme/size/backing-ratio
  cases × four progress values, plus **23 BFS/example UI checks** at 960/390 px.
  Renderer backing ratios are 1/1.25/2; actual host DPR is recorded separately.
  Evidence covers real Canvas pixels, text/path separation, green results,
  rewind/seek, Restart, resize/DPR, host errors and cleanup. The example also
  checks the old maze's BFS/DFS results. BFcache handlers use dispatched persisted
  pagehide/pageshow events; browser cache eligibility is not certified.
- Fresh local archive inspection: **131 files, 126 dist files**, including
  12 headless grid and eight Grid Canvas files. Package version is still 1.2.1;
  this working-copy test archive is not the published 1.2.1 archive or a 1.3.0
  candidate. Examples/tests/scripts are not shipped. Packaged EN/RU README and
  changelog are inspected against current exports and source documentation.

[Headless implementation](checks/grid-implementation-2026-11-20.json) ·
[Canvas implementation](checks/grid-canvas-implementation-2026-11-20.json) ·
[Native renderer](checks/grid-canvas-browser-2026-11-20.json) ·
[BFS example](checks/grid-player-example-2026-11-20.json).
These records retain their original counts and hashes; this review records reuse
instead of relabeling them as fresh runs. No registry lookup, performance
benchmark, browser-support expansion or forced GPU context loss is claimed.

## Remaining release gates

| Gate | Required action | Status |
| --- | --- | --- |
| R0 · Local readiness | Review both entries, documentation, package and example; resolve D1/D2 and verify evidence identity | **Complete** |
| R1 · Prepare 1.3.0 | Update package.json and both root lockfile versions; finalize changelog/release notes and EN/RU README/API/environment/example status for the exact included features. Existing twelve imports need no migration. Update the example's version-status assertions with its text. Do not claim unperformed publication checks. | Pending |
| R2 · Freeze/archive | Include every untracked grid source, fixture, example and document. Build/install the exact 1.3.0 archive, inspect its EN/RU README and changelog, exports/types/file list and source/native identity. Refresh acceptance affected by any implementation change. Preserve unrelated work. | Pending R1 |
| R3 · Commit and exact-SHA CI | When authorized, commit/push the final candidate and await all **11 jobs**: Node 22/24/26 × Ubuntu/Windows (6), TypeScript consumers (4), bundle isolation (1). Any later correction needs its own final-SHA CI. | Pending |
| R4 · Publish and verify | Separately authorize v1.3.0 and a stable GitHub Release on that SHA. Await OIDC/provenance npm publication; verify exact version, latest, fresh installation, source SHA/provenance and registry-served README/packaged EN/RU documentation. Do not move a conflicting tag or substitute local npm publish. | Outside this audit |

The release workflow validates version alignment and package/tests, but does not
enforce prior completion of all eleven CI jobs. **R3 must pass before R4.** Old
1.2.1 CI does not certify these uncommitted additions. Documentation-only edits
do not require rerunning unchanged native behavior; implementation or fixture
changes must be assessed against the corresponding recorded acceptance hashes.
