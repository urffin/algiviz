# AlgiViz 1.2.1: documentation patch

[Русский](ru/release-1.2.1.md) · [Changelog](../CHANGELOG.md) · [Current API](current-api.md) · [GitHub Release](https://github.com/urffin/algiviz/releases/tag/v1.2.1)

This patch updates EN/RU README and changelog shipped with the package and
reconciles repository documentation with completed 1.2.0 publication. The
1.2.0 archive retained stale candidate wording; immutable published files cannot
be replaced. Version 1.2.1 carries the correction for new installations.

Runtime implementations, public declarations, all twelve export paths,
dependencies and environment requirements are unchanged from 1.2.0 / 8e1f50b.
Existing imports need no migration. `/tree` and `/canvas/tree` have been
available since 1.2.0; both stock and custom examples remain available.

The future [Grid API](grid-api.md) is repository design documentation. `/grid`
and `/canvas/grid` are not exported or implemented by this patch. Neither
algorithm code nor additional documentation directories are added to npm files.
The packaged README links to the repository's detailed EN/RU references.

```sh
npm install @grundyjs/algiviz@1.2.1
```

The [1.2.0 receipt](releases/1.2.0.json) records that completed release's CI,
exact-version/latest and cryptographic provenance observations. Its historical
scope is preserved. The documentation patch uses the same GitHub Release →
OIDC npm workflow, with exact-commit CI before release and independent npm,
README payload and provenance verification after publication.
