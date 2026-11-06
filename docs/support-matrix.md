# Support matrix before 1.0

Updated 2026-11-06 for AlgiViz 0.11.2. This records verified Node/TypeScript
coverage and proposed browser coverage, not a promise about untested targets.
See the [stabilization plan](api-stability.md) for the remaining release decisions.

## Scope and status

- **Verified** records a concrete version/configuration and successful checks.
- **Proposed** identifies coverage to confirm before advertising 1.0 support.
- **Unverified** is not a claim of incompatibility or support.

Library runtime, consumer TypeScript, library build tooling and standalone HTML
examples have separate requirements. The library is ESM with ES2022 output and
ships declarations; there are no bundled runtime dependencies or polyfills.
It does not require a browser when importing `/playback`, `/scene` or `/array`.
Drawing with `/canvas` requires a Canvas 2D implementation; its declarations need
DOM types. No CommonJS, Bun or Deno support promise is introduced here.

## Node.js

| Target | Status | Evidence and next action |
| --- | --- | --- |
| Node 22.x | Verified CI family | Windows and Linux: build, all 127 tests and installed-package consumer. Exact local runtime for the TypeScript checks below: 22.17.0 on Windows. |
| Node 24.x | Verified CI family | The same four-entry-point checks on Windows and Linux. Current npm publishing also uses Node 24. |
| Node 26.x | Verified CI family | Full-suite/packed-consumer jobs passed on Windows and Linux in the expanded matrix. |
| Other majors | Unverified / outside the proposal | Do not infer support from ES2022 output. EOL or prerelease majors are not proposed release targets. |

The [expanded compatibility CI](https://github.com/urffin/algiviz/actions/runs/42171367290)
passed all six runtime jobs at `b2d6c62b27e7d81faba3da20234470d550a1b73e` on
2026-11-06. Its Linux setup logs report Node 22.23.4, 24.22.2 and 26.13.0;
the corresponding Windows major-version jobs also passed. The
[workflow](../.github/workflows/ci.yml) keeps all six targets. The older
[release CI](https://github.com/urffin/algiviz/actions/runs/41932170508) remains
evidence for the exact published 0.11.2 SHA, which tested 22/24.
Family checks are not a claim that every historical
minor/patch was tested. Prefer maintained patch releases when defining support.
No `engines` field is changed until the advertised boundary is decided.

Lifecycle source: [official Node release table](https://nodejs.org/en/about/previous-releases).
This external lifecycle does not itself establish AlgiViz compatibility.

## TypeScript consumers

The proposed consumer scope is TypeScript 5.x from the tested 5.0.4 baseline and
TypeScript 6.0, with `NodeNext` or `Bundler` resolution. This is a selected-version
compatibility result, not proof of every intermediate patch or future 6.x release.
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

Proposed release coverage: current and previous stable Chrome/Edge and Firefox,
plus current and previous major Safari on macOS/iOS. This is a coverage policy
to verify, not a declaration that these targets have already passed. Record exact
versions at each check; Firefox ESR, older browsers and embedded WebViews require
separate evidence if they become support requirements.

| Target | Current result | Next action |
| --- | --- | --- |
| Embedded Chromium, reported UA Chrome/157.0.0.0 on Windows | Six manual browser smoke groups passed on 2026-11-06; Canvas filter is available | Retain as engine-level smoke evidence, not certification of branded Chrome or Edge releases. |
| Chrome / Edge stable and previous | Unverified as specific products/versions | Run the browser smoke fixture and representative interactive examples; record versions, OS, results and console errors. |
| Firefox stable and previous | Unverified | Run the same checks with Gecko, not only a Chromium-based host. |
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

## Next work

1. Run the named browser targets, starting with available desktop engines;
   track Safari/iOS as pending until that environment is actually checked.
2. Keep the Node/TypeScript CI gates passing for subsequent changes; the first
   expanded run is complete and does not need to be repeated as a separate task.
3. Decide and document the advertised 1.0 support scope from these results, then
   apply the [exact-candidate release checks](api-stability.md#what-remains-before-10-in-order).

External reviews and additional users are optional. The owner's website/video
integrations and the already completed custom-object examples are valid evidence
for API authoring decisions; they do not automatically establish every environment
in the proposed matrix.
