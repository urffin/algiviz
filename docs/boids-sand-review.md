# Boids and falling-sand review — 2026-11-12

Reviewed the pending examples and shared demo-controller changes after completing
the [lifecycle and Sorting lab checks](browser-checks-2026-11-12.md).
No blocking product failure was found within the scope below.

## Code and automated checks

- Checkout HEAD: `7d0e50bc7299c336634c8fd420e08ee833d1547f`. Boids, sand,
  their tests, catalog entries and shared controller changes were uncommitted.
  The library `src`, public exports and package version remained unchanged.
- Both simulations, object types, projections and renderers belong to the
  examples. They use public `/playback` and `/scene` APIs. The shared controller
  accepts per-example timing and exposes `pause()`; existing timing defaults
  remain covered by the controller regression test.
- `npm test` passed **145 tests**, including eight Boids tests, nine sand tests
  and both default/custom-timing shared-controller cases. Coverage includes
  deterministic immutable snapshots, stable IDs, inspection predictions,
  history/generator parity, seeking, early source closure and finite rendering.
  Sand also covers conservation, competing proposals, gate drainage and brush
  path clipping; Boids covers wrapped neighbors, all presets/rule combinations
  and synchronous updates.
- `npm run test:package` passed with the pinned TypeScript 6.0.3 consumer check.
  This verifies the current local tarball; it is not an npm publication.
- [CI 43161867906](https://github.com/urffin/algiviz/actions/runs/43161867906)
  passed for the documentation commit above. It does **not** cover these
  uncommitted examples or replace their future exact-commit CI check.
- Added the missing falling-sand catalog row to the Russian README to match
  the English README and both example catalogs.

## Embedded-browser checks

Used the same Windows embedded Chromium host as the lifecycle follow-up, a local
HTTP server and the fresh local build. One agent-created tab was reused and
closed afterward. Native desktop browsers were not used.

| Area | Observed result |
| --- | --- |
| Boids stepping and inspection | Next/Previous worked. The next velocity displayed for bird #1 at tick 0 exactly matched its displayed current velocity at tick 1. Selecting a bird retained the tick; enabling inspection during playback paused it. |
| Boids configuration | Applying seed 42, the gate preset and disabled alignment restarted at tick 0 with the chosen settings. An invalid seed retained the loaded configuration and tick. |
| Boids completion and generator | Playback reached tick 600 and Replay. A 100-bird generator advanced one tick, disabled Previous/seek and showed max 192. Switching it to history was rejected and retained generator mode and tick. |
| Sand inspection and history | Selecting grain #1 showed its neighborhood and next decision. Next reached tick 1; Previous restored the original neighborhood. |
| Sand gate and restart | Opening the gate retained 320 grains, reset the history to tick 0 and disabled the gate button. Restart retained the edited, open gate. |
| Sand brushes | A central 3 × 3 brush added nine grains. Erasing removed them. A wall painted on empty cells blocked adding sand there; erasing the wall allowed nine grains again. |
| Sand completion | A five-tick scene with nine grains reached its final state and the Replay button without losing grains. |
| Sand generator and validation | A 513-grain generator played/paused, disabled Previous/seek and showed max 2000. History rejection and an invalid seed retained its current tick and scene. Restart followed by Next reached tick 1. |
| Console | No warning/error entries were returned for either example. Expected validation errors appeared in the page. |

Sixteen observation records and screenshots were saved in the task's local
`browser-checks-2026-11-12` artifacts, including `boids-sand-result.json`,
`boids-inspector.jpg` and `sand-inspector.jpg`. Source hashes accompany them.
Visual inspection confirmed the scenes and explanatory panels were legible at
the tested desktop viewport. This is not a responsive-layout or accessibility
audit. Continuous drag paths were covered by unit tests; the UI brush check used
single clicks. No browser FPS, heap threshold or maximum-size performance claim
is made.

## Next step

The reviewed changes were committed and pushed at
[`273b292`](https://github.com/urffin/algiviz/commit/273b292a6fa01dfaeb1717b6bbb7a4b149b4e6c9).
[CI 43163212052](https://github.com/urffin/algiviz/actions/runs/43163212052)
passed all ten Node/TypeScript jobs for that exact commit, including the
145-test suite in all six Node/OS jobs. This closes the commit/CI step recorded
above; the earlier working-copy observations remain dated evidence.
The examples require no new library API or release. The support boundary and
long-term compatibility decision are tracked in the [stabilization plan](api-stability.md).
