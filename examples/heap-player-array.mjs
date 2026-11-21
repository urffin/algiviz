import { arrayScene } from '@grundyjs/algiviz/canvas';
import { createSceneFrame, createSceneProjector } from '@grundyjs/algiviz/scene';

function activeIds(event) {
    if (event.type === 'highlight') return event.itemIds;
    if (event.type === 'compare' || event.type === 'swap') return [event.leftId, event.rightId];
    return [];
}

export function createHeapArrayRenderer() {
    const project = createSceneProjector(arrayScene);
    return (ctx, frame, { width, height }) => {
        const { current, previous, progress } = frame;
        const scene = createSceneFrame(project({ ...frame, previous: previous.array, current: current.array }));
        const count = current.array.slots.length;
        const sortedFrom = count - current.array.sortedSuffixLength;
        const active = activeIds(current.arrayEvent);
        const cell = width / count, tile = Math.min(64, cell * .65, height * .3);
        const center = height * .46;
        const lift = 4 * progress * (1 - progress) * tile * .62;

        ctx.save();
        try {
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#101827';
            ctx.fillRect(0, 0, width, height);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '14px system-ui';
            ctx.fillStyle = '#cbd5e1';
            for (let index = 0; index < count; index++) ctx.fillText(String(index), (index + .5) * cell, height * .88);

            ctx.font = 'bold 20px system-ui';
            for (const { id, previous: old, current: next } of scene.objects) {
                const from = old.data.index, to = next.data.index;
                const x = (from + (to - from) * progress + .5) * cell;
                // Lift the swapping tiles in opposite directions so both IDs remain readable.
                const y = center + Math.sign(to - from) * lift;
                const sorted = to >= sortedFrom, highlighted = active.includes(id);
                ctx.fillStyle = sorted ? '#34d399' : highlighted ? '#fbbf24' : '#334155';
                ctx.fillRect(x - tile / 2, y - tile / 2, tile, tile);
                ctx.fillStyle = sorted || highlighted ? '#101827' : '#f1f5f9';
                ctx.fillText(current.labelById[id], x, y);
            }
        } finally {
            ctx.restore();
        }
    };
}
