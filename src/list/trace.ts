import type { ListInput, ListTraceOptions, ListTrace, ListSnapshot, ListStep, ListEvent,
    ListEdit, ListMarkUpdate, ListPosition, ListDoneOptions } from "./types.js";
import { model, structure, record, reference } from "./validation.js";
import type { Model } from "./validation.js";
import * as attributes from "./attributes.js";

/** Own complete chains; state, lifecycle and retired identities commit together. */
export function createListTrace<Value = unknown>(list: ListInput<Value>, options: ListTraceOptions): ListTrace<Value> {
    let current = model<Value>(list);
    const settings = record(options, ["layout", "nodeCaptions"], ["layout"]);
    const positions = attributes.layout(settings.layout, current).positions;
    const captions = attributes.captions(settings.nodeCaptions === undefined ? [] : settings.nodeCaptions, current);
    let state: ListSnapshot<Value> = Object.freeze({ list: current.list, layout: positions,
        nodeMarks: Object.freeze([]), pointerMarks: Object.freeze([]), nodeCaptions: captions, result: null });
    let phase: "new" | "running" | "done" = "new", busy = false, index = 0;
    let retired = new Set<string>();
    type Prepared = { state: ListSnapshot<Value>; event: ListEvent; model?: Model<Value>; retired?: Set<string> };
    function command(expected: typeof phase, prepare: () => Prepared): ListStep<Value> {
        if (busy) throw new Error("List trace cannot be mutated while capturing a command");
        if (phase !== expected) throw new Error("Call list start once before operations; no operations are allowed after done");
        busy = true;
        try {
            const next = prepare();
            const step = Object.freeze({ index, state: next.state, event: Object.freeze(next.event) });
            state = next.state;
            if (next.model) current = next.model;
            if (next.retired) retired = next.retired;
            phase = next.event.type === "done" ? "done" : "running";
            index++;
            return step;
        } finally { busy = false; }
    }
    function patched(base: ListSnapshot<Value>, patch: ReturnType<typeof attributes.marks>, model: Model<Value>): ListSnapshot<Value> {
        return Object.freeze({ ...base,
            nodeMarks: attributes.applyNodeMarks(base.nodeMarks, patch.nodes, model),
            pointerMarks: attributes.applyPointerMarks(base.pointerMarks, patch.pointers, model),
            nodeCaptions: attributes.applyCaptions(base.nodeCaptions, patch.nodeCaptions, model) });
    }
    return Object.freeze({
        get state() { return state; },
        start() { return command("new", () => ({ state, event: { type: "start" } })); },
        edit(update: ListEdit<Value>) {
            return command("running", () => {
                const fields = record(update, ["headId", "nodes", "layout", "marks"], []);
                const headId = fields.headId === undefined ? current.list.headId : reference(fields.headId);
                const candidate = structure<Value>(headId, fields.nodes === undefined ? current.list.nodes : fields.nodes);
                for (const node of candidate.list.nodes) if (retired.has(node.id)) throw new RangeError(`Retired list node: ${node.id}`);
                const positions = fields.layout === undefined ? state.layout.filter(p => candidate.ids.has(p.nodeId)) : fields.layout;
                const layout = attributes.layout(positions, candidate).positions;
                // Pruning is confined to prepared values; patch references address the final chain.
                const base = Object.freeze({ list: candidate.list, layout, result: null,
                    nodeMarks: attributes.applyNodeMarks(state.nodeMarks, [], candidate),
                    pointerMarks: attributes.applyPointerMarks(state.pointerMarks, [], candidate),
                    nodeCaptions: attributes.applyCaptions(state.nodeCaptions, [], candidate) });
                const patch = attributes.marks(fields.marks === undefined ? {} : fields.marks, candidate);
                const nextState = patched(base, patch, candidate), nextRetired = new Set(retired);
                for (const node of current.list.nodes) if (!candidate.ids.has(node.id)) nextRetired.add(node.id);
                return { state: nextState, event: { type: "edit" }, model: candidate, retired: nextRetired };
            });
        },
        mark(update: ListMarkUpdate) {
            return command("running", () => {
                const patch = attributes.marks(update, current);
                return { state: patched(state, patch, current), event: { type: "mark", ...patch } };
            });
        },
        setLayout(value: readonly ListPosition[]) {
            return command("running", () => ({ state: Object.freeze({ ...state,
                layout: attributes.layout(value, current).positions }), event: { type: "layout" } }));
        },
        done(options?: ListDoneOptions) {
            return command("running", () => {
                const fields = record(options === undefined ? {} : options, ["result"], []);
                const result = fields.result === undefined ? null : attributes.result(fields.result, current);
                return { state: Object.freeze({ ...state, result }), event: { type: "done" } };
            });
        }
    });
}
