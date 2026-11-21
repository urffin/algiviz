# AlgiViz 1.7.0 readiness review

[Русский](ru/readiness-1.7.md) · [Current API](current-api.md) · [Compatibility policy](api-compatibility.md#types-and-extensibility)

**Historical review from November 22, 2026.** The compatibility blocker
was resolved while the working package still carried version 1.6.0.
The checklist below describes that stage. [1.7.0 release notes](release-1.7.md).

## Original compatibility finding

The initial build added a fifth variant to the existing closed
`PlayerOptions<State, Event>` union. The following consumer compiles
with the published 1.6.0 declarations.

```ts
import type { PlayerOptions } from '@grundyjs/algiviz/player';

function readHistory(options: PlayerOptions<number>) {
  if (options.source !== undefined || options.asyncSource !== undefined ||
      options.stepSource !== undefined) return;
  return options.history();
}
```

With the initial declarations, `history` could be undefined after those checks
(`TS2722`). An exhaustive check after the four original branches also
fails (`TS2322`). Both results were reproduced with TypeScript 6.0.3 in
NodeNext and Bundler, using the declarations from the registry archive
verified against the [1.6.0 publication receipt](releases/1.6.0.json).
U3 requires preserving these existing consumer patterns in a minor.

## Resolution

The implementation keeps the four variants of `PlayerOptions` and adds
`PlayerStepHistoryOptions` with a separate constructor overload. Legacy
options accept explicit `stepHistory: undefined`. The legacy overload is
last, so `ConstructorParameters` continues to expose those options.
The permanent consumer tests cover the original narrowing, exhaustive
handling and inference from the new factory.

## API, examples and documentation

- The factory validates the full array before rendering. Frames retain the
  destination step's event and original index. A failed Restart keeps the
  previous recording, position, frame and speed. Legacy state-only history
  continues to yield `undefined` for `frame.event`.
  [Player reference](player.md#full-history-of-steps).
- Bubble sort passes its recorded frame directly to the stock Canvas
  renderer. Eight native checks cover two yellow bars during the transition,
  repeat seeking and Restart. The heap example passed 44 native checks at
  390 and 960 CSS pixels. It retains `extract-swap` on the Player frame and
  `swap` in the array snapshot. The array and tree rewind and restart
  together. Both examples passed their focused tests after the type fix,
  and all 73 compiled JavaScript files matched the preceding native build
  byte for byte. [Array check](../test/step-history-array-browser.html) ·
  [Heap check](../test/heap-player-browser.html).
- The implementation and examples passed 808 repository tests. The
  installed working archive passed 531 tests and strict consumers with
  TypeScript 6.0.3 in both resolutions. Bundle isolation passed.
  The Player consumer also passed with TypeScript 5.0.4 in NodeNext and Bundler.
- Both READMEs and EN/RU references identify `stepHistory` as part of the
  repository build. The initial review checked the two README files and
  changelog against the working archive and resolved 322 repository links
  and anchors. The exact 1.7.0 archive needs its own documentation check.

## Remaining release steps

1. Set 1.7.0 in the manifest and lockfile, finalize both READMEs, changelog
   and EN/RU release notes and references. Build and install the exact archive
   and check its README files, changelog, version, exports and links before tagging.
2. Push the verified release commit and await all eleven CI jobs on its SHA.
3. With publication authorized, create the tag and GitHub Release. Verify
   exact npm version, latest, provenance and registry README, then record
   the results in the EN/RU release documentation.
