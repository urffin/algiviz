import { createSceneProjector, createSceneRenderer } from '@grundyjs/algiviz/scene';

/** @typedef {{vertex: {id:string,index:number,count:number,label:string,distance:number|null,status:string,start:boolean,target:boolean,path:boolean,complete:boolean},
 * connection: {from:string,to:string,active:boolean,tree:boolean,path:boolean,lane:number},
 * queueEntry: {index:number,label:string}}} GraphObjects */
const vertexId = id => 'vertex:' + id;

/** @returns {import('@grundyjs/algiviz/scene').Scene<GraphObjects>} */
export function graphScene(state) {
    const visited = new Set(state.visited), tree = new Set(state.treeEdges), path = new Set(state.path);
    const distances = new Map(state.distances.map(item => [item.id, item.distance]));
    const parents = new Map(state.parents.map(item => [item.id, item]));
    const labels = new Map(state.graph.nodes.map(node => [node.id, node.label]));
    const pathEdges = new Set();
    for (let i = 1; i < state.path.length; i++) {
        const a = parents.get(state.path[i - 1]), b = parents.get(state.path[i]);
        pathEdges.add(a.parent === b.id ? a.edge : b.edge);
    }
    const groups = new Map();
    for (const edge of state.graph.edges) {
        const key = JSON.stringify([edge.from, edge.to].sort());
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(edge);
    }
    const lanes = new Map();
    for (const edges of groups.values()) edges.forEach((edge, index) => lanes.set(edge.id,
        edge.from === edge.to ? index : (index - (edges.length - 1) / 2) * 18 * (edge.from < edge.to ? 1 : -1)));
    return { objects: [
        ...state.graph.edges.map(edge => ({
            id: 'connection:' + edge.id, type: 'connection', zIndex: 0,
            data: { from: vertexId(edge.from), to: vertexId(edge.to), active: edge.id === state.activeEdge,
                tree: tree.has(edge.id), path: pathEdges.has(edge.id), lane: lanes.get(edge.id) },
        })),
        ...state.graph.nodes.map((node, index) => ({
            id: vertexId(node.id), type: 'vertex', zIndex: 1,
            data: { id: node.id, index, count: state.graph.nodes.length, label: node.label,
                distance: distances.get(node.id), start: node.id === state.start, target: node.id === state.target,
                path: path.has(node.id), complete: state.phase !== 'traversal',
                status: node.id === state.current ? 'active' : visited.has(node.id) ? 'visited'
                    : distances.get(node.id) !== null ? 'queued' : 'unseen' },
        })),
        ...state.queue.map((id, index) => ({
            id: 'queue:' + id, type: 'queueEntry', zIndex: 2,
            data: { index, label: labels.get(id) },
        })),
    ] };
}

const positions = {
    layers: { A: [.48, 0], B: [.18, .34], C: [.78, .34], D: [0, .68], E: [.48, .68], F: [1, .68], G: [.48, 1], H: [1, 0] },
    chain: { A: [.08, 0], B: [.5, .25], C: [.92, .5], D: [.5, .75], E: [.08, 1] },
    diamond: { A: [.5, 0], B: [.05, .5], C: [.95, .5], D: [.5, 1] },
};
export function graphLayout(width, count, shape = 'circle') {
    if (!Number.isFinite(width) || width < 180 || !Number.isInteger(count) || count < 1)
        throw new RangeError('Invalid graph viewport');
    const wide = width >= 700, graphWidth = wide ? Math.floor(width * .64) : width;
    const graphHeight = 344, queueLeft = wide ? graphWidth + 20 : 12;
    const queueTop = wide ? 16 : graphHeight + 12;
    const queueWidth = width - queueLeft - 12, columns = Math.max(1, Math.floor(queueWidth / 52));
    const pitch = queueWidth / columns, rows = Math.max(1, Math.ceil(Math.max(1, count - 1) / columns));
    return { height: Math.max(graphHeight, queueTop + 114 + rows * 54), graphWidth, graphHeight, queueLeft, queueTop, queueWidth,
        node(id, index) {
            const fixed = Object.hasOwn(positions, shape) && Object.hasOwn(positions[shape], id) ? positions[shape][id] : null;
            const angle = -Math.PI / 2 + index * 2 * Math.PI / count;
            const [nx, ny] = fixed ?? [.5 + Math.cos(angle) * .42, .5 + Math.sin(angle) * .44];
            const margin = fixed ? 28 : 56;
            return { x: margin + nx * (graphWidth - margin * 2), y: 66 + ny * (graphHeight - 108) };
        },
        queue(index) { return { x: queueLeft + index % columns * pitch, y: queueTop + 90 + Math.floor(index / columns) * 54, width: Math.min(54, pitch - 6) }; },
    };
}

