import { createDemoPlayer } from './demo-player.mjs';
import { limits, generateValues } from './player-settings.mjs';
import { binarySearch } from './binary-search-algorithm.mjs';
import { binarySearchLayout, createBinarySearchRenderer } from './binary-search-scene.mjs';
const $ = id => document.getElementById(id);
const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
const renderer = createBinarySearchRenderer();
const playback = createDemoPlayer({
    isTerminal: step => step.event.type === 'done',
    onError: error => { $('error').textContent = error.message; },
    render(frame, { running }) {
        const state = frame.current;
        const width = Math.max(48, canvas.getBoundingClientRect().width);
        const height = binarySearchLayout(width, state.values.length).height;
        const ratio = window.devicePixelRatio || 1;
        canvas.style.height = height + 'px';
        const bitmapWidth = Math.round(width * ratio), bitmapHeight = Math.round(height * ratio);
        if (canvas.width !== bitmapWidth) canvas.width = bitmapWidth;
        if (canvas.height !== bitmapHeight) canvas.height = bitmapHeight;
        ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
        renderer.render(ctx, frame, width);
        const result = state.result === null ? 'pending' : state.result === -1 ? 'not found' : 'first occurrence at index ' + state.result;
        const text = 'Step ' + frame.stepIndex + ': ' + frame.event.type + ' · Target: ' + state.target +
            ' · Interval: ' + (state.low <= state.high ? '[' + state.low + ', ' + state.high + ']' : 'empty') +
            ' · Middle: ' + (state.mid ?? '—') + ' · Candidate: ' + (state.candidate ?? '—') +
            ' · Inspected elements: ' + state.probes + ' · Result: ' + result +
            ' · Values: [' + state.values.slice(0, 24).join(', ') + (state.values.length > 24 ? ', … (' + state.values.length + ' items)' : '') + ']';
        $('status').setAttribute('aria-live', running ? 'off' : 'polite');
        if ($('status').textContent !== text) $('status').textContent = text;
    }
});
function load(values, target) {
    const saved = [...values];
    playback.load(mode => {
        if (saved.length > limits[mode]) throw new RangeError('Use up to ' + limits[mode] + ' values in this mode.');
        return binarySearch.iterate(saved, target);
    });
    $('values').value = saved.join(', ');
    $('target').value = String(target);
}
function attempt(action) { try { action(); } catch (error) { $('error').textContent = error.message; } }
function targetValue() {
    const text = $('target').value.trim();
    if (!text || !Number.isFinite(Number(text))) throw new TypeError('Enter a finite target number.');
    return Number(text);
}
$('apply').onclick = () => attempt(() => {
    const text = $('values').value.trim(), tokens = text ? text.split(/[\s,;]+/) : [];
    if (tokens.some(token => !token || !Number.isFinite(Number(token)))) throw new TypeError('Enter finite numbers separated by spaces, commas or semicolons.');
    load(tokens.map(Number), targetValue());
});
$('generate').onclick = () => attempt(() => {
    const target = targetValue();
    // Always sorted; generated values follow the shared generation and mode limits.
    load(generateValues(Number($('size').value), 'sorted', playback.mode), target);
});
new ResizeObserver(() => playback.draw()).observe(canvas);
window.addEventListener('resize', () => playback.draw());
$('apply').click();
