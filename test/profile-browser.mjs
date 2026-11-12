import { profileWorkloads, profileWorkload, profileSize, profilePolicy } from './profile-workloads.mjs';
const $ = id => document.getElementById(id), canvas = document.querySelector('canvas'), context = canvas.getContext('2d');
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
$('run').onclick = async () => {
    $('run').disabled = true; delete document.body.dataset.result; $('rows').replaceChildren();
    const report = { environment: { userAgent: navigator.userAgent, dpr: devicePixelRatio, hardwareConcurrency: navigator.hardwareConcurrency,
        visibility: document.visibilityState, canvas: profileSize, backend: 'native Canvas 2D; CPU submission only', date: new Date().toISOString() }, policy: profilePolicy, workloads: [] };
    try {
        for (const workload of profileWorkloads) {
            const row = await profileWorkload(workload, { context, pause, replay: true, progress: phase => { $('status').textContent = workload.name + ' · ' + phase; } });
            report.workloads.push(row);
            const tr = document.createElement('tr');
            for (const value of [row.name, row.objects.join('–'), ...['generationPrefixPerStep','projectionUncached','projectionCachedPair','matching','matchingAndDispatch','renderPlaybackPattern','canvasCommandReplay'].map(key => row.phases[key].medianMs.toFixed(4))]) {
                const td = document.createElement('td'); td.textContent = value; tr.append(td);
            }
            $('rows').append(tr); $('report').textContent = JSON.stringify(report, null, 2); await pause();
        }
        $('status').textContent = 'Завершено: 10 сценариев. Во всех сценариях Canvas replay совпал по пикселям.';
        document.body.dataset.result = 'pass';
    } catch (error) {
        report.error = error.message; $('status').textContent = 'Ошибка: ' + error.message; document.body.dataset.result = 'fail';
    } finally { $('report').textContent = JSON.stringify(report, null, 2); $('run').disabled = false; }
};
