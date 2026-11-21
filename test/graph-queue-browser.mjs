import { timing } from '../examples/player-settings.mjs';

const checks = [];
function ensure(value, message) {
    if (!value) throw new Error(message);
}

async function check(name, run) {
    const row = document.createElement('li');
    document.querySelector('#checks').append(row);
    try {
        await run();
        checks.push({ name, passed: true });
        row.textContent = name + ' · PASS';
    } catch (error) {
        checks.push({ name, passed: false, error: String(error?.stack ?? error) });
        row.textContent = name + ' · FAIL ' + error;
    }
}

async function openExample(page, width) {
    const iframe = document.createElement('iframe');
    iframe.title = page + ' at ' + width + 'px';
    iframe.width = String(width);
    const loaded = new Promise(resolve => iframe.addEventListener('load', resolve, { once: true }));
    iframe.src = '../examples/' + page + '.html';
    document.querySelector('#examples').append(iframe);
    await loaded;
    const view = iframe.contentWindow, doc = iframe.contentDocument;
    const raf = () => new Promise(view.requestAnimationFrame.bind(view));
    const control = action => doc.querySelector('[data-action="' + action + '"]');
    const phase = () => doc.querySelector('.algiviz-player')?.dataset.phase;
    const status = () => doc.querySelector('#status').textContent;
    const queue = () => doc.querySelector('#queue').textContent.split('Queue, front first: ')[1];
    function click(action) {
        const button = control(action);
        ensure(button && !button.hidden && !button.disabled, 'Unavailable control ' + action);
        button.click();
    }
    function select(input, value, event = 'change') {
        input.value = String(value);
        input.dispatchEvent(new view.Event(event, { bubbles: true }));
    }
    await raf();
    return { view, doc, raf, control, phase, status, queue, click, select };
}

function greenPixels(canvas) {
    const { width, height } = canvas;
    const data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 52 && data[i + 1] === 211 && data[i + 2] === 153 && data[i + 3] === 255) count++;
    }
    return count;
}

