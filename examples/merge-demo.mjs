import { createTimeline, createPlayer } from '@grundyjs/algiviz/playback';
import { mergeSort } from './merge-algorithm.mjs';
import { createMergeRenderer, mergeItemLabel } from './merge-scene.mjs';

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const seek = document.querySelector('#seek');
const play = document.querySelector('#play');
const mode = document.querySelector('#mode');
const previous = document.querySelector('#previous');
const modeHelp = document.querySelector('#mode-help');
const speed = document.querySelector('#speed');
const input = document.querySelector('#values');
const status = document.querySelector('#status');
const error = document.querySelector('#error');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let steps, timeline, player, original, loadedValues, renderer, time = 0, request = 0, last = null, running = false;
function pause() { running = false; last = null; cancelAnimationFrame(request); play.textContent = 'Play'; }
function draw() {
    const frame = player ? player.frame : timeline.sample(time);
    const completed = frame.stepIndex;
    const state = frame.current;
    renderer.render(ctx, reduced.matches ? { ...frame, previous: state, current: state, progress: 1 } : frame);
    seek.value = String(time);
    const label = item => mergeItemLabel(item, original);
    const description = 'Step ' + completed + (steps ? ' / ' + (steps.length - 1) : '') + ': ' + frame.event.type +
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
        start(values); error.textContent = '';
    } catch (e) { error.textContent = e.message; }
}
function start(values) {
    pause(); player?.dispose();
    loadedValues = [...values];
    steps = timeline = player = null;
    const timing = { stepDurationMs: 650, finalHoldMs: 1000 };
    if (mode.value === 'generator') {
        player = createPlayer(mergeSort.iterate(loadedValues), {
            ...timing, isTerminal: step => step.event.type === 'done'
        });
        original = player.frame.current.main;
    } else {
        steps = mergeSort.steps(loadedValues);
        timeline = createTimeline(steps, timing);
        original = steps[0].state.main;
    }
    renderer = createMergeRenderer(true, original);
    time = 0; seek.max = String(timeline?.durationMs ?? 0);
    seek.disabled = previous.disabled = Boolean(player);
    modeHelp.textContent = player
        ? 'Generator: steps are produced on demand. History and seeking are unavailable; restart creates a new iterator.'
        : 'History: all steps are stored for backward stepping and seeking.';
    draw();
}
function finished() { return player ? player.finished : time === timeline.durationMs; }
function tick(now) {
    if (!running) return;
    if (last !== null) { const delta = Math.min(now - last, 100) * Number(speed.value); if (player) player.advance(delta); else time = Math.min(timeline.durationMs, time + delta); }
    last = now; draw();
    if (finished()) pause(); else request = requestAnimationFrame(tick);
}
play.onclick = () => { if (running) return pause(); if (finished()) start(loadedValues); running = true; last = null; play.textContent = 'Pause'; request = requestAnimationFrame(tick); };
seek.oninput = () => { pause(); time = Number(seek.value); draw(); };
document.querySelector('#restart').onclick = () => start(loadedValues);
mode.onchange = () => start(loadedValues);
for (const [id, direction] of [['previous', -1], ['next', 1]]) document.querySelector('#' + id).onclick = () => {
    pause();
    if (player) { if (direction > 0) { const frame = player.frame; player.advance(frame.event.type === 'done' ? 1000 : 650 * (frame.progress < 1 ? 1 - frame.progress : 1)); draw(); } return; }
    const step = direction < 0 ? Math.ceil(time / 650) - 1 : Math.floor(time / 650) + 1;
    time = Math.max(0, Math.min((steps.length - 1) * 650, step * 650)); draw();
};
document.querySelector('#apply').onclick = load;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', pause);
reduced.addEventListener('change', draw);
const resize = new ResizeObserver(() => { canvas.width = Math.max(320, Math.round(canvas.getBoundingClientRect().width)); canvas.height = Math.max(380, Math.round(canvas.width * 0.65)); if (timeline || player) draw(); });
resize.observe(canvas);
load();
