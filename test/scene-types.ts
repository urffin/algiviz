import { createSceneRenderer, type Scene, type SceneVisualizations } from "@grundyjs/algiviz/scene";
import { createPlayer, type Step } from "@grundyjs/algiviz/playback";
import { createArrayPlayer } from "@grundyjs/algiviz/array";
const manualPlayer = createPlayer([{ index: 0, state: { x: 1 }, event: 'done' }], {
    isTerminal: step => step.event === 'done',
});
const manualX: number = manualPlayer.nextStep().current.x;
createPlayer([{ index: 0, state: manualX, event: true }], {
    stepDurationMs: undefined, finalHoldMs: undefined, isTerminal: step => step.event,
});
createArrayPlayer([]);

interface Objects {
    node: { x: number; label: string };
    edge: { from: string; to: string };
}
const visualizations: SceneVisualizations<Objects, string[], "visit" | "done"> = {
    node(ctx, transition, scene) {
        const node = transition.current ?? transition.previous!;
        ctx.push(node.data.label);
        // @ts-expect-error A node does not have edge data.
        node.data.from;
        const linked = scene.get("another")?.current;
        if (linked?.type === "edge") ctx.push(linked.data.to);
    },
    edge(ctx, transition) {
        ctx.push((transition.current ?? transition.previous!).data.from);
    }
};
// @ts-expect-error Every declared object type requires a visualization.
const missing: SceneVisualizations<Objects, string[], "visit"> = { node() {} };
void missing;
const state: Scene<Objects> = {
    objects: [
        { id: "a", type: "node", data: { x: 10, label: "A" } },
        // @ts-expect-error Object data must match its discriminant.
        { id: "b", type: "edge", data: { x: 10, label: "B" } }
    ]
};
const renderer = createSceneRenderer(visualizations);
const steps: Step<Scene<Objects>, "visit" | "done">[] = [{ index: 0, state, event: "done" }];
createPlayer(steps, {
    stepDurationMs: 100,
    finalHoldMs: 0,
    isTerminal: (step) => step.event === "done",
    render: (frame) => renderer.render([], frame)
});

import { createSceneProjector } from '@grundyjs/algiviz/scene';
const project = createSceneProjector((value: { scene: Scene<Objects> }) => value.scene);
const projected = project({ previous: { scene: state }, current: { scene: state }, progress: 1, stepIndex: 0, event: 'done' as const });
renderer.render([], projected);
// @ts-expect-error Projected inputs must have the declared state shape.
project({ previous: 1, current: 2, progress: 1, stepIndex: 0, event: 'done' });

import { createStepEmitter } from "@grundyjs/algiviz/playback";
const emitStep = createStepEmitter(() => ({ count: 1 }));
const emittedStep = emitStep({ kind: "count" as const });
const checkedCount: number = emittedStep.state.count;
const checkedKind: "count" = emittedStep.event.kind;
// @ts-expect-error Step index is readonly.
emittedStep.index = 2;

import { createArrayRenderer, createSortRenderer, type ArrayPalette, type ArrayPaletteOverrides, type ArrayRendererOptions } from '@grundyjs/algiviz/canvas';
const overrides: ArrayPaletteOverrides = { background: '#fff', held: 'purple' };
const rendererOptions: ArrayRendererOptions = { theme: 'light', colors: overrides };
createArrayRenderer(rendererOptions);
createSortRenderer(rendererOptions);
// @ts-expect-error Unknown palette role.
createArrayRenderer({ theme: 'dark', colors: { unknown: 'red' } });
// @ts-expect-error Colors are strings.
createArrayRenderer({ theme: 'dark', colors: { bar: 123 } });
const fullPalette: ArrayPalette = {background:'white',text:'black',bar:'gray',sorted:'green',active:'orange',held:'purple'};
createArrayRenderer({theme:'light',colors:fullPalette});
