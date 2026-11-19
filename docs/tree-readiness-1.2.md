# Tree readiness for 1.2.0

[Русский](ru/tree-readiness-1.2.md) · [Current API](current-api.md) · [Tree API](tree-api.md) · [Tree Canvas](tree-canvas-api.md) · [Initial machine review](checks/tree-readiness-1.2-2026-11-19.json) · [T1 correction](checks/tree-t1-fix-2026-11-19.json)

**Release follow-up, 2026-11-19:** 1.2.0 was released from 8e1f50b after all
11 CI jobs. Exact npm/latest, a fresh install and signature/provenance passed.
[Completed release](release-1.2.md). Preparation and pending gates below remain
historical; all 1.2.0 release gates are complete.

**Candidate follow-up, 2026-11-19:** package.json and both root lockfile versions
are now 1.2.0. [Candidate notes](candidate-1.2.md) and the
[preparation record](checks/candidate-1.2.0-2026-11-19.json) supersede the version
and pending R1/R2 status in the dated audit below. R3 requires all 11 jobs on
the final candidate commit; R4 (tag/publication) is outside this task.

## Dated review

**T1 closed, 2026-11-19; local, unpublished.** The tree scope is ready for
candidate preparation within the reviewed boundary. The only known blocker, T1,
is corrected without changing public API or version metadata. R0 is complete;
R1–R4 below remain open. The initial audit record retains its original open-T1
finding and hash-bound evidence. The [fix report](checks/tree-t1-fix-2026-11-19.json)
records the changed planner, new permanent regressions and refreshed acceptance.
No commit, push, CI, tag, Release or publication was performed.

## Scope and version decision

The baseline is released **1.1.0 / 629defe**. All 43 released source files and all
ten original export records are unchanged. Runtime dependencies and build-tool
versions are unchanged. Two independent entries make **1.2.0 the compatible minor
target**; package.json and both lockfile root versions are still 1.1.0.

| Surface | Released 1.1.0 | Working copy |
| --- | ---: | ---: |
| Entry paths | 10 | 12 |
| Runtime names | 24 | 27 |
| Type-only exports | 95 | 128 |
| Distinct type-only names | 83 | 116 |

/tree exports createTreeTrace, treeScene and 29 types; /canvas/tree exports
createTreeRenderer and four types. Existing imports require no migration. npm
1.1.0 contains neither new entry. Their first publication gets the same 1.x
protection as the existing entries, without experimental status.

TreeKind (ordered/binary), binary slots (left/right), TreeEvent's five cases,
TreeObjects' two kinds and renderer enums are closed sets; roles are open strings.
TreeFrame's third generic is Kind and fourth is Event. No root/CJS/private deep
import, built-in insertion/AVL algorithm, new Player option, forest/DAG, SVG or
OffscreenCanvas backend is added.

## Readiness matrix

| Area | Result | Evidence and boundary |
| --- | --- | --- |
| Public API/types | Ready | Exact emitted/declaration-code parity in EN/RU, readonly/generic types, 29 + 4 new types; no unresolved API decision |
| Model/atomic edit | Ready | Rooted finite ordered/binary topology, stable IDs, whole-collection edits, retired-ID history, failure identity/index/lifecycle preservation |
| View state and scenes | Ready | Canonical layout/marks/captions, independent result selection, namespaced node/link domains, old/new endpoint references; no ghost scene objects |
| Explicit layout | Ready | Ordered leaf ranks and finite extended binary in-order, storage-order output, iterative deep trees, copied/frozen positions, arithmetic errors |
| Motion and result | Ready | Recorded positions, joint endpoint/ghost bounds, attached relation crossfades, raw progress, current/exit styles and green result from State |
| Secondary placement | Ready after T1 correction | Full painted square bounds include half the stroke width in every reservation; 4 px viewport / 2 px neighbor regressions pass |
| Host/errors | Ready within the contract | Validation before Canvas, zero-size checks, DPR, save/restore ownership, original/falsy errors, reentrancy and recovery; input context must be unclipped |
| Playback/example | Ready | Eight-step insertion plus one right rotation; both Player modes, Pause/Next, rewind/seek, fresh Restart and cleanup; old custom Canvas/SVG example preserved |
| Packaging/loading | Ready for a later freeze | Independent entries, ES2022-only /tree, DOM-typed Canvas entry, private paths closed, no trace builder/other backend loading; current archive still versioned 1.1.0 |
| Documentation | Reconciled after T1 correction | Target/status, T1 closure, current versus historical evidence and remaining gates aligned in EN/RU |
| Exact 1.2.0 candidate/CI | Pending | R0 complete; R1–R4 remain. No 1.2.0 candidate SHA or CI certification yet |

No API clarification or known implementation blocker remains open within this
reviewed scope. The selected 4 px / 2 px contract is unchanged; crowded custom
layouts may safely omit decorations.

