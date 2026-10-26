# Public exports audit

Inspected 2026-10-26 at 49be3cc, package version 0.8.0. This document proposes
compatibility decisions; it does not change exports or authorize a release.

## Inventory

Runtime namespaces were imported directly and compared with source entry points
and generated declarations.

| Entry point | Runtime exports | Type-only exports |
| --- | --- | --- |
| /playback | createPlayer, createTimeline, createStepEmitter | Player, Step, Frame, Timeline |
| /scene | createSceneFrame, createSceneRenderer, createSceneProjector | SceneObject, Scene, ObjectTransition, SceneFrame, SceneVisualizations |
| /array | createArrayTrace, defineArrayAlgorithm, createArrayPlayer, createArrayTimeline | ArrayTrace, ArrayAlgorithm, SortedRegions, Item, ArrayEvent, ArraySnapshot, ArrayStep, ArrayPlayer, ArrayFrame, ArrayTimeline |
| /canvas | arrayScene, createArrayRenderer, createSortRenderer | ArrayObjects, ArrayPalette, ArrayPaletteOverrides, ArrayRendererOptions |

There are 13 runtime names (12 distinct functions) and 23 type-only names.
No root, /core, algorithm registration or bundled algorithm export exists.
Relative imports inside declarations resolve shipped implementation modules; they
do not require consumers to import those private paths themselves.

## Recommendations before 1.0

1. **Keep all four entry points.** They separate generic playback, generic scenes,
   optional numeric array operations and optional Canvas drawing. A root barrel
   is unnecessary and could blur the headless/browser boundary.
2. **Keep createSortRenderer as a compatibility alias.** It is documented and
   tested. Prefer createArrayRenderer in examples; make that name the actual
   function declaration so editor signatures lead with the preferred name.
   Preserve alias identity and behavior. Removing it would break existing imports
   without providing a functional benefit.
3. **Use ArrayEvent/ArraySnapshot/ArrayStep internally as well as publicly.**
   Current public aliases are correct, but generated signatures still display
   SortStep and SortSnapshot through internal imports. Rename internal types and
   references without changing the public entry-point names or data shapes.
   Do not add public Sort* aliases: those type names are not currently exported
   by /array. Deep implementation imports are not a supported API.
4. **Resolve explicit undefined in palette types.** Runtime skips undefined roles
   and README promises that fallback. Partial<ArrayPalette> rejects an explicit
   undefined with exactOptionalPropertyTypes enabled. Prefer allowing undefined
   for each override role, matching existing runtime behavior. Add a strict
   packed-consumer fixture for this precise case.
5. **Keep generic state ownership explicit.** SceneObject.data and Step.state
   intentionally retain the supplied type; readonly wrappers do not imply deep
   immutability. ObjectTransition exposes nullable endpoints; handlers must narrow
   them. A discriminated transition union could improve ergonomics, but is not
   necessary for 1.0 and would deserve a separate compatibility review.
6. **Keep synchronous iteration explicit.** createPlayer accepts Iterable;
   defineArrayAlgorithm requires a Generator callback. AsyncIterable, workers,
   scheduling, layout and DOM lifecycle helpers are outside the current contract.
   No evidence from this audit requires adding them before 1.0.

## Verification gaps to close

- The packed consumer exercises representative APIs, but does not assert the
  complete runtime namespace. Add an explicit export inventory check to catch
  accidental removals and additions before a release.
- /core rejection is tested; also verify rejection of root and private subpaths
  from the installed tarball, rather than relying only on package.json inspection.
- Compile a headless consumer with lib ES2022 (without DOM) using /playback,
  /scene and /array. Existing fixtures use the default DOM library, so their
  success alone does not establish this separation.
- After internal type renaming, compile imports of every public type from the
  installed package. Check the renderer alias remains the same function and both
  names accept the same palette options.

## Compatibility assessment

No required breaking API change was identified. Internal Array* naming and
preferred renderer naming are declaration cleanup; explicit undefined support
widens an existing type to match runtime. Retain snapshot shapes, event names,
terminal semantics, index preservation and renderer behavior.

This audit inspected local code and declarations. It does not certify a future
candidate's CI, website integration, browser FPS or publication status.
