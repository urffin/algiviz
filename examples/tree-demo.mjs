import { createDemoPlayer } from './demo-player.mjs';
import { treeSteps, treeRenderer } from './tree-scene.mjs';
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const status = document.querySelector('#status');
const playback = createDemoPlayer({
    source: () => treeSteps(), isTerminal: step => step.event.kind === 'finished',
    render(frame) {
        ctx.fillStyle = '#101827'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        treeRenderer.render(ctx, frame);
        const text = `${frame.event.kind}${frame.event.active ? ': ' + frame.event.active.toUpperCase() : ''} · step ${frame.stepIndex}`;
        if (status.textContent !== text) status.textContent = text;
    }
});
playback.load();
