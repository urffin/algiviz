const checks = [], details = [], gallery = document.querySelector('#gallery');
const ensure = (condition, message) => { if (!condition) throw Error(message); };
const equal = (a, b, message) => ensure(JSON.stringify(a) === JSON.stringify(b), message);
const nextFrame = view => new Promise(resolve => view.requestAnimationFrame(resolve));
async function settle(view) { await nextFrame(view); await nextFrame(view); }
async function check(name, run) {
    const row = document.createElement('li'); row.textContent = name; document.querySelector('#checks').append(row);
    try { await run(); row.textContent += ' · PASS'; checks.push({ name, passed: true }); }
    catch (error) { row.textContent += ' · FAIL: ' + error.message; checks.push({ name, passed: false, error: String(error.stack ?? error) }); }
}
async function embed(page, width) {
    const iframe = document.createElement('iframe'); iframe.title = `${page}, ${width}px`; iframe.style.width = width + 'px';
    const loaded = new Promise(resolve => iframe.addEventListener('load', resolve, { once: true }));
    iframe.src = '../examples/' + page; gallery.append(iframe); await loaded;
    const view = iframe.contentWindow, doc = iframe.contentDocument;
    await settle(view); return { iframe, view, doc, canvas: doc.querySelector('canvas') };
}
function instrument(ctx) {
    const log = { renders: 0, fills: [], strokes: [], text: [] }, saved = {}; let points = [];
    for (const name of ['clearRect', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'fillText']) {
        saved[name] = ctx[name]; ctx[name] = function (...args) {
            if (name === 'clearRect') { log.renders++; log.fills = []; log.strokes = []; log.text = []; }
            if (name === 'fillRect') log.fills.push({ args, color: ctx.fillStyle });
            if (name === 'beginPath') points = [];
            if (name === 'moveTo' || name === 'lineTo') points.push(args);
            if (name === 'stroke') log.strokes.push({ points: points.map(p => [...p]), color: ctx.strokeStyle, alpha: ctx.globalAlpha });
            if (name === 'fillText') log.text.push(args[0]);
            return saved[name].apply(ctx, args);
        };
    }
    return { log, restore() { for (const [name, original] of Object.entries(saved)) ctx[name] = original; } };
}
const cells = log => log.fills.slice(1), resultCells = log => cells(log).map((c, i) => c.color === '#34d399' ? i : -1).filter(i => i >= 0);
const routes = log => log.strokes.filter(s => s.color === '#fbbf24');
function green(canvas) {
    const p = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0; for (let i = 0; i < p.length; i += 4) if (p[i] === 52 && p[i + 1] === 211 && p[i + 2] === 153 && p[i + 3] === 255) count++;
    return count;
}
const control = (doc, action) => doc.querySelector(`[data-action="${action}"]`);
function click(doc, action) { const button = control(doc, action); ensure(button && !button.disabled && !button.hidden, 'Unavailable control: ' + action); button.click(); }
function select(doc, id, value) { const node = doc.querySelector(id); node.value = value; node.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true })); ensure(!doc.querySelector('#error').textContent, 'Selection failed: ' + id); }
function seek(doc, value) { const node = control(doc, 'seek'); ensure(!node.disabled && !node.hidden, 'Seek unavailable'); node.value = String(value); node.dispatchEvent(new doc.defaultView.Event('input', { bubbles: true })); }
function finish(doc) {
    for (let i = 0; i < 100 && doc.querySelector('.algiviz-player').dataset.phase !== 'finished'; i++) click(doc, 'next');
    ensure(doc.querySelector('.algiviz-player').dataset.phase === 'finished', 'Search did not terminate');
    ensure(!doc.querySelector('#error').textContent, 'Playback error');
}
const pathIds = [0, 1, 2, 9, 16, 17, 18, 25, 32, 33, 34];
for (const width of [960, 390]) {
    const { view, doc, canvas } = await embed('grid-player.html', width);
    const capture = instrument(canvas.getContext('2d')), { log } = capture;
    for (const mode of ['generator', 'history']) {
        await check(`${width}px · ${mode}: native cells, distance captions, Play/Pause and viewport DPR`, async () => {
            select(doc, '#preset', 'passages'); select(doc, '#mode', mode);
            ensure(doc.querySelector('#status').textContent.startsWith('Step 0:'), 'Initial state missing');
            ensure(cells(log).length === 35 && green(canvas) === 0, 'Initial grid wrong');
            ensure(log.text.includes('S') && log.text.includes('T') && log.text.includes('#'), 'Cell labels missing');
            ensure(canvas.width === Math.round(canvas.getBoundingClientRect().width * view.devicePixelRatio), 'Native DPR mismatch');
            ensure(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth, 'Horizontal overflow');
            click(doc, 'play'); ensure(doc.querySelector('.algiviz-player').dataset.phase === 'playing', 'Play failed');
            await settle(view); click(doc, 'play'); ensure(doc.querySelector('.algiviz-player').dataset.phase === 'paused', 'Pause failed');
            const image = canvas.toDataURL(), text = doc.querySelector('#status').textContent;
            await settle(view); ensure(canvas.toDataURL() === image && doc.querySelector('#status').textContent === text, 'Pause advanced');
            click(doc, 'restart'); click(doc, 'next'); ensure(log.text.includes('d=0'), 'Start distance absent');
            click(doc, 'next'); click(doc, 'next'); ensure(log.text.includes('d=1'), 'Discovery distance absent');
        });
        await check(`${width}px · ${mode}: shortest path joins exactly the eleven green cells; resize preserves result`, async () => {
            click(doc, 'restart'); finish(doc);
            ensure(doc.querySelector('#result').textContent.startsWith('Shortest path: 10 moves.'), 'Wrong route summary');
            ensure(doc.querySelector('#counters').textContent === 'Discovered: 23 · Dequeued: 22', 'Wrong search counters');
            ensure(doc.querySelector('#queue').textContent.startsWith('Queue, head → tail (1):'), 'Search did not stop at goal');
            equal(resultCells(log), pathIds, 'Wrong green cells'); ensure(green(canvas) > 1000, 'Green raster missing');
            const route = routes(log); ensure(route.length === 1 && route[0].alpha === 1, 'Final path line missing');
            for (const [i, id] of pathIds.entries()) {
                const box = cells(log)[id].args, point = route[0].points[i];
                ensure(Math.abs(point[0] - (box[0] + box[2] / 2)) < 1e-6 && Math.abs(point[1] - (box[1] + box[3] / 2)) < 1e-6, 'Line does not follow path centers');
            }
            ensure(log.text.includes('d=10') && log.text.includes('S') && log.text.includes('T'), 'Final captions/labels missing');
            canvas.style.width = (width === 960 ? 700 : 300) + 'px'; await settle(view); await settle(view);
            equal(resultCells(log), pathIds, 'Resize lost result'); ensure(canvas.width === Math.round(canvas.getBoundingClientRect().width * view.devicePixelRatio), 'Resize DPR mismatch');
            canvas.style.width = ''; await settle(view); await settle(view);
            details.push({ width, mode, bitmapWidth: canvas.width, bitmapHeight: canvas.height, DPR: view.devicePixelRatio, pathIds, greenPixels: green(canvas) });
        });
        await check(`${width}px · ${mode}: Previous/Next replay, bounded window and fresh Restart`, () => {
            for (let i = 0; i < 3 && resultCells(log).length; i++) click(doc, 'previous');
            ensure(resultCells(log).length === 0 && green(canvas) === 0 && routes(log).length === 0, 'Rewind retained final path');
            ensure(!doc.querySelector('#result').textContent.startsWith('Shortest path:'), 'Rewind retained final summary');
            click(doc, 'next'); equal(resultCells(log), pathIds, 'Replay lost path');
            if (mode === 'generator') {
                for (let i = 0; i < 80 && !control(doc, 'previous').disabled; i++) click(doc, 'previous');
                ensure(doc.querySelector('#status').textContent.startsWith('Step 36:'), 'Wrong bounded rewind floor');
                ensure(control(doc, 'previous').disabled, 'Previous did not stop at retained window');
            }
            click(doc, 'restart'); ensure(doc.querySelector('#status').textContent.startsWith('Step 0:') && green(canvas) === 0, 'Restart retained result');
            ensure(doc.querySelector('#counters').textContent === 'Discovered: 0 · Dequeued: 0', 'Restart retained queue work');
        });
        if (mode === 'history') await check(`${width}px · history: native seek into path appearance and jump backwards`, () => {
            seek(doc, 650 * 66.5); equal(routes(log).map(r => r.alpha), [.5], 'Mid-transition path opacity wrong');
            equal(resultCells(log), pathIds, 'Current result lost at fractional progress');
            seek(doc, 650 * 67); equal(routes(log).map(r => r.alpha), [1], 'Full path missing');
            seek(doc, 0); ensure(green(canvas) === 0 && routes(log).length === 0, 'Seek to start retained final pixels');
        });
        await check(`${width}px · ${mode}: unreachable and zero-move paths, including rewind and Restart`, () => {
            select(doc, '#preset', 'blocked'); finish(doc);
            ensure(doc.querySelector('#result').textContent === 'No path. The target is unreachable.', 'Unreachable outcome missing');
            ensure(resultCells(log).length === 0 && routes(log).length === 0 && green(canvas) === 0, 'Unreachable target invented a path');
            select(doc, '#preset', 'same'); finish(doc);
            ensure(doc.querySelector('#result').textContent === 'Shortest path: 0 moves. (1,1)', 'Zero-move summary wrong');
            equal(resultCells(log), [0], 'Singleton not green'); ensure(green(canvas) > 200 && routes(log).length === 0, 'Singleton raster or line wrong');
            for (let i = 0; i < 3 && resultCells(log).length; i++) click(doc, 'previous');
            ensure(green(canvas) === 0, 'Singleton persisted on rewind'); click(doc, 'next'); equal(resultCells(log), [0], 'Singleton replay failed');
            click(doc, 'restart'); ensure(green(canvas) === 0 && doc.querySelector('#status').textContent.startsWith('Step 0:'), 'Singleton Restart failed');
            select(doc, '#preset', 'passages');
        });
    }
    await check(`${width}px · failed selections preserve session; grid/mode changes preserve speed`, () => {
        const speed = control(doc, 'speed'); speed.value = '2'; speed.dispatchEvent(new view.Event('change', { bubbles: true }));
        click(doc, 'next'); const image = canvas.toDataURL(), text = doc.querySelector('#status').textContent, root = doc.querySelector('.algiviz-player');
        for (const id of ['#mode', '#preset']) {
            const node = doc.querySelector(id), option = new view.Option('Invalid test selection', 'invalid'); node.add(option); node.value = 'invalid'; node.dispatchEvent(new view.Event('change', { bubbles: true }));
            ensure(doc.querySelector('#error').textContent && doc.querySelector('.algiviz-player') === root, 'Invalid selection replaced session');
            ensure(canvas.toDataURL() === image && doc.querySelector('#status').textContent === text, 'Invalid selection changed state'); option.remove();
        }
        select(doc, '#preset', 'same'); ensure(control(doc, 'speed').value === '2', 'Grid change reset speed');
        select(doc, '#mode', 'generator'); ensure(control(doc, 'speed').value === '2', 'Mode change reset speed');
        select(doc, '#mode', 'history'); select(doc, '#preset', 'passages');
    });
    await check(`${width}px · pagehide disposes controls/viewport; BFcache starts a fresh search`, async () => {
        seek(doc, 650 * 67); ensure(green(canvas) > 1000, 'Missing result before cleanup');
        view.dispatchEvent(new view.PageTransitionEvent('pagehide', { persisted: true }));
        ensure(!doc.querySelector('.algiviz-player') && canvas.parentElement === doc.querySelector('#player'), 'Player not disposed');
        const renders = log.renders; canvas.style.width = '280px'; await settle(view); await settle(view); ensure(log.renders === renders, 'Disposed viewport redrew'); canvas.style.width = '';
        view.dispatchEvent(new view.PageTransitionEvent('pageshow', { persisted: true })); await settle(view); await settle(view);
        ensure(doc.querySelector('.algiviz-player') && green(canvas) === 0 && doc.querySelector('#status').textContent.startsWith('Step 0:'), 'BFcache restoration retained result');
        ensure(doc.querySelector('#mode').value === 'history' && doc.querySelector('#preset').value === 'passages', 'Restored selections desynchronized');
        capture.restore(); view.dispatchEvent(new view.PageTransitionEvent('pagehide'));
    });
}
await check('Preserved maze: seeded generation, BFS and DFS cycle still work with original controls', async () => {
    const { view, doc } = await embed('maze.html', 390);
    ensure(doc.querySelector('#status').textContent.includes('Start generation'), 'Original generation did not start');
    doc.querySelector('#next').click(); ensure(!doc.querySelector('#error').textContent, 'Original generation step failed');
    const change = (id, value) => { const node = doc.querySelector(id); node.value = value; node.dispatchEvent(new view.Event('change', { bubbles: true })); };
    change('#preset', 'cycle');
    for (const [stage, moves] of [['bfs', 1], ['dfs', 5]]) {
        change('#stage', stage); doc.querySelector('#input-form').dispatchEvent(new view.Event('submit', { bubbles: true, cancelable: true }));
        ensure(!doc.querySelector('#error').textContent, 'Original Apply failed');
        for (let i = 0; i < 150 && doc.querySelector('#status').textContent !== 'Search complete.' && !doc.querySelector('#result').textContent.startsWith('Path length:'); i++) doc.querySelector('#next').click();
        ensure(doc.querySelector('#result').textContent.startsWith(`Path length: ${moves} `), 'Original ' + stage + ' result changed');
        details.push({ preservedMaze: stage, pathMoves: moves });
    }
    view.dispatchEvent(new view.PageTransitionEvent('pagehide'));
});
const report = { date: new Date().toISOString(), host: { userAgent: navigator.userAgent, devicePixelRatio }, checks, details,
    passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed).length };
document.querySelector('#status').textContent = `Complete: ${report.passed}/${checks.length}; failed ${report.failed}`;
document.querySelector('#report').textContent = JSON.stringify(report, null, 2);
await fetch('/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
