import type { GridCellView, GridSnapshot, GridFrame } from "../grid/types.js";

export interface GridPalette {
    readonly background: string;
    readonly cell: string;
    readonly border: string;
    readonly text: string;
    readonly caption: string;
    readonly active: string;
    readonly visited: string;
    readonly queued: string;
    readonly result: string;
    readonly resultText: string;
    readonly path: string;
}
export interface GridCellPresentation {
    readonly label?: string | undefined;
    readonly color?: string | undefined;
}
export interface GridRendererOptions<Value = unknown> {
    readonly theme: "light" | "dark";
    readonly colors?: { readonly [K in keyof GridPalette]?: string | undefined } | undefined;
    readonly roleColors?: Readonly<Record<string, string>> | undefined;
    readonly cellGap?: number | undefined;
    readonly presentCell?: ((this: void, cell: GridCellView<Value>, snapshot: GridSnapshot<Value>) => GridCellPresentation | undefined) | undefined;
    readonly cellCaptions?: "auto" | "hidden" | undefined;
    readonly path?: "visible" | "hidden" | undefined;
}
export interface GridRenderSize {
    readonly width: number;
    readonly height: number;
}
export interface GridRenderer<Value = unknown> {
    render<Event>(context: CanvasRenderingContext2D, frame: GridFrame<Value, Event>, size: GridRenderSize): void;
}

import { record, text } from "../grid/validation.js";
import { gridSnapshot, gridViews } from "./grid-state.js";
import { dimension, finite, gridLayout, gridRoutes } from "./grid-layout.js";
import { gridText } from "./grid-text.js";

