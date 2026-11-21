import { createTreeTrace, treeScene, type TreeSnapshot, type TreeEvent } from '@grundyjs/algiviz/tree';
import { createArrayTrace, type ArraySnapshot, type ArrayEvent } from '@grundyjs/algiviz/array';
import { createArrayRenderer } from '@grundyjs/algiviz/canvas';
import {createGridTrace, gridScene, type GridSnapshot, type GridEvent} from '@grundyjs/algiviz/grid';
import { Player, type PlayerOptions, type PlayerStepHistoryOptions, type PlayerStatus, type PlayerLabels, type PlayerCloseResult } from '@grundyjs/algiviz/player';
import type { Frame } from '@grundyjs/algiviz/playback';
import { createGraphTrace, graphScene, type GraphSnapshot, type GraphEvent } from '@grundyjs/algiviz/graph';

if (typeof Player !== 'function') throw new Error('Player entry must import without DOM globals');
export type PublicPlayerTypes = [PlayerOptions<{ x: number }>, Player<{ x: number }>, PlayerStatus, PlayerLabels, PlayerCloseResult];

export function checkGraphPlayerTypes(host: HTMLElement) {
    function* steps() {
        const trace = createGraphTrace({ nodes: [{ id: 'A', data: 1 }], edges: [] });
        yield trace.start(); yield trace.done({ result: { nodeIds: ['A'] } });
    }
    const player = new Player(host, { stepSource: steps, isTerminal: step => step.event.type === 'done',
        rewindCapacity: 8, render(frame) {
            const state: GraphSnapshot<number> = frame.current;
            const event: GraphEvent = frame.event;
            graphScene(state, { namespace: 'player' }); void event;
            // @ts-expect-error Graph payload inference is retained by Player.
            const bad: string = state.graph.nodes[0]!.data!; void bad;
        } });
    const frame: Frame<GraphSnapshot<number>,GraphEvent> | null = player.frame; void frame;
    player.previous(); player.restart(); player.dispose();
}

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

export function checkStepPlayerTypes(host: HTMLElement, legacy: PlayerOptions<number>) {
    const p = new Player(host, { stepSource: function* () { yield { index: 0, state: { x: 1 }, event: { done: true } }; },
        isTerminal(step) { const x: number = step.state.x; return step.event.done && x > 0; },
        render(frame) { const event: boolean = frame.event.done; const x: number = frame.current.x; void event; void x; } });
    const frame: Frame<{ x: number }, { done: boolean }> | null = p.frame;
    const old: Player<number> = new Player(host, legacy); void old; void frame;
    new Player<number, string | undefined>(host, { source: () => [1], render() {} });
    // @ts-expect-error An event type excluding undefined cannot use state-only sources.
    new Player<number, string>(host, { source: () => [1], render() {} });
    // @ts-expect-error never must not bypass the state-only branch constraint.
    new Player<number, never>(host, { source: () => [1], render() {} });
    // @ts-expect-error Explicit steps require isTerminal.
    new Player(host, { stepSource: () => [{ index: 0, state: 1, event: true }], render() {} });
    // @ts-expect-error The predicate is exclusive to stepSource.
    new Player(host, { source: () => [1], isTerminal: () => true, render() {} });
    // @ts-expect-error Factories remain mutually exclusive.
    new Player(host, { stepSource: () => [], history: () => [1], isTerminal: () => true, render() {}, stepDurationMs: 1 });
    // @ts-expect-error A predicate cannot return a promise.
    new Player(host, { stepSource: () => [{ index: 0, state: 1, event: true }], isTerminal: async () => true, render() {} });
    // @ts-expect-error Async-only step iterables are outside this contract.
    new Player(host, { stepSource: async function* () { yield { index: 0, state: 1, event: true }; }, isTerminal: () => true, render() {} });
}

export function checkDirectArrayRenderer(host: HTMLElement, ctx: CanvasRenderingContext2D) {
 const renderer = createArrayRenderer({ theme: 'light' });
 const widget = new Player(host, { stepSource: function* () { const a = createArrayTrace([3,1]); yield a.start(); yield a.done(); },
 isTerminal: step => step.event.type === 'done', render: frame => renderer.render(ctx, frame) });
 const frame: Frame<ArraySnapshot, ArrayEvent> | null = widget.frame; void frame;
}

export function readLegacyHistory(options: PlayerOptions<number>) {
    if (options.source !== undefined || options.asyncSource !== undefined || options.stepSource !== undefined) return;
    return options.history();
}

