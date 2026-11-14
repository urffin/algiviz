import { Player } from '../dist/player/index.js';
import { createWorkerSourceFactory, WorkerSourceError } from '../dist/worker/index.js';

const $ = id => document.getElementById(id);
const host = $('host'), viewport = $('viewport');
const checks = [], unexpected = [], owned = new Set(), frameRequests = new Set();
const nativeRAF = requestAnimationFrame.bind(window), nativeCancel = cancelAnimationFrame.bind(window);
let maximumOwned = 0, ui, generations = [], frames = [], statuses = [], errors = [], settings = {}, nextValue = 0, keyboardVerified = false;
window.requestAnimationFrame = callback => { const id = nativeRAF(time => { frameRequests.delete(id); callback(time); }); frameRequests.add(id); return id; };
window.cancelAnimationFrame = id => { frameRequests.delete(id); nativeCancel(id); };
addEventListener('error', event => unexpected.push(String(event.message)));
addEventListener('unhandledrejection', event => unexpected.push(String(event.reason)));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(predicate, message = 'State timeout') {
    const start = performance.now();
    while (!predicate()) { if (performance.now() - start > 5000) throw new Error(message); await delay(5); }
}
const button = action => host.querySelector(`[data-action="${action}"]`);
const stage = () => host.querySelector('[data-role="viewport"]');
function update() {
    const pending = generations.findLast(g => !g.report && g.pending !== null);
    $('value').disabled = !pending;
    $('cleanup').disabled = !generations.some(g => !g.report && g.returning);
    $('diagnostics').textContent = JSON.stringify({ status: ui?.status, frame: ui?.frame && {
        generation: ui.frame.current.generation, index: ui.frame.current.index, stepIndex: ui.frame.stepIndex, progress: ui.frame.progress,
        bufferBytes: ui.frame.current.buffer.byteLength }, ownedWorkers: owned.size,
        generations: generations.map(g => ({ id: g.id, requests: g.requests, pending: g.pending, returning: g.returning, aborted: g.aborted,
            termination: g.report?.termination, cleanup: g.report?.cleanup.count })) }, null, 2);
}
function command(generation, type, data = {}) {
    generation.worker.postMessage({ channel: 'player-worker-fixture', type, read: generation.pending, ...data });
    if (['value', 'reject', 'eof'].includes(type)) generation.pending = null;
    if (type === 'cleanup') generation.returning = false;
    update();
}
function attach(options = {}) {
    settings = options; generations = []; frames = []; statuses = []; errors = []; nextValue = 0;
    const factory = createWorkerSourceFactory({
        worker() {
            const id = generations.length;
            const worker = new Worker(new URL('./player-worker-native.mjs', import.meta.url), { type: 'module' });
            const generation = { id, worker, requests: 0, pending: null, settled: 0, returning: false, aborted: false, report: null };
            generations.push(generation); owned.add(worker); maximumOwned = Math.max(maximumOwned, owned.size);
            const terminate = worker.terminate.bind(worker);
            worker.terminate = () => { owned.delete(worker); terminate(); };
            worker.addEventListener('error', event => unexpected.push(`Worker ${id}: ${event.message}`));
            worker.addEventListener('message', event => {
                const metric = event.data;
                if (metric?.channel !== 'player-worker-fixture' || metric.generation !== id) return;
                if (metric.event === 'request') { generation.requests = metric.read; generation.pending = metric.read; }
                if (metric.event === 'abort') { generation.aborted = true; generation.reason = metric.reason; }
                if (metric.event === 'return') generation.returning = true;
                if (metric.event === 'settled') generation.settled = metric.read;
                update();
            });
            return worker;
        },
        input: () => ({ generation: generations.length - 1, ...(settings.configure?.(generations.length - 1) ?? {}) }),
        shutdown: { gracePeriodMs: settings.grace ?? 1000 },
    });
    ui = new Player(host, {
        viewport, asyncSource(signal) {
            const index = generations.length, session = factory(signal);
            void session.closed.then(report => {
                const generation = generations[index]; generation.report = report; generation.pending = null; generation.returning = false; update();
            }).catch(error => unexpected.push(`Observer: ${error}`));
            return session;
        },
        render(frame) {
            frames.push({ generation: frame.current.generation, index: frame.current.index, progress: frame.progress, stepIndex: frame.stepIndex });
            $('drawing').textContent = `Worker ${frame.current.generation}, состояние ${frame.current.index}`;
            $('marker').style.transform = `translateX(${Math.max(0, frame.current.index) * 35}px)`;
        },
        onStatus(status) { statuses.push(status); update(); }, onError(error) { errors.push(error); update(); },
        rewindCapacity: 3, maxStepsPerFrame: 1, ...(options.timed ? { stepDurationMs: 120 } : {}),
        labels: { start: 'Начать', play: 'Играть', pause: 'Пауза', next: 'Вперёд', previous: 'Назад', restart: 'Сначала', replay: 'Повторить',
            waiting: 'Ожидание Worker', preparing: 'Подготовка Worker', cleanup: 'Ожидание очистки Worker' },
    });
    update();
}
async function drain() {
    if (!ui) return;
    const current = ui, list = generations;
    current.dispose();
    const start = performance.now();
    let closed = false; current.closed.then(() => { closed = true; });
    while (!closed) {
        for (const generation of list) if (!generation.report) command(generation, 'cleanup');
        if (performance.now() - start > 5000) throw new Error('Player cleanup timeout');
        await delay(10);
    }
    assert(owned.size === 0, 'Worker ownership leaked');
}
async function reset(options = {}) { await drain(); attach(options); }
async function read(generation, n) { await wait(() => generation.pending === n, `Worker ${generation.id} request ${n} missing`); }
async function value(generation, index) { const old = generation.requests; command(generation, 'value', { index }); await wait(() => generation.settled === old); assert(generation.requests === old, 'unexpected prefetch'); }
async function start(options = {}) { await reset(options); ui.start(); const generation = generations[0]; await read(generation, 1); await value(generation, 0); await wait(() => ui.status.started); return generation; }
function record(name, condition) {
    assert(condition, name); checks.push({ name, passed: true });
    const li = document.createElement('li'); li.textContent = `${name} ✓`; $('checks').append(li);
}
async function run() {
    $('run').disabled = true; keyboardVerified = false; checks.length = 0; $('checks').textContent = ''; $('report').textContent = '';
    try {
        await reset(); record('idle mount does not create a Worker', ui.status.phase === 'idle' && generations.length === 0);
        button('start').click(); ui.start(); ui.restart(); ui.next();
        record('Start exposes waiting/preparing and disables controls', ui.status.waiting && ui.status.preparing === 'start' && button('start').disabled && stage().getAttribute('aria-busy') === 'true' && generations.length === 1);
        const first = generations[0]; await read(first, 1); await value(first, 0); await wait(() => ui.status.started);
        record('first transferred frame is paused at index zero', ui.status.phase === 'paused' && ui.frame.stepIndex === 0 && ui.frame.current.buffer.byteLength === 8);
        button('next').click(); button('next').click(); await read(first, 2);
        record('manual Next coalesces and exposes Pause', first.requests === 2 && !button('play').hidden && button('play').getAttribute('aria-label') === 'Пауза');
        button('play').click(); const renders = frames.length; await value(first, 1); await wait(() => !ui.status.waiting);
        record('Pause stages a late Worker value without rendering/abort', ui.frame.current.index === 0 && frames.length === renders && !first.aborted);
        button('next').click(); record('Next consumes staged state without another pull', ui.frame.current.index === 1 && first.requests === 2);

        const timed = await start({ timed: true }); button('play').click(); await read(timed, 2); await delay(80);
        record('Play waiting schedules no RAF polling', ui.status.phase === 'playing' && ui.status.waiting && frameRequests.size === 0);
        await value(timed, 1); await wait(() => frames.some(f => f.index === 1));
        record('waiting time is discarded and transition starts at zero', frames.find(f => f.index === 1).progress === 0);
        ui.pause(); ui.next(); record('Next finishes an interpolation without requesting data', ui.frame.progress === 1 && timed.requests === 2);

        const old = await start(); ui.next(); await read(old, 2); const retained = ui.frame.current;
        ui.restart(); ui.restart(); const candidate = generations[1]; await read(candidate, 1);
        record('Restart prepares one Worker and preserves old frame/ownership', generations.length === 2 && ui.status.preparing === 'restart' && !old.aborted && ui.frame.current === retained);
        await value(candidate, 100); await wait(() => old.returning);
        record('candidate waits for old cleanup with no additional pull', ui.status.cleanupPending && ui.frame.current === retained && candidate.requests === 1 && owned.size === 2);
        command(old, 'cleanup'); await wait(() => ui.status.preparing === null);
        record('Restart installs candidate paused after acknowledged shutdown', ui.frame.current.generation === 1 && ui.status.phase === 'paused' && old.report.termination.kind === 'acknowledged' && owned.size === 1);

        ui.next(); await read(candidate, 2); ui.restart(); const failed = generations[2]; await read(failed, 1);
        command(failed, 'reject', { message: 'candidate rejected' }); await wait(() => failed.returning);
        await value(candidate, 1); record('candidate error quarantines old ready result', ui.frame.current.index === 100 && errors.length === 1 && !candidate.aborted);
        command(failed, 'cleanup'); await wait(() => ui.status.preparing === null); ui.next();
        record('failed candidate rollback preserves usable old Worker', ui.status.phase === 'paused' && ui.frame.current.generation === 1 && ui.frame.current.index === 1 && candidate.requests === 2 && owned.size === 1);

        const forced = await start({ grace: 100, configure: id => ({ ignoreCancellation: id === 0 }) });
        ui.next(); await read(forced, 2); ui.restart(); const replacement = generations[1]; await read(replacement, 1); await value(replacement, 50);
        await wait(() => ui.status.preparing === null);
        record('forced old shutdown permits Restart without cleanup error', forced.report.termination.kind === 'forced' && forced.report.cleanup.count === 0 && ui.frame.current.generation === 1 && errors.length === 0);

        const bad = await start({ configure: id => ({ cleanupError: id === 0 }) }); const readable = ui.frame.current;
        ui.restart(); const discarded = generations[1]; await read(discarded, 1); await value(discarded, 10);
        await wait(() => discarded.returning); command(discarded, 'cleanup'); await wait(() => !ui.status.preparing && !ui.status.cleanupPending);
        record('actual cleanup failure rejects replacement and preserves drawing', ui.status.phase === 'error' && errors.length === 1 && errors[0] instanceof WorkerSourceError && errors[0].code === 'cleanup' && ui.frame.current === readable && readable.buffer.byteLength === 8 && bad.report.cleanup.count === 1 && owned.size === 0);

        await reset(); ui.start(); const waiting = generations[0]; await read(waiting, 1); ui.dispose();
        const counts = [frames.length, statuses.length, errors.length];
        record('dispose while waiting removes UI and restores viewport immediately', viewport.parentNode === host && !host.querySelector('.algiviz-player') && ui.status.phase === 'disposed' && ui.status.cleanupPending);
        await wait(() => waiting.returning); command(waiting, 'cleanup'); const closed = await ui.closed; await delay(20);
        record('closed waits Worker cleanup with no late UI callbacks', closed.sources.length === 1 && owned.size === 0 && JSON.stringify([frames.length, statuses.length, errors.length]) === JSON.stringify(counts));

        const current = await start(); ui.next(); await read(current, 2); ui.restart(); const preparing = generations[1]; await read(preparing, 1);
        const beforeDispose = ui.frame.current; ui.dispose(); const afterDispose = [frames.length, statuses.length, errors.length];
        await wait(() => generations.every(g => g.returning));
        for (const generation of generations) command(generation, 'cleanup');
        const both = await ui.closed; await delay(20);
        record('dispose during Restart closes both Workers without installing candidate', both.sources.length === 2 && owned.size === 0 && ui.frame.current === beforeDispose && JSON.stringify(afterDispose) === JSON.stringify([frames.length, statuses.length, errors.length]));

        const eof = await start({ timed: true }); ui.next(); ui.pause(); await read(eof, 2); command(eof, 'eof'); await wait(() => !ui.status.waiting);
        record('paused EOF stays staged and releases Worker once', ui.status.phase === 'paused' && eof.report.termination.kind === 'acknowledged' && owned.size === 0);
        ui.next(); record('Next commits staged EOF', ui.status.phase === 'finished');
        button('play').click(); const replay = generations[1]; await read(replay, 1);
        assert(button('play').getAttribute('aria-label') === 'Пауза', 'Replay cannot be paused'); button('play').click();
        await value(replay, 0); await wait(() => ui.status.preparing === null);
        record('Pause cancels Replay autoplay during Worker preparation', ui.status.phase === 'paused' && replay.requests === 1 && frameRequests.size === 0);

        record('no unexpected errors and at most two owned Workers', unexpected.length === 0 && maximumOwned <= 2);
        await reset(); $('status').textContent = `${checks.length} автопроверок прошли. Клавиатура: Начать → выдать → Вперёд → Пауза → выдать → Вперёд.`;
    } catch (error) {
        const li = document.createElement('li'); li.className = 'failed'; li.textContent = `FAIL: ${error.stack ?? error}`; $('checks').append(li);
        checks.push({ name: 'automatic checks', passed: false, error: String(error.stack ?? error) }); $('status').textContent = `Ошибка: ${error.message}`;
        await drain();
    } finally { $('run').disabled = false; update(); }
}
$('run').onclick = run;
$('manual').onclick = () => reset(); $('timed').onclick = () => reset({ timed: true });
$('value').onclick = () => { const generation = generations.findLast(g => !g.report && g.pending !== null); if (generation) command(generation, 'value', { index: nextValue++ }); };
$('cleanup').onclick = () => { for (const generation of generations) if (generation.returning && !generation.report) command(generation, 'cleanup'); };
$('dispose').onclick = () => { ui.dispose(); update(); };
$('keyboard').onclick = () => {
    try {
        record('native keyboard Start/Next/Pause consumes only the staged state', ui.frame?.current.index === 1 && ui.status.phase === 'paused' && !ui.status.waiting && generations.length === 1 && generations[0].requests === 2 && !generations[0].aborted);
        keyboardVerified = true; $('status').textContent = 'Клавиатура проверена. Удалите плеер, разрешите очистку и сохраните итог.';
    } catch (error) { $('status').textContent = error.message; }
};
$('save').onclick = async () => {
    try {
        assert(keyboardVerified && ui.status.phase === 'disposed' && !ui.status.cleanupPending && owned.size === 0, 'Сначала завершите проверку клавиатуры и очистку');
        const playerClose = await ui.closed;
        record('final dispose releases all Workers and restores viewport', viewport.parentNode === host && !host.querySelector('.algiviz-player') && playerClose.sources.length === 1 && playerClose.errorCount === 0 && unexpected.length === 0 && frameRequests.size === 0);
        const provenance = await fetch('/__player_worker_provenance').then(response => response.json());
        const report = { date: new Date().toISOString(), environment: { userAgent: navigator.userAgent, dpr: devicePixelRatio }, checks,
            unexpected, remainingOwnedWorkers: owned.size, maximumOwnedWorkers: maximumOwned, remainingRAF: frameRequests.size,
            keyboard: { stepIndex: ui.frame.stepIndex, index: ui.frame.current.index, requests: generations[0].requests }, provenance };
        const response = await fetch('/__player_worker_report', { method: 'POST', body: JSON.stringify(report) });
        if (!response.ok) throw new Error(await response.text());
        $('report').textContent = JSON.stringify(report, null, 2); $('status').textContent = `${checks.length}/${checks.length} проверок пройдено; отчёт сохранён; Worker и RAF: 0.`;
    } catch (error) { $('status').textContent = `Ошибка сохранения: ${error.message}`; }
};
attach();
