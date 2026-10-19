import { limits, generateValues } from './player-settings.mjs';
import { createDemoPlayer } from './demo-player.mjs';
import { insertion, bubble } from './algorithms.mjs';
import { createArrayRenderer } from '@grundyjs/algiviz/canvas';
const $ = id => document.getElementById(id);
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
let renderer = createArrayRenderer({ theme: 'dark' });
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

// UI presets mirror the documented built-in palettes. Renderer owns its copy.
const palettePresets = {
    dark: { background: '#101827', text: '#f1f5f9', bar: '#94a3b8', sorted: '#34d399', active: '#fbbf24', held: '#c4b5fd' },
    light: { background: '#f8fafc', text: '#0f172a', bar: '#475569', sorted: '#047857', active: '#b45309', held: '#7c3aed' },
};
const colorRoles = Object.keys(palettePresets.dark);
function updatePalette() {
    const colors = Object.fromEntries(colorRoles.map(role => [role, $('color-' + role).value]));
    renderer = createArrayRenderer({ theme: $('palette-theme').value, colors });
    playback.draw();
}
function resetPalette() {
    const preset = palettePresets[$('palette-theme').value];
    for (const role of colorRoles) $('color-' + role).value = preset[role];
    updatePalette();
}
for (const role of colorRoles) $('color-' + role).oninput = updatePalette;
$('palette-theme').onchange = resetPalette;
$('palette-reset').onclick = resetPalette;
resetPalette();
