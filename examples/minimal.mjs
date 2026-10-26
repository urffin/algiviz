import { createPlayer, createStepEmitter } from '@grundyjs/algiviz/playback';
import { createSceneRenderer } from '@grundyjs/algiviz/scene';

// This object type and its algorithm belong entirely to the application.
/** @typedef {{ token: { x: number } }} Objects */
export function* tokenSteps() {
    let x = 0;
    const emit = createStepEmitter(() => Object.freeze({ objects: Object.freeze([
        Object.freeze({ id: 'token', type: 'token', data: Object.freeze({ x }) }),
    ]) }));
    yield emit('start');
    for (x = 1; x <= 3; x++) yield emit(x === 3 ? 'done' : 'move');
}

/** @type {import('@grundyjs/algiviz/scene').SceneVisualizations<Objects, CanvasRenderingContext2D, string>} */
const visualizations = {
    token(ctx, object) {
        const before = object.previous ?? object.current;
        const after = object.current ?? object.previous;
        if (!before || !after) return;
        const from = before.data.x;
        const to = after.data.x;
        const x = from + (to - from) * object.progress;
        ctx.beginPath();
        ctx.arc(24 + x / 3 * (ctx.canvas.width - 48), ctx.canvas.height / 2, 16, 0, Math.PI * 2);
        ctx.fill();
    },
};
export const tokenRenderer = createSceneRenderer(visualizations);

// No demo controller, DOM IDs or application-wide settings are required.
/** @param {CanvasRenderingContext2D} ctx */
export function createTokenPlayer(ctx) {
    return createPlayer(tokenSteps(), {
        stepDurationMs: 600,
        finalHoldMs: 0,
        isTerminal: step => step.event === 'done',
        render(frame) {
            ctx.save();
            try {
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                ctx.fillStyle = '#7c3aed';
                tokenRenderer.render(ctx, frame);
            } finally { ctx.restore(); }
        },
    });
}
