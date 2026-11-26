import type { Frame } from "../playback/types.js";
import type { GraphSnapshot, GraphObjects, GraphEdgeView } from "../graph/types.js";
import { graphScene } from "../graph/scene.js";
import { array, record, string } from "../graph/validation.js";
import { createSceneFrame, type Scene } from "../scene/index.js";
import { graphGeometry, type GraphEdgePaint } from "./graph-geometry.js";
import { graphCaptions, graphEdgeLabels } from "./graph-captions.js";
import { withDrawCallback } from "./draw-callback.js";

export interface GraphPalette {
    readonly background: string;
    readonly text: string;
    readonly node: string;
    readonly edge: string;
    readonly active: string;
    readonly visited: string;
    readonly queued: string;
    readonly result: string;
}
export interface GraphEdgeStrokeOptions {
    readonly dash?: readonly number[] | undefined;
}
export interface GraphEdgeDrawContext<E = unknown> {
    readonly ctx: CanvasRenderingContext2D;
    readonly view: GraphEdgeView<E>;
    readonly curve: GraphEdgePaint["curve"];
    readonly arrow: GraphEdgePaint["arrow"];
    readonly drawStroke: (options?: GraphEdgeStrokeOptions) => void;
    readonly drawArrow: () => void;
}
export type GraphEdgeDrawer<E = unknown> = (this: void, drawing: GraphEdgeDrawContext<E>) => void;
export type GraphEdgeBender<E = unknown> = (this: void, view: GraphEdgeView<E>) => number | undefined;
export interface GraphRendererOptions<E = unknown> {
    readonly theme: "light" | "dark";
    readonly colors?: { readonly [K in keyof GraphPalette]?: string | undefined } | undefined;
    readonly roleColors?: Readonly<Record<string, string>> | undefined;
    readonly nodeCaptions?: "auto" | "hidden" | undefined;
    readonly edgeLabels?: {
        readonly placement: "auto";
        readonly preferredSide?: "left" | "right" | undefined;
    } | undefined;
    readonly topologyTransitions?: boolean | undefined;
    readonly drawEdge?: GraphEdgeDrawer<E> | undefined;
    readonly edgeBend?: GraphEdgeBender<E> | undefined;
    readonly nodeRadius?: number | undefined;
}
export interface GraphRenderSize {
    readonly width: number;
    readonly height: number;
}
export interface GraphRenderer {
    render<N, E, Event>(context: CanvasRenderingContext2D, frame: Frame<GraphSnapshot<N, E>, Event>, size: GraphRenderSize): void;
}
export interface GraphRendererWithEdgeData<E> {
    readonly render: <N, Event>(context: CanvasRenderingContext2D, frame: Frame<GraphSnapshot<N, E>, Event>, size: GraphRenderSize) => void;
}

const palettes: Readonly<Record<"light" | "dark", GraphPalette>> = {
    dark: { background: "#101827", text: "#f1f5f9", node: "#334155", edge: "#94a3b8",
        active: "#fbbf24", visited: "#64748b", queued: "#a78bfa", result: "#34d399" },
    light: { background: "#f8fafc", text: "#0f172a", node: "#e2e8f0", edge: "#475569",
        active: "#fbbf24", visited: "#94a3b8", queued: "#c4b5fd", result: "#047857" }
};
function dimension(value: unknown): number {
    if (typeof value !== "number") throw new TypeError("Graph drawing dimensions must be numbers");
    if (!Number.isFinite(value) || value < 0) throw new RangeError("Graph drawing dimensions must be finite and nonnegative");
    return value;
}

