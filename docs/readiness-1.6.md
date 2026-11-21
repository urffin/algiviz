# AlgiViz 1.6.0 readiness review

[Русский](ru/readiness-1.6.md) · [Current API](current-api.md) · [Environment requirements](support-matrix.md#current-support-boundary)

**Historical review from November 22, 2026.** The review found the working
build ready for release preparation while its package version was still
1.5.0. The checklist below describes that stage. [1.6.0 release notes](release-1.6.md).

| Area | Result |
| --- | --- |
| [Array Canvas API](array.md#custom-item-labels) | `itemLabel` is an optional callback on `createArrayRenderer` and its alias `createSortRenderer`. Omission or an `undefined` result preserves numeric labels. An empty string hides only the value. Below 24 bitmap pixels per cell the renderer skips both labels and the callback. Invalid options and return values throw `TypeError`, and callback exceptions propagate with Canvas settings restored. |
| [Heap sort with Player](examples.md#heap-sort-with-player) | The array keeps its dedicated tile view. At 50% of the first exchange, the stock renderer drew `2a` and `2b` at the same coordinates on both tested widths. The tile view separates all three labels vertically. It shares the snapshots, stable IDs and playback position with the tree. Extraction moves `2a` out of the tree and keeps it green in the array. |
| [Documentation EN](current-api.md) / [RU](ru/current-api.md) | Both READMEs and API references identify `itemLabel` as a feature of the repository build for 1.6.0. The examples describe the dedicated tile view, and the two-panel guide shows how to use the stock renderer with the shared snapshot and its stored `ArrayEvent`. The current publication receipt remains 1.5.0. |

## Verification

- Compared the working npm archive with the saved registry archive for 1.5.0,
  whose SHA-512 matched the [publication receipt](releases/1.5.0.json). All 16
  import paths and the archive file list matched. After normalizing line endings,
  only the Canvas entry implementation and declaration differed in `dist`.
  The only declaration addition is `ArrayRendererOptions.itemLabel`. Existing
  callers can keep their imports and renderer options.
- All 803 repository tests and 526 installed-package tests passed. The strict
  consumer passed with TypeScript 6.0.3 in NodeNext and Bundler, and bundle
  isolation passed. Both README files and the changelog matched the working
  archive byte for byte.
- All 42 built-in browser checks passed on Canvas at 390 and 960 CSS pixels.
  They cover `2a` and `2b`, synchronized exchange and extraction, the green sorted
  suffix, Previous, Next, Pause and Restart in both playback modes. In full
  history, the three label bounds are vertically separate at the midpoint.
  [Native browser checks](../test/heap-player-browser.html).

## Remaining release steps

1. Set 1.6.0 in `package.json` and both root version fields in
   `package-lock.json`. Finalize the changelog, EN/RU release notes and both
   READMEs. Update the current API and environment references for the exact
   version and use wording suitable for the published package.
2. Build and install the exact 1.6.0 npm archive. Before tagging or creating
   the GitHub Release, check both archived READMEs, the changelog, version,
   import paths and documentation links against the release's EN/RU sources.
3. Commit and push the verified release changes. Wait for all 11 CI jobs
   on the exact release SHA.
4. Once publication is authorized, create `v1.6.0` and the GitHub Release
   on that SHA. Verify npm version 1.6.0, `latest`, registry signature,
   provenance and registry README. Record the receipt and update the
   publication status in EN/RU in the same release task.
