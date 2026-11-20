import type { GridSnapshot, GridCellView } from "../grid/types.js";
import { record, captureGrid, offset } from "../grid/validation.js";
import { captureAnnotations, captureCaptions, result } from "../grid/attributes.js";

/** Own validated endpoint containers before any application presentation callback. */
export function gridSnapshot<Value>(source: unknown): GridSnapshot<Value> {
    const fields = record(source, ["grid", "cellMarks", "cellCaptions", "result"]);
    const grid = captureGrid<Value>(fields.grid);
    const cellMarks = captureAnnotations(fields.cellMarks, grid);
    const cellCaptions = captureCaptions(fields.cellCaptions, grid, true);
    const selected = fields.result === null ? null : result(fields.result, grid, true);
    return Object.freeze({ grid, cellMarks, cellCaptions, result: selected });
}
export function gridViews<Value>(state: GridSnapshot<Value>): readonly GridCellView<Value>[] {
    const roles = new Map(state.cellMarks.map(c => [offset(c, state.grid), c.role]));
    const captions = new Map(state.cellCaptions.map(c => [offset(c, state.grid), c.text]));
    const selected = new Set(state.result?.cells.map(c => offset(c, state.grid)));
    for (const c of state.result?.path ?? []) selected.add(offset(c, state.grid));
    return state.grid.values.map((value, index) => Object.freeze({ row: Math.floor(index / state.grid.columns),
        column: index % state.grid.columns, value, role: roles.get(index) ?? null,
        caption: captions.get(index) ?? null, result: selected.has(index) }));
}
