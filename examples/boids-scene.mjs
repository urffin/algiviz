import { createSceneProjector, createSceneRenderer } from '@grundyjs/algiviz/scene';
import { analyzeBoid, boidsDelta, boidsPhysics, boidsWorld } from './boids-algorithm.mjs';

export const boidsColors = Object.freeze({ background: '#101827', bird: '#7dd3fc', neighbor: '#67e8f9',
    selected: '#f8fafc', separation: '#fbbf24', alignment: '#60a5fa', cohesion: '#c4b5fd',
    obstacle: '#fb7185', total: '#34d399', nextVelocity: '#f8fafc', wall: '#334155', edge: '#94a3b8' });
export const steeringScale = 700;
const frozenObject = (id, type, data, zIndex) => Object.freeze({ id, type, data: Object.freeze(data), zIndex });

export function boidsScene(state, { inspect = false, selectedId = 0 } = {}) {
    const analysis = inspect ? analyzeBoid(state, selectedId) : null;
    const neighbors = new Set(analysis?.neighbors), close = new Set(analysis?.close);
    const selected = state.birds.find(b => b.id === selectedId);
    const objects = state.config.obstacles.map(o => frozenObject(`obstacle:${o.id}`, 'obstacle', { obstacle: o }, 0));
    if (analysis) {
        objects.push(frozenObject('perception', 'perception', { bird: selected }, 1));
        for (const id of analysis.neighbors) objects.push(frozenObject(`neighbor:${id}`, 'neighbor-link',
            { from: selected, to: state.birds.find(b => b.id === id) }, 1));
    }
    for (const bird of state.birds) objects.push(frozenObject(`bird:${bird.id}`, 'bird',
        { bird, selected: inspect && bird.id === selectedId, neighbor: neighbors.has(bird.id), close: close.has(bird.id) }, 2));
    if (analysis) for (const key of ['separation', 'alignment', 'cohesion', 'obstacle', 'total', 'nextVelocity'])
        objects.push(frozenObject(`vector:${key}`, 'steering-vector', { key, value: analysis[key], bird: selected }, key === 'total' ? 4 : 3));
    return Object.freeze({ objects: Object.freeze(objects) });
}

const wrap = (value, extent) => (value % extent + extent) % extent;
export function interpolateBoid(before, after, progress) {
    return {
        x: wrap(before.x + boidsDelta(after.x - before.x, boidsWorld.width) * progress, boidsWorld.width),
        y: wrap(before.y + boidsDelta(after.y - before.y, boidsWorld.height) * progress, boidsWorld.height),
        vx: before.vx + (after.vx - before.vx) * progress,
        vy: before.vy + (after.vy - before.vy) * progress
    };
}

