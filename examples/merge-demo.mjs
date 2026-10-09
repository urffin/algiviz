import { limits, generateValues } from './player-settings.mjs';
import { createDemoPlayer } from './demo-player.mjs';
import { mergeSort } from './merge-algorithm.mjs';
import { createMergeRenderer, mergeItemLabel } from './merge-scene.mjs';
const $ = id => document.getElementById(id);
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
let original, renderer;
const playback = createDemoPlayer({
    isTerminal: step => step.event.type === 'done',
    onError: error => { $('error').textContent = error.message; },
    render(frame) {
        if (frame.stepIndex === 0 && original !== frame.current.main) {
            original = frame.current.main; renderer = createMergeRenderer(true, original);
        }
        renderer.render(ctx, frame);
        const label = item => mergeItemLabel(item, original);
        const summarize = items => items.slice(0, 24).map(label).join(', ') + (items.length > 24 ? ', … (' + items.length + ' items)' : '');
        const state = frame.current;
        const text = `Step ${frame.stepIndex}: ${frame.event.type} · Main: [${summarize(state.main)}] · Buffer: [${summarize(state.buffer)}] · Comparisons: ${state.comparisons} · Buffer writes: ${state.bufferWrites} · Main writes: ${state.mainWrites}`;
        if ($('status').textContent !== text) $('status').textContent = text;
    }
});
function load(values) {
    const saved = [...values];
    playback.load(mode => {
        if (saved.length > limits[mode] || saved.some(value => !Number.isFinite(value))) throw new Error(`Use up to ${limits[mode]} finite numbers.`);
        return mergeSort.iterate(saved);
    });
    $('values').value = saved.join(', '); $('error').textContent = '';
}
function attempt(action) { try { action(); } catch (error) { $('error').textContent = error.message; } }
$('apply').onclick = () => attempt(() => {
    const text = $('values').value.trim();
    const tokens = text ? text.split(/[\s,]+/) : [];
    if (tokens.some(token => !token || !Number.isFinite(Number(token)))) throw new TypeError('Enter finite numbers separated by spaces or commas.');
    load(tokens.map(Number));
});
$('generate').onclick = () => attempt(() => load(generateValues(Number($('size').value), $('order').value, playback.mode)));
new ResizeObserver(() => {
    canvas.width = Math.max(320, Math.round(canvas.getBoundingClientRect().width));
    canvas.height = Math.max(380, Math.round(canvas.width * 0.65)); playback.draw();
}).observe(canvas);
$('apply').click();
