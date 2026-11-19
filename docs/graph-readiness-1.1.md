# Graph readiness for 1.1.0

[Русский](ru/graph-readiness-1.1.md) · [Current API](current-api.md) · [Compatibility](api-compatibility.md) · [Graph API](graph-api.md) · [Machine review](checks/graph-readiness-1.1-2026-11-17.json)

**Release closure, 2026-11-17:** R1–R4 are complete for released 1.1.0 / 629defe.
[Release and receipt](release-1.1.md) record CI/publication/registry/provenance.
The pre-release review and its pending-gate table below are historical.

**Candidate preparation follow-up, 2026-11-17:** package/lockfile are now 1.1.0.
[Candidate notes](candidate-1.1.md) track the new freeze/commit/CI stage. The
review and pending-gate table below retain their pre-preparation scope.

**Final review, 2026-11-17; local, unpublished.** The graph scope is ready for
candidate preparation. No known unresolved API/implementation blocker was found
within this review. Release gates below remain open. No version bump, source/API
implementation change, commit, push, tag, Release, npm publication or fresh CI run
was made by this audit.

## Scope and version decision

Compare against released 1.0.0 / 3977c78. All 35 original source files and all eight
original export-map records are unchanged. Runtime dependencies/build versions
are unchanged. Two independent paths are added, so **1.1.0 is the compatible minor
target**, rather than a breaking release of the original entries.

| Surface | 1.0.0 baseline | Working tree |
| --- | ---: | ---: |
| Entry paths | 8 | 10 |
| Runtime names | 21 | 24 |
| Type-only export names | 69 | 95 |
| Distinct type-only names | 57 | 83 |

New runtime: /graph exports createGraphTrace and graphScene; /canvas/graph exports
createGraphRenderer. Their 22 + 4 types include two caption types. No root/CJS,
private deep paths, built-in BFS/DFS or new Player mode/option is added. Application
examples are outside package algorithm API. GraphEvent has four closed cases;
GraphObjects has two kinds, caption modes are auto/hidden, roles are open strings.
New graph entries get the same 1.x protection upon first publication, without
experimental status. Fixed topology/independent results/payload ownership and
standard error rules are selected, not deferred decisions.

## Readiness matrix

| Area | Result | Evidence and boundary |
| --- | --- | --- |
| Public API/types | Ready | Ten-entry inventory, readonly/generic inference, old fixtures, closed event cases, headless/DOM boundaries |
| Trace/model | Ready | Immediate capture, stable IDs, finite graph/layout, atomic roles/captions, no-op/index/lifecycle rules, original proxy errors |
| Scene | Ready | Namespaces, stable node/edge references, lanes/loops, optional captions and legacy snapshots; no new scene kinds |
| Canvas | Ready | Arrow direction, parallel/antiparallel lanes/loops, current styles, raw interpolation, explicit logical size, context/error recovery |
| Captions | Ready with documented limits | State-owned text; eight candidates, collision exclusion and safe omission; no guarantee that all dense/long-text labels remain visible |
| Playback/control | Ready | Existing Player supports history/stream rewind, Pause/Next, Restart/dispose; no core changes |
| BFS examples | Ready | Detailed and stock pages; 179 runs/6756 semantic-step baseline, distance dash/infinity, green answer, applied-input/session semantics |
| Packaging/loading | Ready for freeze | Current-version dry-run payload and installed consumers; no private paths or optional-module loading leak; version metadata still 1.0.0 |
| Documentation | Reconciled in this audit | Current status, compatibility, README/changelog/support links and caption validation/metric wording |
| Exact 1.1.0 candidate/CI | Pending release gates | Uncommitted working tree has no 1.1.0 SHA or CI certification |

## Findings closed during review

**D1 — stale release status.** Current references still labelled 1.0 fixes and
explicit steps/results as unpublished, listed baseline 0.16.0 or called 1.0.0 a
candidate. Reconciled EN/RU current index/compatibility policy, support header,
README stream memory wording and changelog. Historical reports/candidate evidence
retain their dates and original hashes. They are not rewritten as 1.1 evidence.

