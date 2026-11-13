import { Player } from '@grundyjs/algiviz/player';
const $ = id => document.getElementById(id), host = $('host'), viewport = $('viewport');
const provenance = await (await fetch('/__provenance')).json();
const checks = [], unexpected = [], errors = [], generations = [];
let ui, lastState, renders = 0, notifications = 0, closedReport = null, timed = false;
const button = action => host.querySelector(`[data-action=${action}]`);
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
function report(status = ui?.status ?? lastState) {
    const data = { provenance, environment: { userAgent: navigator.userAgent, dpr: devicePixelRatio, date: new Date().toISOString() },
        checks, unexpected, errors, status, frame: ui?.frame, renders, notifications, closedReport,
        generations: generations.map(gen => ({ id: gen.id, requests: gen.reads.length, pending: gen.reads.filter(read => !read.settled).length,
            aborted: gen.signal.aborted, returns: gen.returns })) };
    $('diagnostics').textContent = JSON.stringify(data, null, 2); return data;
}
addEventListener('error', event => { unexpected.push(event.message); report(); });
addEventListener('unhandledrejection', event => { unexpected.push(String(event.reason)); report(); });
function check(name, condition) {
    checks.push({ name, passed: !!condition }); report();
    if (!condition) throw new Error(name);
}
function attach(withTiming = false) {
    timed = withTiming; closedReport = null; ui = undefined;
    ui = new Player(host, { viewport, autoHide: false, stepDurationMs: timed ? 300 : undefined,
        rewindCapacity: 3, maxStepsPerFrame: 2,
        labels: { start: 'Начать', next: 'Вперёд', previous: 'Назад', pause: 'Пауза', play: 'Играть', restart: 'Сначала', replay: 'Повторить',
            waiting: 'Запрос состояния', preparing: 'Подготовка воспроизведения', cleanup: 'Ожидание очистки источника' },
        asyncSource(signal) {
            const gen = { id: generations.length, signal, reads: [], returns: 0, values: 0 }; generations.push(gen);
            return { [Symbol.asyncIterator]() { return {
                next() { return new Promise((resolve, reject) => {
                    const read = { settled: false,
                        resolve(value) { read.settled = true; resolve(value); },
                        reject(error) { read.settled = true; reject(error); } };
                    gen.reads.push(read);
                }); },
                return() { gen.returns++; return Promise.resolve({ done: true }); },
            }; } };
        },
        render(frame) {
            renders++;
            $('drawn').textContent = `Состояние ${frame.current.n} · progress ${frame.progress.toFixed(3)}`;
            const x = frame.previous.n + (frame.current.n - frame.previous.n) * frame.progress;
            $('marker').style.transform = `translateX(${20 + x % 12 * 30}px)`;
        },
        onStatus(status) { lastState = status; notifications++; report(status); },
        onError(error) { errors.push(String(error)); report(); },
    });
    ui.closed.then(result => { closedReport = result; report(); });
    report();
}
function latestPending() {
    const gen = generations.findLast(gen => gen.reads.some(read => !read.settled));
    return gen && { gen, read: gen.reads.find(read => !read.settled) };
}
async function reset(withTiming) {
    if (ui) {
        ui.dispose();
        for (const gen of generations) for (const read of gen.reads) if (!read.settled) read.resolve({ done: true });
        await ui.closed;
    }
    attach(withTiming);
}
$('value').onclick = async () => { const pending = latestPending(); if (pending) pending.read.resolve({ value: { n: pending.gen.values++ } }); await flush(); report(); };
$('eof').onclick = async () => { latestPending()?.read.resolve({ done: true }); await flush(); report(); };
$('reject').onclick = async () => { latestPending()?.read.reject(new Error('Controlled source error')); await flush(); report(); };
$('dispose').onclick = () => { ui.dispose(); report(); };
$('manual').onclick = () => reset(false);
$('timed').onclick = () => reset(true);
$('keyboard').onclick = () => {
    check('native keyboard: staged Next after Pause', ui.frame?.current.n === 1 && ui.status.phase === 'paused' && !ui.status.waiting && generations.at(-1).reads.length === 2);
    $('result').textContent = 'Клавиатура: проверка зафиксирована';
};
$('save').onclick = async () => {
    const response = await fetch('/__report', { method: 'POST', body: JSON.stringify(report()) });
    $('result').textContent = response.ok ? 'Отчёт сохранён' : await response.text();
};
$('run').onclick = async () => {
    $('run').disabled = true;
    try {
        await reset(false);
        const first = generations.length;
        check('idle does not acquire a source', ui.status.phase === 'idle' && !ui.status.started);
        button('start').click();
        const old = generations[first];
        check('Start: disabled, preparing, busy stage', ui.status.preparing === 'start' && button('start').disabled && host.querySelector('[data-role=viewport]').getAttribute('aria-busy') === 'true');
        old.reads[0].resolve({ value: { n: 0 } }); await flush();
        check('first frame paused', ui.frame.current.n === 0 && ui.status.phase === 'paused');
        button('next').click(); button('next').click();
        check('manual Next coalesces and exposes Pause', old.reads.length === 2 && !button('play').hidden && button('play').getAttribute('aria-label') === 'Пауза');
        button('play').click(); const before = renders;
        old.reads[1].resolve({ value: { n: 1 } }); await flush();
        check('Pause stages arrival without a render or abort', ui.frame.current.n === 0 && renders === before && !old.signal.aborted && !ui.status.waiting);
        button('next').click();
        check('Next consumes staged state', ui.frame.current.n === 1 && old.reads.length === 2);
        button('next').click(); button('restart').click();
        const candidate = generations.at(-1);
        candidate.reads[0].resolve({ value: { n: 100 } }); await flush();
        check('Restart waits for old cleanup', ui.frame.current.n === 1 && ui.status.preparing === 'restart' && ui.status.cleanupPending && old.signal.aborted && old.returns === 0);
        old.reads[2].reject(new Error('late cancelled read')); await flush();
        check('Restart installs candidate paused after cleanup', ui.frame.current.n === 100 && ui.status.phase === 'paused' && !ui.status.preparing && old.returns === 1);
        button('restart').click(); generations.at(-1).reads[0].reject(new Error('candidate rejected')); await flush();
        check('failed candidate preserves old session', ui.frame.current.n === 100 && ui.status.phase === 'paused' && ui.status.hasError && ui.status.canNext);
        button('next').click();
        const outstanding = candidate.reads.at(-1); ui.dispose(); const afterDispose = notifications, afterFrames = renders;
        check('dispose restores viewport before source closure', viewport.parentNode === host && !host.querySelector('.algiviz-player') && ui.status.cleanupPending);
        outstanding.reject(new Error('late after disposal')); await ui.closed; await flush();
        check('closed observes late error without UI callbacks', notifications === afterDispose && renders === afterFrames && closedReport.sources.length === 1 && closedReport.sources[0].lateReadError !== null);
        check('no unexpected browser errors', unexpected.length === 0);
        await reset(false);
        $('result').textContent = 'Автопроверки пройдены. Для клавиатуры: Начать → выдать → Вперёд → Пауза → выдать → Вперёд.';
    } catch (error) { $('result').textContent = `FAIL: ${error.message}`; report(); }
    finally { $('run').disabled = false; }
};
attach();
