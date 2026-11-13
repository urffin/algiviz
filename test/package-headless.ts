import { createPlayer, createStatePlayer, createTimeline, createStepEmitter, createRewindBuffer, type RewindBuffer, type Player, type Step, type Frame, type Timeline } from '@grundyjs/algiviz/playback';
import { createSceneFrame, createSceneProjector, createSceneRenderer, type SceneObject, type Scene, type ObjectTransition, type SceneFrame, type SceneVisualizations } from '@grundyjs/algiviz/scene';
import { createArrayTrace, defineArrayAlgorithm, createArrayPlayer, createArrayTimeline, type ArrayTrace, type ArrayAlgorithm, type SortedRegions, type Item, type ArrayEvent, type ArraySnapshot, type ArrayStep, type ArrayPlayer, type ArrayFrame, type ArrayTimeline } from '@grundyjs/algiviz/array';

// All headless exports must compile with lib ES2022 and no DOM or ambient types.
interface Objects { node: { x: number } }
export type PublicTypes = [Player<number,string>, Step<number,string>, Frame<number,string>, Timeline<number,string>,
    RewindBuffer<{ x: number }>,
    SceneObject<Objects>, Scene<Objects>, ObjectTransition<SceneObject<Objects>>, SceneFrame<Objects,string>,
    SceneVisualizations<Objects,number[],string>, ArrayTrace, ArrayAlgorithm, SortedRegions, Item,
    ArrayEvent, ArraySnapshot, ArrayStep, ArrayPlayer, ArrayFrame, ArrayTimeline];
const emit = createStepEmitter(() => 1);
const steps = [emit('done')];
const timing = { stepDurationMs: 100, finalHoldMs: 0 };
createPlayer(steps, { ...timing, isTerminal: step => step.event === 'done' }).dispose();
createTimeline(steps, timing).sample(0);
const statePlayer: Player<{ x: number }, undefined> = createStatePlayer([{ x: 1 }, { x: 2 }]);
const stateFrame: Frame<{ x: number }, undefined> = statePlayer.nextStep();
const event: undefined = stateFrame.event;
// @ts-expect-error Plain-state playback does not manufacture user events.
const userEvent: string = stateFrame.event;
// @ts-expect-error State inference must preserve the supplied object shape.
const wrongState: string = stateFrame.current.x;
statePlayer.advance(0); statePlayer.dispose();
createStatePlayer([1], { stepDurationMs: undefined, finalHoldMs: undefined }).dispose();
// @ts-expect-error RAF work budgeting does not alter the headless public options.
createStatePlayer([1], { maxStepsPerFrame: 1 });
const rewind: RewindBuffer<{ x: number }> = createRewindBuffer([{ x: 1 }, { x: 2 }], { capacity: 2 });
const rewindX: number = rewind.next().x;
const rewindPosition: number = rewind.position;
const rewindAvailable: boolean = rewind.canPrevious;
rewind.previous(); rewind.dispose();
// @ts-expect-error Value inference is preserved across backward navigation.
const rewindWrong: string = rewind.previous().x;
// @ts-expect-error Capacity is required.
createRewindBuffer([1], {});
// @ts-expect-error Asynchronous iteration is a separate future adapter.
createRewindBuffer((async function* () { yield 1; })(), { capacity: 2 });
void rewindX; void rewindPosition; void rewindAvailable;
createPlayer(steps, { isTerminal: () => true }).nextStep();
void event;
const scene: Scene<Objects> = { objects: [{id:'a',type:'node',data:{x:1}}] };
const project = createSceneProjector((state: Scene<Objects>) => state);
const frame = project({previous:scene,current:scene,progress:1,stepIndex:0,event:'done'});
createSceneFrame(frame);
createSceneRenderer<Objects,number[],string>({node(out, object) {
    const value = object.current ?? object.previous;
    if (value) out.push(value.data.x);
}}).render([],frame);
createArrayTrace([1]).start();
const optionalRegions: SortedRegions = { sortedPrefixLength: undefined, sortedSuffixLength: undefined };
const regionTrace = createArrayTrace([3, 2, 1]);
regionTrace.start(optionalRegions);
regionTrace.swap(0, 2, optionalRegions);
regionTrace.select(1, optionalRegions);
regionTrace.shift(0, 1, optionalRegions);
regionTrace.insert(0, optionalRegions);
regionTrace.pass(2, optionalRegions);
regionTrace.done(optionalRegions);
// @ts-expect-error Markers accept numeric lengths or undefined, not null.
const nullRegions: SortedRegions = { sortedPrefixLength: null };
// @ts-expect-error The held sentinel is only valid for compare/highlight.
regionTrace.swap('held', 1);
// @ts-expect-error shift requires numeric positions.
regionTrace.shift('held', 0);
const algorithm = defineArrayAlgorithm(function* (array) { yield array.start(); yield array.done(); });
const arrayPlayer = createArrayPlayer(algorithm.iterate([1]));
const arrayFrame: ArrayFrame = arrayPlayer.nextStep();
arrayPlayer.dispose();
void arrayFrame;
createArrayTimeline(algorithm.steps([1]),timing).sample(0);
