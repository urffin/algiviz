# Browser verification — 2026-11-06

Follow-up: the [2026-11-12 verification](browser-checks-2026-11-12.md) completed
the outstanding embedded-browser lifecycle and Sorting lab checks. The partial
results and tool failures below remain the historical record of this earlier run.

Baseline: AlgiViz 0.11.2, checkout `2fcffe98071a3df8f98f1878bc4d23909f4914bd`.
The local build was served over loopback HTTP. This was a local-build check,
not a browser installation from the registry tarball or a 1.0 candidate check.
No library source changes were made during this verification.

## Environment and scope

Embedded browser on Windows, reported user agent:

```text
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36
```

Native Canvas `filter` was present. This identifies the embedded Chromium host,
not a verified branded Chrome, Edge or Safari version.

The installed desktop binaries reported Chrome 156.0.8078.80, Edge 156.0.4314.58
and Firefox 133.0.3. Access to Chrome was rejected by the computer-use tool;
launch/window inspection of Edge timed out. The owner then explicitly limited
this pass to the embedded browser. None of those desktop products was tested;
neither were Safari, iOS or previous browser versions.

## Completed checks

| Page | Result | Evidence and limits |
| --- | --- | --- |
| [Browser smoke](../test/browser-smoke.html) | 6/6 groups passed | Plain states with mixed controls/exhaustion/disposal; explicit steps/timeline; custom SVG objects and cleanup; array adapters/palette; Canvas settings/progress; dense arrays/zero bitmap. No warning/error console entries were returned for this page. |
| [Minimal walkthrough](../examples/visualization-pipeline.html) | Passed interactive sequence | Initial blank Canvas and Start; first state at x=40; successive states 200/360/560; sequential code highlighting; visible disabled Next during processing. The extra click detects exhaustion, keeps x=560 and hides Next. Restart returns to Start. Console warning/error entries: none. |
| [Object lifecycle](../examples/object-lifecycle.html) | Partial interactive check | Observed A entering with presence 0.25, updates, A exiting with presence 0.75, and mixed advance/nextStep controls. Closing the source at progress 1 closed it once and disabled advance/next/dispose controls. See incomplete checks below. |

The minimal walkthrough deliberately delays its highlights. One UI wait reached
its tool deadline before the next position appeared; a fresh observation showed
x=200, and the remaining sequence completed correctly. This was not recorded as
a library failure.

## Incomplete checks and tool failures

- **Interactive preservation of pixels after early disposal:** not confirmed in
  this pass. An attempted screenshot comparison crossed from progress 0.25 to 1
  without closing the source, so it was not a valid disposal comparison. A
  subsequent click on the dispose control did close once at progress 1. Do not
  treat the earlier screenshot difference as a renderer regression or a passed
  preservation check. The scripted smoke's separate disposal check did pass.
- **Lifecycle restart and exhaustion after that interactive attempt:** not
  completed. The next interaction timed out and reset the tool session. Binding
  the existing tab and a lightweight browser reconnection also timed out and
  reset their sessions. The final page state after the interrupted action is
  unknown; it must be inspected before retrying.
- **Sorting lab controls:** not reached in this pass. Theme/custom colors while
  paused, history seeking, generator mode, validation and restart remain pending
  as interactive browser checks. Palette and dense rendering were exercised by
  the smoke groups, which do not replace these UI checks.
- **Lifecycle console:** not collected before the connection was lost. The
  empty console results above apply only to smoke and the minimal walkthrough.

Historical lifecycle browser checks from 2026-11-02 remain separate evidence;
they are not relabeled as a completed 0.11.2 run. No reproducible library defect
was found in the completed checks, but this pass does not close the browser gate.

## Next verification

1. Once the embedded-browser connection works, inspect/reload the lifecycle page,
   verify early disposal with unchanged Canvas pixels, restart and exhaustion.
2. Complete Sorting lab's interactive controls and collect console results.
3. Test the proposed branded desktop browsers only when access is available and
   the owner resumes that scope. Actual Safari/iOS and historical-version checks
   remain pending until their environments are available.

The [support matrix](support-matrix.md) retains these distinctions. Embedded
Chromium results do not automatically certify the other proposed targets.
