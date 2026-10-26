# API stabilization before 1.0

Updated 2026-10-26 against 0.8.0 and local commits b51979b / 69fc68e.
This is a preparation plan, not authorization to publish 1.0.

Decision on 2026-10-26: defer 1.0 and release the compatible changes as 0.8.1.
Continue validating the API through new application-owned visualizations before
committing to long-term compatibility. New examples alone do not require a minor
package version. The checks below remain preparation criteria, not a release date.

## Public boundary

Keep `/playback`, `/scene`, `/array` and `/canvas`. Algorithms, domain types,
snapshot ownership, layout and browser controls remain application-owned.
The deprecated `/core` export and bundled algorithms were removed in 0.7.0.
No algorithm registration or automatic deep cloning is needed.

## Contracts to preserve

| Area | Current contract and evidence |
| --- | --- |
| Playback | Synchronous lazy iteration; adjacent snapshots retained; explicit terminal predicate; early exhaustion throws. Generic player tests cover consumption and termination. |
| Timeline | Copies the step array, retains its objects; timing uses array position; finite sample times are clamped. Completion uses history length, with no terminal predicate. |
| Indices | Both engines preserve source step.index. Tests cover 10, 25, 90; numbering need not start at zero or be contiguous. The emitter provides consecutive indices as a convenience. |
| Lifecycle | Dispose closes at most once, leaves the frame readable and rejects further advancement. Restart creates a fresh source. |
| Errors | Source, predicate and render errors survive cleanup failures; standalone cleanup failures propagate. Covered by playback-contract tests. |
| Ownership | Generic states/events are not cloned or frozen. The emitter freezes only the step wrapper. Array operations produce immutable snapshots. |
| Scenes | Stable unique IDs, fixed type per ID, layer ordering, explicit enter/update/exit transitions. Handlers are frame draws, not lifecycle callbacks. |
| Projection | Pure state-to-scene mapping with at most two endpoint projections retained; viewport geometry stays in handlers. |
| Palette | Six semantic array colors; partial overrides copied at renderer creation. Theme changes redraw the same frame with a new renderer. |
| Packaging | Four ESM entry points, no root/CommonJS export; packed consumer checks declarations and absence of /core. |

## Completed preparation

- Standalone JavaScript starter passes strict checkJs.
- Complete TypeScript starter has two object types, lazy source, controls and cleanup.
- Packed consumer compiles the TypeScript starter against the installed tarball.
- 78 local tests pass after the merge renderer optimization.
- Website update to 0.8.0 was reported complete by the user; site work stays in its chat.
- CI configuration covers Windows/Linux and Node 22/24. Local validation does not
  replace a successful CI run on a future release candidate.

## Performance evidence and limits

On this machine, 2,000-element reverse inputs retained roughly 5.7-5.9 MiB of
Node heap after explicit GC between 5,000 and 25,000 generator steps. This includes
the process and is diagnostic, not a universal memory bound. Ownership inspection
confirms adjacent player states and a two-endpoint projector cache.

Merge rendering of two 2,000-cell rows fell from about 10.9 to 7.2 ms per frame
in the CPU-only mock Canvas benchmark after batching Canvas state scopes and
per-frame geometry. Visible draw calls matched for 6,840 frames with reverse seeks,
multiple widths, duplicate and signed values. These figures are not browser FPS.

Generator mode avoids accumulated history but still pays snapshot allocation and
synchronous generation costs. Large advance calls can block the host; applications
should cap elapsed time. Full history intentionally retains snapshots. No worker,
async source or automatic scheduling guarantee is proposed for 1.0.

## Remaining release gates, in order

The [public export audit](public-exports-audit.md) records the inventory and
recommended compatibility decisions. Declaration cleanup and its follow-up
package checks are implemented in the working tree; candidate CI and consumer
integration checks remain release gates.

1. Review the public declarations and exported names, especially Sort-named Canvas
   compatibility aliases, and decide what is intentionally supported long term.
   Do not remove an alias merely to tidy names in a patch release.
2. Reconcile documentation with these contracts and confirm coverage for any new
   discrepancy. The contiguous-index wording was corrected in both READMEs.
3. Run the selected candidate through custom-object examples and the website in
   its own chat; preserve generator/history behavior, palettes and lifecycle.
4. Run tests and packed-consumer checks, push the selected candidate when
   authorized, and verify CI for that exact commit.
5. Publish 1.0 only after the API review and consumer checks are complete and the
   user explicitly authorizes that release. No release date is assigned.

A browser controller may be considered later if independent integrations reveal
repeated needs. The new starter alone does not justify expanding the package API.
