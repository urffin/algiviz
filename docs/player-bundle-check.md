# Optional player: bundle isolation — 2026-11-12

Working-tree `/player` after prototype commit `12f8fb3`; no npm publication.
Measured on Windows, Node 22.17.0 and pinned esbuild 0.28.2, browser platform,
ES2022 ESM, splitting enabled, no source maps/legal comments.

## Installed-package method

`npm run test:bundle` builds and packs the repository, installs that tarball in a
temporary consumer and runs real bundler builds. The existing-only fixture
exports all runtime names from `/playback`, `/scene`, `/array` and `/canvas` so
they cannot disappear as unused imports. The baseline copies those same four
installed module folders and removes the optional point/files. This measures
isolation from the new module, not a comparison with a separately downloaded
registry release or a production application.

Both raw and minified existing-only output matched the baseline **byte for
byte**. Its graph contains no `/player` implementation, UI strings or styles.

The static fixture adds a `Player` re-export. The dynamic fixture adds
`loadPlayer()`, which calls `import('@grundyjs/algiviz/player')`. The check follows
the entry's static imports, including shared chunks, and verifies no player code
or CSS strings in that initial graph. It verifies UI/styles in deferred outputs.
Minified outputs and the lazy loader execute in Node without DOM globals.

## Measured output

All sizes below are bytes. Gzip is measured per emitted file and summed; shared
chunks are counted once. No CSS asset is emitted: styles are in the UI JavaScript
and are inserted only on mount.

| Fixture | Raw initial JS | Minified initial JS | Initial gzip | Minified all JS | All gzip |
| --- | ---: | ---: | ---: | ---: | ---: |
| Existing four entries | 20,444 | 10,224 | 3,961 | 10,224 | 3,961 |
| Static UI import | 48,901 | 27,059 | 9,566 | 27,059 | 9,566 |
| Dynamic UI import | 20,749 | 10,399 | 4,299 | 27,253 | 10,348 |

The dynamic initial output is **175 minified bytes** larger than existing-only
output, due to the loader and split-module plumbing. It contains no UI code or
styles. The deferred UI file is 16,854 minified bytes / 6,049 gzip bytes in this
fixture. Static importing the widget deliberately includes it from the start.

These values depend on the fixture's exported functions, bundler configuration,
minification and compression boundaries. They are not the cost of every consumer
application, a universal gzip delta or an assertion about network preloading in
other frameworks. The npm archive/install grows because optional files are shipped.

## Repeat and scope

```sh
npm run test:bundle -- --report /absolute/path/to/bundle-report.json
```

The report contains exact versions and output graphs. The task's local artifacts
include `bundle-report.json`. The CI workflow adds one bundle job on Ubuntu/Node
24 alongside the six runtime and four compiler jobs; remote results for the
new implementation require its own commit/run. esbuild is a dev dependency only.

The old runtime folders were not modified by the player extraction. No package
version, release tag or registry publication was changed by these checks.