**D2 — incomplete caption/error wording.** Main reference validation order omitted
caption groups; measured-text wording could confuse unavailable metrics with
invalid numeric geometry. Aligned constructor/mark/scene order with code. Missing
or nonnumeric required bounds suppress captions without coercion, after supplied
numeric metrics are checked; nonfinite numeric metrics, negative width or invalid
computed geometry give RangeError before pixels. Original host throws/restore
priority stay unchanged. No production behavior or API shape changed in this audit.

There are no open implementation/API findings. This is a bounded review, not a
claim that all fonts, graph sizes or future topology editors are solved.

## Verification and reuse

- Source hashes match 36 implementation/example/test/script evidence files.
  All 35 released source files and eight original export records match 3977c78.
  package.json/lockfile/dependencies were left unchanged by the audit.
- Reuse [595-test / four-compiler / 26-bundle evidence](checks/graph-node-captions-implementation-2026-11-17.json)
  because production/test sources are unchanged. Compiler consumers: 5.0.4,
  5.4.5, 5.9.3, 6.0.3; NodeNext/Bundler with the appropriate ES2022/DOM/WebWorker
  libraries. No full suite/compiler/bundle rerun is claimed here.
- Reuse [31 real-Canvas + 7 page-control checks](checks/graph-node-captions-native-2026-11-17.json)
  with source/image identity. Actual metrics and an independent hidden-bitmap
  obstacle oracle are covered. Bitmap ratios 1/1.25/2 are backing-store sizes,
  not three page zoom settings. Earlier 15-check renderer evidence retains its
  pre-caption scope and is not added to the current native count.
- This review adds 11 isolated runtime checks, including falsy proxy errors,
  atomic rollback, cloned/legacy snapshots, ignored Event, hidden validation,
  missing/invalid TextMetrics, original error precedence and fresh trace state.
- Current export inventory, local links/code parity, git whitespace checks,
  origin/version consistency and npm pack --dry-run --ignore-scripts were checked.
  No registry/latest/provenance lookup, native rerun, performance benchmark or
  new browser support promise is claimed.

Native tests prove the supplied fixtures. Caption omission, discrete position
changes and caller-owned payload immutability remain explicit limits. Frame work
budgets bound source reads, not the cost of an individual graph render. No O(1),
FPS, allocation or speed improvement claim is made.

## Remaining release gates

| Gate | Required next action | Status |
| --- | --- | --- |
| R1 · Prepare candidate | Set package.json and both root lockfile versions to 1.1.0; finalize changelog/release notes and release-facing EN/RU status. Explain that original eight imports require no migration and graph imports require the new version. Avoid claiming registry availability before publication. | Pending |
| R2 · Freeze/archive | Freeze reviewed files, including untracked graph sources/tests/examples/docs/assets. Build/install the 1.1.0 archive and check all export paths/types/files. Repeat checks affected by source/metadata changes; retain hashes when reusing unchanged source-level tests/native evidence. Preserve unrelated user work. | Pending |
| R3 · Commit and exact-SHA CI | When authorized, commit/push to origin (master push or PR covered by CI) and await all 11 jobs on the final candidate SHA: Node 22/24/26 × Ubuntu/Windows (6), four TypeScript consumers (4), bundle isolation (1). A changed/merged candidate needs its own exact-SHA result. | Pending |
| R4 · Publish and verify | Separately authorize tag v1.1.0 and stable GitHub Release on that SHA; never move a conflicting tag. npm-publish.yml uses OIDC/provenance; do not substitute local npm publish. Await workflow, verify exact npm version, normal latest and provenance/source SHA, record release evidence. | Pending; not authorized by this review |

The publishing workflow validates tag/package/lock versions and runs package/unit
checks, but does not itself enforce success of all 11 earlier CI jobs. **R3 must
be checked before creating the stable Release.** No automation change is required
for this review's existing manual release gate.

A later source/API edit invalidates the corresponding hash-bound acceptance.
Metadata/documentation-only changes do not require repeating unchanged rendering
fixtures, but the final versioned archive/CI must still be verified. Successful
old 1.0 CI never certifies the uncommitted graph additions.