export function checkLegacyPlayerExhaustiveness(options: PlayerOptions<number>) {
    if (options.source !== undefined || options.asyncSource !== undefined ||
        options.stepSource !== undefined || options.history !== undefined) return;
    const exhaustive: never = options;
    return exhaustive;
}

export function checkLegacyPlayerConstructor(options: PlayerOptions<number>) {
    type ConstructorOptions = ConstructorParameters<typeof Player<number, undefined>>[1];
    const extracted: ConstructorOptions = options;
    const original: PlayerOptions<number> = extracted;
    return original;
}

export function checkStepHistoryPlayerTypes(host: HTMLElement, ctx: CanvasRenderingContext2D) {
    function* steps() {
        const trace = createArrayTrace([3, 1]);
        yield trace.start();
        yield trace.swap(0, 1);
        yield trace.done();
    }
    const stepHistory = () => Object.freeze(Array.from(steps()));
    const renderer = createArrayRenderer({ theme: 'light' });
    const recording = new Player(host, {
        stepHistory, stepDurationMs: 100, stepSource: undefined, history: undefined,
        render(frame) {
            renderer.render(ctx, frame);
            const event: ArrayEvent = frame.event;
            // @ts-expect-error The event type cannot collapse to undefined.
            const missing: undefined = frame.event;
            void event; void missing;
        },
    });
    const frame: Frame<ArraySnapshot, ArrayEvent> | null = recording.frame;
    recording.seek(50); recording.restart(); recording.dispose(); void frame;
    const explicit: PlayerStepHistoryOptions<ArraySnapshot, ArrayEvent> = {
        stepHistory, stepDurationMs: 100, render: frame => renderer.render(ctx, frame),
    };
    const typedRecording: Player<ArraySnapshot, ArrayEvent> = new Player(host, explicit);
    // @ts-expect-error The legacy options remain a closed union.
    const legacy: PlayerOptions<ArraySnapshot, ArrayEvent> = explicit;
    typedRecording.dispose(); void legacy;
    new Player(host, { history: () => [1], stepHistory: undefined, stepDurationMs: 100,
        render(frame) { const event: undefined = frame.event; void event; } });
    // @ts-expect-error Full step history requires timing.
    new Player(host, { stepHistory, render() {} });
    // @ts-expect-error Full step history requires an array, not an arbitrary iterable.
    new Player(host, { stepHistory: steps, stepDurationMs: 100, render() {} });
    // @ts-expect-error The last recorded step is terminal, with no predicate.
    new Player(host, { stepHistory, isTerminal: () => true, stepDurationMs: 100, render() {} });
    // @ts-expect-error Rewind windows apply to streams.
    new Player(host, { stepHistory, rewindCapacity: 2, stepDurationMs: 100, render() {} });
    // @ts-expect-error Source work budgets apply to streams.
    new Player(host, { stepHistory, maxStepsPerFrame: 2, stepDurationMs: 100, render() {} });
    // @ts-expect-error Histories are mutually exclusive.
    new Player(host, { stepHistory, history: () => [1], stepDurationMs: 100, render() {} });
}

export function checkTreePlayer(host: HTMLElement) {
 const widget = new Player(host, { stepSource: function* () { const t = createTreeTrace({kind:"binary",rootId:"A",nodes:[{id:"A",data:2}],links:[]},{layout:[{nodeId:"A",x:0,y:0}]}); yield t.start(); yield t.done({result:{nodeIds:["A"]}}); }, isTerminal: s => s.event.type === "done", render(frame) { const n:number|undefined=frame.current.tree.nodes[0]?.data; treeScene(frame.current,{namespace:"player"}); void n; } });
 const frame: Frame<TreeSnapshot<number,unknown,"binary">,TreeEvent>|null=widget.frame; void frame;
}

export function checkGridPlayerTypes(host: HTMLElement) {
    function* steps() { const trace=createGridTrace({rows:1,columns:1,values:[1]});yield trace.start();yield trace.done({result:{path:[{row:0,column:0}]}}); }
    const player=new Player(host,{stepSource:steps,isTerminal:s=>s.event.type==='done',rewindCapacity:4,render(frame){
        const state:GridSnapshot<number>=frame.current;const event:GridEvent=frame.event;
        gridScene(state,{namespace:'grid-player'});void event;
        // @ts-expect-error inferred grid payload stays numeric
        const bad:string=state.grid.values[0]!;void bad;
    }});player.previous();player.restart();player.dispose();
}
