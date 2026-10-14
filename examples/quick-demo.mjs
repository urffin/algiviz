import { limits, generateValues } from './player-settings.mjs';
import { createDemoPlayer } from './demo-player.mjs';
import { quickSort } from './quick-algorithm.mjs';
import { threeWayQuickSort } from './quick-three-way.mjs';
import { createQuickRenderer, quickItemLabel } from './quick-scene.mjs';
const $ = (id) => document.getElementById(id);
const canvas = document.querySelector('canvas'),
    ctx = canvas.getContext('2d');
let original,
    renderer,
    loaded = [],
    variant = 'lomuto';
const playback = createDemoPlayer({
    isTerminal: (step) => step.event.type === 'done',
    onError: (error) => {
        $('error').textContent = error.message;
    },
    render(frame, { running }) {
        if (frame.stepIndex === 0 && original !== frame.current.main) {
            original = frame.current.main;
            renderer = createQuickRenderer(true, original);
        }
        renderer.render(ctx, frame);
        $('status').setAttribute('aria-live', running ? 'off' : 'polite');
        const state = frame.current,
            b = state.bands,
            r = state.range;
        const values =
            state.main
                .slice(0, 24)
                .map((item) => quickItemLabel(item, original))
                .join(', ') + (state.main.length > 24 ? ', …' : '');
        const regions = b
            ? ' · Pivot value ' +
              b.value +
              ' · < [' +
              r.start +
              ', ' +
              b.less +
              ') · = [' +
              b.less +
              ', ' +
              b.scan +
              ') · ? [' +
              b.scan +
              ', ' +
              b.greater +
              ') · > [' +
              b.greater +
              ', ' +
              r.end +
              ')'
            : ' · i / j / p: ' + (state.boundary ?? '—') + ' / ' + (state.scan ?? '—') + ' / ' + (state.pivot ?? '—');
        const operation =
            frame.event.type === 'classify'
                ? 'check ' +
                  quickItemLabel(state.main[frame.event.index], original) +
                  (frame.event.relation === 'less' ? ' < ' : ' > ') +
                  frame.event.value
                : frame.event.type;
        const text =
            'Step ' +
            frame.stepIndex +
            ': ' +
            operation +
            ' · Array: [' +
            values +
            '] · Comparisons: ' +
            state.comparisons +
            ' · Swaps: ' +
            state.swaps +
            regions;
        if ($('status').textContent !== text) $('status').textContent = text;
    },
});
function load(values, nextVariant = variant) {
    const saved = [...values],
        algorithm = nextVariant === 'three-way' ? threeWayQuickSort : quickSort;
    playback.load(mode => {
        if (saved.length > limits[mode] || saved.some(x => !Number.isFinite(x)))
            throw new RangeError(`Use up to ${limits[mode]} finite numbers.`);
        return algorithm.iterate(saved);
    });
    loaded = saved;
    variant = nextVariant;
    $('partition').value = variant;
    $('values').value = saved.join(', ');
    $('error').textContent = '';
    $('legend').textContent =
        variant === 'three-way'
            ? 'Blue: smaller; purple: equal; orange: greater; gray: unchecked; yellow: current check; green: final. lt / i / gt mark the region boundaries.'
            : 'Purple p: pivot; yellow j: current comparison; cyan i: next smaller-value position; green: final. The frame marks the active range.';
}
function attempt(action) {
    try {
        action();
    } catch (error) {
        $('error').textContent = error.message;
        $('partition').value = variant;
    }
}
$('apply').onclick = () =>
    attempt(() => {
        const text = $('values').value.trim(),
            tokens = text ? text.split(/[\s,]+/) : [];
        if (tokens.some((token) => !token || !Number.isFinite(Number(token))))
            throw new TypeError('Enter finite numbers separated by spaces or commas.');
        load(tokens.map(Number));
    });
$('partition').onchange = () => attempt(() => load(loaded, $('partition').value));
$('generate').onclick = () =>
    attempt(() => {
        const count = Number($('size').value);
        load(generateValues(count, $('order').value, playback.mode));
    });
$('duplicates').onclick = () => load([4, 2, 4, 6, 4, 2, 4, 6, 4, 4]);
$('equal').onclick = () => load(Array(10).fill(4));
new ResizeObserver(() => {
    canvas.width = Math.max(320, Math.round(canvas.getBoundingClientRect().width));
    canvas.height = Math.max(380, Math.round(canvas.width * 0.65));
    playback.draw();
}).observe(canvas);
$('apply').click();
