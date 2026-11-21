# Public API compatibility policy

[Русский](ru/api-compatibility.md) · [Stabilization](api-stability.md) · [Current API](current-api.md) · [Support evidence](support-matrix.md)

U3 protects public types, errors, environments and behavior across all sixteen
1.6.0 entry points. The optional `itemLabel` callback uses the existing
`/canvas` path. [Release notes and migration](release-1.6.md).

## Public surface

Only the export map defines importable paths. Version 1.6.0 has **16 entries,
34 runtime names, 189 type-only exports, 177 distinct types**. The 1.0.0 baseline
had 8 / 21 / 69 / 57. Shared Worker types count at both paths; classes count as
runtime names. [Inventory](current-api.md) and [1.1 review](graph-readiness-1.1.md).

| Entry suffix | Runtime names | Type-only names |
| --- | --- | --- |
| `/playback` | `createPlayer`, `createStatePlayer`, `createTimeline`, `createStepEmitter`, `createRewindBuffer`, `createAsyncSource` | 10 |
| `/scene` | `createSceneFrame`, `createSceneRenderer`, `createSceneProjector` | 5 |
| `/array` | `createArrayTrace`, `defineArrayAlgorithm`, `createArrayPlayer`, `createArrayTimeline` | 11 |
| `/canvas` | `arrayScene`, `createArrayRenderer`, `createSortRenderer` | 4 |
| `/canvas/viewport` | `createCanvasViewport` | 3 |
| `/player` | `Player` | 4 |
| `/worker` | `createWorkerSourceFactory`, `WorkerSourceError` | 17 |
| `/worker/runtime` | `exposeWorkerSource` | 15 |
| `/graph` | `createGraphTrace`, `createDynamicGraphTrace`, `graphScene` | 26 |
| `/canvas/graph` | `createGraphRenderer` | 4 |
| `/tree` | `createTreeTrace`, `treeScene` | 29 |
| `/canvas/tree` | `createTreeRenderer` | 4 |
| `/grid` | `createGridTrace`, `gridScene` | 22 |
| `/canvas/grid` | `createGridRenderer` | 5 |
| `/list` | `createListTrace`, `listScene` | 25 |
| `/canvas/list` | `createListRenderer` | 5 |

The protected contract includes exported names, signatures, generics/inference,
overload selection for existing calls, readonly/optional fields and reachable
public structural shapes, even when their defining file is private. It includes
documented defaults, valid-input domains, result/state/event meanings, source
indices, reference/immutability rules, callback timing/order, laziness, ownership,
cancellation, completion, error precedence and disposal/closed semantics.

Examples of protected behavior include first synchronous headless render versus
lazy widget Start, no-lookahead EOF, bounded rewind eviction, U1 reentrancy,
U2 value-first speed validation, bounded per-RAF work and debt, async ready slots
and cleanup barriers, buffer copy/transfer and shared-memory rejection. The
`createSortRenderer === createArrayRenderer` alias identity is protected.
Documented keyboard/accessibility behavior, label-option keys and CSS custom
properties are public; a rewrite cannot silently break those integration points.

There is currently no root/CommonJS entry or public `/core`, `/compat`, `src/*`
or `dist/*` deep import. Internal files appearing in an archive do not become
public paths. The Worker wire envelopes, channel/version constants and raw
messages are private, not an application protocol or persisted data format.
Host and endpoint must use the same package version; cross-version combinations
are not part of the selected guarantee. Internal protocol changes may remain
compatible when matched host/endpoint public behavior is preserved. Applications
own coherent deployment/cache invalidation of their Worker module.

Internal algorithms, caches, private helpers, DOM nesting, undocumented classes/
data attributes, generated filenames, chunk names and byte sizes are not stable
integration APIs. Neither are callback counts not explicitly promised, incidental
object-wrapper identities, exact pixels/fonts, UI wording, FPS, GC timing or
benchmark numbers. This does not permit changes to documented timing, ownership,
color priorities, resource bounds or accessible control meanings. Application
algorithms, examples, website/video tooling and private test helpers are outside
the package compatibility surface.

## Types and extensibility

`GraphEvent.type`, `DynamicGraphEvent.type`, `GraphObjects` keys and the
`nodeCaptions` modes are closed. `ListEvent.type`, `ListPointerId.kind` and
`ListObjects` keys are also closed. Graph and list roles remain open strings.


