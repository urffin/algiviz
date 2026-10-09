import { limits, generateValues } from './player-settings.mjs';
import { createDemoPlayer } from './demo-player.mjs';
import { insertion, bubble } from './algorithms.mjs';
import { createArrayRenderer } from '@grundyjs/algiviz/canvas';
const $ = id => document.getElementById(id);
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const renderer = createArrayRenderer({ theme: 'dark' });
const algorithms = { insertion, bubble };
let values = [5, 2, 4, 2, 1], algorithm = 'insertion';
const playback = createDemoPlayer({
    isTerminal: step => step.event.type === 'done',
    onError: error => { $('error').textContent = error.message; },
    render(frame, info) {
        renderer.render(ctx, frame);
        const text = `${info.finished ? 'Finished' : info.running ? 'Playing' : 'Paused'} · ${values.length} items · Step ${frame.stepIndex}: ${frame.event.type} · Comparisons: ${frame.current.comparisons} · Writes: ${frame.current.writes} · Total duration: ${info.duration === undefined ? 'unknown' : (info.duration / 1000).toFixed(1) + ' s'}`;
        if ($('status').textContent !== text) $('status').textContent = text;
        $('limit').textContent = `Demo limit: ${limits[info.mode]} values. Negative numbers and duplicates are supported.`;
    }
});
function load(nextValues = values, nextAlgorithm = algorithm) {
    const saved = [...nextValues];
    playback.load(mode => {
        if (saved.length > limits[mode]) throw new RangeError(`Use at most ${limits[mode]} values in ${mode} mode.`);
        return algorithms[nextAlgorithm].iterate(saved);
    });
    values = saved; algorithm = nextAlgorithm;
    $('values').value = values.join(', ');
    canvas.setAttribute('aria-label', `${algorithm === 'insertion' ? 'Insertion' : 'Bubble'} sort visualization`);
    $('error').textContent = ''; playback.draw();
}
function attempt(action) { try { action(); } catch (error) { $('error').textContent = error.message; } }
$('algorithm').onchange = () => { attempt(() => load(values, $('algorithm').value)); $('algorithm').value = algorithm; };
$('apply').onclick = () => attempt(() => {
    const text = $('values').value.trim();
    const tokens = text ? text.split(/[\s,]+/) : [];
    if (tokens.some(token => !token || !Number.isFinite(Number(token)))) throw new TypeError('Enter finite numbers separated by spaces or commas.');
    load(tokens.map(Number));
});
$('generate').onclick = () => attempt(() => load(generateValues(Number($('size').value), $('order').value, playback.mode)));
new ResizeObserver(entries => {
    const width = Math.round(entries[0].contentRect.width);
    if (width <= 0) return;
    canvas.width = width; canvas.height = Math.max(280, Math.round(width * 0.5625)); playback.draw();
}).observe(document.querySelector('main'));
load();
