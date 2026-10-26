// Example-owned scene types and drawing; public /scene APIs only.
import { createSceneProjector, createSceneRenderer } from "@grundyjs/algiviz/scene";
const buttonInk = () => "#101827";
/** Match the BFS layouts so traversal, rather than a moving graph, is the comparison. */
export const dfsPositions = {
    layers: {
        A: { x: 0.48, y: 0 },
        B: { x: 0.18, y: 0.34 },
        C: { x: 0.78, y: 0.34 },
        D: { x: 0, y: 0.68 },
        E: { x: 0.48, y: 0.68 },
        F: { x: 1, y: 0.68 },
        G: { x: 0.48, y: 1 },
        H: { x: 1, y: 0 }
    },
    chain: {
        A: { x: 0.08, y: 0 },
        B: { x: 0.5, y: 0.25 },
        C: { x: 0.92, y: 0.5 },
        D: { x: 0.5, y: 0.75 },
        E: { x: 0.08, y: 1 }
    },
    diamond: { A: { x: 0.5, y: 0 }, B: { x: 0.05, y: 0.5 }, C: { x: 0.95, y: 0.5 }, D: { x: 0.5, y: 1 } }
};
export function dfsScene(state) {
    const next = new Map(state.path.slice(1).map((id, index) => [state.path[index], id]));
    const pathVertices = new Set(state.path);
    const labels = new Map(state.graph.vertices.map(vertex => [vertex.id, vertex.label]));
    return {
        objects: [
            ...state.graph.edges.map(edge => ({
                id: `edge:${edge.id}`,
                type: "edge",
                zIndex: 0,
                data: {
                    source: edge.source,
                    target: edge.target,
                    active: state.activeEdge?.edgeId === edge.id,
                    tree: state.parent[edge.source] === edge.target || state.parent[edge.target] === edge.source,
                    path: next.get(edge.source) === edge.target || next.get(edge.target) === edge.source
                }
            })),
            ...state.graph.vertices.map(vertex => ({
                id: `vertex:${vertex.id}`,
                type: "vertex",
                zIndex: 1,
                data: {
                    ...vertex,
                    status: state.status[vertex.id],
                    current: state.current === vertex.id,
                    start: state.start === vertex.id,
                    target: state.target === vertex.id,
                    path: pathVertices.has(vertex.id)
                }
            })),
            ...state.stack.map((call, index) => ({
                id: `call:${call.vertex}`,
                type: "call",
                zIndex: 2,
                data: {
                    ...call,
                    label: labels.get(call.vertex),
                    index,
                    degree: state.graph.adjacency[call.vertex].length,
                    current: index === state.stack.length - 1
                }
            }))
        ]
    };
}
/** Fixed stack capacity for the whole run prevents resizing during enter/return and seek. */
export function dfsLayout(width, positions, capacity) {
    if (!Number.isFinite(width) || width < 180 || !Number.isInteger(capacity) || capacity < 1)
        throw new RangeError("Invalid DFS viewport");
    const wide = width >= 700, graphWidth = wide ? Math.floor(width * 0.64) : width;
    const graphHeight = 344, stackLeft = wide ? graphWidth + 20 : 12, stackTop = wide ? 16 : graphHeight + 12;
    const stackWidth = wide ? width - stackLeft - 12 : width - 24;
    const stackHeight = 76 + capacity * 36;
    return {
        width,
        graphWidth,
        graphHeight,
        stackLeft,
        stackTop,
        stackWidth,
        height: Math.max(graphHeight, stackTop + stackHeight + 12),
        radius: 20,
        node(id) {
            const point = positions[id];
            if (!point)
                throw new RangeError(`Missing position: ${id}`);
            return { x: 28 + point.x * (graphWidth - 56), y: 66 + point.y * (graphHeight - 108) };
        },
        call(index) {
            return { x: stackLeft, y: stackTop + 48 + (capacity - 1 - index) * 36, width: stackWidth };
        },
        baseY: stackTop + 48 + capacity * 36 + 16
    };
}
export function createDfsRenderer(positions, text, colors, capacity) {
    const project = createSceneProjector(dfsScene);
    const renderer = createSceneRenderer({
        edge(ctx, object) {
            const data = object.current?.data;
            if (!data)
                return;
            const layout = dfsLayout(ctx.canvas.width, positions, capacity);
            const a = layout.node(data.source), b = layout.node(data.target);
            const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy), inset = layout.radius / length;
            if (length <= layout.radius * 2)
                return;
            ctx.save();
            ctx.strokeStyle =
                data.path ? colors.sorted
                    : data.active ? colors.active
                        : data.tree ? colors.held
                            : colors.muted;
            ctx.lineWidth =
                data.path || data.active ? 4
                    : data.tree ? 2.5
                        : 1.5;
            ctx.globalAlpha = data.path || data.active || data.tree ? 1 : 0.65;
            ctx.beginPath();
            ctx.moveTo(a.x + dx * inset, a.y + dy * inset);
            ctx.lineTo(b.x - dx * inset, b.y - dy * inset);
            ctx.stroke();
            ctx.restore();
        },
        vertex(ctx, object) {
            const data = object.current?.data;
            if (!data)
                return;
            const layout = dfsLayout(ctx.canvas.width, positions, capacity), { x, y } = layout.node(data.id), r = layout.radius;
            const fill = data.path ? colors.sorted
                : data.current ? colors.active
                    : data.status === "visiting" ? colors.held
                        : data.status === "finished" ? colors.bar
                            : colors.canvasBackground;
            ctx.save();
            ctx.fillStyle = fill;
            ctx.strokeStyle = data.status === "unseen" && !data.path ? colors.muted : fill;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            if (data.current || data.target || data.path) {
                ctx.strokeStyle =
                    data.path ? colors.sorted
                        : data.current ? colors.active
                            : colors.text;
                ctx.setLineDash(data.target && !data.path && !data.current ? [3, 4] : []);
                ctx.beginPath();
                ctx.arc(x, y, r + 5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.fillStyle = data.status === "unseen" && !data.path ? colors.text : buttonInk(fill);
            ctx.font = "bold 16px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(data.label, x, y, r * 1.6);
            ctx.font = "12px Arial";
            ctx.fillStyle = colors.muted;
            if (data.status === "finished")
                ctx.fillText("✓", x + r - 5, y + r + 7);
            if (data.start || data.target)
                ctx.fillText(data.start && data.target ? text.bothMark
                    : data.start ? text.startMark
                        : text.targetMark, Math.max(56, Math.min(layout.graphWidth - 56, x)), y - r - 15, 100);
            ctx.restore();
        },
        call(ctx, object, scene) {
            const data = object.current?.data ?? object.previous?.data;
            if (!data)
                return;
            const layout = dfsLayout(ctx.canvas.width, positions, capacity), box = layout.call(data.index);
            const p = Math.min(1, scene.progress * 4), fill = data.current ? colors.active : colors.held;
            ctx.save();
            ctx.globalAlpha =
                object.phase === "exit" ? 1 - p
                    : object.phase === "enter" ? p
                        : 1;
            ctx.fillStyle = fill;
            ctx.beginPath();
            ctx.roundRect(box.x, box.y, box.width, 30, 6);
            ctx.fill();
            ctx.fillStyle = buttonInk(fill);
            ctx.textBaseline = "middle";
            ctx.font = "bold 15px Arial";
            ctx.textAlign = "left";
            ctx.fillText(data.label, box.x + 10, box.y + 15, box.width / 3);
            ctx.textAlign = "right";
            ctx.font = "12px Arial";
            ctx.fillText(`${data.nextNeighbor}/${data.degree}${data.current ? " · " + text.top : ""}`, box.x + box.width - 10, box.y + 15, box.width * 0.65);
            ctx.restore();
        }
    });
    return {
        render(ctx, frame) {
            const layout = dfsLayout(ctx.canvas.width, positions, capacity), state = frame.current;
            ctx.fillStyle = colors.canvasBackground;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.save();
            ctx.fillStyle = colors.muted;
            ctx.font = "12px Arial";
            ctx.textAlign = "left";
            ctx.fillText(text.graph, 12, 22);
            ctx.fillText(text.stack, layout.stackLeft, layout.stackTop + 12);
            ctx.fillText(text.nextNeighbor, layout.stackLeft, layout.stackTop + 32);
            ctx.fillText(text.bottom, layout.stackLeft, layout.baseY);
            if (!state.stack.length && frame.progress === 1)
                ctx.fillText(text.empty, layout.stackLeft + 75, layout.baseY);
            if (ctx.canvas.width >= 700) {
                ctx.strokeStyle = colors.border;
                ctx.beginPath();
                ctx.moveTo(layout.graphWidth, 14);
                ctx.lineTo(layout.graphWidth, layout.height - 14);
                ctx.stroke();
            }
            ctx.restore();
            renderer.render(ctx, project(frame));
        }
    };
}
