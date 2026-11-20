import type { GridInput, GridTraceOptions, GridTrace, GridSnapshot, GridEvent, GridStep, GridEdit, GridMarkUpdate, GridDoneOptions } from "./types.js";
import { record, captureGrid, values, writes, offset } from "./validation.js";
import { marks, captureCaptions, applyMarks, applyCaptions, result } from "./attributes.js";

export function createGridTrace<Value = unknown>(grid: GridInput<Value>, options?: GridTraceOptions): GridTrace<Value> {
    const initial = captureGrid<Value>(grid);
    const settings = record(options === undefined ? {} : options, ["cellCaptions"], []);
    let state: GridSnapshot<Value> = Object.freeze({ grid: initial, cellMarks: Object.freeze([]),
        cellCaptions: captureCaptions(settings.cellCaptions === undefined ? [] : settings.cellCaptions, initial), result: null });
    let phase: "new" | "running" | "done" = "new", busy = false, index = 0;
    function command(expected: typeof phase, prepare: () => { state: GridSnapshot<Value>; event: GridEvent }): GridStep<Value> {
        if (busy) throw new Error("Grid trace cannot be mutated while capturing a command");
        if (phase !== expected) throw new Error("Call grid start once before operations; no operations are allowed after done");
        busy = true;
        try {
            const next = prepare(), step = Object.freeze({ index, state: next.state, event: Object.freeze(next.event) });
            // No callback, capture or allocation follows this commit boundary.
            state = next.state;
            phase = next.event.type === "done" ? "done" : "running";
            index++;
            return step;
        } finally { busy = false; }
    }
    function marked(update: unknown, grid: GridInput<Value>) {
        const patch = marks(update, grid);
        return { patch, state: Object.freeze({ grid,
            cellMarks: applyMarks(state.cellMarks, patch.cells, grid),
            cellCaptions: applyCaptions(state.cellCaptions, patch.cellCaptions, grid), result: null }) };
    }
    return Object.freeze({
        get state() { return state; },
        start() { return command("new", () => ({ state, event: { type: "start" } })); },
        edit(update: GridEdit<Value>) {
            return command("running", () => {
                const fields = record(update, ["rows", "columns", "marks", "values", "writes"], []);
                if (fields.rows !== undefined) throw new TypeError("Grid rows cannot be changed by edit");
                if (fields.columns !== undefined) throw new TypeError("Grid columns cannot be changed by edit");
                if (fields.values !== undefined && fields.writes !== undefined) throw new TypeError("Grid values and writes are mutually exclusive");
                let nextValues = state.grid.values;
                if (fields.values !== undefined) nextValues = values<Value>(fields.values, state.grid.rows * state.grid.columns);
                else {
                    const patch = writes<Value>(fields.writes, state.grid);
                    if (patch.length) {
                        const copied = state.grid.values.slice();
                        for (const item of patch) copied[offset(item, state.grid)] = item.value;
                        nextValues = Object.freeze(copied);
                    }
                }
                const grid = nextValues === state.grid.values ? state.grid : Object.freeze({ ...state.grid, values: nextValues });
                return { state: marked(fields.marks === undefined ? {} : fields.marks, grid).state, event: { type: "edit" } };
            });
        },
        mark(update: GridMarkUpdate) {
            return command("running", () => {
                const next = marked(update, state.grid);
                return { state: next.state, event: { type: "mark", cells: next.patch.cells, cellCaptions: next.patch.cellCaptions } };
            });
        },
        done(options?: GridDoneOptions) {
            return command("running", () => {
                const fields = record(options === undefined ? {} : options, ["result"], []);
                return { state: Object.freeze({ ...state, result: fields.result === undefined ? null : result(fields.result, state.grid) }), event: { type: "done" } };
            });
        }
    });
}