Treat current public discriminants and literal unions as **closed**, unless a
specific future API explicitly declares an open extension boundary beforehand.
This includes `ArrayEvent.type`, Player phase/mode/preparing, async read/close
kinds, Worker error code/origin/phase, cancellation and termination kinds. Adding
a case can break an exhaustive switch even if runtime emission is opt-in; it
requires a breaking release. A new separate type/method with old return domains
unchanged can instead be an additive feature. Generic application-owned events
and a documented custom scene registry remain their existing extension points.

Adding a required public field, method or callback member is breaking, including
on output/report interfaces: consumers may construct fixtures, implement them or
use structural assignments. Optional-to-required, loss of readonly guarantees,
parameter narrowing, wider output domains, changed inference and changed
undefined/null distinctions also require compatibility review and a breaking
release when existing supported use changes.

New optional options/fields, optional trailing parameters, overloads and exports
may be minor additions only when existing supported calls, implementations,
inference and defaults remain compatible. Exact object key sets, exhaustive
`keyof` maps and arbitrary extra properties reserved by applications are not
extension guarantees; optional additions may add keys. Unknown option behavior
is guaranteed only where an individual contract defines it. This allowance does
not permit overriding existing fields or weakening a documented input contract.
“New field” and “wider type” alone are not proof of compatibility.

## Errors are part of the contract

| Surface | Protected behavior |
| --- | --- |
| Library validation/command rejection | Documented error class and conditions, synchronous throw versus promise rejection, order of argument/lifecycle checks and effects before rejection |
| Application/source exceptions | Documented preservation of the original `unknown`, including non-Errors/undefined, primary versus cleanup precedence, propagation versus callback/report delivery |
| Async cancellation/closure | Read/close discriminants, prompt logical cancellation versus delayed physical cleanup, never-rejecting report promises where promised, stable diagnostic field meanings and bounds |
| Worker normalized errors | `WorkerSourceError` public class, readonly metadata, closed code/phase/origin domains, descriptor and cleanup-report semantics |

Only explicitly documented classes are stabilized; an error class observed in an
implementation or incidental test does not by itself create a new promise.
Where only a generic Error rejection is specified, consumers cannot assume a
more specific subclass. A 1.0 review must make each intended class/delivery rule
explicit or state its limit. This is not a global rule assigning TypeError to all
wrong types or RangeError to all numbers: U2 deliberately uses RangeError for
every invalid speed, including wrong runtime types, before lifecycle guards.

Message prose, stack traces, call-site details and browser-native diagnostic
wording/codes are not fixed library error identifiers. Structured fields and
discriminants are the intended machine-readable surface. User-provided values
remain user data under the stated identity/clone/truncation rules; a diagnostic
descriptor does not promise remote Error prototype/identity reconstruction.

Changing an established class, normalized-versus-original boundary, primary
error winner, throw/reject/report delivery or validation order for supported use
is breaking. Fixing acceptance of an input already forbidden by the contract can
be a patch, with impact documented. Ambiguity is resolved explicitly before
claiming stable semantics, not by silently declaring observed behavior a bug.
The later **U5 decision selects identity preservation** for host postMessage throws
as unknown, with host/post report context. Cancel failures are original cleanup
issues inside the existing cleanup summary; [the U5 contract](worker-post-errors.md)
defines the boundary and priority. The [75 permanent public/installed regressions](checks/u5-post-errors-regressions-2026-11-14.json)
passed before 1.0 and are part of the released baseline. The 1.1 release
receipt records the later exact-candidate acceptance.
The U3 policy itself introduced no runtime change.

## Environments and loading

Import safety, declaration libraries, runtime capabilities and concrete version
verification are separate guarantees. All sixteen runtime entries must remain
importable without DOM/Worker globals or import-time allocation of external resources; that
does not make their active browser operations available in Node.

| Entries | Declaration libraries | Active runtime boundary |
| --- | --- | --- |
| `/playback`, `/scene`, `/array`, `/graph`, `/tree`, `/grid`, `/list` | ES2022, no DOM or ambient Node types required | Headless JS/iterables; async adapter uses its cooperative DOM-free signal |
| `/canvas` | ES2022 + DOM | Canvas 2D host; bitmap coordinates; no implicit viewport ownership |
| `/canvas/graph`, `/canvas/tree`, `/canvas/grid`, `/canvas/list` | ES2022 + DOM | Canvas 2D host; explicit logical size and caller-owned bitmap/CSS sizing |
| `/canvas/viewport`, `/player` | ES2022 + DOM | Browser DOM/window and the documented measurement/scheduling APIs; creation/mounting is explicit |
| `/worker` | ES2022 + DOM; browser-Worker host use with WebWorker types also documented | Dedicated module Worker host, native clone/transfer facilities; lazy exclusive Worker ownership |
| `/worker/runtime` | ES2022 + WebWorker, checked separately from DOM | Explicit dedicated Worker endpoint installation and compatible source factory |

