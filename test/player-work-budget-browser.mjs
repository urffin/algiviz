import { Player } from '@grundyjs/algiviz/player';
const $ = id => document.getElementById(id);
const provenance = await (await fetch('/__provenance')).json();
const counts = { factories: 0, requests: 0, yielded: 0, eof: 0, closed: 0, renders: 0, maxWork: 0, maxSourceRequests: 0 };
const events = [], violations = [];
let ui, finite = false, lastRequests = 0, lastEof = 0, lastIndex = 0, lastPhase = 'idle';
function report(status = ui?.status) {
    const result = { provenance, environment: { userAgent: navigator.userAgent, dpr: devicePixelRatio,
        visibility: document.visibilityState, date: new Date().toISOString() },
        configuration: { maxStepsPerFrame: 2, rewindCapacity: 8, stepDurationMs: 1, speed: status?.speed, finite },
        counts, violations, events, status };
    $('report').textContent = JSON.stringify(result, null, 2); return result;
}
function attach() {
    lastIndex = 0; lastRequests = counts.requests; lastEof = counts.eof; lastPhase = 'idle';
    ui = new Player($('host'), { viewport: $('viewport'), autoHide: false, stepDurationMs: 1,
        finalHoldMs: 50, rewindCapacity: 8, maxStepsPerFrame: 2,
        labels: { start: 'Начать', play: 'Воспроизвести', pause: 'Пауза', previous: 'Назад', next: 'Вперёд',
            restart: 'Сначала', replay: 'Повторить', step: 'Состояние', stream: 'ПОТОК' },
        source() {
            counts.factories++; const limit = finite ? 6 : Infinity;
            const source = (function* () {
                try { for (let i = 0; i < limit; i++) { counts.yielded++; yield Object.freeze({ i }); } }
                finally { counts.closed++; }
            })();
            return { [Symbol.iterator]() { return {
                next() { counts.requests++; const result = source.next(); if (result.done) counts.eof++; return result; },
                return() { return source.return(); }
            }; } };
        },
        render(frame) {
            counts.renders++;
            if (ui?.status.phase === 'playing' || lastPhase === 'playing') {
                const work = Math.max(0, frame.stepIndex - lastIndex) + counts.eof - lastEof;
                const requests = counts.requests - lastRequests;
                counts.maxWork = Math.max(counts.maxWork, work);
                counts.maxSourceRequests = Math.max(counts.maxSourceRequests, requests);
                if (work > 2 || requests > 2) violations.push({ work, requests, step: frame.stepIndex });
            }
            lastIndex = frame.stepIndex; lastRequests = counts.requests; lastEof = counts.eof;
            $('viewport').textContent = `Состояние ${frame.current.i} · progress ${frame.progress.toFixed(3)}`;
        },
        onStatus(status) {
            lastPhase = status.phase;
            events.push({ phase: status.phase, index: status.stepIndex, requests: counts.requests,
                range: [status.rewindStartIndex, status.rewindEndIndex] });
            if (events.length > 32) events.shift();
            $('metrics').textContent = `Макс. шагов/RAF: ${counts.maxWork} · запросов источника/RAF: ${counts.maxSourceRequests} · запросов всего: ${counts.requests} · закрыто: ${counts.closed} · ${status.phase}`;
            for (const id of ['finite', 'long', 'dispose']) $(id).disabled = status.phase === 'disposed';
            $('remount').disabled = status.phase !== 'disposed'; report(status);
        }
    });
    ui.setSpeed(16);
}
$('finite').onclick = () => { finite = true; ui.restart(); };
$('long').onclick = () => { finite = false; ui.restart(); };
$('dispose').onclick = () => ui.dispose();
$('remount').onclick = attach;
$('save').onclick = async () => {
    const response = await fetch('/__report', { method: 'POST', body: JSON.stringify(report()) });
    if (!response.ok) throw Error('Cannot save report');
    $('saved').textContent = violations.length ? 'Есть превышения лимита' : 'Отчёт сохранён: превышений лимита нет';
};
attach();