for (const width of [960, 390]) {
    const { view, doc, raf, control, phase, status, queue, click, select } = await openExample('graph-queue', width);
    const canvases = [...doc.querySelectorAll('canvas')];
    const mode = doc.querySelector('#mode');
    const pixels = () => canvases.map(canvas => canvas.toDataURL());
    const matches = (a, b) => a.every((snapshot, i) => snapshot === b[i]);
    const bothChange = (a, b) => a.every((snapshot, i) => snapshot !== b[i]);
    const expect = (event, fifo) => ensure(status().includes(event) && queue() === fifo,
        'Expected ' + event + ', queue ' + fifo + '; got ' + status() + ', queue ' + queue());
    for (const playback of ['generator', 'history']) {
        await check(width + 'px · ' + playback + ' · one Player and two native viewports', async () => {
            select(mode, playback);
            expect('Discover A', '[A]');
            ensure(doc.querySelectorAll('.algiviz-player').length === 1, 'Expected one Player');
            ensure(doc.querySelectorAll('.algiviz-player__viewport canvas').length === 2, 'Expected both canvases inside Player');
            ensure(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth, 'Horizontal page overflow');
            for (const canvas of canvases) {
                ensure(canvas.width === Math.round(canvas.getBoundingClientRect().width * view.devicePixelRatio), 'Wrong bitmap width');
            }
            ensure(control('seek').hidden === (playback === 'generator'), 'Seek control visibility mismatch');
            click('play');
            ensure(phase() === 'playing', 'Play did not start');
            await raf();
            click('play');
            const paused = pixels();
            await raf();
            ensure(phase() === 'paused' && matches(paused, pixels()), 'Pause did not freeze both canvases');
        });

        await check(width + 'px · ' + playback + ' · synchronized step, rewind and replay', () => {
            click('restart');
            const initial = pixels();
            click('next');
            expect('Take A', '[]');
            ensure(bothChange(initial, pixels()), 'Dequeue did not redraw both canvases');
            click('next');
            expect('Inspect neighbor B', '[]');
            const beforeDiscover = pixels();
            click('next');
            expect('Discover B at distance 1', '[B]');
            const discover = pixels();
            ensure(bothChange(beforeDiscover, discover), 'Enqueue did not redraw both canvases');
            click('previous');
            expect('Inspect neighbor B', '[]');
            ensure(matches(beforeDiscover, pixels()), 'Previous did not restore the two canvas images');
            click('next');
            expect('Discover B at distance 1', '[B]');
            ensure(matches(discover, pixels()), 'Next did not restore the two canvas images');
            if (playback === 'history') {
                select(control('seek'), 2.5 * timing.stepDurationMs, 'input');
                expect('Discover B at distance 1', '[B]');
                const inBetween = pixels();
                ensure(inBetween[1] !== beforeDiscover[1] && inBetween[1] !== discover[1], 'Queue did not interpolate during seek');
                select(control('seek'), 3 * timing.stepDurationMs, 'input');
                ensure(matches(discover, pixels()), 'Seek lost the recorded endpoint');
            }
        });

        await check(width + 'px · ' + playback + ' · shortest path and Restart', () => {
            for (let i = 0; i < 100 && phase() !== 'finished'; i++) click('next');
            ensure(phase() === 'finished', 'BFS did not finish');
            expect('Traversal complete', '[]');
            ensure(doc.querySelector('#result').textContent.includes('A → B → D → G'), 'Wrong shortest path');
            ensure(greenPixels(canvases[0]) > 200 && greenPixels(canvases[1]) === 0, 'Expected a green path and an empty unmarked queue');
            click('restart');
            expect('Discover A at distance 0', '[A]');
            ensure(greenPixels(canvases[0]) === 0, 'Restart retained the result');
            ensure(doc.querySelector('#error').textContent === '', 'Unexpected rendering error');
        });
    }
    await check(width + 'px · page lifecycle restores one Player and both canvases', async () => {
        select(control('speed'), 2);
        view.dispatchEvent(new view.PageTransitionEvent('pagehide', { persisted: true }));
        ensure(!doc.querySelector('.algiviz-player') && doc.querySelectorAll('#player > .panes canvas').length === 2,
            'Pagehide did not restore the viewport wrapper');
        const sizes = canvases.map(canvas => canvas.width);
        canvases.forEach(canvas => { canvas.style.width = '200px'; });
        await raf();
        await raf();
        ensure(canvases.every((canvas, i) => canvas.width === sizes[i]), 'Disposed viewport resized a canvas');
        canvases.forEach(canvas => { canvas.style.width = ''; });
        view.dispatchEvent(new view.PageTransitionEvent('pageshow', { persisted: true }));
        await raf();
        expect('Discover A', '[A]');
        ensure(mode.value === 'history' && control('speed').value === '2', 'Restored page lost mode or speed');
        ensure(doc.querySelectorAll('.algiviz-player__viewport canvas').length === 2, 'Restored Player lost a canvas');
    });
    view.dispatchEvent(new view.PageTransitionEvent('pagehide'));
}

for (const page of ['graph', 'graph-player']) {
    await check(page + ' · previous example still mounts one canvas and replays', async () => {
        const { view, doc, status, queue, click } = await openExample(page, 600);
        ensure(doc.querySelectorAll('.algiviz-player__viewport canvas').length === 1, 'Existing viewport did not mount');
        ensure(status().includes('Discover A') && queue() === '[A]', 'Wrong first step');
        click('next');
        ensure(status().includes('Take A') && queue() === '[]', 'Previous example did not advance');
        click('restart');
        ensure(status().includes('Discover A') && queue() === '[A]', 'Previous example did not restart');
        view.dispatchEvent(new view.PageTransitionEvent('pagehide'));
    });
}

const passed = checks.filter(check => check.passed).length, failed = checks.length - passed;
document.querySelector('#status').textContent = 'Завершено ' + passed + '/' + checks.length + ', ошибок ' + failed;
await fetch('/report', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passed, failed, host: { userAgent: navigator.userAgent, devicePixelRatio }, checks }) });
