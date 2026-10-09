import { createSceneRenderer } from '@grundyjs/algiviz/scene';

// Everything about the tree, its algorithm and its visual types belongs to the app.
const nodes = [
    { id: 'a', label: 'A', x: 0.5, y: 0.18, children: ['b', 'c'] },
    { id: 'b', label: 'B', x: 0.26, y: 0.47, children: ['d', 'e'] },
    { id: 'c', label: 'C', x: 0.74, y: 0.47, children: [] },
    { id: 'd', label: 'D', x: 0.13, y: 0.77, children: [] },
    { id: 'e', label: 'E', x: 0.39, y: 0.77, children: [] }
];

export function* treeSteps() {
    const visited = new Set();
    let index = 0;
    const emit = (kind, active) => {
        const objects = [];
        for (const node of nodes) {
            if (!visited.has(node.id)) continue;
            objects.push(Object.freeze({ id: node.id, type: 'node', zIndex: 1,
                data: Object.freeze({ label: node.label, x: node.x, y: node.y, active: node.id === active }) }));
            for (const child of node.children) if (visited.has(child)) objects.push(Object.freeze({
                id: `${node.id}-${child}`, type: 'edge', zIndex: 0,
                data: Object.freeze({ from: node.id, to: child })
            }));
        }
        if (active) objects.push(Object.freeze({ id: 'cursor', type: 'pointer', zIndex: 2,
            data: Object.freeze({ target: active }) }));
        return Object.freeze({ index: index++, event: Object.freeze({ kind, active }),
            state: Object.freeze({ objects: Object.freeze(objects) }) });
    };
    yield emit('start', null);
    function* visit(id) {
        visited.add(id);
        yield emit('visit', id);
        for (const child of nodes.find(node => node.id === id).children) yield* visit(child);
    }
    yield* visit('a');
    yield emit('finished', null); // The pointer exits, while the tree remains.
}

function position(transition, width, height) {
    if (!transition) return null;
    const before = (transition.previous ?? transition.current).data;
    const after = (transition.current ?? transition.previous).data;
    if (!('x' in before) || !('x' in after)) return null;
    const p = transition.progress;
    return { x: (before.x + (after.x - before.x) * p) * width,
        y: (before.y + (after.y - before.y) * p) * height };
}

export const treeRenderer = createSceneRenderer({
    edge(ctx, object, scene) {
        const { from, to } = (object.current ?? object.previous).data;
        const a = scene.get(from), b = scene.get(to);
        const start = position(a, ctx.canvas.width, ctx.canvas.height);
        const end = position(b, ctx.canvas.width, ctx.canvas.height);
        if (!start || !end) return;
        ctx.save();
        try {
            ctx.globalAlpha = Math.min(object.presence, a.presence, b.presence);
            ctx.strokeStyle = '#64748b'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        } finally { ctx.restore(); }
    },
    node(ctx, object) {
        const point = position(object, ctx.canvas.width, ctx.canvas.height);
        const data = (object.current ?? object.previous).data;
        ctx.save();
        try {
            ctx.globalAlpha = object.presence;
            ctx.fillStyle = data.active ? '#fbbf24' : '#34d399';
            ctx.beginPath(); ctx.arc(point.x, point.y, 24, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#101827'; ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(data.label, point.x, point.y);
        } finally { ctx.restore(); }
    },
    pointer(ctx, object, scene) {
        // References can change while the cursor keeps its own stable identity.
        const oldTarget = (object.previous ?? object.current).data.target;
        const newTarget = (object.current ?? object.previous).data.target;
        const a = position(scene.get(oldTarget), ctx.canvas.width, ctx.canvas.height);
        const b = position(scene.get(newTarget), ctx.canvas.width, ctx.canvas.height);
        if (!a || !b) return;
        const x = a.x + (b.x - a.x) * object.progress;
        const y = a.y + (b.y - a.y) * object.progress - 36;
        ctx.save();
        try {
            ctx.globalAlpha = object.presence; ctx.fillStyle = '#c4b5fd';
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 9, y - 15); ctx.lineTo(x + 9, y - 15); ctx.closePath(); ctx.fill();
        } finally { ctx.restore(); }
    }
});
