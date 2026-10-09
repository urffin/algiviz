import { createTimeline } from '@grundyjs/algiviz/playback';
import { mergeSort } from './merge-algorithm.mjs';
import { createMergeRenderer, mergeItemLabel } from './merge-scene.mjs';

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const seek = document.querySelector('#seek');
const play = document.querySelector('#play');
const speed = document.querySelector('#speed');
const input = document.querySelector('#values');
const status = document.querySelector('#status');
const error = document.querySelector('#error');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let steps, timeline, renderer, time = 0, request = 0, last = null, running = false;
function pause() { running = false; last = null; cancelAnimationFrame(request); play.textContent = 'Play'; }
function draw() {
    const frame = timeline.sample(time);
    const completed = reduced.matches && frame.progress < 1 ? Math.max(0, frame.stepIndex - 1) : frame.stepIndex;
    const state = steps[completed].state;
    renderer.render(ctx, reduced.matches ? { ...frame, previous: state, current: state, event: steps[completed].event, progress: 1 } : frame);
    seek.value = String(time);
    const label = item => mergeItemLabel(item, steps[0].state.main);
    const description = 'Step ' + completed + ' / ' + (steps.length - 1) + ': ' + steps[completed].event.type +
        ' · Main: [' + state.main.map(label).join(', ') + '] · Buffer: [' + state.buffer.map(label).join(', ') +
        '] · Comparisons: ' + state.comparisons + ' · Buffer writes: ' + state.bufferWrites + ' · Main writes: ' + state.mainWrites;
    if (status.textContent !== description) status.textContent = description;
}
function load() {
    try {
        const text = input.value.trim();
        const values = text ? text.split(/[\s,]+/).map(Number) : [];
        if (values.length > 24 || values.some(value => !Number.isFinite(value) || Math.abs(value) > 1000))
            throw new Error('Use up to 24 finite numbers between -1000 and 1000.');
        const nextSteps = mergeSort.steps(values);
        const nextTimeline = createTimeline(nextSteps, { stepDurationMs: 650, finalHoldMs: 1000 });
        pause(); steps = nextSteps; timeline = nextTimeline;
        renderer = createMergeRenderer(true, steps[0].state.main);
        time = 0; seek.max = String(timeline.durationMs); error.textContent = ''; draw();
    } catch (e) { error.textContent = e.message; }
}
function tick(now) {
    if (!running) return;
    if (last !== null) time = Math.min(timeline.durationMs, time + Math.min(now - last, 100) * Number(speed.value));
    last = now; draw();
    if (time === timeline.durationMs) pause(); else request = requestAnimationFrame(tick);
}
play.onclick = () => { if (running) return pause(); if (time === timeline.durationMs) time = 0; running = true; last = null; play.textContent = 'Pause'; request = requestAnimationFrame(tick); };
seek.oninput = () => { pause(); time = Number(seek.value); draw(); };
document.querySelector('#restart').onclick = () => { pause(); time = 0; draw(); };
for (const [id, direction] of [['previous', -1], ['next', 1]]) document.querySelector('#' + id).onclick = () => {
    pause();
    const step = direction < 0 ? Math.ceil(time / 650) - 1 : Math.floor(time / 650) + 1;
    time = Math.max(0, Math.min((steps.length - 1) * 650, step * 650)); draw();
};
document.querySelector('#apply').onclick = load;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', pause);
reduced.addEventListener('change', draw);
const resize = new ResizeObserver(() => { canvas.width = Math.max(320, Math.round(canvas.getBoundingClientRect().width)); canvas.height = Math.max(380, Math.round(canvas.width * 0.65)); if (timeline) draw(); });
resize.observe(canvas);
load();