/** Optional full-bitmap graph drawing. The caller owns CSS/bitmap size and redraw scheduling. */
export function createGraphRenderer(options: GraphRendererOptions & {
    readonly drawEdge?: undefined;
    readonly edgeBend?: undefined;
}): GraphRenderer;
export function createGraphRenderer<E>(options: GraphRendererOptions<E>): GraphRendererWithEdgeData<E>;
export function createGraphRenderer(options: GraphRendererOptions): GraphRenderer;
export function createGraphRenderer<E>(options: GraphRendererOptions<E>): GraphRenderer {
    const fields = record(options, ["theme", "colors", "roleColors", "nodeCaptions", "edgeLabels", "drawEdge", "edgeBend", "nodeRadius"], ["theme"]);
    if (fields.theme !== "light" && fields.theme !== "dark") throw new TypeError("Graph renderer theme must be light or dark");
    const colors = { ...palettes[fields.theme] }, keys = Object.keys(colors) as (keyof GraphPalette)[];
    if (fields.colors !== undefined) {
        const overrides = record(fields.colors, keys, []);
        for (const key of keys) if (overrides[key] !== undefined) colors[key] = string(overrides[key]);
    }
    const roles = new Map<string, string>();
    if (fields.roleColors !== undefined) {
        // Validate the container before enumerating its own string role names.
        record(fields.roleColors, [], []);
        const names = Object.getOwnPropertyNames(fields.roleColors);
        const overrides = record(fields.roleColors, names);
        for (const name of names) roles.set(string(name), string(overrides[name]));
    }
    if (fields.nodeCaptions !== undefined && fields.nodeCaptions !== "auto" && fields.nodeCaptions !== "hidden")
        throw new TypeError("Graph node captions must be auto or hidden");
    const captionsHidden = fields.nodeCaptions === "hidden";
    let edgeLabelSide: "left" | "right" | undefined;
    if (fields.edgeLabels !== undefined) {
        const labels = record(fields.edgeLabels, ["placement", "preferredSide"], ["placement"]);
        if (labels.placement !== "auto") throw new TypeError("Graph edge label placement must be auto");
        const side = labels.preferredSide;
        if (side !== undefined && side !== "left" && side !== "right")
            throw new TypeError("Graph edge label preferred side must be left or right");
        edgeLabelSide = side ?? "left";
    }
    const topology = Object.getOwnPropertyDescriptor(options, "topologyTransitions");
    if (topology && (!("value" in topology) || (topology.value !== undefined && typeof topology.value !== "boolean"))) {
        throw new TypeError("Graph topologyTransitions must be a boolean data property");
    }
    const topologyTransitions = topology?.value === true;
    if (fields.drawEdge !== undefined && typeof fields.drawEdge !== "function") throw new TypeError("Graph drawEdge must be a function");
    const drawEdge = fields.drawEdge as GraphEdgeDrawer | undefined;
    if (fields.edgeBend !== undefined && typeof fields.edgeBend !== "function") throw new TypeError("Graph edgeBend must be a function");
    const edgeBend = fields.edgeBend as GraphEdgeBender | undefined;
    const nodeRadius = fields.nodeRadius === undefined ? 16 : fields.nodeRadius;
    if (typeof nodeRadius !== "number") throw new TypeError("Graph node radius must be a number");
    if (!Number.isFinite(nodeRadius) || nodeRadius <= 0) throw new RangeError("Graph node radius must be finite and positive");
    function color(view: { readonly result: boolean; readonly role: string | null }, base: "node" | "edge"): string {
        if (view.result) return colors.result;
        if (view.role !== null) {
            const custom = roles.get(view.role);
            if (custom !== undefined) return custom;
            if (view.role === "active" || view.role === "visited" || view.role === "queued") return colors[view.role];
        }
        return colors[base];
    }
    type Cached = { state: GraphSnapshot; scene: Scene<GraphObjects> };
    let cache: Cached[] = [], busy = false;
    return Object.freeze({
        render<N, E, Event>(ctx: CanvasRenderingContext2D, frame: Frame<GraphSnapshot<N, E>, Event>, size: GraphRenderSize): void {
            if (busy) throw new Error("Graph renderer cannot render recursively");
            busy = true;
            try {
                const dimensions = record(size, ["width", "height"]);
                const width = dimension(dimensions.width), height = dimension(dimensions.height);
                const progress: unknown = frame.progress;
                if (typeof progress !== "number") throw new TypeError("Graph progress must be a number");
                if (!Number.isFinite(progress) || progress < 0 || progress > 1) throw new RangeError("Graph progress must be between zero and one");
                const next: Cached[] = [];
                function endpoint(state: GraphSnapshot) {
                    const item = [...next, ...cache].find(item => Object.is(item.state, state))
                        ?? { state, scene: graphScene(state, { namespace: "graph" }) };
                    if (!next.includes(item)) next.push(item);
                    return item.scene;
                }
                const previous = endpoint(frame.previous), current = endpoint(frame.current);
                const bitmapWidth = dimension(ctx.canvas.width), bitmapHeight = dimension(ctx.canvas.height);
                if (width === 0 || height === 0 || bitmapWidth === 0 || bitmapHeight === 0) { cache = next; return; }
                const sx = bitmapWidth / width, sy = bitmapHeight / height;
                if (![sx, sy].every(value => Number.isFinite(value) && value > 0)) throw new RangeError("Graph bitmap transform is not representable");
                const scene = createSceneFrame({ previous, current, progress, stepIndex: 0, event: undefined });
                const geometry = graphGeometry(scene, width, height, nodeRadius, topologyTransitions, edgeBend);
                const edges = geometry.edges.map(edge => ({ ...edge, color: color(edge.view, "edge"),
                    text: edge.showLabel ? edge.view.edge.label ?? (edge.view.edge.weight === undefined ? "" : String(edge.view.edge.weight)) : "" }));
                const nodes = geometry.nodes.map(node => ({ ...node, color: color(node.view, "node"), text: node.view.node.label ?? node.view.node.id }));
                cache = next;
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
                    const labels = edgeLabelSide === undefined ? undefined
                        : graphEdgeLabels(ctx, nodes, edges, geometry.radius, width, height, edgeLabelSide);
                    const captions = captionsHidden ? [] : graphCaptions(ctx, nodes, labels === undefined ? edges : edges.map(edge => {
                        const label = labels.get(edge);
                        return label ? { ...edge, label } : { ...edge, text: "" };
                    }), geometry.radius, width, height);
                    if (topologyTransitions) ctx.clearRect(0, 0, width, height);
                    ctx.fillStyle = colors.background; ctx.fillRect(0, 0, width, height);
                    function stroke(edge: GraphEdgePaint): void {
                        const [a, b, c, d] = edge.curve;
                        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(b.x, b.y, c.x, c.y, d.x, d.y); ctx.stroke();
                    }
                    function arrowhead(edge: GraphEdgePaint): void {
                        if (edge.arrow.length) {
                            ctx.beginPath(); ctx.moveTo(edge.arrow[0]!.x, edge.arrow[0]!.y);
                            ctx.lineTo(edge.arrow[1]!.x, edge.arrow[1]!.y); ctx.lineTo(edge.arrow[2]!.x, edge.arrow[2]!.y); ctx.closePath(); ctx.fill();
                        }
                    }
                    for (const edge of edges) {
                        ctx.globalAlpha = edge.presence; ctx.strokeStyle = edge.color; ctx.fillStyle = edge.color;
                        const lineWidth = edge.view.result || edge.view.role === "active" ? 3 : 1.5;
                        ctx.lineWidth = lineWidth;
                        if (drawEdge === undefined) {
                            stroke(edge);
                            arrowhead(edge);
                        } else if (edge.presence > 0) {
                            for (const point of edge.curve) Object.freeze(point);
                            for (const point of edge.arrow) Object.freeze(point);
                            const curve = Object.freeze(edge.curve), arrow = Object.freeze(edge.arrow);
                            withDrawCallback(ctx, assertActive => {
                                drawEdge({ ctx, view: edge.view, curve, arrow,
                                    drawStroke(options) {
                                        assertActive();
                                        const dash = options === undefined ? undefined : record(options, ["dash"], []).dash;
                                        const pattern = dash === undefined ? [] : array(dash).map(segment => {
                                            if (typeof segment !== "number") throw new TypeError("Graph dash lengths must be numbers");
                                            if (!Number.isFinite(segment) || segment < 0) throw new RangeError("Graph dash lengths must be finite and nonnegative");
                                            return segment;
                                        });
                                        ctx.globalAlpha = edge.presence; ctx.strokeStyle = edge.color; ctx.lineWidth = lineWidth;
                                        ctx.setLineDash(pattern); ctx.lineDashOffset = 0;
                                        stroke(edge);
                                    },
                                    drawArrow() {
                                        assertActive();
                                        ctx.globalAlpha = edge.presence; ctx.fillStyle = edge.color;
                                        arrowhead(edge);
                                    } });
                            });
                        }
                        if (!labels && edge.text) { ctx.fillStyle = colors.text; ctx.fillText(edge.text, edge.label.x, edge.label.y); }
                    }
                    if (labels) for (const label of labels.values()) {
                        ctx.globalAlpha = label.presence; ctx.fillStyle = colors.text;
                        ctx.fillText(label.text, label.x, label.y);
                    }
                    for (const node of nodes) {
                        ctx.globalAlpha = node.presence; ctx.fillStyle = node.color;
                        ctx.beginPath(); ctx.arc(node.point.x, node.point.y, geometry.radius, 0, 2 * Math.PI); ctx.fill();
                        if (node.text) { ctx.fillStyle = colors.text; ctx.fillText(node.text, node.point.x, node.point.y, Math.max(1, geometry.radius * 1.8)); }
                    }
                    for (const caption of captions) {
                        ctx.globalAlpha = caption.presence; ctx.fillStyle = colors.background;
                        ctx.fillRect(caption.left, caption.top, caption.right - caption.left, caption.bottom - caption.top);
                        ctx.fillStyle = colors.text; ctx.fillText(caption.text, caption.x, caption.y);
                    }
                } catch (error) { failed = true; primary = error; }
                try { ctx.restore(); } catch (error) { if (!failed) throw error; }
                if (failed) throw primary;
            } finally { busy = false; }
        }
    });
}
