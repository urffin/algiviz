import { createListRenderer } from '/dist/canvas/list.js';
import { createCanvasViewport } from '/dist/canvas/viewport.js';
import { createListTrace } from '/dist/list/index.js';
import { Player } from '/dist/player/index.js';

const gallery = document.querySelector('#gallery');
const checks = [];
const size = { width: 540, height: 220 };
function ensure(value, message) { if (!value) throw new Error(message); }
async function check(name, run) {
    try {
        await run();
        checks.push({ name, passed: true });
    } catch (error) {
        checks.push({ name, passed: false, error: String(error?.stack ?? error) });
    }
    const row = document.createElement('li');
    const result = checks.at(-1);
    row.textContent = result.passed ? name + ' · PASS' : name + ' · FAIL ' + result.error;
    document.querySelector('#checks').append(row);
}
const chain = ids => ({ headId: ids[0] ?? null, nodes: ids.map((id, i) => ({ id, value: id, nextId: ids[i + 1] ?? null })) });
const next = nodeId => ({ kind: 'next', nodeId });
function* steps(draw) {
    const initial = chain(['A', 'B']);
    const trace = createListTrace(initial, { layout: draw.layout(initial), nodeCaptions: [{ id: 'A', text: 'start' }] });
    yield trace.start();
    let candidate = chain(['A', 'X', 'B']);
    yield trace.edit({ ...candidate, layout: draw.layout(candidate) });
    candidate = chain(['A', 'X']);
    yield trace.edit({ ...candidate, layout: draw.layout(candidate) });
    candidate = chain(['X', 'A']);
    yield trace.edit({ ...candidate, layout: draw.layout(candidate) });
    yield trace.done({ result: { nodeIds: ['X'], pointerIds: [next('A')] } });
}
const presenter = ({ node }) => ({ label: node.value });
const pair = (previous, current = previous, progress = 1) => ({ previous, current, progress });
function view(ratio = 1, host) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    canvas.style.width = size.width + 'px';
    host?.append(canvas);
    return canvas.getContext('2d', { willReadFrequently: true });
}
const pixels = ctx => ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
function count(ctx, [r, g, b]) {
    const data = pixels(ctx);
    let matching = 0;
    for (let i = 0; i < data.length; i += 4)
        if (data[i] === r && data[i + 1] === g && data[i + 2] === b && data[i + 3] === 255) matching++;
    return matching;
}
function assertMargin(ctx, rgb) {
    const data = pixels(ctx), { width, height } = ctx.canvas;
    const mx = Math.floor(4 * width / size.width), my = Math.floor(4 * height / size.height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (x >= mx && x < width - mx && y >= my && y < height - my) continue;
        const at = (y * width + x) * 4;
        ensure(data[at] === rgb[0] && data[at + 1] === rgb[1] && data[at + 2] === rgb[2] && data[at + 3] === 255,
            'Paint escaped the 4px margin');
    }
}
const contextState = ctx => JSON.stringify({
    transform: [...ctx.getTransform().toFloat64Array()], alpha: ctx.globalAlpha, composite: ctx.globalCompositeOperation,
    filter: ctx.filter, dash: ctx.getLineDash(), font: ctx.font, direction: ctx.direction, fill: ctx.fillStyle
});
for (const theme of ['light', 'dark']) for (const ratio of [1, 1.25, 2]) {
    await check(theme + ' · backing ' + ratio + ' · insertion, deletion, reversal and result', () => {
        const draw = createListRenderer({ theme, presentNode: presenter });
        const ctx = view(ratio, ratio === 1 ? gallery : undefined);
        const states = [...steps(draw)].map(step => step.state);
        const background = theme === 'dark' ? [16, 24, 39] : [248, 250, 252];
        for (let i = 1; i < states.length; i++) for (const p of [0, 0.5, 1]) {
            draw.render(ctx, pair(states[i - 1], states[i], p), size);
            assertMargin(ctx, background);
        }
        ensure(count(ctx, theme === 'dark' ? [52, 211, 153] : [4, 120, 87]) > 100, 'Missing green result');
        ensure(count(ctx, theme === 'dark' ? [203, 213, 225] : [71, 85, 105]) > 0, 'Missing recorded caption or route ink');
    });
}
await check('Empty list, hidden null stub and small canvas', () => {
    const draw = createListRenderer({ theme: 'light' });
    const hidden = createListRenderer({ theme: 'light', nullPointers: 'hidden' });
    const empty = createListTrace(chain([]), { layout: [] }).state, ctx = view();
    draw.render(ctx, pair(empty), size);
    const visible = count(ctx, [100, 116, 139]);
    hidden.render(ctx, pair(empty), size);
    ensure(visible > 0 && count(ctx, [100, 116, 139]) === 0, 'Null outline visibility did not change');
    ensure(count(ctx, [226, 232, 240]) > 100, 'Missing head badge');
    draw.render(ctx, pair(empty), { width: 24, height: 100 });
    ensure(count(ctx, [248, 250, 252]) === ctx.canvas.width * ctx.canvas.height, 'Tiny view should paint background only');
});
await check('Selected null stays readable against the Canvas background in both themes', () => {
    const palettes = [
        ['light', '#0f172a', '#ffffff', [4, 120, 87]],
        ['dark', '#f1f5f9', '#052e16', [52, 211, 153]],
    ];
    for (const [theme, nullText, headText, result] of palettes) {
        const draw = createListRenderer({ theme });
        const input = chain(['A']);
        const trace = createListTrace(input, { layout: draw.layout(input) });
        trace.start();
        const state = trace.done({ result: { pointerIds: [{ kind: 'head' }, next('A')] } }).state;
        const ctx = view(), colors = new Map();
        const fillText = ctx.fillText.bind(ctx);
        ctx.fillText = (text, ...args) => {
            colors.set(text, ctx.fillStyle);
            fillText(text, ...args);
        };
        draw.render(ctx, pair(state), size);
        ensure(colors.get('null') === nullText, 'Missing foreground text for selected null');
        ensure(colors.get('head') === headText, 'Selected head lost contrast on green fill');
        ensure(count(ctx, result) > 100, 'Missing result pixels for selected pointers');
    }
});
await check('Context state, bitmap reset and transparent rewind', () => {
    const draw = createListRenderer({ theme: 'light', presentNode: presenter, colors: { background: 'transparent' } });
    const states = [...steps(draw)].map(step => step.state);
    const ctx = view(), clean = view();
    ctx.setTransform(2, 0.2, 0, 3, 6, 7);
    ctx.globalAlpha = 0.37;
    ctx.globalCompositeOperation = 'xor';
    ctx.filter = 'blur(1px)';
    ctx.setLineDash([2, 3]);
    ctx.direction = 'rtl';
    const saved = contextState(ctx);
    draw.render(ctx, pair(states.at(-1)), size);
    ensure(saved === contextState(ctx), 'Context state leaked');
    ensure(count(ctx, [4, 120, 87]) > 100, 'Missing transparent-background result');
    draw.render(ctx, pair(states[0]), size);
    draw.render(clean, pair(states[0]), size);
    const baseline = pixels(clean);
    ensure(pixels(ctx).every((v, i) => v === baseline[i]), 'Rewind left stale pixels');
    ctx.canvas.width = ctx.canvas.width;
    draw.render(ctx, pair(states.at(-1)), size);
    ensure(count(ctx, [4, 120, 87]) > 100, 'Reset lost rendered result');
});
for (const mode of ['stream', 'history']) await check('Player ' + mode + ' · controls, rewind, Restart, viewport and disposal', async () => {
    const host = document.createElement('div');
    gallery.append(host);
    const ctx = view(1, host), draw = createListRenderer({ theme: 'light', presentNode: presenter });
    let player, runs = 0, closes = 0, draws = 0;
    const display = frame => {
        const drawingSize = viewport.resize(width => width * size.height / size.width);
        if (drawingSize) { draw.render(ctx, frame, drawingSize); draws++; }
    };
    const viewport = createCanvasViewport(ctx.canvas, { onResize() { if (player?.frame) display(player.frame); } });
    function* source() {
        runs++;
        try { yield* steps(draw); } finally { closes++; }
    }
    player = new Player(host, {
        ...(mode === 'stream' ? { stepSource: source, isTerminal: s => s.event.type === 'done', rewindCapacity: 5 }
            : { history: () => [...source()].map(s => s.state) }),
        viewport: ctx.canvas, stepDurationMs: 150, render: display
    });
    function click(action) {
        const button = host.querySelector('[data-action="' + action + '"]');
        ensure(button && !button.disabled, 'Unavailable control ' + action);
        button.click();
    }
    const raf = () => new Promise(requestAnimationFrame);
    const green = () => count(ctx, [4, 120, 87]);
    try {
        click('start');
        click('play');
        await raf();
        click('play');
        const paused = player.frame;
        await raf();
        ensure(player.frame === paused, 'Pause advanced the frame');
        for (let i = 0; i < 10 && player.status.phase !== 'finished'; i++) click('next');
        ensure(player.status.phase === 'finished' && green() > 100, 'Missing terminal result');
        click('previous');
        ensure(green() === 0, 'Previous kept the result');
        click('next');
        ensure(green() > 100 && runs === 1, 'Replay reread the source or lost the result');
        ctx.canvas.style.width = '390px';
        for (let i = 0; i < 4; i++) await raf();
        const width = ctx.canvas.getBoundingClientRect().width;
        ensure(ctx.canvas.width === Math.round(width * devicePixelRatio) && green() > 100, 'Viewport DPR or redraw mismatch');
        click('restart');
        ensure(runs === 2 && green() === 0, 'Restart kept the final result');
    } finally {
        player.dispose();
        player.dispose();
        viewport.dispose();
        const result = await player.closed;
        ensure(result.errorCount === 0 && closes === 2, 'Source cleanup mismatch');
        const previousDraws = draws;
        await raf();
        ensure(draws === previousDraws, 'Redraw after dispose');
    }
});
const report = { host: { userAgent: navigator.userAgent, devicePixelRatio },
    passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed).length, checks };
document.querySelector('#status').textContent = 'Завершено ' + report.passed + '/' + checks.length + ', ошибок ' + report.failed;
await fetch('/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