const palettes: Readonly<Record<"light" | "dark", GridPalette>> = {
    light: { background: "#f8fafc", cell: "#e2e8f0", border: "#94a3b8", text: "#0f172a", caption: "#475569",
        active: "#fbbf24", visited: "#94a3b8", queued: "#c4b5fd", result: "#047857", resultText: "#ffffff", path: "#1d4ed8" },
    dark: { background: "#101827", cell: "#334155", border: "#64748b", text: "#f1f5f9", caption: "#cbd5e1",
        active: "#fbbf24", visited: "#64748b", queued: "#a78bfa", result: "#34d399", resultText: "#052e16", path: "#fbbf24" }
};
/** Restore every acquired save, preserving even falsy primary exceptions. */
function saved(ctx: CanvasRenderingContext2D, run: () => void): void {
    ctx.save();
    let failed = false, primary: unknown;
    try { run(); } catch (error) { failed = true; primary = error; }
    try { ctx.restore(); } catch (error) { if (!failed) { failed = true; primary = error; } }
    if (failed) throw primary;
}
function setup(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
    ctx.shadowColor = "rgba(0, 0, 0, 0)"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.miterLimit = 10;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.direction = "ltr"; ctx.font = "12px sans-serif";
    if ("fontKerning" in ctx) ctx.fontKerning = "none";
    if ("fontStretch" in ctx) ctx.fontStretch = "normal";
    if ("fontVariantCaps" in ctx) ctx.fontVariantCaps = "normal";
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    if ("wordSpacing" in ctx) ctx.wordSpacing = "0px";
    if ("textRendering" in ctx) ctx.textRendering = "auto";
}
export function createGridRenderer<Value = unknown>(options: GridRendererOptions<Value>): GridRenderer<Value> {
    const fields = record(options, ["theme", "colors", "roleColors", "cellGap", "presentCell", "cellCaptions", "path"], ["theme"]);
    if (fields.theme !== "light" && fields.theme !== "dark") throw new TypeError("Grid renderer theme must be light or dark");
    const colors = { ...palettes[fields.theme] }, keys = Object.keys(colors) as (keyof GridPalette)[];
    if (fields.colors !== undefined) {
        const overrides = record(fields.colors, keys, []);
        for (const key of keys) if (overrides[key] !== undefined) colors[key] = text(overrides[key], true);
    }
    const roles = new Map<string, string>();
    if (fields.roleColors !== undefined) {
        record(fields.roleColors, [], []);
        const names = Object.getOwnPropertyNames(fields.roleColors), overrides = record(fields.roleColors, names);
        for (const name of names) roles.set(text(name, true), text(overrides[name], true));
    }
    const gap = fields.cellGap === undefined ? 0.1 : dimension(fields.cellGap);
    if (fields.presentCell !== undefined && typeof fields.presentCell !== "function") throw new TypeError("Grid presenter must be a function");
    const presenter = fields.presentCell as GridRendererOptions<Value>["presentCell"];
    if (fields.cellCaptions !== undefined && fields.cellCaptions !== "auto" && fields.cellCaptions !== "hidden") throw new TypeError("Grid captions must be auto or hidden");
    if (fields.path !== undefined && fields.path !== "visible" && fields.path !== "hidden") throw new TypeError("Grid path must be visible or hidden");
    const captions = fields.cellCaptions !== "hidden", paths = fields.path !== "hidden";
    let busy = false;
    return Object.freeze({
        render<Event>(ctx: CanvasRenderingContext2D, frame: GridFrame<Value, Event>, size: GridRenderSize): void {
            if (busy) throw new Error("Grid renderer cannot be controlled recursively");
            busy = true;
            try {
                const dimensions = record(size, ["width", "height"]), width = dimension(dimensions.width), height = dimension(dimensions.height);
                const input = record(frame, ["progress", "previous", "current"]), progress = dimension(input.progress);
                if (progress > 1) throw new RangeError("Grid progress must be between zero and one");
                const previous = gridSnapshot<Value>(input.previous), current = gridSnapshot<Value>(input.current);
                if (previous.grid.rows !== current.grid.rows || previous.grid.columns !== current.grid.columns) throw new RangeError("Grid endpoint shapes must match");
                const canvas = ctx.canvas, bitmapWidth = dimension(canvas.width), bitmapHeight = dimension(canvas.height);
                if (width === 0 || height === 0 || bitmapWidth === 0 || bitmapHeight === 0) return;
                const sx = bitmapWidth / width, sy = bitmapHeight / height;
                if (![sx, sy].every(n => Number.isFinite(n) && n > 0)) throw new RangeError("Grid bitmap transform is not representable");
                const geometry = gridLayout(current.grid, width, height, gap), views = geometry ? gridViews(current) : [];
                const presentations = views.map(view => {
                    const value = presenter ? presenter(view, current) : undefined;
                    const output = value === undefined ? { label: undefined, color: undefined } : record(value, ["label", "color"], []);
                    return { label: output.label === undefined ? undefined : text(output.label),
                        color: output.color === undefined ? undefined : text(output.color, true) };
                });
                const fills = views.map((view, i) => {
                    if (view.result) return colors.result;
                    const custom = view.role === null ? undefined : roles.get(view.role);
                    if (custom !== undefined) return custom;
                    if (view.role === "active" || view.role === "visited" || view.role === "queued") return colors[view.role];
                    return presentations[i]!.color ?? colors.cell;
                });
                const routes = geometry && paths ? gridRoutes(previous.result?.path ?? [], current.result?.path ?? [], geometry, current.grid.columns, progress) : [];
                saved(ctx, () => {
                    setup(ctx, sx, sy);
                    const texts = geometry ? gridText(ctx, geometry, presentations.map(p => p.label), views.map(v => captions ? v.caption : null)) : [];
                    const holes = texts.map(t => ({ left: finite(t.box.left - 1), top: finite(t.box.top - 1),
                        width: finite(t.box.right - t.box.left + 2), height: finite(t.box.bottom - t.box.top + 2) }));
                    ctx.clearRect(0, 0, width, height); ctx.fillStyle = colors.background; ctx.fillRect(0, 0, width, height);
                    if (geometry) for (const [i, cell] of geometry.cells.entries()) {
                        ctx.fillStyle = fills[i]!; ctx.fillRect(cell.left, cell.top, geometry.side, geometry.side);
                        if (geometry.border > 0) {
                            const half = geometry.border / 2; ctx.strokeStyle = colors.border; ctx.lineWidth = geometry.border;
                            ctx.strokeRect(cell.left + half, cell.top + half, geometry.side - geometry.border, geometry.side - geometry.border);
                        }
                    }
                    if (geometry && routes.length) saved(ctx, () => {
                        ctx.beginPath(); ctx.rect(0, 0, width, height);
                        for (const hole of holes) ctx.rect(hole.left, hole.top, hole.width, hole.height);
                        ctx.clip("evenodd");
                        for (const route of routes) {
                            ctx.globalAlpha = route.alpha; ctx.beginPath(); ctx.moveTo(route.points[0]!.x, route.points[0]!.y);
                            for (let i = 1; i < route.points.length; i++) ctx.lineTo(route.points[i]!.x, route.points[i]!.y);
                            if (geometry.halo > 0) { ctx.lineWidth = geometry.halo; ctx.strokeStyle = colors.background; ctx.stroke(); }
                            if (geometry.core > 0) { ctx.lineWidth = geometry.core; ctx.strokeStyle = colors.path; ctx.stroke(); }
                        }
                    });
                    ctx.globalAlpha = 1;
                    for (const item of texts) {
                        ctx.font = `${item.font}px sans-serif`;
                        ctx.fillStyle = views[item.cellIndex]!.result ? colors.resultText : item.caption ? colors.caption : colors.text;
                        ctx.fillText(item.text, item.x, item.y);
                    }
                });
            } finally { busy = false; }
        }
    });
}
