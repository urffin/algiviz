# Dynamic graph readiness for 1.5.0

[Русский](ru/graph-readiness-1.5.md) · [Graph API](graph-api.md) · [Dynamic trace](graph-dynamic-topology.md) · [Canvas transitions](graph-dynamic-canvas.md) · [Edge contraction](examples.md#edge-contraction)

**Historical review from November 21, 2026.** See the [1.5.0 release notes](release-1.5.md)
for the versioned API. This review compared the development build with the
published 1.4.0 archive. The dynamic graph was ready for the 1.5.0 minor release
preparation. No API, implementation or example blockers were found.

| Area | Result |
| --- | --- |
| `/graph` | `createDynamicGraphTrace` adds atomic edits, stable node and edge IDs, and retirement after removal. Failed edits preserve the snapshot, index and ID history. `DynamicGraphEvent` adds `edit` in a separate union. Existing `GraphEvent`, snapshots and scene projection retain their contracts. |
| `/canvas/graph` | `topologyTransitions: true` fades entries and exits, crossfades redirected routes with their own endpoints and interpolates retained parallel lanes. Omission, `undefined` and `false` preserve the 1.4.0 renderer behavior. The caller still owns sizing, DPR and the unclipped context. |
| Edge contraction | One edit removes `B` and `AB`, redirects `BC` and `BD` with their IDs intact, and leaves `AC` and `BC` parallel. The result marks `A`, `BC` and `BD` in green. Previous and Restart work in both Player modes, and history seeking can revisit the crossfade. |
| EN/RU documentation | Both README files, the API index, the graph references and the example catalog identify the features and their availability in the repository build. The Canvas reference states the existing unclipped-context requirement for full bitmap clearing. Earlier reports retain the dates and scope of their checks. |

The export map still has 16 paths. The working build has 34 runtime exports
and 189 type-only exports (177 distinct names). Existing imports need no
migration. `/graph` still uses ES2022 declarations without DOM, and
`/canvas/graph` uses ES2022 with DOM and an HTML Canvas 2D context for drawing.
There are no new runtime dependencies.

## Verification

- Compared the build with the archived npm 1.4.0 package after matching that
  archive's integrity against the [publication receipt](releases/1.4.0.json).
  Outside the graph implementation and its declarations, the only generated
  file difference was a line ending in `dist/player/mount.js`.
- Existing graph declarations matched after removing the documented additions.
  Fixed-trace steps and projected scenes matched for start, marks/captions,
  layout and done. All 150 comparisons of Canvas command streams matched
  1.4.0 across both themes, five progress values and the three default-mode
  option forms.
- The repository passed 788 tests. The installed archive passed 521 runtime
  tests, TypeScript 6.0.3 checks in NodeNext and Bundler, and bundle isolation
  on Node 22.17.0. The archive still reports the working version 1.4.0.
- Both README files and the changelog matched the local archive byte for byte.
  The documentation check resolved 457 repository links and anchors. The
  TypeScript blocks in the two dynamic API references match in EN and RU.
- In the built-in Chromium browser, 24 native graph Canvas checks passed.
  The contraction page was exercised again through Next, Previous and Restart
  with both sources. Five permanent example regressions also cover the atomic
  snapshot, stable IDs, lanes, green result, history seeking and Restart.

## Release steps identified by the review

1. Set 1.5.0 in `package.json` and both root version fields in
   `package-lock.json`. Finalize the changelog and EN/RU release notes.
   Update both README files and the current API and environment references
   to describe the exact 1.5.0 package. Include the graph feature versions,
   unchanged imports and the explicit Canvas opt-in.
2. Build and install the exact 1.5.0 archive. Before tagging, inspect its
   English and Russian README and changelog, verify version, exports, links
   and feature descriptions, and check the corresponding EN/RU repository
   docs. Resolve any discrepancy on the release commit.
3. Commit and push the verified release changes to origin. Await all 11 CI
   jobs on that exact SHA. The matrix has six Node/OS jobs, four TypeScript
   consumer jobs and one bundle isolation job. Changes to the release commit
   require CI on the new SHA.
4. With publication authorized, create `v1.5.0` and a stable GitHub Release
   from that SHA. Await the npm workflow and verify the exact version,
   `latest`, signature, provenance and registry README against the archive.
   Record the publication receipt and close out the EN/RU release status.
