import type { GridCoordinate, GridInput, GridWrite } from "./types.js";

export const limit = 1_000_000;

/** Capture only known own data fields. Application values are opaque. */
export function record<K extends string>(value: unknown, keys: readonly K[], required: readonly K[] = keys): Record<K, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Expected a plain grid record");
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError("Expected a plain grid record");
    const fields = Object.create(null) as Record<K, unknown>;
    for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor) {
            if (required.includes(key)) throw new TypeError(`Missing grid field: ${key}`);
            fields[key] = undefined;
        } else {
            if (!("value" in descriptor)) throw new TypeError(`Grid field must be a data property: ${key}`);
            fields[key] = descriptor.value;
        }
    }
    return fields;
}

/** Length limits precede copying/density checks; density precedes element records. */
export function array(value: unknown, maximum: number, expected?: number): unknown[] {
    if (!Array.isArray(value)) throw new TypeError("Expected a dense grid array");
    const length: unknown = Object.getOwnPropertyDescriptor(value, "length")?.value;
    if (typeof length !== "number" || !Number.isInteger(length) || length < 0 || length > 0xffffffff) throw new TypeError("Invalid grid array length");
    if (length > maximum || (expected !== undefined && length !== expected)) throw new RangeError("Grid array length exceeds its limit or does not match the shape");
    const captured: unknown[] = [];
    for (let i = 0; i < length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, i);
        if (!descriptor || !("value" in descriptor)) throw new TypeError("Grid arrays require own data elements");
        captured.push(descriptor.value);
    }
    return captured;
}
export function integer(value: unknown): number {
    if (typeof value !== "number") throw new TypeError("Expected a numeric grid dimension or coordinate");
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("Grid dimensions and coordinates must be nonnegative safe integers");
    return value === 0 ? 0 : value;
}
export function text(value: unknown, nonempty = false): string {
    if (typeof value !== "string" || (nonempty && value.length === 0)) throw new TypeError("Expected grid text");
    return value;
}
export type Shape = Pick<GridInput, "rows" | "columns">;
export function offset(cell: GridCoordinate, shape: Shape): number {
    if (cell.row >= shape.rows || cell.column >= shape.columns) throw new RangeError("Grid coordinate is outside the shape");
    return cell.row * shape.columns + cell.column;
}
export function coordinate(fields: Record<"row" | "column", unknown>): GridCoordinate {
    return { row: integer(fields.row), column: integer(fields.column) };
}
export function unique(index: number, seen: Set<number>): void {
    if (seen.has(index)) throw new RangeError("Duplicate grid coordinate");
    seen.add(index);
}
export function values<Value>(value: unknown, size: number): readonly Value[] {
    return Object.freeze(array(value, size, size)) as readonly Value[];
}
export function captureGrid<Value>(value: unknown): GridInput<Value> {
    const fields = record(value, ["rows", "columns", "values"]);
    function dimension(value: unknown) {
        const size = integer(value);
        if (size > limit) throw new RangeError("Grid dimension exceeds 1,000,000");
        return size;
    }
    const rows = dimension(fields.rows), columns = dimension(fields.columns);
    if (rows * columns > limit) throw new RangeError("Grid shape exceeds 1,000,000 cells");
    return Object.freeze({ rows, columns, values: values<Value>(fields.values, rows * columns) });
}
export function writes<Value>(value: unknown, shape: Shape): readonly GridWrite<Value>[] {
    const captured = value === undefined ? [] : array(value, shape.rows * shape.columns), seen = new Set<number>();
    return Object.freeze(captured.map(item => {
        const fields = record(item, ["row", "column", "value"]), cell = coordinate(fields);
        unique(offset(cell, shape), seen);
        return Object.freeze({ ...cell, value: fields.value as Value });
    }));
}
