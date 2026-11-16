# Core readiness for 1.0 after four model reviews

[Русский](ru/core-readiness-1.0.md) · [Candidate](candidate-1.0.md) · [Current API](current-api.md) · [Compatibility](api-compatibility.md)

**Later native acceptance, 2026-11-16:** documentation commit 76f76ed passed all
11 CI jobs and the [remaining G3 scope passed 133 native checks](checks/candidate-1.0.0-g3-76f76ed-2026-11-16.json),
including actual DPR 1 → approximately 1.1 and zero remaining Workers/RAF. The
[candidate page](candidate-1.0.md) holds the current gate status; the assessment
and pre-commit gate table below retain their historical scope. No publication.

**Later documentation freeze:** [candidate follow-up](candidate-1.0.md) prepares
these documents/reports for an authorized commit/push and exact-SHA CI. The
assessment and gate table below retain their pre-commit review-time scope.

**Consolidated review, 2026-11-16.** The core is architecturally ready for 1.0
within the selected contracts and support boundary. The graph, tree, matrix/grid
and linked-list sketches found **no required core API or implementation change**.
F1/F2 and U1–U5 remain resolved. This does not mean every release gate is complete:
native G3 is partly complete, and the documentation was uncommitted at review time.
This review changes documentation only and starts no release.

