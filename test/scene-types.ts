import { createSceneRenderer, type Scene, type SceneVisualizations } from "@grundyjs/algiviz/scene";
import { createPlayer, type Step } from "@grundyjs/algiviz/playback";

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
