# Documentation patch 1.3.1

[Русский](ru/release-1.3.1.md) · [Current API](current-api.md) · [Completed 1.3.0 release](release-1.3.md)

Version **1.3.1** reconciles EN/RU README, changelog, API/environment references
and release statuses with the completed 1.3.0 publication. It replaces candidate-facing links in
current references and clearly labels preparation/design reports as historical.

Runtime sources, declarations, all fourteen exports, dependencies and examples
are unchanged from 1.3.0. No migration is required. /grid and /canvas/grid remain
available since 1.3.0; the reproducible minimum-search quickstart stays pinned
to 1.0.0, which already provides the features it uses.

The immutable package includes the corrected EN/RU README and changelog.
The results below are for 1.3.1.

## Completed publication — 2026-11-20

Released from d61829d72ed8cbdc27a591d280f224703eb3e248.
[GitHub Release](https://github.com/urffin/algiviz/releases/tag/v1.3.1) · [npm 1.3.1](https://www.npmjs.com/package/@grundyjs/algiviz/v/1.3.1).

All eleven [CI jobs](https://github.com/urffin/algiviz/actions/runs/44647976891) passed on the exact SHA. The [publication workflow](https://github.com/urffin/algiviz/actions/runs/44648303067) succeeded.
Exact npm and latest were 1.3.1 at verification; gitHead matches the release.
Fresh installation checked all fourteen entries/30 runtime names, private-path
rejection and grid trace/scene/renderer. All 126 dist files match the candidate
after newline normalization. Packaged EN/RU README/changelog and registry README
match the release. Registry signature and source/digest-bound SLSA provenance
were cryptographically verified. [Transparency record](https://search.sigstore.dev/?logIndex=4011742948).

Sources, dependencies, declarations and examples did not change. Existing native
renderer (18) and BFS UI (23) checks were reused for identical code; no fresh
browser run is claimed.
