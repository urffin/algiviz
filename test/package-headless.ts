import { createPlayer, createTimeline, createStepEmitter, type Player, type Step, type Frame, type Timeline } from '@grundyjs/algiviz/playback';
import { createSceneFrame, createSceneProjector, createSceneRenderer, type SceneObject, type Scene, type ObjectTransition, type SceneFrame, type SceneVisualizations } from '@grundyjs/algiviz/scene';
import { createArrayTrace, defineArrayAlgorithm, createArrayPlayer, createArrayTimeline, type ArrayTrace, type ArrayAlgorithm, type SortedRegions, type Item, type ArrayEvent, type ArraySnapshot, type ArrayStep, type ArrayPlayer, type ArrayFrame, type ArrayTimeline } from '@grundyjs/algiviz/array';

// All headless exports must compile with lib ES2022 and no DOM or ambient types.
interface Objects { node: { x: number } }
export type PublicTypes = [Player<number,string>, Step<number,string>, Frame<number,string>, Timeline<number,string>,
    SceneObject<Objects>, Scene<Objects>, ObjectTransition<SceneObject<Objects>>, SceneFrame<Objects,string>,
    SceneVisualizations<Objects,number[],string>, ArrayTrace, ArrayAlgorithm, SortedRegions, Item,
    ArrayEvent, ArraySnapshot, ArrayStep, ArrayPlayer, ArrayFrame, ArrayTimeline];
const emit = createStepEmitter(() => 1);
const steps = [emit('done')];
const timing = { stepDurationMs: 100, finalHoldMs: 0 };
createPlayer(steps, { ...timing, isTerminal: step => step.event === 'done' }).dispose();
createTimeline(steps, timing).sample(0);
const scene: Scene<Objects> = { objects: [{id:'a',type:'node',data:{x:1}}] };
const project = createSceneProjector((state: Scene<Objects>) => state);
const frame = project({previous:scene,current:scene,progress:1,stepIndex:0,event:'done'});
createSceneFrame(frame);
createSceneRenderer<Objects,number[],string>({node(out, object) {
    const value = object.current ?? object.previous;
    if (value) out.push(value.data.x);
}}).render([],frame);
createArrayTrace([1]).start();
const algorithm = defineArrayAlgorithm(function* (array) { yield array.start(); yield array.done(); });
createArrayPlayer(algorithm.iterate([1]),timing).dispose();
createArrayTimeline(algorithm.steps([1]),timing).sample(0);