## T1: closed with painted square bounds

Before correction, nominal 6×6 square bounds excluded half the 1.5px stroke.
For a singleton binary tree with an empty label at (0,0), size 160×21 and:

```ts
createTreeRenderer({ theme: "light", horizontalGap: 4, emptySlots: "visible" });
```

painted bottom was 17.75, leaving 3.25 px instead of 4. The planner now outsets the
square by 0.75 CSS px and uses that painted box for viewport, circle, text, real
route and neighboring slot reservations, including later captions. The stub's
existing stroke-aware checks and drawing geometry remain unchanged.

The unsafe 160×21 squares are omitted; at 160×24 both squares still paint with
4.25 px bottom margin. Separate fixtures check a neighboring node, caption and
slot. All five permanent regression groups failed before the correction and pass
after it. They cover bitmap ratios 1/1.25/2, hidden/visible fit parity and raw
enter/exit opacity. No API or safety promise was weakened.

## Verification and reuse

- Fresh npm test: **648/648**. Fresh installed-package NodeNext/Bundler consumers
  with TypeScript 6.0.3: **403 runtime regressions**. Fresh bundle isolation:
  **34 variants**, including independent/lazy tree Canvas and unchanged old/UI
  outputs. The five new T1 regressions are copied into the installed consumer.
- Fresh native acceptance: **32 renderer checks** and **17 example UI checks**.
  The renderer includes the original 24 theme/size/bitmap combinations and new
  T1 witnesses at ratios 1/1.25/2, including raster omission/positive controls.
  The example repeats green result, rewind/seek, Restart, cleanup, BFcache and
  legacy Canvas/SVG at widths 960/390. See [native evidence](checks/tree-t1-native-2026-11-19.json).
- Public declaration/EN–RU code parity and the 12-entry inventory remain unchanged.
  The four-compiler type boundary (5.0.4/5.4.5/5.9.3/6.0.3; NodeNext/Bundler) is
  reused only for unchanged declarations/fixtures. Runtime acceptance for the
  changed planner is fresh, not borrowed from the old 398-case result.
- The [initial audit](checks/tree-readiness-1.2-2026-11-19.json), 643-test example
  report and old 30-check renderer report retain their historical source scope.
  Their hashes are not rewritten to certify the corrected planner.
- Package/lock versions and API remain 1.1.0 / unchanged. Original 43 released
  implementation files and ten export records are preserved. Only the private
  tree label planner changes among the 53 current implementation files.
  Examples remain unchanged. Current dry-run archive: 111 files, 106 dist files,
  including 12 tree and eight tree Canvas files; examples/tests are not shipped.

Retired-ID sets grow with distinct committed IDs even with bounded rewind. Layout,
validation and rendering are synchronous; Player's frame budget limits source
reads, not the cost of one operation. Labels/slots can be omitted, pair-boundary
fit can change, and transient custom geometry can overlap. Caller payload
immutability, unclipped input context and a working restore remain required.
Recovery evidence covers host throws and bitmap/context reset, not forced GPU
context loss. No performance benchmark, FPS/O(1) claim or registry lookup is added.

## Remaining release gates

| Gate | Required action | Status |
| --- | --- | --- |
| R0 · Close T1 | Painted bounds corrected; five permanent regressions and affected package/bundle/Canvas/example acceptance refreshed. [Evidence](checks/tree-t1-fix-2026-11-19.json). | **Complete** |
| R1 · Prepare candidate | Set package.json and both lockfile root versions to 1.2.0; finalize changelog/release notes and EN/RU status. Existing ten imports need no migration; new tree imports need 1.2.0 after publication. | Pending |
| R2 · Freeze/archive | Include all untracked tree sources/tests/examples/docs and prior release-documentation closure. Build/install the exact 1.2.0 archive; check exports/types/files and affected source/native hashes. Preserve unrelated work. | Pending R1 |
| R3 · Commit and exact-SHA CI | When authorized, commit/push and await all 11 jobs on the final SHA: Node 22/24/26 × Ubuntu/Windows (6), TypeScript consumers (4), bundle isolation (1). Changes after that need their own final-SHA result. | Pending |
| R4 · Publish and verify | Separately authorize tag v1.2.0 and stable GitHub Release on that SHA. Await OIDC/provenance npm workflow; verify exact version, latest, fresh installation and provenance/source SHA. Do not substitute local npm publish or move a conflicting tag. | Not authorized by this audit |

The release workflow checks version alignment and package/unit tests, but does
not enforce the prior eleven CI jobs. **R3 must be verified before a stable
Release.** A source fix invalidates its matching acceptance hashes; documentation
changes alone do not require replaying unchanged native fixtures. Old 1.1.0 CI
does not certify these uncommitted additions.
