import { timing as options, limits, configureControls, nextDelta, stepTime, generateValues } from './player-settings.mjs';
import { insertion, bubble } from './algorithms.mjs';
import { createArrayTimeline as createSortTimeline, createArrayPlayer as createSortPlayer } from '@grundyjs/algiviz/array';
import { createArrayRenderer as createSortRenderer } from '@grundyjs/algiviz/canvas';

const $ = id => document.getElementById(id);
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const renderer = createSortRenderer({ theme: 'dark' });
configureControls();
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let values = [5, 2, 4, 2, 1];
let mode = 'history';
let algorithm = 'insertion';
const algorithms = {
    insertion: { name: 'Insertion sort', ...insertion },
    bubble: { name: 'Bubble sort', ...bubble }
};
let timeline, player;
let time = 0, running = false, last = null, raf = 0;
const finished = () => player ? player.finished : time >= timeline.durationMs;
const currentFrame = () => player ? player.frame : timeline.sample(time);

function draw() {
    const frame = currentFrame();
    renderer.render(ctx, reduced.matches ? { ...frame, previous: frame.current, progress: 1 } : frame);
    $('time').value = String(time);
    const duration = timeline ? `${(timeline.durationMs / 1000).toFixed(1)} s` : 'unknown';
    const text = `${finished() ? 'Finished' : running ? 'Playing' : 'Paused'} · ${values.length} items · Step ${frame.stepIndex}: ${frame.event.type} · Comparisons: ${frame.current.comparisons} · Writes: ${frame.current.writes} · Total duration: ${duration}`;
    if ($('status').textContent !== text) $('status').textContent = text;
    $('play').textContent = running ? 'Pause' : finished() ? 'Replay' : 'Play';
}
function pause() {
    running = false;
    last = null;
    cancelAnimationFrame(raf);
}
function load(nextValues = values, nextMode = mode, nextAlgorithm = algorithm) {
    if (nextValues.length > limits[nextMode]) throw new RangeError(`Use at most ${limits[nextMode]} values in ${nextMode} mode.`);
    // Prepare first so invalid replacements leave the current session intact.
    const sort = algorithms[nextAlgorithm];
    const nextPlayer = nextMode === 'generator' ? createSortPlayer(sort.iterate(nextValues), options) : null;
    const nextTimeline = nextMode === 'history' ? createSortTimeline(sort.steps(nextValues), options) : null;
    pause();
    player?.dispose();
    player = nextPlayer;
    timeline = nextTimeline;
    values = [...nextValues];
    mode = nextMode;
    algorithm = nextAlgorithm;
    $('algorithm').value = algorithm;
    canvas.setAttribute('aria-label', `${sort.name} visualization`);
    time = 0;
    $('mode').value = mode;
    $('values').value = values.join(', ');
    $('time').disabled = $('previous').disabled = !timeline;
    $('time').max = String(timeline?.durationMs ?? 1);
    $('size').max = String(limits[mode]);
    $('limit').textContent = `Demo limit: ${limits[mode]} values. Negative numbers and duplicates are supported.`;
    $('mode-note').textContent = timeline
        ? 'Full history stores all snapshots. Seeking and total duration are available.'
        : 'Generator mode retains only adjacent snapshots. Seeking is unavailable; restarting creates a new generator.';
    $('error').textContent = '';
    draw();
}
function attempt(action) {
    try { action(); }
    catch (error) { $('error').textContent = error.message; }
}
function tick(now) {
    if (!running) return;
    // Bound catch-up after a stalled frame to keep controls responsive.
    const delta = last === null ? 0 : Math.min(100, now - last) * Number($('speed').value);
    last = now;
    if (player) player.advance(delta);
    else time = Math.min(timeline.durationMs, time + delta);
    if (finished()) pause();
    draw();
    if (running) raf = requestAnimationFrame(tick);
}
$('play').onclick = () => {
    if (running) { pause(); draw(); return; }
    if (finished()) load();
    running = true;
    last = null;
    draw();
    raf = requestAnimationFrame(tick);
};
$('reset').onclick = () => load();
$('algorithm').onchange = () => {
    attempt(() => load(values, mode, $('algorithm').value));
    $('algorithm').value = algorithm;
};
$('speed').onchange = () => { last = null; };
$('mode').onchange = () => {
    attempt(() => load(values, $('mode').value));
    $('mode').value = mode;
};
$('apply').onclick = () => attempt(() => {
    const text = $('values').value.trim();
    const tokens = text ? text.split(/[\s,]+/) : [];
    if (tokens.some(token => !token || !Number.isFinite(Number(token)))) throw new TypeError('Enter finite numbers separated by spaces or commas.');
    load(tokens.map(Number));
});
$('generate').onclick = () => attempt(() => {
    const count = Number($('size').value);
    load(generateValues(count, $('order').value, mode));
});
$('time').oninput = () => {
    if (!timeline) return;
    pause();
    time = Number($('time').value);
    draw();
};
document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); draw(); }
});
window.addEventListener('pagehide', () => { pause(); player?.dispose(); });
window.addEventListener('pageshow', event => { if (event.persisted) load(); });
new ResizeObserver(entries => {
    const width = Math.round(entries[0].contentRect.width);
    if (width <= 0) return;
    canvas.width = width;
    canvas.height = Math.max(280, Math.round(width * 0.5625));
    draw();
}).observe(document.querySelector('main'));
load();
for (const [id, direction] of [['previous', -1], ['next', 1]]) $(id).onclick = () => {
    pause();
    if (player) { if (direction > 0) player.advance(nextDelta(player.frame)); }
    else time = stepTime(time, direction, timeline.durationMs);
    draw();
};
reduced.addEventListener('change', draw);
