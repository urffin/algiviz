# Linked list readiness for 1.4.0

[Русский](ru/list-readiness-1.4.md) · [List API](list-api.md) · [Canvas API](list-canvas-api.md) · [Example](examples.md#linked-list-edits) · [Verification record](checks/list-readiness-1.4-2026-11-20.json)

**Historical review from November 20, 2026.** See the [1.4.0 release notes](release-1.4.md) for the package version.

The review covers the local `/list` and `/canvas/list` additions against the
published 1.3.1 baseline. The two new entries bring the working copy to 16
entry paths, 33 runtime exports and 185 type-only exports (173 distinct names).
The previous 14 entry records and their compiled behavior and declarations
match the published package. Existing imports need no migration. The separate
entries fit a 1.4.0 minor release under the [compatibility policy](api-compatibility.md).

| Area | Reviewed behavior |
| --- | --- |
| List model | Node IDs and structural head/next slot IDs, complete acyclic chains, retired-ID checks, atomic edits and independent result selections |
| Canvas layout | Recorded node positions, permanent head badge, optional null markers and safe fitting that includes arrow and stroke bounds |
| Interpolation | Old and new routes resolve their own endpoints. Retained slots keep identity, including transitions to and from null |
| Rendering | Text fitting, independent result colors, context restoration and caller-owned bitmap and DPR |
| Example | Insert 5 after 7, remove 3 and reverse the chain to 9 → 5 → 7. Both Player modes replay the green result and Restart restores the original list |
| Packaging | Separate headless and DOM consumers, private path rejection and independent static and lazy bundles |

The review corrected a readability issue in selected null markers. The outline
and route still use the result color. The label now uses foreground text over
the canvas background. The head badge retains its result text over the green fill.
The regression covers both themes. The README module tables also distinguish
the 14 published imports from the two local additions.

The [verification record](checks/list-readiness-1.4-2026-11-20.json) records the
archive, source comparisons, tests and browser observations. The historical
[renderer](checks/list-canvas-implementation-2026-11-20.json) and
[example](checks/list-player-example-2026-11-20.json) reports retain their
original scope. The reviewed archive used the working version 1.3.1.

Release steps identified by the review.

1. Prepare the 1.4.0 candidate with package and lockfile versions, release notes
   and the 1.4.0 availability wording in both README files and current docs.
2. Inspect the actual 1.4.0 archive, then commit and push the candidate and
   require all 11 CI jobs on its exact commit.
3. Publish from that checked commit and verify the exact npm version, latest,
   provenance and the registry README. Record publication evidence in EN/RU
   docs once it exists.
