import type { Scene, SceneObject } from "../scene/index.js";
import type { GridSnapshot, GridSceneOptions, GridObjects } from "./types.js";
import { record, text, captureGrid, offset } from "./validation.js";
import { captureAnnotations, captureCaptions, result } from "./attributes.js";

export function gridScene<Value = unknown>(state: GridSnapshot<Value>, options: GridSceneOptions): Scene<GridObjects<Value>> {
    const namespace = text(record(options, ["namespace"]).namespace, true);
    const fields = record(state, ["grid", "cellMarks", "cellCaptions", "result"]), grid = captureGrid<Value>(fields.grid);
    const annotations = new Map(captureAnnotations(fields.cellMarks, grid).map(item => [offset(item, grid), item.role]));
    const captions = new Map(captureCaptions(fields.cellCaptions, grid, true).map(item => [offset(item, grid), item.text]));
    const selected = fields.result === null ? null : result(fields.result, grid, true);
    const chosen = new Set(selected?.cells.map(cell => offset(cell, grid)));
    for (const cell of selected?.path ?? []) chosen.add(offset(cell, grid));
    const id = (row: number, column: number) => JSON.stringify([namespace, "grid", "cell", row, column]);
    const objects: SceneObject<GridObjects<Value>>[] = [];
    for (let index = 0; index < grid.values.length; index++) {
        const row = Math.floor(index / grid.columns), column = index % grid.columns;
        objects.push(Object.freeze({ id: id(row, column), type: "gridCell" as const, zIndex: 0,
            data: Object.freeze({ row, column, value: grid.values[index] as Value,
                caption: captions.get(index) ?? null, role: annotations.get(index) ?? null, result: chosen.has(index) }) }));
    }
    if (selected?.path.length) objects.push(Object.freeze({ id: JSON.stringify([namespace, "grid", "path"]), type: "gridPath" as const, zIndex: 1,
        data: Object.freeze({ cellIds: Object.freeze(selected.path.map(cell => id(cell.row, cell.column))) }) }));
    return Object.freeze({ objects: Object.freeze(objects) });
}
