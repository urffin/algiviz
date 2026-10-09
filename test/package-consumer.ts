import { defineArrayAlgorithm, createArrayPlayer, createArrayTimeline } from "@grundyjs/algiviz/array";
import { arrayScene, createArrayRenderer } from "@grundyjs/algiviz/canvas";
import { createSceneRenderer, type Scene } from "@grundyjs/algiviz/scene";
import { createPlayer, createTimeline, type Step } from "@grundyjs/algiviz/playback";
import { insertionSortSteps } from "@grundyjs/algiviz/core";

function check(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message);
}
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
check(insertionSortSteps([2, 1]).at(-1)?.state.slots[0]?.value === 1, "Legacy API failed");
