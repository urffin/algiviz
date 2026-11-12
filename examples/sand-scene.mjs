import { createSceneProjector, createSceneRenderer } from '@grundyjs/algiviz/scene';
import { WALL, sandWorld, sandHash } from './sand-algorithm.mjs';

export function sandScene(state) {
    const objects = [Object.freeze({ id: 'field', type: 'field', data: state, zIndex: 0 })];
    for (let index = 0; index < state.cells.length; index++) if (state.cells[index] >= 0)
        objects.push(Object.freeze({ id: `grain:${state.cells[index]}`, type: 'grain', zIndex: 1,
            data: Object.freeze({ id: state.cells[index], x: index % sandWorld.columns, y: Math.floor(index / sandWorld.columns) }) }));
    return Object.freeze({ objects: Object.freeze(objects) });
}
export function sandGeometry(width, height) {
    const size = Math.min(width / sandWorld.columns, height / sandWorld.rows);
    return { size, x: (width - sandWorld.columns * size) / 2, y: (height - sandWorld.rows * size) / 2 };
}
export function createSandRenderer() {
    const project = createSceneProjector(sandScene);
    let geometry;
    const renderer = createSceneRenderer({
        field(ctx, object) {
            const state = (object.current ?? object.previous).data;
            ctx.fillStyle = '#33415b';
            for (let i = 0; i < state.cells.length; i++) if (state.cells[i] === WALL) {
                const x = geometry.x + i % sandWorld.columns * geometry.size, y = geometry.y + Math.floor(i / sandWorld.columns) * geometry.size;
                ctx.fillRect(x, y, geometry.size, geometry.size);
                ctx.fillStyle = '#53647e'; ctx.fillRect(x, y, geometry.size, Math.max(1, geometry.size * .15)); ctx.fillStyle = '#33415b';
            }
        },
        grain(ctx, object) {
            const from = (object.previous ?? object.current).data, to = (object.current ?? object.previous).data;
            const x = from.x + (to.x - from.x) * object.progress, y = from.y + (to.y - from.y) * object.progress;
            const color = sandHash(7, 0, to.id);
            ctx.globalAlpha = object.presence;
            ctx.fillStyle = `hsl(${34 + color % 17} 89% ${57 + color % 18}%)`;
            ctx.fillRect(geometry.x + x * geometry.size + .4, geometry.y + y * geometry.size + .4, geometry.size - .8, geometry.size - .8);
            ctx.globalAlpha = 1;
        }
    });
    return {
        render(ctx, frame, { analysis = null, exact = false } = {}) {
            geometry = sandGeometry(ctx.canvas.width, ctx.canvas.height);
            ctx.fillStyle = '#0b1222'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            renderer.render(ctx, project(analysis || exact ? { ...frame, previous: frame.current, progress: 1 } : frame));
            if (!analysis) return;
            const cell = (index, color, inset = 0) => {
                ctx.strokeStyle = color; ctx.lineWidth = 2;
                ctx.strokeRect(geometry.x + index % sandWorld.columns * geometry.size + inset,
                    geometry.y + Math.floor(index / sandWorld.columns) * geometry.size + inset,
                    geometry.size - inset * 2, geometry.size - inset * 2);
            };
            for (const index of analysis.choices) cell(index, '#60a5fa', 1);
            cell(analysis.from, '#fff', -1);
            if (analysis.proposed !== analysis.from) {
                cell(analysis.proposed, analysis.moved ? '#5ee0b1' : '#fb923c', -1);
                const ax = geometry.x + (analysis.from % sandWorld.columns + .5) * geometry.size;
                const ay = geometry.y + (Math.floor(analysis.from / sandWorld.columns) + .5) * geometry.size;
                const bx = geometry.x + (analysis.proposed % sandWorld.columns + .5) * geometry.size;
                const by = geometry.y + (Math.floor(analysis.proposed / sandWorld.columns) + .5) * geometry.size;
                ctx.strokeStyle = analysis.moved ? '#5ee0b1' : '#fb923c'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
            }
        }
    };
}
