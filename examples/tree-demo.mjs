import { createTimeline } from '@grundyjs/algiviz/playback';
import { treeSteps, treeRenderer } from './tree-scene.mjs';

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const seek = document.querySelector('#seek');
const play = document.querySelector('#play');
const timeline = createTimeline([...treeSteps()], { stepDurationMs: 900, finalHoldMs: 900 });
let time = 0, request = 0, last = null, running = false;
seek.max = String(timeline.durationMs);
function draw() {
    ctx.fillStyle = '#101827'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const frame = timeline.sample(time);
    treeRenderer.render(ctx, frame);
    seek.value = String(time);
    document.querySelector('#status').textContent = `${frame.event.kind}${frame.event.active ? ': ' + frame.event.active.toUpperCase() : ''} · step ${frame.stepIndex}`;
}
function pause() { running = false; last = null; cancelAnimationFrame(request); play.textContent = 'Play'; }
function tick(now) {
    if (!running) return;
    if (last !== null) time = Math.min(timeline.durationMs, time + Math.min(now - last, 100));
    last = now; draw();
    if (time === timeline.durationMs) pause();
    else request = requestAnimationFrame(tick);
}
play.onclick = () => {
    if (running) { pause(); return; }
    if (time === timeline.durationMs) time = 0;
    running = true; play.textContent = 'Pause'; request = requestAnimationFrame(tick);
};
seek.oninput = () => { pause(); time = Number(seek.value); draw(); };
document.querySelector('#restart').onclick = () => { pause(); time = 0; draw(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', pause);
draw();
