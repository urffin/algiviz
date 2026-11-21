import { timing } from '../examples/player-settings.mjs';

const checks = [], details = [];
const initialMessage = 'Start with 7 → 3 → 9.';
const resultMessage = 'Result: 9 → 5 → 7 → null.';
function ensure(value, message) { if (!value) throw new Error(message); }
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
function green(canvas) {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4)
        if (data[i] === 52 && data[i + 1] === 211 && data[i + 2] === 153 && data[i + 3] === 255) count++;
    return count;
}

for (const width of [960, 390]) {
    const iframe = document.createElement('iframe');
    iframe.title = 'Linked list at ' + width + 'px';
    iframe.width = String(width);
    const loaded = new Promise(resolve => iframe.addEventListener('load', resolve, { once: true }));
    iframe.src = '../examples/list-player.html';
    document.querySelector('#examples').append(iframe);
    await loaded;
    const view = iframe.contentWindow, doc = iframe.contentDocument;
    const canvas = doc.querySelector('canvas'), mode = doc.querySelector('#mode');
    const status = () => doc.querySelector('#status').textContent;
    const phase = () => doc.querySelector('.algiviz-player')?.dataset.phase;
    const control = action => doc.querySelector('[data-action="' + action + '"]');
    const raf = () => new Promise(view.requestAnimationFrame.bind(view));
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
    for (const playback of ['generator', 'history']) {
        await check(width + 'px · ' + playback + ' · Play, Pause and viewport', async () => {
            select(mode, playback);
            ensure(status() === initialMessage && green(canvas) === 0, 'Missing initial chain');
            ensure(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth, 'Horizontal page overflow');
            ensure(canvas.width === Math.round(canvas.getBoundingClientRect().width * view.devicePixelRatio), 'Incorrect bitmap width');
            ensure(control('seek').hidden === (playback === 'generator'), 'Seek control visibility mismatch');
            click('play');
            ensure(phase() === 'playing', 'Play did not start');
            await raf();
            click('play');
            const paused = canvas.toDataURL(), message = status();
            await raf();
            await raf();
            ensure(phase() === 'paused' && canvas.toDataURL() === paused && status() === message, 'Pause did not freeze the frame');
        });

        await check(width + 'px · ' + playback + ' · insert, remove, reverse and finish', () => {
            click('restart');
            for (const event of ['Insert 5', 'Remove 3', 'Reverse the links', resultMessage]) {
                click('next');
                ensure(status().startsWith(event), 'Wrong step after Next: ' + status());
            }
            const count = green(canvas);
            ensure(count > 200, 'Final chain lacks green pixels');
            details.push({ width, playback, dpr: view.devicePixelRatio, greenPixels: count });
        });

        await check(width + 'px · ' + playback + ' · rewind, replay and Restart', () => {
            for (let i = 0; i < 3 && status() === resultMessage; i++) click('previous');
            ensure(status().startsWith('Reverse the links') && green(canvas) === 0, 'Previous retained the final result');
            click('next');
            ensure(status() === resultMessage && green(canvas) > 200, 'Next did not restore the result');
            click('restart');
            ensure(status() === initialMessage && green(canvas) === 0, 'Restart retained the final result');
        });
    }
    await check(width + 'px · history seek, invalid mode and page lifecycle', async () => {
        select(control('seek'), timing.stepDurationMs * 2.5, 'input');
        ensure(status().startsWith('Reverse the links'), 'Seek selected the wrong snapshot');
        select(control('seek'), timing.stepDurationMs * 4, 'input');
        ensure(green(canvas) > 200, 'Seek did not show final result');
        select(control('speed'), 2);
        select(mode, 'invalid-mode');
        ensure(mode.value === 'history' && status() === resultMessage && green(canvas) > 200, 'Invalid mode replaced the current player');
        ensure(doc.querySelector('#error').textContent.includes('Choose a playback mode'), 'Missing invalid mode feedback');

        view.dispatchEvent(new view.PageTransitionEvent('pagehide', { persisted: true }));
        ensure(!doc.querySelector('.algiviz-player') && canvas.parentElement.id === 'player', 'Pagehide left controls mounted');
        const bitmapWidth = canvas.width;
        canvas.style.width = '300px';
        await raf();
        await raf();
        ensure(canvas.width === bitmapWidth, 'Disposed viewport resized the canvas');
        canvas.style.width = '';
        view.dispatchEvent(new view.PageTransitionEvent('pageshow', { persisted: true }));
        await raf();
        ensure(status() === initialMessage && mode.value === 'history' && control('speed').value === '2', 'Restored page lost the mode, speed or first snapshot');
    });
    view.dispatchEvent(new view.PageTransitionEvent('pagehide'));
}

const passed = checks.filter(check => check.passed).length, failed = checks.length - passed;
document.querySelector('#status').textContent = 'Завершено ' + passed + '/' + checks.length + ', ошибок ' + failed;
await fetch('/report', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passed, failed, host: { userAgent: navigator.userAgent, devicePixelRatio }, checks, details }) });
