import { createSceneRenderer, createSceneProjector } from "@grundyjs/algiviz/scene";
export function heapItemLabel(item, original) {
    const equal = original.filter(other => other.value === item.value);
    const index = equal.findIndex(other => other.id === item.id);
    return `${item.value}${equal.length > 1 ? (index < 26 ? String.fromCharCode(97 + index) : `#${index + 1}`) : ""}`;
}
export function heapLayout(width, count) {
    const levels = Math.max(1, Math.ceil(Math.log2(count + 1)));
    const dense = count > 15;
    const columns = dense ? Math.max(1, count) : Math.max(1, Math.min(Math.max(1, count), Math.floor((width - 24) / 48)));
    const arrayTop = 84 + levels * 66;
    const pitch = (width - 24) / columns;
    return {
        height: arrayTop + Math.max(1, Math.ceil(count / columns)) * 64 + 24,
        radius: Math.max(0.1, Math.min(21, (width - 24) / 2 ** (levels - 1) * 0.42)),
        cellRadius: Math.min(21, pitch * 0.42),
        pitch,
        tree(index) {
            const depth = Math.floor(Math.log2(index + 1));
            return { x: 12 + ((index - (2 ** depth - 1) + 0.5) * (width - 24)) / 2 ** depth, y: 60 + depth * 66 };
        },
        array(index) {
            return { x: 12 + ((index % columns) + 0.5) * pitch, y: arrayTop + Math.floor(index / columns) * 64 };
        },
        arrayTop
    };
}
export function heapScene(state) {
    const objects = [];
    for (let child = 1; child < state.heapSize; child++) {
        objects.push({
            id: `edge:${child}`,
            type: "edge",
            data: { parent: Math.floor((child - 1) / 2), child },
            zIndex: 0
        });
    }
    state.main.forEach((item, index) => {
        const color = index >= state.heapSize ? "#34d399"
            : index === state.candidate ? "#67e8f9"
                : index === state.left || index === state.right || index === state.parent ? "#fbbf24"
                    : "#a5b4fc";
        for (const view of ["tree", "array"]) {
            if (view === "tree" && index >= state.heapSize)
                continue;
            objects.push({
                id: `${view}:${item.id}`,
                type: "item",
                zIndex: 1,
                data: { item, index, view, color, parent: index === state.parent }
            });
        }
    });
    return { objects };
}
export function createHeapRenderer(en, original) {
    const projectFrame = createSceneProjector(heapScene);
    const labels = new Map();
    const groups = new Map();
    for (const item of original) { const group = groups.get(item.value) ?? []; group.push(item); groups.set(item.value, group); }
    for (const group of groups.values()) group.forEach((item,i) => labels.set(item.id, `${item.value}${group.length > 1 ? (i < 26 ? String.fromCharCode(97+i) : `#${i+1}`) : ""}`));
    const renderer = createSceneRenderer({
        edge(ctx, object) {
            const data = object.current?.data ?? object.previous?.data;
            if (!data)
                return;
            const layout = heapLayout(ctx.canvas.width, original.length);
            const a = layout.tree(data.parent), b = layout.tree(data.child);
            ctx.save();
            ctx.globalAlpha = object.presence;
            ctx.strokeStyle = "#64748b";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.restore();
        },
        item(ctx, object, scene) {
            const data = object.current?.data ?? object.previous?.data;
            if (!data)
                return;
            const layout = heapLayout(ctx.canvas.width, original.length);
            const from = layout[data.view](object.previous?.data.index ?? data.index);
            const to = layout[data.view](data.index);
            const p = scene.progress;
            const x = from.x + (to.x - from.x) * p, y = from.y + (to.y - from.y) * p;
            const radius = data.view === "tree" ? layout.radius : layout.cellRadius;
            ctx.save();
            ctx.globalAlpha = object.presence;
            ctx.fillStyle = data.color;
            ctx.beginPath();
            if (data.view === "tree")
                ctx.arc(x, y, radius, 0, Math.PI * 2);
            else
                ctx.roundRect(x - radius, y - 19, radius * 2, 38, Math.min(5, radius));
            ctx.fill();
            if (data.parent) {
                ctx.strokeStyle = "#f8fafc";
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            ctx.fillStyle = "#111827";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const label = labels.get(data.item.id);
            ctx.font = `${Math.min(14, radius * 0.85)}px Arial`;
            if (radius >= 10) ctx.fillText(label.length > 6 ? `${label.slice(0, 4)}…` : label, x, y, radius * 1.85);
            ctx.restore();
        }
    });
    return {
        render(ctx, frame) {
            const layout = heapLayout(ctx.canvas.width, original.length);
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.fillStyle = "#111827";
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.fillStyle = "#f9fafb";
            ctx.font = "14px Arial";
            ctx.textAlign = "left";
            ctx.fillText(en ? "Max-heap" : "Максимальная куча", 12, 22);
            ctx.fillText(en ? "Array (indices below)" : "Массив (индексы снизу)", 12, layout.arrayTop - 32);
            renderer.render(ctx, projectFrame(frame));
            ctx.font = "11px Arial";
            ctx.textAlign = "center";
            ctx.fillStyle = "#cbd5e1";
            original.forEach((_, index) => {
                const a = layout.array(index), t = layout.tree(index);
                if (layout.cellRadius >= 10) ctx.fillText(String(index), a.x, a.y + 32);
                if (layout.radius >= 10 && index < frame.current.heapSize)
                    ctx.fillText(String(index), t.x, t.y + layout.radius + 13);
            });
            const boundary = frame.current.heapSize;
            if (boundary < original.length) {
                const point = layout.array(boundary);
                ctx.strokeStyle = "#34d399";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(point.x - layout.pitch / 2, point.y - 22);
                ctx.lineTo(point.x - layout.pitch / 2, point.y + 22);
                ctx.stroke();
            }
            if (!original.length) {
                ctx.fillStyle = "#cbd5e1";
                ctx.fillText(en ? "Empty array" : "Пустой массив", ctx.canvas.width / 2, 65);
            }
        }
    };
}
