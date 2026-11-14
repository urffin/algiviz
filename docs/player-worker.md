# Worker sources in Player

[Русский](ru/player-worker.md) · [Player](player.md) · [Worker API](worker-source-api.md)

**Added in 0.16.0, 2026-11-14.** Version 0.15.0 has no
Worker entries. Pass `createWorkerSourceFactory` directly as `asyncSource`.
The existing Player controller and types already support this boundary; there
is no additional source option, phase, command or implicit Worker import.

## Connect a source

The application owns the Worker module URL, algorithm and drawing. The host
factory must create a fresh dedicated module Worker for every session. Mounting
Player does not call it; Start creates the first session. The endpoint uses
`exposeWorkerSource` as shown in the [Worker API examples](worker-source-api.md#application-example).

```ts
import { Player } from '@grundyjs/algiviz/player';
import { createWorkerSourceFactory } from '@grundyjs/algiviz/worker';

interface Init { readonly count: number }
interface State { readonly step: number; readonly values: ArrayBuffer }

export function mount(container: HTMLElement, draw: (state: State) => void) {
    const factory = createWorkerSourceFactory<State, Init>({
        worker: () => new Worker(new URL('./states.worker.js', import.meta.url), { type: 'module' }),
        input: () => ({ count: 100 }),
        shutdown: { gracePeriodMs: 1000 },
    });
    return new Player(container, {
        asyncSource: factory,
        render(frame) { draw(frame.current); },
        stepDurationMs: 200,
        rewindCapacity: 32,
        maxStepsPerFrame: 4,
    });
}
```

Omit `stepDurationMs` for manual Next-only playback. `rewindCapacity` retains
only the configured window; the Worker does not rerun when replaying it. States
transferred to the host remain readable through rewind, Restart and disposal.
Worker algorithms must allocate fresh buffers for subsequent states instead of
mutating or transferring storage that has already been sent.

## Controls and lifecycle

| Action | Behavior with a Worker source |
| --- | --- |
| Start | Waits for the first state with `waiting` and `preparing: 'start'`; controls remain unavailable until preparation finishes. Installs the first frame paused. |
| Next | Requests one state when needed; repeated commands share the pending read. A staged result is consumed without another pull. An unfinished timed transition is completed first. |
| Pause | Changes playback intent without aborting the Worker or the pending read. A late value or EOF stays staged until Next/Play. Errors still stop the failed session. Manual pending Next exposes Pause through `canPause`. |
| Play / data stall | `waiting` exposes missing data, without RAF polling. The playback clock drops waiting time; arrival starts a new transition at zero progress. |
| Restart / Replay | Prepares one fresh candidate before retiring the old session. Old arrivals are quarantined. Candidate failure restores the usable old session; success waits for its cleanup before installation. Restart installs paused; Replay autoplays only if its intent remains current. At most two Workers are owned. |
| dispose | Removes UI/listeners/timers synchronously, restores the viewport and preserves the last drawing. Cancels all owned sessions, including a candidate. `closed` waits for their shutdown and UI cleanup; no later render/status/error callbacks occur. |

After the finite shutdown grace period, an unresponsive Worker is terminated.
Forced shutdown alone permits replacement; it is not an actual cleanup error.
If retiring the old source reports a real cleanup failure, Player closes the
candidate, preserves the readable drawing and reports an error. A retired old
source is never resumed. Per-frame budgeting bounds requests, not the duration
of a Worker step, host cloning or rendering.

## Observe transport completion

`ui.closed` is the existing `Promise<PlayerCloseResult>`. Its source reports
describe the async adapter lifecycle; they do not include Worker termination
metadata. To observe forced/acknowledged shutdown, wrap the factory and observe
each returned session's separate, never-rejecting `closed` promise:

```ts
import { Player } from '@grundyjs/algiviz/player';
import { createWorkerSourceFactory, type WorkerSourceCloseResult } from '@grundyjs/algiviz/worker';

export function mountObserved(container: HTMLElement, onClosed: (report: WorkerSourceCloseResult) => void) {
    const factory = createWorkerSourceFactory<number>({
        worker: () => new Worker(new URL('./numbers.worker.js', import.meta.url), { type: 'module' }),
        input: () => undefined,
    });
    return new Player(container, {
        asyncSource(signal) {
            const session = factory(signal);
            // The application callback must not throw; handle its errors locally.
            void session.closed.then(onClosed);
            return session;
        },
        render(frame) { container.dataset.step = String(frame.current); },
    });
}
```

Observe each session as it completes instead of retaining an unbounded lifetime
journal. Cancellation reaches the Worker as a bounded clone-safe reason. Actual
remote failures use `WorkerSourceError`; cleanup diagnostics and termination
kind remain separate. See the [Worker contract](worker-source.md).

## Verification

On 2026-11-14, **304 repository tests passed**, including **11 Player/Worker
integration cases** in [the controlled suite](../test/player-worker.test.mjs).
Those cases also passed against a fresh installed local archive with strict
unhandled-rejection handling. Strict TypeScript 5.0.4/6.0.3 consumers passed
NodeNext/Bundler: direct factory compatibility, inferred State, unchanged
synchronous commands, separate close reports and mutually exclusive sources.
ES2022-only headless and separate DOM/WebWorker declarations still pass.

Installed-package ESM bundle checks cover joint deferred loading of Player and
the host Worker adapter; initial/old graphs exclude both, and the UI graph does
not import Worker code. The runtime endpoint remains separate from the host.

The built-in browser passed **25/25 native checks** using dedicated module
Workers: 23 automated cases, actual Enter activation of Start/Next/Pause, and
final disposal. The [report](checks/player-worker-browser-2026-11-14.json)
records 31 source/build/fixture SHA-256 hashes, zero unexpected errors, a maximum
of two owned Workers, and zero remaining Workers/RAF. The separate standalone
[20-case report](checks/worker-source-browser-2026-11-14.json) covers native
copying, transfer, serialization and forced CPU-loop shutdown.

Repeat with `npm test`, `npm run test:package -- --resolution=all`,
`npm run test:package -- --typescript=5.0.4 --resolution=all`, and
`npm run test:bundle`. After building, `node scripts/serve-worker.mjs --player`
prints the local native-check URL. Run its automatic checks, follow the displayed
keyboard sequence, dispose, permit cleanup and save the report. This verifies a
local build, not a published release, performance or all browser versions.
