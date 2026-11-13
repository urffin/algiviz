import { createArrayTrace, defineArrayAlgorithm, createArrayPlayer, createArrayTimeline, type SortedRegions } from "@grundyjs/algiviz/array";
import { arrayScene, createArrayRenderer } from "@grundyjs/algiviz/canvas";
import { createSceneRenderer, type Scene } from "@grundyjs/algiviz/scene";
import { createPlayer, createTimeline, createRewindBuffer, type RewindBuffer, type Step } from "@grundyjs/algiviz/playback";
import { createAsyncSource, type AsyncSourceSignal } from "@grundyjs/algiviz/playback";

function check(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message);
}
const nativeAbort = new AbortController();
let asyncFinally = 0;
const asyncSource = createAsyncSource(async function* (signal) {
    const unsubscribe = signal.subscribe(reason => nativeAbort.abort(reason));
    try { yield { x: 7 }; } finally { unsubscribe(); asyncFinally++; }
});
const firstAsyncRead = asyncSource.next();
check(firstAsyncRead === asyncSource.next(), 'Installed async reads do not coalesce');
const firstAsyncState = await firstAsyncRead;
check(firstAsyncState.kind === 'value' && firstAsyncState.value.x === 7, 'Installed async state failed');
asyncSource.dispose('consumer finished');
check(nativeAbort.signal.aborted && nativeAbort.signal.reason === 'consumer finished', 'AbortController bridge failed');
const asyncClosed = await asyncSource.closed;
check(asyncClosed.kind === 'disposed' && asyncClosed.cleanupErrors.length === 0 && asyncFinally === 1, 'Async cleanup failed');
function checkPlatformSignal(signal: AsyncSourceSignal) {
    // @ts-expect-error DOM-free source signals require an explicit platform bridge.
    const native: AbortSignal = signal;
    void native;
}
void checkPlatformSignal;
const optionalMarkers: SortedRegions = { sortedPrefixLength: undefined, sortedSuffixLength: undefined };
const arrayTrace = createArrayTrace([2, 1]);
arrayTrace.start({ sortedPrefixLength: 1, sortedSuffixLength: 1 });
arrayTrace.select(0, optionalMarkers);
for (const [operation, args] of [
    [arrayTrace.swap, ['held', 1]], [arrayTrace.swap, [1, 'held']],
    [arrayTrace.shift, ['held', 0]], [arrayTrace.shift, [1, 'held']],
] as const) {
    let rejected = false;
    try { Reflect.apply(operation, undefined, args); } catch (error) { rejected = error instanceof RangeError; }
    check(rejected, 'Installed array operation accepted a non-numeric position');
}
const restored = arrayTrace.insert(0, optionalMarkers);
check(restored.index === 2 && restored.state.writes === 1, 'Rejected operation changed counters/index');
check(restored.state.slots.map(item => item?.id).join() === 'item-0,item-1', 'Rejected operation lost identities');
check(restored.state.sortedPrefixLength === 1 && restored.state.sortedSuffixLength === 1, 'Undefined markers changed regions');
arrayTrace.done(optionalMarkers);
const reverse = defineArrayAlgorithm(function* (array) {
    yield array.start();
    for (let i = 0; i < Math.floor(array.length / 2); i++) yield array.swap(i, array.length - i - 1);
    yield array.done();
});
const timing = { stepDurationMs: 100, finalHoldMs: 0 };
const history = createArrayTimeline(reverse.steps([1, 2, 3]), timing);
const lazy = createArrayPlayer(reverse.iterate([1, 2, 3]), timing);
lazy.advance(history.durationMs);
check(lazy.finished, "Array player did not finish");
check(JSON.stringify(lazy.frame) === JSON.stringify(history.sample(history.durationMs)), "Playback modes disagree");
check(lazy.frame.current.slots.map(item => item?.value).join() === "3,2,1", "External algorithm failed");
check(arrayScene(lazy.frame.current).objects.length === 3, "Array scene adapter failed");
check(typeof createArrayRenderer({ theme: "dark" }).render === "function", "Canvas export failed");
lazy.dispose();

interface Objects { badge: { x: number; label: string } }
const steps: Step<Scene<Objects>, "move" | "done">[] = [
    { index: 0, state: { objects: [{ id: "a", type: "badge", data: { x: 0, label: "A" } }] }, event: "move" },
    { index: 1, state: { objects: [{ id: "a", type: "badge", data: { x: 10, label: "A" } }] }, event: "done" }
];
const renderer = createSceneRenderer<Objects, number[], "move" | "done">({
    badge(output, object) {
        const from = (object.previous ?? object.current)!.data;
        const to = (object.current ?? object.previous)!.data;
        output.push(from.x + (to.x - from.x) * object.progress);
        // @ts-expect-error Custom object data stays narrowed in the installed declarations.
        to.missing;
    }
});
const output: number[] = [];
const player = createPlayer(steps, {
    ...timing, isTerminal: step => step.event === "done",
    render: frame => renderer.render(output, frame)
});
player.advance(50);
check(output.at(-1) === 5, "Custom visualization interpolation failed");
const timeline = createTimeline(steps, timing);
renderer.render(output, timeline.sample(50));
check(output.at(-1) === 5, "Scene seeking failed");
player.dispose();

