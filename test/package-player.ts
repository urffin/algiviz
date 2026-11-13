import { Player, type PlayerOptions, type PlayerStatus, type PlayerLabels, type PlayerCloseResult } from '@grundyjs/algiviz/player';
import type { Frame } from '@grundyjs/algiviz/playback';

if (typeof Player !== 'function') throw new Error('Player entry must import without DOM globals');
export type PublicPlayerTypes = [PlayerOptions<{ x: number }>, Player<{ x: number }>, PlayerStatus, PlayerLabels, PlayerCloseResult];

// Compiled against the installed package, without executing any DOM operations in Node.
export function checkPlayerTypes(host: HTMLElement, viewport: HTMLCanvasElement) {
    // @ts-expect-error The public entry is a constructor, not a factory function.
    Player(host, { source: () => [1], render() {} });
    const widget = new Player(host, {
        viewport, source: function* () { yield { x: 1, label: 'A' }; },
        render(frame) {
            const x: number = frame.current.x;
            const label: string = frame.previous.label;
            // @ts-expect-error State inference must retain the actual source shape.
            frame.current.missing;
            // @ts-expect-error This player does not manufacture events.
            const event: string = frame.event;
            void x; void label;
        },
        stepDurationMs: undefined, finalHoldMs: undefined, autoHide: undefined, seekBar: undefined, rewindCapacity: 3, maxStepsPerFrame: 2,
        labels: { start: 'Начать', pause: undefined }, onStatus: undefined, onError: undefined,
    });
    const frame: Frame<{ x: number; label: string }, undefined> | null = widget.frame;
    const status: PlayerStatus = widget.next();
    const windowStart: number | null = status.rewindStartIndex;
    const windowEnd: number | null = status.rewindEndIndex;
    widget.previous(); void windowStart; void windowEnd;
    // @ts-expect-error Status is read-only.
    status.phase = 'playing';
    // @ts-expect-error The returned frame keeps the inferred state type.
    const wrong: string = widget.frame!.current.x;
    const recording: PlayerOptions<{ x: number }> = {
        history: () => Object.freeze([{ x: 0 }, { x: 1 }]), source: undefined,
        render() {}, stepDurationMs: 1000, seekBar: false, labels: undefined,
    };
    const second: Player<{ x: number }> = new Player(host, recording);
    second.seek(50); second.previous(); second.setSpeed(2); second.dispose(); widget.dispose();
    void frame;
    // @ts-expect-error Exactly one source factory is required.
    new Player(host, { source: () => [1], history: () => [1], render() {}, stepDurationMs: 100 });
    // @ts-expect-error Recording timing is mandatory.
    new Player(host, { history: () => [1], render() {} });
    // @ts-expect-error A bounded rewind window is a stream option, not a recording option.
    new Player(host, { history: () => [1], stepDurationMs: 100, rewindCapacity: 3, render() {} });
    // @ts-expect-error Rewind capacity is numeric.
    new Player(host, { source: () => [1], rewindCapacity: '3', render() {} });
    // @ts-expect-error Work budgets apply to streams, not recorded timeline sampling.
    new Player(host, { history: () => [1], stepDurationMs: 100, maxStepsPerFrame: 2, render() {} });
    // @ts-expect-error The step budget is numeric.
    new Player(host, { source: () => [1], maxStepsPerFrame: '2', render() {} });
    new Player(host, { source: () => [1], maxStepsPerFrame: undefined, render() {} });
    // @ts-expect-error History is explicitly an array, not an iterable to collect.
    new Player(host, { history: function* () { yield 1; }, render() {}, stepDurationMs: 100 });
    // @ts-expect-error Only known label keys are accepted.
    new Player(host, { source: () => [1], render() {}, labels: { volume: 'Volume' } });
    // @ts-expect-error A DOM container is required for mounting.
    new Player({}, { source: () => [1], render() {} });
}

export function checkAsyncPlayerTypes(host: HTMLElement, oldLabels: PlayerLabels) {
    const widget = new Player(host, {
        asyncSource: async function* (signal) {
            const reason: unknown = signal.reason;
            const unsubscribe: () => void = signal.subscribe(value => { const error: unknown = value; void error; });
            // @ts-expect-error Cancellation belongs to the widget's source adapter.
            signal.aborted = true;
            try { yield { x: 1, label: 'A' }; } finally { unsubscribe(); }
            void reason;
        },
        source: undefined, history: undefined, rewindCapacity: 3, maxStepsPerFrame: 2,
        render(frame) {
            const x: number = frame.current.x;
            const label: string = frame.previous.label;
            const event: undefined = frame.event;
            // @ts-expect-error Async state inference retains its actual shape.
            const bad: string = frame.current.x;
            void x; void label; void event; void bad;
        },
        labels: { start: undefined, waiting: 'Waiting', preparing: undefined, cleanup: 'Closing' },
        onStatus(status) {
            const waiting: boolean = status.waiting;
            const preparation: 'start' | 'restart' | null = status.preparing;
            const cleanup: boolean = status.cleanupPending;
            const pause: boolean = status.canPause;
            // @ts-expect-error Status metadata is readonly.
            status.waiting = false;
            void waiting; void preparation; void cleanup; void pause;
        },
    });
    const inferred: Player<{ x: number; label: string }> = widget;
    const synchronous: PlayerStatus = widget.start();
    const closed: Promise<PlayerCloseResult> = widget.closed;
    new Player(host, { source: () => [1], asyncSource: undefined, render() {}, labels: oldLabels });
    new Player(host, { history: () => [1], asyncSource: undefined, render() {}, stepDurationMs: 100 });
    // @ts-expect-error Exactly one source capability is accepted.
    new Player(host, { source: () => [1], asyncSource: async function* () { yield 1; }, render() {} });
    // @ts-expect-error Async source and history are mutually exclusive.
    new Player(host, { history: () => [1], asyncSource: async function* () { yield 1; }, render() {}, stepDurationMs: 100 });
    // @ts-expect-error A synchronous iterable keeps the source option.
    new Player(host, { asyncSource: function* () { yield 1; }, render() {} });
    // @ts-expect-error Factory promises are not accepted.
    new Player(host, { asyncSource: async () => (async function* () { yield 1; })(), render() {} });
    // @ts-expect-error Commands remain synchronous.
    const readiness: Promise<PlayerStatus> = widget.restart();
    // @ts-expect-error No new phase literal is introduced.
    const phase: PlayerStatus['phase'] = 'waiting';
    // @ts-expect-error No new mode literal is introduced.
    const mode: PlayerStatus['mode'] = 'async';
    void inferred; void synchronous; void closed; void readiness; void phase; void mode;
}

export function checkCloseResult(report: PlayerCloseResult) {
    const count: number = report.errorCount;
    // @ts-expect-error The report is readonly.
    report.errorCount = 0;
    // @ts-expect-error The source reports are readonly.
    report.sources.push({});
    if (report.firstError !== null) {
        const phase: 'abort-listener' | 'return' | 'dispose' | 'onStatus' | 'onError' = report.firstError.phase;
        const error: unknown = report.firstError.error;
        void phase; void error;
    }
    for (const source of report.sources) {
        switch (source.kind) {
            case 'completed': break;
            case 'disposed': { const reason: unknown = source.reason; void reason; break; }
            case 'failed': { const error: unknown = source.error; void error; break; }
            default: { const exhaustive: never = source; return exhaustive; }
        }
    }
    void count;
}