export function createBoidsRenderer() {
    let project, viewKey, camera, scale, width, height, inspecting;
    function point(x, y) {
        return inspecting ? { x: width / 2 + boidsDelta(x - camera.x, boidsWorld.width) * scale,
            y: height / 2 + boidsDelta(y - camera.y, boidsWorld.height) * scale }
            : { x: width / 2 + (x - boidsWorld.width / 2) * scale, y: height / 2 + (y - boidsWorld.height / 2) * scale };
    }
    function arrow(ctx, from, dx, dy, color, dashed = false, thick = false) {
        const length = Math.hypot(dx, dy);
        if (length < 0.25) return;
        const end = { x: from.x + dx, y: from.y + dy }, angle = Math.atan2(dy, dx);
        const head = Math.min(7, Math.max(3, length * 0.3));
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = thick ? 2.7 : 1.8;
        ctx.setLineDash(dashed ? [5, 4] : []);
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - head * Math.cos(angle - 0.5), end.y - head * Math.sin(angle - 0.5));
        ctx.lineTo(end.x - head * Math.cos(angle + 0.5), end.y - head * Math.sin(angle + 0.5));
        ctx.closePath(); ctx.fill();
    }
    const renderer = createSceneRenderer({
        obstacle(ctx, object) {
            const o = (object.current ?? object.previous).data.obstacle;
            const cx = o.type === 'circle' ? o.x : (o.ax + o.bx) / 2;
            const cy = o.type === 'circle' ? o.y : (o.ay + o.by) / 2;
            const center = point(cx, cy);
            ctx.save();
            for (const ix of [-1, 0, 1]) for (const iy of [-1, 0, 1]) {
                const x = center.x + ix * boidsWorld.width * scale, y = center.y + iy * boidsWorld.height * scale;
                if (o.type === 'circle') {
                    ctx.beginPath(); ctx.arc(x, y, o.radius * scale, 0, Math.PI * 2);
                    ctx.fillStyle = boidsColors.wall; ctx.fill(); ctx.strokeStyle = boidsColors.edge; ctx.lineWidth = 1; ctx.stroke();
                } else {
                    ctx.lineCap = 'round';
                    const dx = (o.bx - o.ax) * scale / 2, dy = (o.by - o.ay) * scale / 2;
                    ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy);
                    ctx.strokeStyle = boidsColors.edge; ctx.lineWidth = o.radius * scale * 2 + 2; ctx.stroke();
                    ctx.strokeStyle = boidsColors.wall; ctx.lineWidth = o.radius * scale * 2; ctx.stroke();
                }
            }
            ctx.restore();
        },
        perception(ctx, object) {
            const bird = object.current.data.bird, p = point(bird.x, bird.y);
            ctx.save(); ctx.strokeStyle = boidsColors.neighbor; ctx.lineWidth = 1; ctx.globalAlpha = 0.55;
            ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(p.x, p.y, boidsPhysics.neighborRadius * scale, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = boidsColors.separation; ctx.setLineDash([2, 4]);
            ctx.beginPath(); ctx.arc(p.x, p.y, boidsPhysics.separationRadius * scale, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        },
        'neighbor-link'(ctx, object) {
            const { from, to } = object.current.data, a = point(from.x, from.y);
            ctx.save(); ctx.strokeStyle = boidsColors.neighbor; ctx.globalAlpha = 0.22; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y);
            ctx.lineTo(a.x + boidsDelta(to.x - from.x, boidsWorld.width) * scale,
                a.y + boidsDelta(to.y - from.y, boidsWorld.height) * scale); ctx.stroke(); ctx.restore();
        },
        bird(ctx, object) {
            const data = object.current.data, from = object.previous?.data.bird ?? data.bird;
            const bird = interpolateBoid(from, data.bird, object.progress), p = point(bird.x, bird.y);
            const angle = Math.atan2(bird.vy, bird.vx), ux = Math.cos(angle), uy = Math.sin(angle);
            const size = data.selected ? 9 : Math.max(3, Math.min(6, scale * 6));
            ctx.save(); ctx.globalAlpha = inspecting && !data.selected && !data.neighbor ? 0.27 : 0.95;
            ctx.fillStyle = data.selected ? boidsColors.selected : data.close ? boidsColors.separation : data.neighbor ? boidsColors.neighbor : boidsColors.bird;
            for (const ix of [-1, 0, 1]) for (const iy of [-1, 0, 1]) {
                const x = p.x + ix * boidsWorld.width * scale, y = p.y + iy * boidsWorld.height * scale;
                if (x < -15 || x > width + 15 || y < -15 || y > height + 15) continue;
                ctx.beginPath(); ctx.moveTo(x + ux * size, y + uy * size);
                ctx.lineTo(x - ux * size * 0.65 - uy * size * 0.5, y - uy * size * 0.65 + ux * size * 0.5);
                ctx.lineTo(x - ux * size * 0.3, y - uy * size * 0.3);
                ctx.lineTo(x - ux * size * 0.65 + uy * size * 0.5, y - uy * size * 0.65 - ux * size * 0.5);
                ctx.closePath(); ctx.fill();
            }
            if (data.selected) {
                ctx.globalAlpha = 1; ctx.strokeStyle = boidsColors.selected; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = boidsColors.selected; ctx.font = '13px system-ui'; ctx.textAlign = 'center';
                ctx.fillText(`#${data.bird.id + 1}`, p.x, p.y - 20);
            }
            ctx.restore();
        },
        'steering-vector'(ctx, object) {
            const { key, value, bird } = object.current.data, from = point(bird.x, bird.y);
            ctx.save();
            if (key === 'nextVelocity') {
                const length = Math.hypot(value.x, value.y);
                if (length) arrow(ctx, from, value.x / length * 47, value.y / length * 47, boidsColors[key], true);
            } else arrow(ctx, from, value.x * steeringScale * scale, value.y * steeringScale * scale, boidsColors[key], key === 'total', key === 'total');
            ctx.restore();
        }
    });
    return {
        render(ctx, frame, { inspect = false, selectedId = 0 } = {}) {
            const key = `${inspect}:${selectedId}`;
            if (key !== viewKey) { viewKey = key; project = createSceneProjector(state => boidsScene(state, { inspect, selectedId })); }
            width = ctx.canvas.width; height = ctx.canvas.height; inspecting = inspect;
            camera = inspect ? frame.current.birds.find(b => b.id === selectedId) : null;
            scale = Math.min(width / boidsWorld.width, height / boidsWorld.height) * (inspect ? 1.6 : 1);
            ctx.fillStyle = boidsColors.background; ctx.fillRect(0, 0, width, height);
            ctx.save(); ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.clip();
            try {
                // Inspection shows one exact state and predicts its next update.
                // Smoothing between two different neighborhoods would be misleading.
                renderer.render(ctx, project(inspect ? { ...frame, previous: frame.current, progress: 1 } : frame));
            } finally { ctx.restore(); }
        }
    };
}
