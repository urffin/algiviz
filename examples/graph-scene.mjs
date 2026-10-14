import { createSceneProjector, createSceneRenderer } from '@grundyjs/algiviz/scene';

/** @typedef {{vertex: {index:number,count:number,label:string,distance:number|null,status:string},
 * connection: {from:string,to:string,active:boolean,tree:boolean},
 * queueEntry: {index:number,label:string}}} GraphObjects */
const vertexId = id => 'vertex:' + id;

/** @returns {import('@grundyjs/algiviz/scene').Scene<GraphObjects>} */
export function graphScene(state) {
    const visited = new Set(state.visited), tree = new Set(state.treeEdges);
    const distances = new Map(state.distances.map(item => [item.id, item.distance]));
    const labels = new Map(state.graph.nodes.map(node => [node.id, node.label]));
    return { objects: [
        ...state.graph.edges.map(edge => ({
            id: 'connection:' + edge.id, type: 'connection', zIndex: 0,
            data: { from: vertexId(edge.from), to: vertexId(edge.to),
                active: edge.id === state.activeEdge, tree: tree.has(edge.id) },
        })),
        ...state.graph.nodes.map((node, index) => ({
            id: vertexId(node.id), type: 'vertex', zIndex: 1,
            data: { index, count: state.graph.nodes.length, label: node.label,
                distance: distances.get(node.id),
                status: node.id === state.current ? 'active' : visited.has(node.id) ? 'visited'
                    : distances.get(node.id) !== null ? 'queued' : 'unseen' },
        })),
        ...state.queue.map((id, index) => ({
            id: 'queue:' + id, type: 'queueEntry', zIndex: 2,
            data: { index, label: labels.get(id) },
        })),
    ] };
}
function point(data, ctx) {
    const angle = -Math.PI / 2 + data.index * 2 * Math.PI / Math.max(1, data.count);
    return { x: ctx.canvas.width / 2 + Math.cos(angle) * ctx.canvas.width * .33,
        y: 210 + Math.sin(angle) * 150 };
}
export function createGraphRenderer() {
    const project = createSceneProjector(graphScene);
    const renderer = createSceneRenderer({
        connection(ctx, object, scene) {
            const data = (object.current ?? object.previous).data;
            const a = scene.get(data.from), b = scene.get(data.to);
            if (!a || !b) return;
            const from = point((a.current ?? a.previous).data, ctx);
            const to = point((b.current ?? b.previous).data, ctx);
            ctx.strokeStyle = data.active ? '#fbbf24' : data.tree ? '#34d399' : '#526178';
            ctx.lineWidth = data.active ? 5 : data.tree ? 3 : 2;
            ctx.beginPath();
            if (data.from === data.to) ctx.arc(from.x + 20, from.y - 20, 24, 0, Math.PI * 2);
            else { ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); }
            ctx.stroke();
            if (data.active && data.from !== data.to) {
                // Animate examination along the actual edge, starting at the current vertex.
                const source = scene.get(vertexId(scene.event.source));
                const reverse = source?.id === data.to;
                const p = reverse ? 1 - scene.progress : scene.progress;
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath(); ctx.arc(from.x + (to.x - from.x) * p,
                    from.y + (to.y - from.y) * p, 6, 0, Math.PI * 2); ctx.fill();
            }
        },
        vertex(ctx, object) {
            const data = (object.current ?? object.previous).data, pos = point(data, ctx);
            ctx.fillStyle = { active: '#fbbf24', visited: '#34d399', queued: '#c4b5fd', unseen: '#64748b' }[data.status];
            ctx.beginPath(); ctx.arc(pos.x, pos.y, 24, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#101827'; ctx.font = 'bold 18px system-ui';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(data.label, pos.x, pos.y, 42);
            ctx.fillStyle = '#e2e8f0'; ctx.font = '13px system-ui';
            ctx.fillText(data.distance === null ? 'd = —' : 'd = ' + data.distance, pos.x, pos.y + 39);
        },
        queueEntry(ctx, object) {
            const data = (object.current ?? object.previous).data;
            const before = (object.previous ?? object.current).data;
            const index = before.index + (data.index - before.index) * object.progress;
            const pitch = Math.min(72, (ctx.canvas.width - 48) / 7);
            ctx.save();
            try {
                ctx.globalAlpha = object.presence;
                ctx.fillStyle = '#c4b5fd';
                ctx.fillRect(24 + index * pitch, 440, pitch - 8, 40);
                ctx.fillStyle = '#101827'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(data.label, 24 + index * pitch + (pitch - 8) / 2, 460, pitch - 12);
            } finally { ctx.restore(); }
        },
    });
    return {
        render(ctx, frame) {
            ctx.save();
            try {
                ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
                ctx.fillStyle = '#101827'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                ctx.fillStyle = '#e2e8f0'; ctx.font = '16px system-ui'; ctx.textAlign = 'left';
                ctx.textBaseline = 'alphabetic'; ctx.fillText('Queue · front → back', 24, 423);
                // Animation context is frame-specific, never captured by the cached projector.
                renderer.render(ctx, project({ ...frame, event: { ...frame.event, source: frame.current.current } }));
            } finally { ctx.restore(); }
        },
    };
}
