import type { GraphInput, GraphTraceOptions, GraphTrace, GraphSnapshot, GraphEvent, GraphStep, GraphMarkUpdate, GraphPosition, GraphDoneOptions } from "./types.js";
import { captureGraph, record, captureLayout, defaultLayout, captureMarks, applyMarks, captureResult, captureCaptions, captureCaptionPatches, applyCaptions } from "./validation.js";

/** Own a fixed topology and immutable snapshots; payloads remain application-owned. */
export function createGraphTrace<N = unknown, E = unknown>(graph: GraphInput<N, E>, options?: GraphTraceOptions): GraphTrace<N, E> {
    const { graph: topology, nodeIds, edgeIds } = captureGraph<N, E>(graph);
    const model = { graph: topology, nodeIds, edgeIds };
    const settings = record(options === undefined ? {} : options, ["layout", "nodeCaptions"], []);
    const layout = settings.layout === undefined ? defaultLayout(model.graph.nodes)
        : captureLayout(settings.layout, model.graph.nodes, model.nodeIds).layout;
    const nodeCaptions = captureCaptions(settings.nodeCaptions, model.graph.nodes);
    let state: GraphSnapshot<N, E> = Object.freeze({ graph: model.graph, layout,
        nodeMarks: Object.freeze([]), edgeMarks: Object.freeze([]), nodeCaptions, result: null });
    let phase: "new" | "running" | "done" = "new", busy = false, index = 0;

    function command(expected: typeof phase, prepare: () => { state: GraphSnapshot<N, E>; event: GraphEvent }): GraphStep<N, E> {
        if (busy) throw new Error("Graph trace cannot be mutated while capturing a command");
        if (phase !== expected) throw new Error("Call graph start once before operations; no operations are allowed after done");
        busy = true;
        try {
            const next = prepare();
            const step = Object.freeze({ index, state: next.state, event: Object.freeze(next.event) });
            // Nothing observable is changed until all capture/validation/allocation succeeds.
            state = next.state; phase = next.event.type === "done" ? "done" : "running"; index++;
            return step;
        } finally { busy = false; }
    }
    return Object.freeze({
        get state() { return state; },
        start() { return command("new", () => ({ state, event: { type: "start" } })); },
        mark(update: GraphMarkUpdate) {
            return command("running", () => {
                const fields = record(update, ["nodes", "edges", "nodeCaptions"], []);
                const nodes = captureMarks(fields.nodes, model.nodeIds), edges = captureMarks(fields.edges, model.edgeIds);
                const captions = captureCaptionPatches(fields.nodeCaptions, model.nodeIds);
                const next = Object.freeze({ ...state,
                    nodeCaptions: applyCaptions(state.nodeCaptions ?? [], captions, model.graph.nodes),
                    nodeMarks: applyMarks(state.nodeMarks, nodes, model.graph.nodes),
                    edgeMarks: applyMarks(state.edgeMarks, edges, model.graph.edges) });
                return { state: next, event: { type: "mark", nodes, edges, nodeCaptions: captions } };
            });
        },
        setLayout(positions: readonly GraphPosition[]) {
            return command("running", () => ({
                state: Object.freeze({ ...state, layout: captureLayout(positions, model.graph.nodes, model.nodeIds).layout }),
                event: { type: "layout" }
            }));
        },
        done(options?: GraphDoneOptions) {
            return command("running", () => {
                const fields = record(options === undefined ? {} : options, ["result"], []);
                const result = fields.result === undefined ? null : captureResult(fields.result, model.nodeIds, model.edgeIds);
                return { state: Object.freeze({ ...state, result }), event: { type: "done" } };
            });
        }
    });
}
