import type { ListInput, ListPosition, ListSnapshot, ListNodeView, ListFrame } from "../list/types.js";
import { coordinate, model, record, string, text } from "../list/validation.js";
import { captureListScene } from "../list/scene.js";
import { createSceneFrame } from "../scene/index.js";
import { listGeometry, finite } from "./list-geometry.js";
import type { Box, Point } from "./list-geometry.js";
import { listText } from "./list-text.js";
import { saved, setup } from "./list-context.js";

export interface ListPalette {
    readonly background: string;
    readonly node: string;
    readonly border: string;
    readonly text: string;
    readonly caption: string;
    readonly pointer: string;
    readonly nullMarker: string;
    readonly active: string;
    readonly visited: string;
    readonly queued: string;
    readonly result: string;
    readonly resultText: string;
}
export interface ListNodePresentation {
    readonly label?: string | undefined;
    readonly color?: string | undefined;
}
export interface ListRendererOptions<Value = unknown> {
    readonly theme: "light" | "dark";
    readonly colors?: { readonly [K in keyof ListPalette]?: string | undefined } | undefined;
    readonly roleColors?: Readonly<Record<string, string>> | undefined;
    readonly nodeGap?: number | undefined;
    readonly pointerGap?: number | undefined;
    readonly presentNode?: ((this: void, node: ListNodeView<Value>, snapshot: ListSnapshot<Value>) => ListNodePresentation | undefined) | undefined;
    readonly nullPointers?: "visible" | "hidden" | undefined;
    readonly nodeCaptions?: "auto" | "hidden" | undefined;
}
export interface ListRenderSize {
    readonly width: number;
    readonly height: number;
}
export interface ListRenderer<Value = unknown> {
    layout(list: ListInput<Value>): readonly ListPosition[];
    render<Event>(context: CanvasRenderingContext2D, frame: ListFrame<Value, Event>, size: ListRenderSize): void;
}

const palettes: Readonly<Record<"light" | "dark", ListPalette>> = {
    light: {
        background: "#f8fafc", node: "#e2e8f0", border: "#94a3b8", text: "#0f172a", caption: "#475569",
        pointer: "#475569", nullMarker: "#64748b", active: "#fbbf24", visited: "#94a3b8", queued: "#c4b5fd",
        result: "#047857", resultText: "#ffffff"
    },
    dark: {
        background: "#101827", node: "#334155", border: "#64748b", text: "#f1f5f9", caption: "#cbd5e1",
        pointer: "#94a3b8", nullMarker: "#94a3b8", active: "#fbbf24", visited: "#64748b", queued: "#a78bfa",
        result: "#34d399", resultText: "#052e16"
    }
};
function dimension(value: unknown): number {
    const number = coordinate(value);
    if (number < 0) throw new RangeError("List drawing dimensions must be nonnegative");
    return number;
}
function positive(value: unknown): number {
    const number = dimension(value);
    if (number === 0) throw new RangeError("List drawing scale and gaps must be positive");
    return number;
}
function fill(ctx: CanvasRenderingContext2D, box: Box, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
}
function outline(ctx: CanvasRenderingContext2D, box: Box, color: string, width: number): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.strokeRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
}
function polyline(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
}

