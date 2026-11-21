import type { Step } from "../playback/types.js";
import type {
    DynamicGraphEdit, DynamicGraphEvent, DynamicGraphTrace, GraphDoneOptions, GraphInput,
    GraphMarkUpdate, GraphPosition, GraphSnapshot, GraphTrace, GraphTraceOptions
} from "./types.js";
import { captureGraph, record, captureLayout, defaultLayout, captureMarks, applyMarks, captureResult, captureCaptions, captureCaptionPatches, applyCaptions } from "./validation.js";

interface GraphModel<N, E> {
    readonly graph: GraphInput<N, E>;
    readonly nodeIds: ReadonlySet<string>;
    readonly edgeIds: ReadonlySet<string>;
}

function captureModel<N, E>(input: unknown): GraphModel<N, E> {
    const { graph, nodeIds, edgeIds } = captureGraph<N, E>(input);
    return { graph, nodeIds, edgeIds };
}

function captureMarkUpdate(value: unknown, { nodeIds, edgeIds }: GraphModel<unknown, unknown>) {
    const fields = record(value, ["nodes", "edges", "nodeCaptions"], []);
    const nodes = captureMarks(fields.nodes, nodeIds);
    const edges = captureMarks(fields.edges, edgeIds);
    const nodeCaptions = captureCaptionPatches(fields.nodeCaptions, nodeIds);
    return { nodes, edges, nodeCaptions };
}

function applyMarkUpdate<N, E>(state: GraphSnapshot<N, E>, patch: ReturnType<typeof captureMarkUpdate>): GraphSnapshot<N, E> {
    return Object.freeze({ ...state,
        nodeCaptions: applyCaptions(state.nodeCaptions ?? [], patch.nodeCaptions, state.graph.nodes),
        nodeMarks: applyMarks(state.nodeMarks, patch.nodes, state.graph.nodes),
        edgeMarks: applyMarks(state.edgeMarks, patch.edges, state.graph.edges) });
}

function createTraceController<N, E>(graph: GraphInput<N, E>, options: GraphTraceOptions | undefined) {
    let model = captureModel<N, E>(graph);
    const settings = record(options === undefined ? {} : options, ["layout", "nodeCaptions"], []);
    const layout = settings.layout === undefined ? defaultLayout(model.graph.nodes)
        : captureLayout(settings.layout, model.graph.nodes, model.nodeIds).layout;
    const nodeCaptions = captureCaptions(settings.nodeCaptions, model.graph.nodes);
    let state: GraphSnapshot<N, E> = Object.freeze({ graph: model.graph, layout,
        nodeMarks: Object.freeze([]), edgeMarks: Object.freeze([]), nodeCaptions, result: null });
    let phase: "new" | "running" | "done" = "new", busy = false, index = 0;

    type Prepared<Event> = {
        state: GraphSnapshot<N, E>;
        event: Event;
        model?: GraphModel<N, E>;
        commit?: () => void;
    };
    function command<Event extends DynamicGraphEvent>(
        expected: typeof phase, prepare: () => Prepared<Event>
    ): Step<GraphSnapshot<N, E>, Event> {
        if (busy) throw new Error("Graph trace cannot be mutated while capturing a command");
        if (phase !== expected) throw new Error("Call graph start once before operations; no operations are allowed after done");
        busy = true;
        try {
            const next = prepare();
            const step = Object.freeze({ index, state: next.state, event: Object.freeze(next.event) });
            // Nothing observable is changed until all capture/validation/allocation succeeds.
            next.commit?.();
            if (next.model) model = next.model;
            state = next.state; phase = next.event.type === "done" ? "done" : "running"; index++;
            return step;
        } finally { busy = false; }
    }
    const trace: GraphTrace<N, E> = {
        get state() { return state; },
        start() { return command("new", () => ({ state, event: { type: "start" } })); },
        mark(update: GraphMarkUpdate) {
            return command("running", () => {
                const patch = captureMarkUpdate(update, model);
                return { state: applyMarkUpdate(state, patch), event: { type: "mark", ...patch } };
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
    };
    return { trace, command, get model() { return model; } };
}

/** Own a fixed topology and immutable snapshots; payloads remain application-owned. */
export function createGraphTrace<N = unknown, E = unknown>(graph: GraphInput<N, E>, options?: GraphTraceOptions): GraphTrace<N, E> {
    return Object.freeze(createTraceController(graph, options).trace);
}

function retireRemoved(before: ReadonlySet<string>, after: ReadonlySet<string>, retired: Set<string>): Set<string> {
    let next = retired;
    for (const id of before) {
        if (after.has(id)) continue;
        if (next === retired) next = new Set(retired);
        next.add(id);
    }
    return next;
}

/** Commit complete graph edits as single immutable steps within a trace. */
export function createDynamicGraphTrace<N = unknown, E = unknown>(
    graph: GraphInput<N, E>, options?: GraphTraceOptions
): DynamicGraphTrace<N, E> {
    const controller = createTraceController(graph, options);
    const { trace, command } = controller;
    let retiredNodes = new Set<string>(), retiredEdges = new Set<string>();

    return Object.freeze(Object.assign(trace, {
        edit(update: DynamicGraphEdit<N, E>) {
            return command("running", () => {
                const fields = record(update, ["nodes", "edges", "layout", "marks"], []);
                const current = controller.model, state = trace.state;
                const candidate = fields.nodes === undefined && fields.edges === undefined ? current : captureModel<N, E>({
                    nodes: fields.nodes === undefined ? current.graph.nodes : fields.nodes,
                    edges: fields.edges === undefined ? current.graph.edges : fields.edges,
                });
                for (const id of candidate.nodeIds) {
                    if (retiredNodes.has(id)) throw new RangeError(`Retired graph node id: ${id}`);
                }
                for (const id of candidate.edgeIds) {
                    if (retiredEdges.has(id)) throw new RangeError(`Retired graph edge id: ${id}`);
                }
                const positions = fields.layout === undefined ? state.layout.filter(p => candidate.nodeIds.has(p.nodeId)) : fields.layout;
                const layout = captureLayout(positions, candidate.graph.nodes, candidate.nodeIds).layout;
                const patch = captureMarkUpdate(fields.marks === undefined ? {} : fields.marks, candidate);
                const nextState = applyMarkUpdate({ ...state, graph: candidate.graph, layout }, patch);
                const nextRetiredNodes = retireRemoved(current.nodeIds, candidate.nodeIds, retiredNodes);
                const nextRetiredEdges = retireRemoved(current.edgeIds, candidate.edgeIds, retiredEdges);
                return {
                    state: nextState,
                    event: { type: "edit" },
                    model: candidate,
                    commit() {
                        retiredNodes = nextRetiredNodes;
                        retiredEdges = nextRetiredEdges;
                    },
                };
            });
        },
    }));
}
