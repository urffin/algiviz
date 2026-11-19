import type { Frame } from "../playback/types.js";
import type { TreeInput, TreePosition, TreeKind, TreeSnapshot } from "../tree/types.js";
import { treeScene } from "../tree/scene.js";
import { record, string } from "../tree/validation.js";
import { createSceneFrame } from "../scene/index.js";
import { treeLayout } from "./tree-layout.js";
import { treeGeometry } from "./tree-geometry.js";
import { treeLabels, lineText } from "./tree-labels.js";

export interface TreePalette {
    readonly background: string;
    readonly text: string;
    readonly node: string;
    readonly link: string;
    readonly emptySlot: string;
    readonly active: string;
    readonly visited: string;
    readonly queued: string;
    readonly result: string;
}
export interface TreeRendererOptions {
    readonly theme: "light" | "dark";
    readonly colors?: { readonly [K in keyof TreePalette]?: string | undefined } | undefined;
    readonly roleColors?: Readonly<Record<string, string>> | undefined;
    readonly horizontalGap?: number | undefined;
    readonly levelGap?: number | undefined;
    readonly emptySlots?: "hidden" | "visible" | undefined;
    readonly nodeCaptions?: "auto" | "hidden" | undefined;
}
export interface TreeRenderSize { readonly width: number; readonly height: number }
export interface TreeRenderer {
    layout<N, L>(tree: TreeInput<N, L>): readonly TreePosition[];
    render<N, L, Kind extends TreeKind, Event>(context: CanvasRenderingContext2D,
        frame: Frame<TreeSnapshot<N, L, Kind>, Event>, size: TreeRenderSize): void;
}
const palettes: Readonly<Record<"light" | "dark", TreePalette>> = {
    dark: { background: "#101827", text: "#f1f5f9", node: "#334155", link: "#94a3b8", emptySlot: "#64748b",
        active: "#fbbf24", visited: "#64748b", queued: "#a78bfa", result: "#34d399" },
    light: { background: "#f8fafc", text: "#0f172a", node: "#e2e8f0", link: "#475569", emptySlot: "#94a3b8",
        active: "#fbbf24", visited: "#94a3b8", queued: "#c4b5fd", result: "#047857" }
};
function dimension(value: unknown): number {
    if (typeof value !== "number") throw new TypeError("Tree drawing dimensions must be numbers");
    if (!Number.isFinite(value) || value < 0) throw new RangeError("Tree drawing dimensions must be finite and nonnegative");
    return value;
}
function gap(value: unknown): number {
    const result = dimension(value);
    if (result === 0) throw new RangeError("Tree layout gaps must be positive");
    return result;
}
/** Optional full-bitmap renderer. Layout is explicit; the caller records positions in its trace. */
export function createTreeRenderer(options: TreeRendererOptions): TreeRenderer {
    const fields = record(options, ["theme", "colors", "roleColors", "horizontalGap", "levelGap", "emptySlots", "nodeCaptions"], ["theme"]);
    if (fields.theme !== "light" && fields.theme !== "dark") throw new TypeError("Tree renderer theme must be light or dark");
    const colors = { ...palettes[fields.theme] }, keys = Object.keys(colors) as (keyof TreePalette)[];
    if (fields.colors !== undefined) {
        const overrides = record(fields.colors, keys, []);
        for (const key of keys) if (overrides[key] !== undefined) colors[key] = string(overrides[key]);
    }
    const roles = new Map<string, string>();
    if (fields.roleColors !== undefined) {
        record(fields.roleColors, [], []);
        const names = Object.getOwnPropertyNames(fields.roleColors), overrides = record(fields.roleColors, names);
        for (const name of names) roles.set(string(name), string(overrides[name]));
    }
    const horizontalGap = fields.horizontalGap === undefined ? 1 : gap(fields.horizontalGap);
    const levelGap = fields.levelGap === undefined ? 2 : gap(fields.levelGap);
    if (fields.emptySlots !== undefined && fields.emptySlots !== "hidden" && fields.emptySlots !== "visible") throw new TypeError("Tree empty slots must be hidden or visible");
    if (fields.nodeCaptions !== undefined && fields.nodeCaptions !== "auto" && fields.nodeCaptions !== "hidden") throw new TypeError("Tree node captions must be auto or hidden");
    const showSlots = fields.emptySlots === "visible", captions = fields.nodeCaptions !== "hidden";
    function color(view: { result: boolean; role: string | null }, base: "node" | "link"): string {
        if (view.result) return colors.result;
        if (view.role !== null) {
            const custom = roles.get(view.role);
            if (custom !== undefined) return custom;
            if (view.role === "active" || view.role === "visited" || view.role === "queued") return colors[view.role];
        }
        return colors[base];
    }
    let busy = false;
    return Object.freeze({
        layout<N, L>(input: TreeInput<N, L>): readonly TreePosition[] {
            if (busy) throw new Error("Tree renderer cannot be controlled recursively");
            busy = true;
            try { return treeLayout(input, horizontalGap, levelGap); } finally { busy = false; }
        },
        render<N, L, Kind extends TreeKind, Event>(ctx: CanvasRenderingContext2D, frame: Frame<TreeSnapshot<N, L, Kind>, Event>, size: TreeRenderSize): void {
            if (busy) throw new Error("Tree renderer cannot be controlled recursively");
            busy = true;
            try {
                const dimensions = record(size, ["width", "height"]);
                const width = dimension(dimensions.width), height = dimension(dimensions.height);
                const fields = record(frame, ["progress", "previous", "current"]);
                const progress = dimension(fields.progress);
                if (progress > 1) throw new RangeError("Tree progress must be between zero and one");
                const previous = fields.previous as TreeSnapshot, current = fields.current as TreeSnapshot;
                const before = treeScene(previous, { namespace: "tree" });
                const after = treeScene(current, { namespace: "tree" });
                if (previous.tree.kind !== current.tree.kind) throw new RangeError("Tree endpoint kinds must match");
                const bitmapWidth = dimension(ctx.canvas.width), bitmapHeight = dimension(ctx.canvas.height);
                if (width === 0 || height === 0 || bitmapWidth === 0 || bitmapHeight === 0) return;
                const sx = bitmapWidth / width, sy = bitmapHeight / height;
                if (![sx, sy].every(n => Number.isFinite(n) && n > 0)) throw new RangeError("Tree bitmap transform is not representable");
                const scene = createSceneFrame({ previous: before, current: after, progress, stepIndex: 0, event: undefined });
                const geometry = treeGeometry(scene, previous, current, width, height, horizontalGap, levelGap);
                ctx.save();
                let failed = false, primary: unknown;
                try {
                    ctx.setTransform(sx, 0, 0, sy, 0, 0);
                    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
                    ctx.shadowColor = "rgba(0, 0, 0, 0)"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
                    ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.miterLimit = 10;
                    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.direction = "ltr"; ctx.font = "12px sans-serif";
                    if ("fontKerning" in ctx) ctx.fontKerning = "none";
                    if ("fontStretch" in ctx) ctx.fontStretch = "normal";
                    if ("fontVariantCaps" in ctx) ctx.fontVariantCaps = "normal";
                    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
                    if ("wordSpacing" in ctx) ctx.wordSpacing = "0px";
                    if ("textRendering" in ctx) ctx.textRendering = "auto";
                    const plan = treeLabels(ctx, geometry.nodes, geometry.links, geometry.slots, geometry.radius, width, height, captions, showSlots);
                    ctx.clearRect(0, 0, width, height);
                    ctx.fillStyle = colors.background; ctx.fillRect(0, 0, width, height);
                    for (const link of geometry.links) {
                        if (link.presence <= 0) continue;
                        ctx.globalAlpha = link.presence; ctx.strokeStyle = color(link.view, "link");
                        ctx.lineWidth = link.view.result || link.view.role === "active" ? 3 : 1.5;
                        const [a, b, c, d] = link.curve;
                        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(b.x, b.y, c.x, c.y, d.x, d.y); ctx.stroke();
                    }
                    ctx.strokeStyle = colors.emptySlot; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
                    for (const slot of plan.slots) {
                        ctx.globalAlpha = slot.presence; ctx.beginPath(); ctx.moveTo(slot.start.x, slot.start.y); ctx.lineTo(slot.end.x, slot.end.y); ctx.stroke();
                        ctx.setLineDash([]); ctx.strokeRect(slot.end.x - 3, slot.end.y - 3, 6, 6); ctx.setLineDash([3, 3]);
                    }
                    ctx.setLineDash([]);
                    for (const node of geometry.nodes) {
                        if (node.presence <= 0) continue;
                        ctx.globalAlpha = node.presence; ctx.fillStyle = color(node.view, "node");
                        ctx.beginPath(); ctx.arc(node.point.x, node.point.y, geometry.radius, 0, 2 * Math.PI); ctx.fill();
                        const text = lineText(node.view.node.label ?? node.view.node.id);
                        if (text.trim()) { ctx.fillStyle = colors.text; ctx.fillText(text, node.point.x, node.point.y, Math.max(1, geometry.radius * 1.8)); }
                    }
                    for (const text of [...plan.labels, ...plan.captions]) {
                        ctx.globalAlpha = text.presence; ctx.fillStyle = colors.background;
                        ctx.fillRect(text.left, text.top, text.right - text.left, text.bottom - text.top);
                        ctx.fillStyle = colors.text; ctx.fillText(text.text, text.x, text.y);
                    }
                } catch (error) { failed = true; primary = error; }
                try { ctx.restore(); } catch (error) { if (!failed) throw error; }
                if (failed) throw primary;
            } finally { busy = false; }
        }
    });
}
