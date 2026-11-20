import type { GridCoordinate, GridInput } from "../grid/types.js";

export interface GridBox { left: number; top: number; right: number; bottom: number }
export interface GridCellBox extends GridBox { x: number; y: number }
export interface GridGeometry { cells: readonly GridCellBox[]; side: number; border: number; halo: number; core: number }
export interface GridRoute { points: readonly { x: number; y: number }[]; alpha: number }
export function finite(value: number): number {
    if (!Number.isFinite(value)) throw new RangeError("Grid drawing geometry is not representable");
    return value;
}
export function dimension(value: unknown): number {
    if (typeof value !== "number") throw new TypeError("Grid drawing dimensions must be numbers");
    if (!Number.isFinite(value) || value < 0) throw new RangeError("Grid drawing dimensions must be finite and nonnegative");
    return value === 0 ? 0 : value;
}
export function gridLayout(grid: GridInput, width: number, height: number, gap: number): GridGeometry | null {
    if (grid.values.length === 0 || width <= 8 || height <= 8) return null;
    const lw = finite(grid.columns + (grid.columns - 1) * gap), lh = finite(grid.rows + (grid.rows - 1) * gap);
    const side = finite(Math.min((width - 8) / lw, (height - 8) / lh) * (1 - 8 * Number.EPSILON));
    if (side <= 0) throw new RangeError("Grid cell scale is not representable");
    const left = finite((width - lw * side) / 2), top = finite((height - lh * side) / 2);
    const border = Math.min(1, side / 4), cells: GridCellBox[] = [];
    for (let index = 0; index < grid.values.length; index++) {
        const x = finite(left + (index % grid.columns) * (1 + gap) * side);
        const y = finite(top + Math.floor(index / grid.columns) * (1 + gap) * side);
        const right = finite(x + side), bottom = finite(y + side);
        if (x < 4 || y < 4 || right > width - 4 || bottom > height - 4 || right <= x || bottom <= y)
            throw new RangeError("Grid cells do not have representable safe bounds");
        if (border > 0 && (x + border / 2 <= x || y + border / 2 <= y || right - border / 2 >= right || bottom - border / 2 >= bottom))
            throw new RangeError("Grid inset border is not representable");
        cells.push({ left: x, top: y, right, bottom, x: finite(x + side / 2), y: finite(y + side / 2) });
    }
    return { cells, side, border, halo: Math.min(5, side / 3), core: Math.min(3, side / 5) };
}
export function gridRoutes(previous: readonly GridCoordinate[], current: readonly GridCoordinate[], geometry: GridGeometry,
    columns: number, progress: number): readonly GridRoute[] {
    const identical = previous.length === current.length && previous.every((c, i) => c.row === current[i]!.row && c.column === current[i]!.column);
    const routes: GridRoute[] = [];
    function add(path: readonly GridCoordinate[], alpha: number) {
        if (alpha <= 0) return;
        const points: { x: number; y: number }[] = [];
        for (const c of path) {
            const cell = geometry.cells[c.row * columns + c.column]!;
            const last = points[points.length - 1];
            if (!last || last.x !== cell.x || last.y !== cell.y) points.push({ x: cell.x, y: cell.y });
        }
        if (points.length > 1) routes.push({ points, alpha });
    }
    if (identical) add(current, 1); else { add(previous, 1 - progress); add(current, progress); }
    return routes;
}