The checked candidate is **a9b93f8db8db92ac1ba08ca4f127be82aad53f95**, version
**1.0.0**. GitHub REST recheck confirms origin/master at that SHA and all **11 CI
jobs successful** in [run 43860619331](https://github.com/urffin/algiviz/actions/runs/43860619331).
The same recheck finds no v1.0.0 tag/Release or npm 1.0.0; latest remains 0.16.0.
[Remote snapshot](checks/candidate-1.0.0-ci-a9b93f8-2026-11-16.json).

## Four model reviews

| Future capability | Bounded model and difficult case | Current mechanism | Result |
| --- | --- | --- | --- |
| [Graph](graph-contract.md) | Fixed finite topology, directed/weighted/parallel edges and self-loops | Generic State/Event; stable scene IDs; linked endpoint transitions | Fits; 25 runtime checks, 4 type configurations |
| [Tree](tree-contract.md) | Rooted ordered tree; atomic insertion/removal/reparenting/rotation | Immutable endpoint snapshots; stable node/link IDs; scene.get | Fits; 31 runtime checks, 4 type configurations |
| [Matrix/grid](grid-contract.md) | Fixed rectangular dimensions; aggregate or per-cell views; cells separate from moving contents | Coordinate-addressed State or explicit cell objects; existing handlers | Fits; 32 runtime checks, 4 type configurations |
| [Linked list](linked-list-contract.md) | Acyclic singly linked chain; next-slot identity; deletion bypass and null targets | Stable pointer IDs; old/new nullable targets in application data; enter/update/exit | Fits; 37 runtime checks, 4 type configurations |

That is **125 successful application assertions and 16 strict type configurations**
in total. Each model uses TypeScript 6.0.3 under NodeNext/Bundler, with separate
ES2022-only and Player/DOM surfaces. There are 36 model-specific negative type
cases. Checks overlap in the generic behavior they exercise; these figures are
not extra repository test totals or the full compiler matrix of new modules.
This review reconciles their existing reports/hashes, without rerunning them.

The shared contract is sufficient:

- Step/Frame carry arbitrary immutable application State and Event; new domain
  fields or global event/status cases are unnecessary.
- State retains topology, marks and results. Rewind/seek restore snapshots;
  render does not reconstruct an algorithm from remembered events.
- Scene matches stable IDs/types. Endpoint transitions and scene.get expose both
  old/new references, including entering/exiting objects at zero presence.
- Pure projection and backend-specific handlers separate model/layout/viewport
  responsibilities. Generic Scene validates identities/types/layers, not domain
  invariants such as tree acyclicity or grid bounds.
- Existing source ownership, terminal steps/EOF, cancellation, Restart and dispose
  contracts cover the models. Async/Worker state-only frames can have undefined
  event; persistent display belongs in State.

The model boundaries remain distinct. Changing tree/list topology does not widen
the initial fixed-topology graph trace. A grid needs explicit adjacency before
graph conversion. A predecessor forest or list working arena is not automatically
a valid rooted tree. Detached list nodes and partial pointer assignments can be
application-owned working State, without weakening a complete-list validator.
scene.get only resolves declared objects, including for aggregate grid surfaces.

## Existing eight-entry surface

Fresh declaration symbol enumeration matches the candidate inventory: **8 entries,
21 runtime exports, 69 type-only exports and 57 distinct type-only names**. The
additional ArrayDoneOptions explains the difference from the historical post-F2
68/56 counts. Enumeration is not a new strict consumer compilation.

| Entry | Runtime/type-only names | Current assessment |
| --- | --- | --- |
| /playback | 6 / 10 | Ready within reviewed scope: explicit/plain/async sources, timelines, bounded rewind and U1 ownership/reentrancy |
| /scene | 3 / 5 | Ready: generic identities, endpoint references, layers, pure projection and bounded caches support all four sketches |
| /array | 4 / 11 | Ready: immutable trace/results; done({ result }) retains the selected answer; closed event contract preserved |
| /canvas | 3 / 4 | Ready: renderer alias, context restoration, dispatcher reuse and result palette; optional DOM/backend boundary preserved |
| /canvas/viewport | 1 / 3 | Ready in declared contract; remaining exact-candidate native sizing/disposal acceptance is part of G3 |
| /player | 1 / 4 | Ready in declared contract: typed stepSource/isTerminal, bounded work/history, U2 speed validation and async/Worker control/cleanup |
| /worker | 2 / 17 | Ready in declared contract: F1/F2 shared-storage rejection, U5 original host throws, copy/transfer and bounded cleanup |
| /worker/runtime | 1 / 15 | Ready in declared contract: endpoint validation/cancellation/diagnostics; matched host/runtime versions and separate WebWorker types |

The [post-F2 review](api-readiness-1.0.md) and original F1/F2/U1–U5 reports retain
their historical numbers and scope. None of the four sketches adds exports,
package declarations, implementations, algorithms or new support environments.
Exact future module APIs, error contracts, layouts/routing, rendering defaults,
size/storage limits and staging helpers remain future feature work. A new entry
may be additive under U3; changing existing closed unions or meanings is still
subject to compatibility review. No promise that every future variant is minor.

## Evidence and its limits

The unchanged candidate preparation passed **551 repository tests**, installed
consumers on TypeScript 5.0.4/5.4.5/5.9.3/6.0.3 with NodeNext/Bundler, bundle
isolation, migration samples and EN/RU quickstart builds. The [preparation record](checks/candidate-1.0.0-explicit-steps-2026-11-16.json)
is reused for unchanged files; the fresh exact-SHA CI check independently confirms
all 11 jobs. This documentation review does not rerun that suite or start CI.

Native acceptance on **the same a9b93f8 candidate** passed **26 checks**: stepSource,
green result pixels, bounded rewind, Restart/dispose and real Play/Pause/Next/final
hold, in a visible Windows browser with real DOM, Canvas and RAF. The [original
native record](checks/candidate-1.0.0-native-a9b93f8-2026-11-16.json) is imported
unchanged; this is not a new browser run or a hardware keyboard/accessibility audit.
The report explicitly does not certify the remaining Worker/viewport scope.

Hash reconciliation confirms **298 protected source/build/example/test/config
files unchanged**, the installed **75-file candidate payload** still matches, and
the retained archive SHA-256 is
`24ca57a98246dd33971cdae353e6bd83a97922333ace87d4edb9915642126972`.
New/edited files in this review are documentation. The four architecture probes
are not visual acceptance of future renderers, a performance promise, full domain
validator tests or expanded browser support.

[Consolidated machine record](checks/api-readiness-1.0-core-extensibility-2026-11-16.json)
records provenance, hashes, inventory, evidence reuse and the remaining gates.

## Remaining release steps

| Gate | Current state | Next action / acceptance |
| --- | --- | --- |
| G1 on a9b93f8 | Complete | Candidate version/lock, changelog/migration and code are committed; origin SHA matches |
| G2 on a9b93f8 | Complete | All 11 jobs successful on that SHA; no skipped/failed jobs counted as success |
| Final documentation/SHA | Pending; not committed by this review | Review and, under a separate instruction, commit/push the accumulated contract/review/native-evidence docs. If the release SHA changes, require all 11 jobs on the final SHA too; a9b93f8 CI certifies a9b93f8 |
| G3 native remainder | Partly complete | Keep the 26-check result. On the final candidate/artifact, finish generic scene enter/update/exit, Canvas/viewport sizing/DPR/disposal, and affected async/Worker data/copy/transfer/F1/F2/waiting/control/cleanup checks. Record build/SHA/host provenance; earlier stage reports remain supporting history |
| Release | Not authorized/performed | After the final candidate gates, separately authorize tag/Release publication at the checked SHA. Use GitHub Release → npm; verify workflow, exact version/latest, fresh registry consumers, normalized payload and provenance/signature |

Changed source/artifact requires rechecking affected evidence. Documentation-only
commits can reuse unchanged payload/source checks with explicit hash provenance;
do not relabel an old native run as a run of a new SHA. The final-SHA CI condition
still applies. npm-publish.yml does not enforce all 11 CI jobs itself.

No additional data-structure implementation, intermediate 0.x release, performance
project or expanded browser/host matrix is required to freeze this core at 1.0.
Website work remains separate. This review creates no commit/push/tag/Release,
changes no version/API/implementation, and performs no publication.
