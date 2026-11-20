import type { GridAnnotation, GridMark, GridCellCaption, GridCellCaptionPatch, GridResult } from "./types.js";
import { record, array, text, coordinate, offset, unique, limit } from "./validation.js";
import type { Shape } from "./validation.js";

export function markPatches(value: unknown, shape: Shape): readonly GridMark[] {
    const entries = value === undefined ? [] : array(value, shape.rows * shape.columns), seen = new Set<number>();
    return Object.freeze(entries.map(item => {
        const fields = record(item, ["row", "column", "role"]), cell = coordinate(fields);
        const role = fields.role === null ? null : text(fields.role, true);
        unique(offset(cell, shape), seen);
        return Object.freeze({ ...cell, role });
    }));
}
export function captionPatches(value: unknown, shape: Shape): readonly GridCellCaptionPatch[] {
    const entries = value === undefined ? [] : array(value, shape.rows * shape.columns), seen = new Set<number>();
    return Object.freeze(entries.map(item => {
        const fields = record(item, ["row", "column", "text"]), cell = coordinate(fields);
        const caption = fields.text === null ? null : text(fields.text);
        unique(offset(cell, shape), seen);
        return Object.freeze({ ...cell, text: caption });
    }));
}
export function marks(value: unknown, shape: Shape): { cells: readonly GridMark[]; cellCaptions: readonly GridCellCaptionPatch[] } {
    const fields = record(value, ["cells", "cellCaptions"], []);
    return { cells: markPatches(fields.cells, shape), cellCaptions: captionPatches(fields.cellCaptions, shape) };
}
export function captureAnnotations(value: unknown, shape: Shape): readonly GridAnnotation[] {
    const entries = array(value, shape.rows * shape.columns); let last = -1;
    return Object.freeze(entries.map(item => {
        const fields = record(item, ["row", "column", "role"]), cell = coordinate(fields), role = text(fields.role, true);
        const index = offset(cell, shape);
        if (index <= last) throw new RangeError("Grid snapshot marks must be unique and row-major");
        last = index;
        return Object.freeze({ ...cell, role });
    }));
}
export function captureCaptions(value: unknown, shape: Shape, ordered = false): readonly GridCellCaption[] {
    const entries = array(value, shape.rows * shape.columns), seen = new Set<number>(); let last = -1;
    const captured = entries.map(item => {
        const fields = record(item, ["row", "column", "text"]), cell = coordinate(fields), caption = text(fields.text);
        const index = offset(cell, shape); unique(index, seen);
        if (ordered && index <= last) throw new RangeError("Grid snapshot captions must be row-major");
        last = index;
        return Object.freeze({ ...cell, text: caption });
    });
    return Object.freeze(captured.sort((a, b) => offset(a, shape) - offset(b, shape)));
}
export function applyMarks(previous: readonly GridAnnotation[], patch: readonly GridMark[], shape: Shape): readonly GridAnnotation[] {
    const next = new Map(previous.map(item => [offset(item, shape), item]));
    for (const item of patch) {
        const key = offset(item, shape);
        if (item.role === null) next.delete(key); else next.set(key, Object.freeze({ row: item.row, column: item.column, role: item.role }));
    }
    return Object.freeze([...next].sort((a, b) => a[0] - b[0]).map(([, item]) => item));
}
export function applyCaptions(previous: readonly GridCellCaption[], patch: readonly GridCellCaptionPatch[], shape: Shape): readonly GridCellCaption[] {
    const next = new Map(previous.map(item => [offset(item, shape), item]));
    for (const item of patch) {
        const key = offset(item, shape);
        if (item.text === null) next.delete(key); else next.set(key, Object.freeze({ row: item.row, column: item.column, text: item.text }));
    }
    return Object.freeze([...next].sort((a, b) => a[0] - b[0]).map(([, item]) => item));
}
export function result(value: unknown, shape: Shape, snapshot = false): GridResult {
    const fields = record(value, ["cells", "path"], snapshot ? ["cells", "path"] : []);
    function selection(value: unknown, repeats: boolean) {
        const entries = !snapshot && value === undefined ? [] : array(value, repeats ? limit : shape.rows * shape.columns), seen = new Set<number>();
        return Object.freeze(entries.map(item => {
            const cell = coordinate(record(item, ["row", "column"])), index = offset(cell, shape);
            if (!repeats) unique(index, seen);
            return Object.freeze(cell);
        }));
    }
    const cells = selection(fields.cells, false), path = selection(fields.path, true);
    return Object.freeze({ cells, path });
}
