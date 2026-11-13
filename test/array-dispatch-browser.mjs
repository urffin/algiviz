import { createArrayRenderer } from '@grundyjs/algiviz/canvas';
import { createArrayRenderer as before } from '/__baseline.mjs';
import { arrayDispatchChecks, arrayDispatchWorkloads, compareArraySpeed } from './array-dispatch-workloads.mjs';
import { prepareProfile, profilePolicy, profileSize } from './profile-workloads.mjs';

const $ = id => document.getElementById(id), pause = () => new Promise(resolve => setTimeout(resolve, 0));
function checkPixels() {
    const contexts = ['before', 'after'].map(id => $(id).getContext('2d'));
    const checks = [...arrayDispatchChecks(), ...arrayDispatchWorkloads.flatMap(w => prepareProfile(w).frames
        .filter((_, i) => i % 4 === 0 || i % 8 === 7).map(frame => ({ frame, width: 960, height: 540 })))];
    let matched = 0;
    for (const options of [{ theme: 'dark' }, { theme: 'light' }, { theme: 'dark', colors: {
        background: '#123456', bar: '#345678', text: '#abcdef', active: '#aabbcc', held: '#112233', sorted: '#778899' } }]) {
        const renderers = [before(options), createArrayRenderer(options)];
        for (const { frame, width, height } of checks) {
            contexts.forEach((ctx, i) => {
                ctx.canvas.width = width; ctx.canvas.height = height;
                ctx.translate(17, 9); ctx.globalAlpha = 0.4; ctx.filter = 'opacity(50%)';
                ctx.shadowBlur = 4; ctx.shadowColor = 'red';
                renderers[i].render(ctx, frame);
                if (ctx.globalAlpha !== 0.4 || ctx.filter !== 'opacity(50%)' || ctx.getTransform().e !== 17 || ctx.shadowBlur !== 4)
                    throw Error('Caller Canvas state changed');
            });
            const a = contexts[0].getImageData(0, 0, width, height).data;
            const b = contexts[1].getImageData(0, 0, width, height).data;
            if (!a.every((v, i) => v === b[i])) throw Error('Pixel mismatch: frame ' + matched);
            matched++;
        }
    }
    return { matched, themes: ['dark', 'light', 'custom'], callerStateRestored: true };
}
$('run').onclick = async () => {
    $('run').disabled = true; delete document.body.dataset.result;
    const report = { provenance: await (await fetch('/__provenance')).json(), policy: profilePolicy,
        environment: { date: new Date().toISOString(), userAgent: navigator.userAgent, dpr: devicePixelRatio,
            visibility: document.visibilityState, canvas: profileSize, backend: 'native Canvas 2D; CPU submission, not FPS/GPU' } };
    try {
        $('status').textContent = 'Сравнение пикселей'; await pause();
        report.correctness = checkPixels();
        const ctx = $('after').getContext('2d'); ctx.canvas.width = profileSize.width; ctx.canvas.height = profileSize.height;
        report.speed = await compareArraySpeed(before, createArrayRenderer, ctx, {
            pause, progress: text => { $('status').textContent = text; } });
        $('summary').textContent = JSON.stringify(report.speed.map(row => ({ name: row.name, cases:
            Object.fromEntries(Object.entries(row.cases).map(([name, rounds]) => [name, rounds.map(r =>
                ({ before: +r.before.medianMs.toFixed(4), after: +r.after.medianMs.toFixed(4) }))])) })), null, 2);
        $('status').textContent = 'Готово: ' + report.correctness.matched + ' кадров совпали по пикселям; 4 сценария измерены.';
        const saved = await fetch('/__report', { method: 'POST', body: JSON.stringify(report) });
        if (!saved.ok) throw Error('Cannot save report: ' + saved.status);
        document.body.dataset.result = 'pass';
    } catch (error) {
        report.error = error.stack; $('status').textContent = 'Ошибка: ' + error.message; document.body.dataset.result = 'fail';
    } finally { $('report').textContent = JSON.stringify(report, null, 2); $('run').disabled = false; }
};