Initial 1.0 verification targets retain the recorded boundary: Node 22.x/24.x/26.x
on Windows/Linux for headless execution/import and package consumers; TypeScript
5.0.4/5.4.5/5.9.3/6.0.3 with strict NodeNext/Bundler consumers, ES2022 and the
appropriate separate DOM/WebWorker libraries. These are selected configurations,
not every intermediate/future compiler or every historical Node patch. Exact
versions and runner configurations must be recorded for the actual candidate.
No new `engines` restriction or dependency change is implied by this decision.

Consumer checks use `strict`, `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`, `skipLibCheck: false` and explicit declaration libs;
headless fixtures require no ambient Node types. DOM and WebWorker are checked
in separate programs rather than merged into one permissive environment.

Browser verification is limited to the recorded Windows built-in Chromium host
and scenarios in the [support matrix](support-matrix.md#current-support-boundary).
Its UA is not a minimum Chromium version or a desktop Chrome/Edge guarantee.
Targeted desktop viewport checks do not certify the complete public API.
Firefox, Safari/iOS, other WebViews, CommonJS, Bun/Deno, Node `worker_threads`,
SharedWorker and ServiceWorker remain outside the promise. Broader support needs
explicit target selection and evidence; absence of verification is not evidence
of incompatibility. Import maps belong to standalone demos, not every bundled
library integration.

Existing entry graphs retain their separation: headless consumers do not acquire
DOM types or mandatory UI/Worker imports; `/canvas/viewport` stays independent;
Worker modules are not silently loaded by unrelated entries. No runtime
dependency or polyfill is made mandatory for the sixteen entries. Compatible
optimization may alter chunks/bytes, but not these loading/host requirements.
Dropping a selected target or raising required language/lib/host capabilities is
breaking even if upstream changes support status. Build-tool version changes
alone are internal if emitted code, declarations and the consumer boundary hold.

## Allowed release changes

Classify against the last published contract and supported use, considering
runtime, types, errors and environments together. Use the most restrictive row
when a change fits several. A deprecation notice does not itself permit removal.

| Change | During 0.x | During 1.x |
| --- | --- | --- |
| Docs/test/tooling correction or internal optimization preserving the contract; fix of already forbidden input | Patch | Patch |
| Backward-compatible new entry/export, optional feature/field or verified additional environment | Minor; verification-only evidence may be a patch | Minor; verification-only evidence may be a patch |
| Closed-union case or required structural member; removed/renamed API; incompatible type/default/lifecycle/error/host change | Explicit breaking minor | Next major |
| Migration from 0.x to the reviewed stable baseline | Explicitly reviewed 1.0 candidate, separately authorized | Not an automatic consequence of a passing patch |

0.x patch releases do not introduce intentional breaking contract changes. A 0.x
minor may break, with a prominent breaking-change note, affected entries, before/
after example and migration. In 1.x an incompatible change waits for a major;
prefer an additive alternative and document deprecation at least one minor in
advance when practical. No fixed notice duration, LTS/backport schedule or
release cadence is promised. Security/isolation fixes may stop already forbidden
use, but are not a blanket exception allowing a supported contract to break in
a patch; document impact and use the appropriate release boundary.

Previously unspecified details may be clarified compatibly, with explicit
release notes where observable. Conflicting documents require a decision and
consumer-impact review, not automatic patch classification. This policy does
not assign a version or authorize shipping the accumulated F1/U1/U2 changes.

## Candidate review and remaining work

For each proposed change identify affected entries, successful/error behaviors,
type consumers and environments; classify the change and record migration when
needed. Verify the installed archive, exact exports/private paths, inference and
negative type cases, affected lifecycle/error regressions and bundle boundaries.
Use the selected Node/TS CI matrix and focused native browser/Worker checks for
the actual candidate and affected browser behavior. Prior local/mock/native
results retain their original scope; green checks do not expand support targets.

U4 reconciled the original eight references; 1.1 adds the two graph references
under the same policy. Releases 1.0 and 1.1 are complete; see the [1.1 receipt](releases/1.1.0.json).
For future changes, candidate acceptance and publication remain separate
owner-authorized actions. [U3 verification](checks/u3-compatibility-policy-2026-11-14.json)
records inventory and unchanged implementation checks for this documentation step.