import { createSceneProjector } from '@grundyjs/algiviz/scene';
const project = createSceneProjector((value: { view: Scene<Objects> }) => value.view);
const projectedFrame = project({ previous: { view: steps[0]!.state }, current: { view: steps[1]!.state }, event: 'move' as const, progress: 0.5, stepIndex: 1 });
renderer.render(output, projectedFrame);
check(output.at(-1) === 5, 'Installed scene projector failed');

const { createStepEmitter } = await import("@grundyjs/algiviz/playback");
const { createStatePlayer } = await import("@grundyjs/algiviz/playback");
const statesPlayer = createStatePlayer([{ x: 1 }, { x: 2 }]);
const stateX: number = statesPlayer.nextStep().current.x;
const stateEvent: undefined = statesPlayer.frame.event;
const rewind: RewindBuffer<{ x: number }> = createRewindBuffer([{ x: 1 }, { x: 2 }, { x: 3 }], { capacity: 2 });
check(rewind.current.x === 1 && rewind.position === 0, 'Rewind initial value failed');
check(rewind.next().x === 2 && rewind.previous().x === 1, 'Rewind backward failed');
check(rewind.next().x === 2 && rewind.next().x === 3 && rewind.startPosition === 1, 'Rewind window failed');
check(rewind.next().x === 3 && rewind.sourceEnded && !rewind.canNext, 'Rewind exhaustion failed');
check(rewind.previous().x === 2 && rewind.canNext, 'Rewind replay after exhaustion failed');
rewind.dispose();
check(Number(rewind.current.x) === 2 && !rewind.canNext && !rewind.canPrevious, 'Rewind disposal failed');
void stateX; void stateEvent;
statesPlayer.dispose();
const emitStep = createStepEmitter(() => Object.freeze({ count: 1 }));
const emittedStep = emitStep("done");
check(emittedStep.index === 0 && emittedStep.state.count === 1 &&
    emittedStep.event === "done" && Object.isFrozen(emittedStep), "Step emitter export failed");

import { createSortRenderer, type ArrayObjects, type ArrayPalette, type ArrayPaletteOverrides, type ArrayRendererOptions } from '@grundyjs/algiviz/canvas';
const typedObjects: Scene<ArrayObjects> = arrayScene(lazy.frame.current);
check(typedObjects.objects.length === 3, 'ArrayObjects public type failed');
const fallbackColors: ArrayPaletteOverrides = { bar: undefined };
createArrayRenderer({ theme: 'dark', colors: fallbackColors });
createSortRenderer({ theme: 'light', colors: fallbackColors });
const palette: ArrayPalette = {background:'white',text:'black',bar:'gray',sorted:'green',active:'orange',held:'purple'};
const paletteOverrides: ArrayPaletteOverrides = { active: palette.active };
const paletteOptions: ArrayRendererOptions = { theme: 'light', colors: paletteOverrides };
check(typeof createArrayRenderer(paletteOptions).render === 'function', 'Palette options failed');
const noColors: ArrayRendererOptions = { theme: 'dark', colors: undefined };
createArrayRenderer(noColors);
createSortRenderer({ theme: 'light', colors: undefined });
for (const factory of [createArrayRenderer, createSortRenderer]) {
    let rejected = false;
    try { Reflect.apply(factory, undefined, [{ theme: 'invalid' }]); }
    catch (error) { rejected = error instanceof TypeError; }
    check(rejected, 'Installed renderer accepted an invalid theme');
}
let canvasDraws = 0;
const canvasContext = {
    canvas: { width: 800, height: 450 }, save() {}, restore() {}, setTransform() {},
    fillRect() { canvasDraws++; }, fillText() { canvasDraws++; }
} as unknown as CanvasRenderingContext2D;
let progressRejected = false;
try { createArrayRenderer(noColors).render(canvasContext, { ...lazy.frame, progress: NaN }); }
catch (error) { progressRejected = error instanceof RangeError; }
check(progressRejected && canvasDraws === 0, 'Installed renderer drew an invalid frame');
createArrayRenderer(noColors).render(canvasContext, lazy.frame);
check(canvasDraws > 0, 'Installed renderer did not draw a valid frame');
