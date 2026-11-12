# Embedded-browser verification — 2026-11-12

Follow-up to the [interrupted 2026-11-06 check](browser-checks-2026-11-06.md).
The outstanding embedded-browser lifecycle and Sorting lab scenarios are now
complete. These results do not certify other browser products or versions.

## Environment and tested code

- Windows embedded Chromium, reported UA `Chrome/157.0.0.0`; native Canvas filter
  support was present. Maximum simultaneous agent-opened tabs: two; both closed
  after verification.
- Local HTTP server and a fresh TypeScript 6.0.3 build of AlgiViz 0.11.2.
- Checkout HEAD: `2fcffe98071a3df8f98f1878bc4d23909f4914bd`. Library `src` files
  were unchanged, but the working copy included uncommitted demo-player,
  player-settings and Sorting lab changes. This verifies those current demos,
  not an unchanged release checkout or a registry-tarball browser installation.
- No production code was changed for this check. Source hashes, DOM observations,
  console results and screenshots were saved in the task's local artifacts.
  Node/TypeScript release CI was not rerun for this browser-only task.

## Object lifecycle: completed

| Scenario | Observed result |
| --- | --- |
| Partial entry | A at state 1, progress 0.25, presence 0.25; two states yielded, zero closes. |
| Early dispose | Still state 1/progress 0.25, two states yielded and exactly one close. Advance/next/dispose disabled; restart remained enabled. |
| Preserved picture | The compared Canvas screenshot interior was identical before/after early disposal; see the method below. |
| Restart after dispose | Empty state 0, progress 1, one state yielded and zero closes for the new generator; controls enabled. |
| Subsequent states | Five manual requests reached state 5, with six states yielded. Empty intermediate scenes and later object C were reached without errors. |
| Exhaustion | One additional nextStep detected exhaustion: state 5 retained, one close, log ends with exhausted/closed, advancement controls disabled. |
| Console | No warning/error entries returned. |

### Screenshot comparison method

The first viewport crop covered different page areas after automatic scrolling;
it was discarded as a comparison. Full-page captures were then aligned using
the Canvas's document coordinates. The screenshot API returned JPEG data, so
matching file bytes or a filename extension would not be a raw bitmap check.

The decoded **891 × 261** interior region, inset four CSS pixels from the Canvas
rectangle, matched pixel-for-pixel. Differences in the original outer crop were
limited to the bottom three rows near the changing adjacent controls. This is
evidence of preserved visible drawing plus unchanged frame metadata, not a hash
comparison of the Canvas backing store or a promise of pixel-perfect output.

## Sorting lab: completed

Twenty-eight state observations cover these UI scenarios:

| Area | Observed result |
| --- | --- |
| History controls | Next/Previous stepped correctly; seeking to End finished and Home returned to zero. Play/Pause, restart, natural completion and Replay worked. |
| Palette | Light/dark presets, a custom background, palette reset and all six custom color inputs worked. Paused status and playback position were retained across palette updates. The custom-background screenshot was visually consistent with the configured color; screenshot RGB was one channel unit away due to JPEG capture, not used as an exact Canvas-color assertion. |
| Generator controls | Previous/seek disabled, max size 2000, unknown total duration. Switching back to valid history restored seeking/Previous and max size 64. |
| Generation and restart | Loaded 100 reverse-order elements in generator mode, stepped once, then restarted to state 0 with the loaded values preserved. |
| Invalid values | A nonnumeric token produced an error while retaining the previous loaded session, time and counters. |
| Invalid size/mode | Size 2001 was rejected without replacing the session. Switching the loaded 100-element array to history was rejected and left generator mode/session intact. |
| Algorithms and completion | Insertion history finished. Bubble sort of [3, 2, 1] finished in generator and history modes at step 9 with three comparisons and six writes in both. |
| Boundary inputs | Negative/duplicate values loaded successfully. An empty array loaded and completed with zero comparisons/writes. This is not a new exhaustive sorting-correctness proof. |
| Console | No warning/error entries returned. Expected input-validation errors appeared in the page's error area. |

## Smoke and outcome

The six [browser smoke groups](../test/browser-smoke.html) passed again in the
same host, with no warning/error console entries. The [minimal walkthrough](../examples/visualization-pipeline.html)
retains its separately recorded successful 2026-11-06 interactive check; it was
not relabeled as newly rerun here.

The requested embedded-browser checklist is complete and no reproducible product
failure was found. Chrome/Edge as desktop products, Firefox, Safari/iOS and
historical browser versions remain unverified. The broader proposed browser
matrix is therefore still a support-scope decision, not a completed certification.
See the [support matrix](support-matrix.md) and [stabilization plan](api-stability.md).
