import { createCanvasViewport } from '../examples/canvas-viewport.mjs';
import { createStatePlayer } from '@grundyjs/algiviz/playback';

const $ = id => document.getElementById(id);
const canvas = document.querySelector('canvas'), stage = $('stage');
let viewport, lastSize, reads = 0, redraws = 0, measuring = 0;
const errors = [];
const player = createStatePlayer((function* () {
    for (const x of [0.15, 0.4, 0.7, 0.9]) { reads++; yield { x }; }
})());
const heightForWidth = width => { measuring++; return width / 2 + 0.125; };
function ensure(condition, message) { if (!condition) throw Error(message); }
const tick = () => new Promise(resolve => requestAnimationFrame(resolve));
async function settle() { for (let i = 0; i < 4; i++) await tick(); }
async function until(condition) {
    const deadline = performance.now() + 2500;
    while (!condition()) { if (performance.now() > deadline) throw Error('Timed out waiting for native observation'); await tick(); }
}
function metrics() {
    const style = getComputedStyle(canvas), m = viewport.context.getTransform();
    return { userAgent: navigator.userAgent, dpr: window.devicePixelRatio, cap: $('cap').checked ? 2 : null, boxSizing: style.boxSizing,
        cssWidth: style.width, cssHeight: style.height, size: lastSize,
        bitmap: [canvas.width, canvas.height], transform: [m.a, m.d], reads, redraws, heightCalls: measuring,
        stepIndex: player.frame.stepIndex, finished: player.finished, canvasVisible: !stage.hidden, errors: [...errors] };
}
function report() { $('metrics').textContent = JSON.stringify(metrics(), null, 2); }
function redraw() {
    redraws++;
    lastSize = viewport.resize(heightForWidth);
    if (lastSize) {
        const { width, height } = lastSize, ctx = viewport.context;
        ctx.fillStyle = '#18263b'; ctx.fillRect(0, 0, width, height);
        ctx.beginPath(); ctx.arc(width * player.frame.current.x, height / 2, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#b39bff'; ctx.fill();
    }
    report();
}
function mount() {
    viewport = createCanvasViewport(canvas, { onResize: redraw, maxPixelRatio: $('cap').checked ? 2 : Infinity });
    redraw();
}
function pixel() { return [...viewport.context.getImageData(1, 1, 1, 1).data].join(','); }
function validateGeometry() {
    ensure(lastSize !== null, 'Expected measurable canvas');
    const style = getComputedStyle(canvas), px = value => parseFloat(value) || 0;
    const width = px(style.width) - (style.boxSizing === 'border-box'
        ? px(style.borderLeftWidth) + px(style.borderRightWidth) + px(style.paddingLeft) + px(style.paddingRight) : 0);
    const ratio = Math.min(window.devicePixelRatio, $('cap').checked ? 2 : Infinity);
    ensure(Math.abs(lastSize.width - width) < 1e-8, 'Wrong content width');
    ensure(canvas.width === Math.max(1, Math.round(width * ratio)), 'Wrong bitmap width');
    ensure(canvas.height === Math.max(1, Math.round(lastSize.height * ratio)), 'Wrong bitmap height');
    const m = viewport.context.getTransform();
    // Native Canvas may round the stored matrix; compare relative to its scale.
    const close = (actual, expected) => Math.abs(actual - expected) <= Math.abs(expected) * 1e-6;
    ensure(close(m.a, canvas.width / lastSize.width), 'Wrong horizontal transform');
    ensure(close(m.d, canvas.height / lastSize.height), 'Wrong vertical transform');
}
async function check(name, action) {
    const li = document.createElement('li');
    try { await action(); li.dataset.result = 'pass'; li.textContent = 'PASS · ' + name; }
    catch (error) { li.dataset.result = 'fail'; li.textContent = 'FAIL · ' + name + ': ' + error.message; }
    $('checks').append(li);
}
$('run').onclick = async () => {
    delete document.body.dataset.result;
    for (const control of document.querySelectorAll('button,input')) control.disabled = true;
    $('checks').replaceChildren(); $('summary').textContent = 'Running native browser checks…';
    const sourceReads = reads, sourceStep = player.frame.stepIndex;
    try {
        for (const box of ['content-box', 'border-box']) {
            viewport.dispose(); stage.hidden = false;
            Object.assign(canvas.style, { width: '319.25px', boxSizing: box, padding: '5.25px 3.75px', border: '1px solid #64748b' });
            mount(); await settle();
            await check(box + ': fractional geometry and native transform', validateGeometry);
            await check(box + ': unchanged resize preserves pixels', () => {
                const ctx = viewport.context; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 3, 3); ctx.restore();
                const before = pixel(); viewport.resize(heightForWidth);
                ensure(pixel() === before, 'Bitmap was cleared');
            });
            await check(box + ': display:none preserves bitmap, transform and source', async () => {
                const before = { bitmap: [canvas.width, canvas.height].join(','), pixel: pixel(), transform: metrics().transform.join(',') };
                stage.hidden = true; await until(() => lastSize === null);
                const calls = measuring;
                canvas.style.width = '376.75px'; redraw();
                ensure(lastSize === null && measuring === calls, 'Hidden canvas evaluated layout height');
                ensure([canvas.width, canvas.height].join(',') === before.bitmap && pixel() === before.pixel, 'Hidden bitmap changed');
                ensure(metrics().transform.join(',') === before.transform, 'Hidden transform changed');
                ensure(reads === sourceReads && player.frame.stepIndex === sourceStep, 'Source advanced');
            });
            await check(box + ': showing canvas redraws automatically without a step', async () => {
                stage.hidden = false; await until(() => lastSize !== null); validateGeometry();
                ensure(lastSize.width > 340, 'Old width was retained');
                ensure(reads === sourceReads && player.frame.stepIndex === sourceStep, 'Source advanced');
            });
            await check(box + ': height feedback settles', async () => {
                await settle(); const count = redraws; await settle();
                ensure(redraws === count, 'Resize feedback kept redrawing');
            });
            await check(box + ': dispose preserves pixels and stops resize delivery', async () => {
                const before = { bitmap: [canvas.width, canvas.height].join(','), pixel: pixel(), height: canvas.style.height };
                viewport.dispose(); viewport.dispose(); const count = redraws;
                canvas.style.width = '385.5px'; window.dispatchEvent(new Event('resize')); await settle();
                ensure(redraws === count, 'Disposed helper delivered resize');
                ensure([canvas.width, canvas.height].join(',') === before.bitmap && pixel() === before.pixel && canvas.style.height === before.height, 'Disposal changed the drawing');
                let rejected = false; try { viewport.resize(heightForWidth); } catch { rejected = true; }
                ensure(rejected, 'Disposed resize was accepted');
            });
        }
    } finally {
        viewport.dispose(); stage.hidden = false; $('visible').checked = true;
        Object.assign(canvas.style, { width: '319.25px', boxSizing: 'content-box', padding: '0px', border: '0px' });
        mount(); await settle();
        for (const control of document.querySelectorAll('button,input')) control.disabled = false;
        $('next').disabled = player.finished;
        const passed = $('checks').querySelectorAll('[data-result=pass]').length;
        const failed = $('checks').querySelectorAll('[data-result=fail]').length;
        $('summary').textContent = `${passed} passed · ${failed} failed · actual DPR ${window.devicePixelRatio}`;
        document.body.dataset.result = failed || errors.length ? 'fail' : 'pass'; report();
    }
};
$('next').onclick = () => { player.nextStep(); redraw(); $('next').disabled = player.finished; };
$('visible').onchange = () => { stage.hidden = !$('visible').checked; };
$('cap').onchange = () => { viewport.dispose(); mount(); };
window.addEventListener('error', event => { errors.push(event.message); if (viewport) report(); });
window.addEventListener('pagehide', () => { viewport.dispose(); player.dispose(); });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
mount(); document.body.dataset.ready = 'true';
