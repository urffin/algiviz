import { createStatePlayer } from '@grundyjs/algiviz/playback';
import { createSceneRenderer } from '@grundyjs/algiviz/scene';
import { timing } from './player-settings.mjs';

const object = (id, x, color) => Object.freeze({ id, type: 'token', data: Object.freeze({ x, color }) });
const token = (id, x) => object(id, x, id === 'A' ? '#a78bfa' : id === 'B' ? '#5eead4' : '#fbbf24');

/** Independent snapshots, including empty scenes. The source records actual consumption. */
export function* lifecycleStates(notify = () => {}) {
    try {
        for (let index = 0; index < 6; index++) {
            // Build only the requested snapshot, without retaining full history.
            let objects;
            switch (index) {
                case 1: objects = [token('A', 100)]; break;
                case 2: objects = [token('A', 260), token('B', 420)]; break;
                case 3: objects = [token('B', 300)]; break;
                case 5: objects = [token('C', 500)]; break;
                default: objects = [];
            }
            notify({ kind: 'yield', index });
            yield Object.freeze({ objects: Object.freeze(objects) });
        }
        notify({ kind: 'exhausted' });
    } finally { notify({ kind: 'closed' }); }
}

export const lifecycleRenderer = createSceneRenderer({
    token(ctx, transition) {
        // Exit has current === null; enter has previous === null.
        const before = transition.previous ?? transition.current;
        const after = transition.current ?? transition.previous;
        if (transition.presence === 0) return;
        const x = before.data.x + (after.data.x - before.data.x) * transition.progress;
        ctx.save();
        try {
            ctx.globalAlpha = transition.presence;
            ctx.fillStyle = after.data.color;
            ctx.beginPath(); ctx.arc(x, 90, 26, 0, 2 * Math.PI); ctx.fill();
            ctx.fillStyle = '#102030'; ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(transition.id, x, 90);
        } finally { ctx.restore(); }
    },
});

export function createLifecyclePlayer({ notify, render } = {}) {
    return createStatePlayer(lifecycleStates(notify), {
        stepDurationMs: timing.stepDurationMs, render,
    });
}
