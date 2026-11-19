import type { TreeInput, TreeOrderedInput, TreeBinaryInput, TreeTraceOptions, TreeTrace, TreeSnapshot, TreeEvent, TreeStep, TreeEdit, TreeMarkUpdate, TreePosition, TreeDoneOptions } from "./types.js";
import { record, root, captureTree, captureStructure } from "./validation.js";
import type { Model } from "./validation.js";
import { captureLayout, captureCaptions, captureMarks, captureCaptionPatches, applyMarks, applyCaptions, captureResult } from "./attributes.js";

export function createTreeTrace<N = unknown, L = unknown>(tree: TreeOrderedInput<N, L>, options: TreeTraceOptions): TreeTrace<N, L, "ordered">;
export function createTreeTrace<N = unknown, L = unknown>(tree: TreeBinaryInput<N, L>, options: TreeTraceOptions): TreeTrace<N, L, "binary">;
export function createTreeTrace<N = unknown, L = unknown>(tree: TreeInput<N, L>, options: TreeTraceOptions): TreeTrace<N, L>;
/** Own complete immutable trees; edits and retired identities commit together. */
export function createTreeTrace<N = unknown, L = unknown>(tree: TreeInput<N, L>, options: TreeTraceOptions): TreeTrace<N, L> {
    let model = captureTree<N, L>(tree);
    const settings = record(options, ["layout", "nodeCaptions"], ["layout"]);
    const layout = captureLayout(settings.layout, model.tree.nodes, model.nodeIds).layout;
    const nodeCaptions = captureCaptions(settings.nodeCaptions === undefined ? [] : settings.nodeCaptions, model.tree.nodes);
    let state: TreeSnapshot<N, L> = Object.freeze({ tree: model.tree, layout,
        nodeMarks: Object.freeze([]), linkMarks: Object.freeze([]), nodeCaptions, result: null });
    let phase: "new" | "running" | "done" = "new", busy = false, index = 0;
    let retiredNodes = new Set<string>(), retiredLinks = new Set<string>();
    type Prepared = { state: TreeSnapshot<N, L>; event: TreeEvent; model?: Model<N, L>;
        retiredNodes?: Set<string>; retiredLinks?: Set<string> };
    function command(expected: typeof phase, prepare: () => Prepared): TreeStep<N, L> {
        if (busy) throw new Error("Tree trace cannot be mutated while capturing a command");
        if (phase !== expected) throw new Error("Call tree start once before operations; no operations are allowed after done");
        busy = true;
        try {
            const next = prepare();
            const step = Object.freeze({ index, state: next.state, event: Object.freeze(next.event) });
            // All copies, validation and allocation finish before this non-callback commit section.
            state = next.state;
            if (next.model) model = next.model;
            if (next.retiredNodes) retiredNodes = next.retiredNodes;
            if (next.retiredLinks) retiredLinks = next.retiredLinks;
            phase = next.event.type === "done" ? "done" : "running";
            index++;
            return step;
        } finally { busy = false; }
    }
    return Object.freeze({
        get state() { return state; },
        start() { return command("new", () => ({ state, event: { type: "start" } })); },
        edit(update: TreeEdit<N, L>) {
            return command("running", () => {
                const fields = record(update, ["kind", "rootId", "nodes", "links", "layout"], []);
                if (fields.kind !== undefined) throw new TypeError("Tree kind cannot be changed by edit");
                const rootId = fields.rootId === undefined ? model.tree.rootId : root(fields.rootId);
                const next = captureStructure<N, L>(model.tree.kind, rootId,
                    fields.nodes === undefined ? model.tree.nodes : fields.nodes,
                    fields.links === undefined ? model.tree.links : fields.links);
                for (const id of next.nodeIds) if (retiredNodes.has(id)) throw new RangeError(`Retired tree node id: ${id}`);
                for (const id of next.linkIds) if (retiredLinks.has(id)) throw new RangeError(`Retired tree link id: ${id}`);
                const positions = fields.layout === undefined ? state.layout.filter(p => next.nodeIds.has(p.nodeId)) : fields.layout;
                const layout = captureLayout(positions, next.tree.nodes, next.nodeIds).layout;
                const nextState = Object.freeze({ tree: next.tree, layout,
                    nodeMarks: applyMarks(state.nodeMarks, [], next.tree.nodes),
                    linkMarks: applyMarks(state.linkMarks, [], next.tree.links),
                    nodeCaptions: applyCaptions(state.nodeCaptions, [], next.tree.nodes), result: null });
                const nextRetiredNodes = new Set(retiredNodes), nextRetiredLinks = new Set(retiredLinks);
                for (const id of model.nodeIds) if (!next.nodeIds.has(id)) nextRetiredNodes.add(id);
                for (const id of model.linkIds) if (!next.linkIds.has(id)) nextRetiredLinks.add(id);
                return { state: nextState, event: { type: "edit" }, model: next,
                    retiredNodes: nextRetiredNodes, retiredLinks: nextRetiredLinks };
            });
        },
        mark(update: TreeMarkUpdate) {
            return command("running", () => {
                const fields = record(update, ["nodes", "links", "nodeCaptions"], []);
                const nodes = captureMarks(fields.nodes, model.nodeIds), links = captureMarks(fields.links, model.linkIds);
                const captions = captureCaptionPatches(fields.nodeCaptions, model.nodeIds);
                return { state: Object.freeze({ ...state,
                    nodeMarks: applyMarks(state.nodeMarks, nodes, model.tree.nodes),
                    linkMarks: applyMarks(state.linkMarks, links, model.tree.links),
                    nodeCaptions: applyCaptions(state.nodeCaptions, captions, model.tree.nodes) }),
                    event: { type: "mark", nodes, links, nodeCaptions: captions } };
            });
        },
        setLayout(positions: readonly TreePosition[]) {
            return command("running", () => ({ state: Object.freeze({ ...state,
                layout: captureLayout(positions, model.tree.nodes, model.nodeIds).layout }), event: { type: "layout" } }));
        },
        done(options?: TreeDoneOptions) {
            return command("running", () => {
                const fields = record(options === undefined ? {} : options, ["result"], []);
                const result = fields.result === undefined ? null : captureResult(fields.result, model.nodeIds, model.linkIds);
                return { state: Object.freeze({ ...state, result }), event: { type: "done" } };
            });
        }
    });
}
