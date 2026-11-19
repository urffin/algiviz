const checks = [], details = [], gallery = document.querySelector('#gallery');
const ensure = (condition, message) => { if (!condition) throw Error(message); };
const nextFrame = view => new Promise(resolve => view.requestAnimationFrame(resolve));
async function check(name, fn) {
    const row = document.createElement('li'); row.textContent = name; document.querySelector('#checks').append(row);
    try { await fn(); row.textContent += ' · PASS'; checks.push({ name, passed: true }); }
    catch (error) { row.textContent += ' · FAIL: ' + error.message; checks.push({ name, passed: false, error: String(error.stack ?? error) }); }
}
async function embed(page, width) {
    const iframe = document.createElement('iframe'); iframe.title = `${page}, ${width}px`; iframe.style.width = width + 'px';
    // The document under test retains its requested viewport even in a narrow parent panel.
    iframe.style.maxWidth = 'none';
    const loaded = new Promise(resolve => iframe.addEventListener('load', resolve, { once: true }));
    iframe.src = '../examples/' + page; gallery.append(iframe); await loaded;
    const view = iframe.contentWindow, doc = iframe.contentDocument;
    await nextFrame(view); await nextFrame(view);
    return { iframe, view, doc, canvas: doc.querySelector('canvas') };
}
function instrument(ctx) {
    const log = { renders: 0, circles: [], curves: [], text: [] }, saved = {};
    let circle;
    for (const name of ['clearRect', 'beginPath', 'arc', 'fill', 'bezierCurveTo', 'fillText']) {
        saved[name] = ctx[name];
        ctx[name] = function (...args) {
            if (name === 'clearRect') { log.renders++; log.circles = []; log.curves = []; log.text = []; }
            if (name === 'beginPath') circle = null;
            if (name === 'arc') circle = args;
            if (name === 'fill' && circle) log.circles.push({ point: circle, color: ctx.fillStyle, alpha: ctx.globalAlpha });
            if (name === 'bezierCurveTo') log.curves.push({ args, alpha: ctx.globalAlpha });
            if (name === 'fillText') log.text.push(args[0]);
            return saved[name].apply(ctx, args);
        };
    }
    return { log, restore() { for (const [name, value] of Object.entries(saved)) ctx[name] = value; } };
}
function green(canvas) {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0; for (let i = 0; i < data.length; i += 4) if (data[i] === 52 && data[i + 1] === 211 && data[i + 2] === 153 && data[i + 3] === 255) count++;
    return count;
}
const button = (doc, action) => doc.querySelector(`[data-action="${action}"]`);
const click = (doc, action) => { const node = button(doc, action); ensure(node && !node.disabled && !node.hidden, 'Unavailable control: ' + action); node.click(); };
function setMode(doc, mode) {
    const select = doc.querySelector('#mode'); select.value = mode; select.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true }));
    ensure(!doc.querySelector('#error').textContent, 'Mode switch error');
}
function seek(doc, value) {
    const input = button(doc, 'seek'); ensure(!input.disabled && !input.hidden, 'Seek unavailable'); input.value = String(value);
    input.dispatchEvent(new doc.defaultView.Event('input', { bubbles: true }));
}
for (const width of [960, 390]) {
    const env = await embed('tree-player.html', width), { doc, view, canvas } = env;
    const ctx = canvas.getContext('2d'), capture = instrument(ctx), { log } = capture;
    for (const mode of ['generator', 'history']) {
        await check(`${width}px · ${mode}: initial state, Play/Pause and native viewport/DPR`, async () => {
            setMode(doc, mode);
            ensure(doc.querySelector('#status').textContent.includes('Start with root 3'), 'Initial state missing');
            ensure(log.circles.length === 2 && green(canvas) === 0, 'Initial bitmap wrong');
            ensure(canvas.width === Math.round(canvas.getBoundingClientRect().width * view.devicePixelRatio), 'Native DPR mismatch');
            ensure(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth, 'Example overflows horizontally');
            click(doc, 'play'); ensure(doc.querySelector('.algiviz-player').dataset.phase === 'playing', 'Play failed');
            await nextFrame(view); click(doc, 'play'); ensure(doc.querySelector('.algiviz-player').dataset.phase === 'paused', 'Pause failed');
            const image = canvas.toDataURL(), text = doc.querySelector('#status').textContent;
            await nextFrame(view); await nextFrame(view);
            ensure(canvas.toDataURL() === image && doc.querySelector('#status').textContent === text, 'Pause advanced playback');
        });
        await check(`${width}px · ${mode}: insert leaf, rotate once, final green tree`, () => {
            click(doc, 'restart');
            for (let i = 0; i < 3; i++) click(doc, 'next');
            ensure(doc.querySelector('#status').textContent.includes('Insert 1 there') && log.circles.length === 3, 'Insertion missing');
            click(doc, 'next'); click(doc, 'next');
            ensure(doc.querySelector('#status').textContent.includes('One right rotation'), 'Rotation missing');
            click(doc, 'next'); click(doc, 'next');
            ensure(doc.querySelector('#status').textContent.includes('Done. Root: 2; left: 1; right: 3'), 'Wrong final summary');
            ensure(log.circles.length === 3 && log.circles.every(c => c.color === '#34d399'), 'Not all result nodes green');
            ensure(green(canvas) > 1200 * view.devicePixelRatio ** 2, 'Green raster missing');
            ensure(log.text.includes('root'), 'Root caption omitted');
            details.push({ width, mode, bitmapWidth: canvas.width, bitmapHeight: canvas.height, DPR: view.devicePixelRatio, greenPixels: green(canvas), resultNodes: log.circles.length });
        });
        await check(`${width}px · ${mode}: Previous/Next replay, return before insertion and Restart`, () => {
            click(doc, 'previous'); ensure(green(canvas) === 0, 'Previous retained green');
            click(doc, 'next'); ensure(green(canvas) > 1200, 'Replay lost result');
            for (let i = 0; i < 7; i++) click(doc, 'previous');
            ensure(log.circles.length === 2 && green(canvas) === 0, 'Rewind failed to remove inserted leaf');
            click(doc, 'next'); click(doc, 'next'); click(doc, 'next'); ensure(log.circles.length === 3, 'Second insertion view missing');
            click(doc, 'restart'); ensure(log.circles.length === 2 && green(canvas) === 0, 'Restart retained insertion/result');
        });
        if (mode === 'history') await check(`${width}px · history: seek into rotation, attached crossfade and jump back`, () => {
            seek(doc, 650 * 4.5);
            ensure(doc.querySelector('#status').textContent.includes('One right rotation'), 'Seek selected wrong state');
            ensure(log.curves.length === 3 && log.curves.filter(c => c.alpha === .5).length === 2, 'Mid-rotation branches missing');
            seek(doc, 650 * 7); ensure(green(canvas) > 1200, 'Seek to final lost green');
            seek(doc, 0); ensure(log.circles.length === 2 && green(canvas) === 0, 'Seek to start retained final state');
        });
    }
    await check(`${width}px · pagehide cleanup and BFcache restoration create a fresh tree`, async () => {
        seek(doc, 650 * 7);
        view.dispatchEvent(new view.PageTransitionEvent('pagehide', { persisted: true }));
        ensure(!doc.querySelector('.algiviz-player'), 'Disposed Player controls retained');
        ensure(canvas.parentElement === doc.querySelector('#player'), 'Canvas not restored');
        const renders = log.renders; canvas.style.width = '320px'; await nextFrame(view); await nextFrame(view);
        ensure(log.renders === renders, 'Disposed viewport redrew'); canvas.style.width = '';
        view.dispatchEvent(new view.PageTransitionEvent('pageshow', { persisted: true }));
        await nextFrame(view); await nextFrame(view);
        ensure(doc.querySelector('.algiviz-player') && log.circles.length === 2 && green(canvas) === 0, 'BFcache restoration failed');
        ensure(doc.querySelector('#mode').value === 'history', 'Restored mode desynchronized');
        capture.restore(); view.dispatchEvent(new view.PageTransitionEvent('pagehide'));
    });
}
await check('Preserved detailed tree: Canvas stepping and retained SVG still work', async () => {
    const { doc, view } = await embed('tree.html', 390);
    ensure(doc.querySelector('#status').textContent.trim(), 'Detailed example did not start');
    doc.querySelector('#next').click();
    const select = doc.querySelector('#backend'); select.value = 'svg'; select.dispatchEvent(new view.Event('change', { bubbles: true }));
    ensure(!doc.querySelector('svg').hasAttribute('hidden') && doc.querySelector('svg').children.length > 0, 'Detailed SVG backend missing');
    select.value = 'canvas'; select.dispatchEvent(new view.Event('change', { bubbles: true }));
    ensure(!doc.querySelector('canvas').hidden, 'Detailed Canvas backend missing');
    view.dispatchEvent(new view.PageTransitionEvent('pagehide'));
});
const report = { date: new Date().toISOString(), host: { userAgent: navigator.userAgent, devicePixelRatio },
    checks, details, passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed).length };
document.querySelector('#status').textContent = `Complete: ${report.passed}/${checks.length}; failed ${report.failed}`;
document.querySelector('#report').textContent = JSON.stringify(report, null, 2);
await fetch('/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
