# Support matrix before 1.0

Updated 2026-11-13 for published AlgiViz 0.13.0 at `443892c`. Its
[eleven-job CI](https://github.com/urffin/algiviz/actions/runs/43326519526) and
[publishing workflow](https://github.com/urffin/algiviz/actions/runs/43327210001)
passed. Fresh registry installation, exact exports, DOM/headless types and
registry signature/provenance were verified.
The four baseline modules are unchanged from 0.11.2; repository checks include the new demos.
The optional `/player` adds a separate DOM-based UI contract; see
the [reference](player.md) and [bundle evidence](player-bundle-check.md).
This records the current support boundary and its concrete verification evidence.
See the [stabilization plan](api-stability.md) for the remaining release decisions.

## 0.16.0 Worker adapter boundary

The published 0.16.0 adds optional dedicated browser module Worker sources.
The host entry /worker requires DOM declarations; /worker/runtime uses WebWorker
declarations separately. Both import safely without Worker/DOM globals, while
actual execution requires browser Worker APIs and native structuredClone.
Existing headless declarations remain ES2022-only. SharedWorker, ServiceWorker
and Node worker_threads are outside this API.

The [standalone report](checks/worker-source-browser-2026-11-14.json) passed 20
native cases; [Player integration](checks/player-worker-browser-2026-11-14.json)
passed 25, including keyboard controls and disposal. Those local-build checks
used the built-in Windows Chromium host and do not expand the browser-product
boundary below. Installed consumers separately check DOM and WebWorker types,
exports, runtime behavior and independent/lazy ESM graphs. All eleven exact-commit
CI jobs and publication passed. Fresh registry consumers, signature, attestation
and exact source/tag/digest provenance were verified; all 68 build files match
after newline normalization. See [release verification](releases/0.16.0.json).

## Scope and status

- **Verified** records a concrete version/configuration and successful checks.
- **Future target** identifies optional coverage that needs its own checks before
  being added to the support boundary.
- **Unverified** is not a claim of incompatibility or support.

Library runtime, consumer TypeScript, library build tooling and standalone HTML
examples have separate requirements. The library is ESM with ES2022 output and
ships declarations; there are no bundled runtime dependencies or polyfills.
It does not require a browser when importing `/playback`, `/scene` or `/array`.
Drawing with `/canvas` requires a Canvas 2D implementation; its declarations need
DOM types. No CommonJS, Bun or Deno support promise is introduced here.
The optional `/player` also requires DOM types; importing it is checked without
DOM globals, while mounting requires a browser DOM/window. Existing no-DOM
fixtures deliberately do not import the UI declarations.

The [independent `/canvas/viewport` entry](canvas-viewport.md) is included in the
published 0.13.0. Its declarations
require DOM types and creation requires the canvas owner's browser APIs;
DOM-free runtime import is checked with the installed package. The prototype's
[checks](canvas-viewport-prototype.md#verification-and-limits) include embedded
DPR 1 visibility tests and desktop Chrome native zoom on 2026-11-13 (reported UA
Chrome/157.0.0.0). Twelve cases passed at DPR 1.25, 2.5 uncapped/capped and restored
1; automatic bitmap/transform updates retained Step 1 and two source reads.
The original scale was restored. This is targeted viewport coverage, not the
full desktop-product matrix. The compiled public entry at `a05bd48` was separately
checked on 2026-11-13: five twelve-case runs passed at DPR 1, 1.25, 2.5 uncapped,
2.5 capped at 2, and restored 1. A hidden zoom change retained bitmap/transform
and source reads, then redrew correctly when shown. The served JavaScript matched
the compiled source. This is a local-build browser check, not a registry-tarball
browser install. It does not establish physical HiDPI support or broaden the
verified browser boundary. The sixth entry in 0.13.0 also passed installed
types/runtime/bundle checks and all eleven candidate CI jobs. The registry
installation subsequently passed twelve viewport contract tests, type checks,
DOM-free runtime import and verified signatures/attestation; this does not turn
the earlier local-build browser check into a registry-tarball browser run.

## Current support boundary

| Area | Recorded boundary |
| --- | --- |
| Node runtime | CI tracks Node 22.x, 24.x and 26.x on Windows and Linux. Use the patch versions selected by the current CI; every historical minor/patch is not separately certified. |
| TypeScript consumers | Verified compiler configurations: 5.0.4, 5.4.5, 5.9.3 and 6.0.3, with NodeNext/Bundler and ES2022, with or without DOM as appropriate below. These selected versions do not establish every intermediate or future compiler version. |
| Headless imports | `/playback`, `/scene` and `/array` work without DOM types or a browser in the checked configurations. `/canvas` requires a Canvas 2D host and DOM types. |
| Browser verification | Windows embedded Chromium, reported UA Chrome/157.0.0.0, for the recorded smoke and interactive scenarios. No general minimum Chromium version or desktop Chrome/Edge product promise is inferred from the host's UA. |
| Other browser products | Desktop Chrome/Edge, Firefox, Safari/macOS/iOS, their historical versions and other WebViews are unverified and outside the current support claim. This does not mean they are known to be incompatible. |
| Standalone demos | Native import maps and the host features used by each page are required. Their UI/controller code is outside the npm runtime; bundled applications may have different host requirements. |

This is the boundary to use in current compatibility statements. An eventual
1.0 candidate must be checked again within the chosen boundary; these results do
not automatically certify future code. Expanding the browser list is optional.

## Node.js

| Target | Status | Evidence and next action |
| --- | --- | --- |
| Node 22.x | Verified CI family | Windows and Linux: build, all 145 repository tests and installed-package consumer. Exact local runtime for the earlier TypeScript checks below: 22.17.0 on Windows. |
| Node 24.x | Verified CI family | The same four-entry-point checks on Windows and Linux. Current npm publishing also uses Node 24. |
| Node 26.x | Verified CI family | Full-suite/packed-consumer jobs passed on Windows and Linux in the expanded matrix. |
| Other majors | Unverified / outside the boundary | Do not infer support from ES2022 output. |

The [expanded compatibility CI](https://github.com/urffin/algiviz/actions/runs/42171367290)
passed all six runtime jobs at `b2d6c62b27e7d81faba3da20234470d550a1b73e` on
2026-11-06. Its Linux setup logs report Node 22.23.4, 24.22.2 and 26.13.0;
the corresponding Windows major-version jobs also passed. The
[workflow](../.github/workflows/ci.yml) keeps all six targets. The older
[release CI](https://github.com/urffin/algiviz/actions/runs/41932170508) remains
evidence for the exact published 0.11.2 SHA, which tested 22/24 and 127 tests.
The latest [repository CI](https://github.com/urffin/algiviz/actions/runs/43163212052)
passed all six runtime jobs at `273b292a6fa01dfaeb1717b6bbb7a4b149b4e6c9`
on 2026-11-12, with 145 tests and the packed consumer in every job.
Family checks are not a claim that every historical
minor/patch was tested. Prefer maintained patch releases when defining support.
No `engines` field is added: this family/OS verification is not a demonstrated
technical minimum, and the browser-capable package should not acquire an
unmeasured Node installation restriction from this documentation update.

Lifecycle source: [official Node release table](https://nodejs.org/en/about/previous-releases).
This external lifecycle does not itself establish AlgiViz compatibility.

## TypeScript consumers

The consumer boundary comprises the four tested versions below, with `NodeNext`
or `Bundler` resolution. This is a selected-version compatibility result, not
proof of every intermediate patch or future 6.x release.
5.0 is a deliberate starting point because it supports both resolution modes;
it is not a demonstrated technical minimum for every possible configuration.
`Bundler` was introduced in [TypeScript 5.0](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html#--moduleresolution-bundler).

| Compiler | NodeNext, no DOM | NodeNext, DOM | Bundler, no DOM | Bundler, DOM |
| --- | --- | --- | --- | --- |
| 5.0.4 | Passed | Passed + consumer execution | Passed | Passed + consumer execution |
| 5.4.5 | Passed | Passed + consumer execution | Passed | Passed + consumer execution |
| 5.9.3 | Passed | Passed + consumer execution | Passed | Passed + consumer execution |
| 6.0.3 | Passed | Passed + consumer execution | Passed | Passed + consumer execution |

All 16 configurations were checked locally on 2026-11-06 with Node 22.17.0 on
Windows. An isolated workspace installed the packed local 0.11.2 tarball and
aliased compiler packages; it did not import library sources or use a local link.
The tarball contains the unchanged runtime/declarations of the released baseline.

Checks reuse the actual [headless fixture](../test/package-headless.ts),
[four-module consumer](../test/package-consumer.ts) and
[TypeScript starter](../examples/custom-objects.ts):

- `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
  `skipLibCheck: false`, `types: []` and target ES2022.
- Headless: `lib: ["ES2022"]`, no emit, `/playback` + `/scene` + `/array`.
- DOM consumer: `lib: ["ES2022", "DOM"]`, all four modules and the custom-object
  starter. Emitted consumer code was also executed successfully on Node 22.17.0.
  That execution is not a test of a real browser or of a bundler's build pipeline.
- NodeNext uses `module: "NodeNext"`; Bundler uses `module: "ESNext"`.

The library itself is built with pinned TypeScript **6.0.3**. Consumers do not
need that exact compiler just because it builds the library. The updated workflow
adds four independent TypeScript consumer jobs on Ubuntu with Node 24, using all
four compiler versions above. Each checks both module-resolution modes with and
without DOM and executes the emitted DOM consumer: 16 configurations and eight
runtime executions in total. All four jobs passed in the
[expanded compatibility CI](https://github.com/urffin/algiviz/actions/runs/42171367290)
on 2026-11-06 at `b2d6c62`, in addition to the earlier local checks. The unchanged
default `test:package` path also passed in every Node/OS runtime job.
All four consumer jobs passed again in the
[2026-11-12 repository CI](https://github.com/urffin/algiviz/actions/runs/43163212052)
at `273b292`, with the same 16 configurations and eight runtime executions.
Working-tree checks of the new installed `/player` additionally passed locally
on 2026-11-12 for all four compilers and both resolution modes, preserving the
headless fixtures and executing a DOM-free UI-import consumer. These are local
candidate results; they do not extend the old remote CI evidence to new code.

The [packed-consumer checker](../scripts/test-package.mjs) accepts an exact
consumer compiler version and resolution mode:

```sh
npm run test:package -- --typescript 5.0.4 --resolution all
```

Alternate compilers are installed only in the check's temporary workspace.
`npm pack` still builds the library with the pinned repository compiler. Plain
`npm run test:package` retains its pinned-compiler/NodeNext behavior for the main
runtime matrix and publishing workflow. `--resolution` accepts `NodeNext`,
`Bundler` or `all`; `--typescript` requires an exact stable version. Repository
dependencies and the lockfile are not replaced by consumer compiler selection.

## Browsers

The current verified boundary is the embedded Windows host below. Possible
future targets include current/previous Chrome, Edge and Firefox, and Safari on
macOS/iOS. They are not required checks within the present narrow boundary.
Record exact versions when adding coverage; product names, shared engines and
ES2022 output do not substitute for running the relevant scenarios.

| Target | Current result | Next action |
| --- | --- | --- |
| Embedded Chromium, reported UA Chrome/157.0.0.0 on Windows | Six smoke groups and minimal walkthrough passed on 2026-11-06; lifecycle and Sorting lab completed on 2026-11-12, with smoke repeated. Boids and sand UI checks also passed | Embedded-host checklist complete. See the [follow-up](browser-checks-2026-11-12.md) and [example review](boids-sand-review.md). Other products/versions remain separate targets. |
| Chrome / Edge stable and previous | Full product/version matrix unverified | Targeted desktop Chrome viewport-prototype zoom checks passed on 2026-11-13, reported UA Chrome/157.0.0.0; see the [report](canvas-viewport-prototype.md#native-chrome-zoom-follow-up). This does not certify all modules, current/previous releases or Edge. |
| Firefox stable and previous | Unverified | Installed Firefox 133.0.3 was not tested and does not certify the possible current/previous targets. Check Gecko separately if the scope is expanded. |
| Safari macOS/iOS, current and previous major | Unverified | Check actual Safari, Canvas behavior and example controls. A different WebKit host is additional evidence rather than automatic Safari/iOS certification. |

The runtime needs native ESM and the JavaScript features actually emitted/used;
`target: ES2022` alone is not a measured minimum browser version. The bare-import
HTML demos use import maps. A bundled integration does not need native import
maps merely because those demos do. ResizeObserver, RAF, DOM/SVG and other host
features belong to the particular integration using them.

Canvas `filter` has [limited cross-browser availability](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter).
Test the context-state contract on each engine, including contexts without this
native property; do not treat assignment of a JavaScript property as proof of
native filter support. Any observed incompatibility becomes a concrete issue to
resolve before that browser target is marked supported.

### Repeatable browser smoke check

1. Build with `npm run build`, then serve the repository over local HTTP.
2. Open [`test/browser-smoke.html`](../test/browser-smoke.html) in the target browser.
   It imports the local build through the four public entry-point mappings.
3. Record the displayed JSON: user agent, native Canvas filter availability and
   individual results. All six groups must pass:
   manual/timed state playback and early disposal; explicit steps and timelines;
   custom objects with projection/SVG cleanup; array adapters/palette; Canvas
   paint-state restoration and invalid progress; dense arrays/zero bitmap.
4. Also check the interactive minimal walkthrough, object lifecycle and Sorting
   lab controls. The scripted smoke page does not replace interactive UI checks,
   historical-version coverage or browser performance measurements.

The fixture runs manually in a browser; it is not included in `npm test` and is
not yet a browser CI job. The 2026-11-06 result covers the local compiled 0.11.2
code, not a fresh registry-tarball browser install or a future 1.0 candidate.
The [initial report](browser-checks-2026-11-06.md) preserves the interrupted run;
the [2026-11-12 follow-up](browser-checks-2026-11-12.md) closes the outstanding
embedded-host scenarios using the then-current working-copy demos. Boids, sand
and their shared-controller changes were subsequently committed at `273b292` and
passed exact-commit CI. Their browser check still uses the local build, not a new
registry-tarball installation. Broader product/version coverage is deferred.

## Next work

1. Maintain the recorded narrow boundary and keep all eleven CI jobs passing:
   six Node, four TypeScript and installed-package bundle isolation. All eleven
   passed for implementation commit `fa22032` in
   [CI](https://github.com/urffin/algiviz/actions/runs/43203994982).
   Every versioned release candidate needs its own exact-commit run.
2. Make the long-term API compatibility decision, then apply the
   [exact-candidate checks](api-stability.md#what-remains-before-10-in-order)
   to any authorized 1.0 candidate within its stated support boundary.
3. Optionally expand browser coverage when a concrete integration needs it and
   access permits. Newly added browser UI modules need their own DOM, cleanup
   and bundle-isolation checks; existing smoke results do not certify them.

External reviews and additional users are optional. The owner's website/video
integrations and the already completed custom-object examples are valid evidence
for API authoring decisions; they do not automatically establish every environment
in the proposed matrix.