export function createListRenderer<Value = unknown>(options: ListRendererOptions<Value>): ListRenderer<Value> {
    const fields = record(options, ["theme", "colors", "roleColors", "nodeGap", "pointerGap",
        "presentNode", "nullPointers", "nodeCaptions"], ["theme"]);
    if (fields.theme !== "light" && fields.theme !== "dark") throw new TypeError("List renderer theme must be light or dark");
    const colors = { ...palettes[fields.theme] }, keys = Object.keys(colors) as (keyof ListPalette)[];
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
    const nodeGap = fields.nodeGap === undefined ? 4 : positive(fields.nodeGap);
    const pointerGap = fields.pointerGap === undefined ? 1 : positive(fields.pointerGap);
    if (fields.presentNode !== undefined && typeof fields.presentNode !== "function") throw new TypeError("List presenter must be a function");
    const presenter = fields.presentNode as ListRendererOptions<Value>["presentNode"];
    if (fields.nullPointers !== undefined && fields.nullPointers !== "visible" && fields.nullPointers !== "hidden") {
        throw new TypeError("List null pointers must be visible or hidden");
    }
    if (fields.nodeCaptions !== undefined && fields.nodeCaptions !== "auto" && fields.nodeCaptions !== "hidden") {
        throw new TypeError("List captions must be auto or hidden");
    }
    const showNull = fields.nullPointers !== "hidden", showCaptions = fields.nodeCaptions !== "hidden";
    function color(view: { role: string | null; result: boolean }, fallback: string): string {
        if (view.result) return colors.result;
        const role = view.role;
        const custom = role === null ? undefined : roles.get(role);
        if (custom !== undefined) return custom;
        return role === "active" || role === "visited" || role === "queued" ? colors[role] : fallback;
    }
    let busy = false;
    function enter(): void {
        if (busy) throw new Error("List renderer cannot be controlled recursively");
        busy = true;
    }
    return Object.freeze({
        layout(input: ListInput<Value>): readonly ListPosition[] {
            enter();
            try {
                const { list, byId } = model<Value>(input), positions = new Map<string, ListPosition>();
                let rank = 0;
                for (let id = list.headId; id !== null; id = byId.get(id)!.nextId) {
                    positions.set(id, Object.freeze({ nodeId: id, x: finite(rank++ * nodeGap), y: 0 }));
                }
                return Object.freeze(list.nodes.map(node => positions.get(node.id)!));
            } finally { busy = false; }
        },
        render<Event>(ctx: CanvasRenderingContext2D, frame: ListFrame<Value, Event>, size: ListRenderSize): void {
            enter();
            try {
                const dimensions = record(size, ["width", "height"]);
                const width = dimension(dimensions.width), height = dimension(dimensions.height);
                const input = record(frame, ["progress", "previous", "current"]), progress = dimension(input.progress);
                if (progress > 1) throw new RangeError("List progress must be between zero and one");
                const previous = captureListScene<Value>(input.previous, "list-canvas", true);
                const current = captureListScene<Value>(input.current, "list-canvas", true);
                const canvas = ctx.canvas, bitmapWidth = dimension(canvas.width), bitmapHeight = dimension(canvas.height);
                if (width === 0 || height === 0 || bitmapWidth === 0 || bitmapHeight === 0) return;
                const sx = positive(bitmapWidth / width), sy = positive(bitmapHeight / height);
                const background = () => {
                    ctx.clearRect(0, 0, width, height);
                    ctx.fillStyle = colors.background;
                    ctx.fillRect(0, 0, width, height);
                };
                if (width <= 24 || height <= 24) {
                    saved(ctx, () => { setup(ctx, sx, sy); background(); });
                    return;
                }
                const scene = createSceneFrame({ previous: previous.scene, current: current.scene, progress, event: undefined, stepIndex: 0 });
                const geometry = listGeometry(scene, previous.snapshot.layout, current.snapshot.layout, width, height, pointerGap);
                const presentations = geometry.nodes.map(({ view, exiting }) => {
                    const output = presenter?.(view, exiting ? previous.snapshot : current.snapshot);
                    const data = output === undefined ? undefined : record(output, ["label", "color"], []);
                    return { label: data?.label === undefined ? "" : text(data.label),
                        color: data?.color === undefined ? colors.node : string(data.color) };
                });
                const routes = geometry.routes.filter(route => route.alpha > 0 && (showNull || !route.marker));
                const markers = routes.flatMap(route => route.marker ? [route.marker] : []);
                const lineWidth = Math.min(2, geometry.scale * 0.08);
                saved(ctx, () => {
                    setup(ctx, sx, sy);
                    const obstacles = [...geometry.nodes.filter(node => node.alpha > 0).map(node => node.box),
                        geometry.head.box, ...markers.map(marker => marker.box)];
                    const plan = listText(ctx, obstacles);
                    for (const [i, node] of geometry.nodes.entries()) {
                        const main = { ...node.box, right: node.divider };
                        plan.add(main, node.box, node.alpha,
                            { text: presentations[i]!.label, max: 14, color: node.view.result ? colors.resultText : colors.text },
                            showCaptions ? { text: node.view.caption ?? "", max: 11,
                                color: node.view.result ? colors.resultText : colors.caption } : undefined);
                    }
                    const head = geometry.head;
                    plan.add(head.box, head.box, head.alpha,
                        { text: "head", max: 12, color: head.view.result ? colors.resultText : colors.text });
                    // The null marker is an outline. Its label sits on the canvas background.
                    for (const marker of markers) plan.add(marker.box, marker.box, marker.alpha,
                        { text: "null", max: 11, color: colors.text });
                    const holes = plan.items.map(({ box }) => ({
                        x: finite(box.left - 1), y: finite(box.top - 1),
                        width: finite(box.right - box.left + 2), height: finite(box.bottom - box.top + 2)
                    }));
                    background();
                    ctx.beginPath();
                    ctx.rect(4, 4, width - 8, height - 8);
                    ctx.clip();
                    if (routes.length) saved(ctx, () => {
                        ctx.beginPath();
                        ctx.rect(0, 0, width, height);
                        for (const hole of holes) ctx.rect(hole.x, hole.y, hole.width, hole.height);
                        ctx.clip("evenodd");
                        for (const route of routes) {
                            if (route.lineWidth <= 0) continue;
                            ctx.globalAlpha = route.alpha;
                            ctx.strokeStyle = color(route.view, route.marker ? colors.nullMarker : colors.pointer);
                            ctx.lineWidth = route.lineWidth;
                            polyline(ctx, route.points);
                            polyline(ctx, route.arrow);
                        }
                    });
                    for (const [i, node] of geometry.nodes.entries()) {
                        if (node.alpha === 0) continue;
                        const slot = geometry.pointerViews[i]!;
                        ctx.globalAlpha = node.alpha;
                        fill(ctx, { ...node.box, right: node.divider }, color(node.view, presentations[i]!.color));
                        fill(ctx, { ...node.box, left: node.divider }, color(slot, colors.node));
                        if (lineWidth > 0) {
                            outline(ctx, node.box, colors.border, lineWidth);
                            polyline(ctx, [{ x: node.divider, y: node.box.top }, { x: node.divider, y: node.box.bottom }]);
                        }
                        ctx.beginPath();
                        ctx.arc(node.port.x, node.port.y, Math.min(2, geometry.scale * 0.08), 0, Math.PI * 2);
                        ctx.fillStyle = slot.result ? colors.resultText : colors.pointer;
                        ctx.fill();
                    }
                    for (const marker of markers) {
                        ctx.globalAlpha = marker.alpha;
                        if (lineWidth > 0) outline(ctx, marker.box, color(marker.view, colors.nullMarker), lineWidth);
                    }
                    ctx.globalAlpha = 1;
                    fill(ctx, geometry.head.box, color(geometry.head.view, colors.node));
                    if (lineWidth > 0) outline(ctx, geometry.head.box, colors.border, lineWidth);
                    for (const item of plan.items) {
                        ctx.globalAlpha = item.alpha;
                        ctx.font = `${item.font}px sans-serif`;
                        ctx.fillStyle = item.color;
                        ctx.fillText(item.text, item.x, item.y);
                    }
                });
            } finally { busy = false; }
        }
    });
}