export function createGraphRenderer({ layout: shape = 'circle' } = {}) {
    const project = createSceneProjector(graphScene);
    let layout;
    const point = data => layout.node(data.id, data.index);
    const renderer = createSceneRenderer({
        connection(ctx, object, scene) {
            const data = (object.current ?? object.previous).data;
            const a = scene.get(data.from), b = scene.get(data.to);
            if (!a || !b) return;
            const from = point((a.current ?? a.previous).data), to = point((b.current ?? b.previous).data);
            const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
            const control = length ? { x: (from.x + to.x) / 2 - dy / length * data.lane,
                y: (from.y + to.y) / 2 + dx / length * data.lane } : null;
            ctx.save();
            try {
                ctx.strokeStyle = data.path ? '#34d399' : data.active ? '#fbbf24' : data.tree ? '#c4b5fd' : '#64748b';
                ctx.lineWidth = data.path || data.active ? 4 : data.tree ? 2.5 : 1.5;
                ctx.beginPath();
                if (!length) ctx.arc(from.x + 18, from.y - 18, 22 + data.lane * 6, 0, Math.PI * 2);
                else {
                    ctx.moveTo(from.x + dx / length * 20, from.y + dy / length * 20);
                    ctx.quadraticCurveTo(control.x, control.y, to.x - dx / length * 20, to.y - dy / length * 20);
                }
                ctx.stroke();
                if (data.active && scene.event.kind === 'examine') {
                    const reverse = vertexId(scene.event.source) === data.to;
                    const p = reverse ? 1 - scene.progress : scene.progress;
                    const x = length ? (1 - p) ** 2 * from.x + 2 * (1 - p) * p * control.x + p ** 2 * to.x : from.x + 18 + Math.cos(p * 2 * Math.PI) * (22 + data.lane * 6);
                    const y = length ? (1 - p) ** 2 * from.y + 2 * (1 - p) * p * control.y + p ** 2 * to.y : from.y - 18 + Math.sin(p * 2 * Math.PI) * (22 + data.lane * 6);
                    ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
                }
            } finally { ctx.restore(); }
        },
        vertex(ctx, object) {
            const data = (object.current ?? object.previous).data, pos = point(data);
            ctx.save();
            try {
                ctx.fillStyle = data.path ? '#34d399' : { active: '#fbbf24', visited: '#94a3b8', queued: '#c4b5fd', unseen: '#101827' }[data.status];
                ctx.strokeStyle = data.path ? '#34d399' : data.status === 'active' ? '#fbbf24' : '#94a3b8';
                ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                if (data.status === 'active' || data.target || data.path) {
                    ctx.setLineDash(data.target && !data.path && data.status !== 'active' ? [3, 4] : []);
                    ctx.beginPath(); ctx.arc(pos.x, pos.y, 25, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
                }
                ctx.fillStyle = data.status === 'unseen' && !data.path ? '#f1f5f9' : '#101827';
                ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(data.label, pos.x, pos.y, 34);
                if (data.status === 'visited') { ctx.font = '11px system-ui'; ctx.fillText('✓', pos.x + 13, pos.y + 13); }
                // Keep distances legible where a vertical edge continues below a vertex.
                ctx.fillStyle = '#101827'; ctx.fillRect(pos.x - 26, pos.y + 27, 52, 16);
                ctx.fillStyle = '#cbd5e1'; ctx.font = '12px system-ui';
                ctx.fillText('d = ' + (data.distance ?? (data.complete ? '∞' : '—')), pos.x, pos.y + 35);
                if (data.start || data.target) {
                    // Side labels cannot collide with the distance of the node one level above.
                    const right = pos.x <= layout.graphWidth / 2;
                    ctx.textAlign = right ? 'left' : 'right';
                    ctx.fillText(data.start && data.target ? 'S / T' : data.start ? 'start' : 'target', pos.x + (right ? 31 : -31), pos.y, 64);
                }
            } finally { ctx.restore(); }
        },
        queueEntry(ctx, object) {
            const data = (object.current ?? object.previous).data;
            const from = layout.queue((object.previous ?? object.current).data.index), to = layout.queue(data.index);
            const p = Math.min(1, object.progress * 4);
            const x = from.x + (to.x - from.x) * p, y = from.y + (to.y - from.y) * p;
            ctx.save();
            try {
                ctx.globalAlpha = object.phase === 'exit' ? 1 - p : object.phase === 'enter' ? p : 1;
                ctx.fillStyle = '#c4b5fd'; ctx.fillRect(x, y, to.width, 40);
                ctx.fillStyle = '#101827'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(data.label, x + to.width / 2, y + 20, to.width - 8);
            } finally { ctx.restore(); }
        },
    });
    return {
        render(ctx, frame, cssWidth = ctx.canvas.width, cssHeight = ctx.canvas.height) {
            layout = graphLayout(cssWidth, frame.current.graph.nodes.length, shape);
            ctx.save();
            try {
                // Keep the caller's DPR transform; layout uses logical CSS pixels, not bitmap dimensions.
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#101827'; ctx.fillRect(0, 0, cssWidth, cssHeight);
                ctx.fillStyle = '#cbd5e1'; ctx.font = '12px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
                ctx.fillText('GRAPH', 12, 22);
                ctx.fillText('Current: ' + (frame.current.current ?? '—'), layout.queueLeft, layout.queueTop + 12);
                ctx.fillText('QUEUE', layout.queueLeft, layout.queueTop + 43);
                ctx.fillText('Front', layout.queueLeft, layout.queueTop + 73);
                ctx.textAlign = 'right'; ctx.fillText('Back', cssWidth - 18, layout.queueTop + 73);
                if (!frame.current.queue.length && frame.progress === 1) {
                    ctx.textAlign = 'left'; ctx.fillText('Empty', layout.queueLeft, layout.queueTop + 115);
                }
                renderer.render(ctx, project(frame));
            } finally { ctx.restore(); }
        },
    };
}
