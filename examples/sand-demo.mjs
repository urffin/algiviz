import { createDemoPlayer } from './demo-player.mjs';
import { createSandSource, paintSand, sandBrush, analyzeSand, gateCells, sandWorld, sandLimits, sandTiming, EMPTY, WALL } from './sand-algorithm.mjs';
import { createSandRenderer, sandGeometry } from './sand-scene.mjs';

const $ = id => document.getElementById(id);
const canvas = $('sand'), ctx = canvas.getContext('2d'), renderer = createSandRenderer();
let lastState, selected = null, stroke = null, strokeCell = null;
const ruleText = { fall: 'Падение: снизу свободно.', slide: 'Скатывание: выбран свободный диагональный ход.', rest: 'Покой: свободного хода нет.' };
let logicalWidth = 1, logicalHeight = 1;
const logicalContext = new Proxy(ctx, {
    get(target, key) { if (key === 'canvas') return { width: logicalWidth, height: logicalHeight };
        const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value; },
    set: (target, key, value) => Reflect.set(target, key, value, target)
});
const playback = createDemoPlayer({
    timing: sandTiming, isTerminal: step => step.event.kind === 'finished',
    onError: error => { $('error').textContent = error.message; },
    render(frame, { running, finished, mode }) {
        lastState = frame.current;
        const state = stroke ?? lastState;
        if (selected !== null && !state.cells.includes(selected)) selected = null;
        const analysis = selected === null ? null : analyzeSand(state, selected);
        logicalWidth = Math.max(1, canvas.clientWidth); logicalHeight = logicalWidth * sandWorld.rows / sandWorld.columns;
        canvas.style.height = `${logicalHeight + canvas.clientTop * 2}px`;
        const dpr = Math.min(devicePixelRatio || 1, 2), width = Math.round(logicalWidth * dpr), height = Math.round(logicalHeight * dpr);
        if (canvas.width !== width) canvas.width = width; if (canvas.height !== height) canvas.height = height;
        ctx.setTransform(width / logicalWidth, 0, 0, height / logicalHeight, 0, 0);
        renderer.render(logicalContext, stroke ? { ...frame, previous: state, current: state, progress: 1 } : frame,
            { analysis, exact: $('tool').value !== 'inspect' });
        $('play').textContent = running ? 'Пауза' : finished ? 'Повторить' : 'Запустить';
        $('status').setAttribute('aria-live', running ? 'off' : 'polite');
        $('status').textContent = `Такт ${state.tick} / ${state.config.ticks} · песчинок ${state.config.count} · переместилось ${state.moved}${finished ? ' · запись завершена' : ''}`;
        $('mode-note').textContent = mode === 'history' ? 'История хранит все снимки: доступны перемотка и шаг назад.' : 'Генератор хранит соседние снимки: шаги только вперёд, «Сначала» создаёт новый генератор.';
        $('count').max = sandLimits[mode];
        $('limit').textContent = `Лимиты примера: ${sandLimits.history} песчинок с историей, ${sandLimits.generator} в генераторе; до ${sandLimits.ticks} тактов.`;
        $('applied').textContent = `Применено: seed ${state.config.seed}, поле ${sandWorld.columns} × ${sandWorld.rows}.`;
        $('open-gate').disabled = state.config.preset !== 'funnel' || !gateCells.some(index => state.cells[index] === WALL);
        $('clear-selection').disabled = selected === null;
        $('grain-number').max = Math.max(1, state.nextId);
        $('neighbors').replaceChildren();
        if (!analysis) {
            $('inspection-title').textContent = 'Одна песчинка — один такт';
            $('decision').textContent = 'Нажмите на песчинку или укажите её номер.';
        } else {
            $('inspection-title').textContent = `Песчинка №${selected + 1} · такт ${state.tick}`;
            for (const neighbor of analysis.neighbors) {
                const box = document.createElement('div');
                box.className = `neighbor ${neighbor.value === WALL ? 'solid' : neighbor.value >= 0 ? 'grain' : ''}${neighbor.dx === 0 && neighbor.dy === 0 ? ' center' : ''}${neighbor.index === analysis.proposed && analysis.proposed !== analysis.from ? ' chosen' : ''}`;
                box.textContent = neighbor.value === WALL ? 'стенка' : neighbor.value === EMPTY ? 'пусто' : `№${neighbor.value + 1}`;
                box.title = `Смещение (${neighbor.dx}, ${neighbor.dy}): ${box.textContent}`;
                $('neighbors').append(box);
            }
            $('decision').textContent = analysis.proposed !== analysis.from && !analysis.moved
                ? `Клетку выбрали несколько песчинок. В этом такте проходит №${analysis.winnerId + 1}, выбранная песчинка ждёт.`
                : ruleText[analysis.rule];
        }
        $('inspection-note').textContent = finished ? 'Запись завершена. Разбор предсказывает ещё один такт за её пределами.' : 'Разбор показывает точный снимок поля и прогноз следующего такта.';
    }
});
$('mode').options[0].textContent = 'История · перемотка'; $('mode').options[1].textContent = 'Генератор · вперёд';
function commit(state) {
    const source = createSandSource({ ...state.config, cells: state.cells, nextId: state.nextId }, playback.mode);
    playback.load(source); $('edit-note').textContent = 'Сцена изменена. История начата заново из этого положения.'; $('error').textContent = '';
}
$('input-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
        const input = { preset: $('preset').value, count: Number($('count').value), ticks: Number($('ticks').value),
            seed: /^\d+$/.test($('seed').value.trim()) ? Number($('seed').value) : NaN };
        const source = createSandSource(input, playback.mode); selected = null; $('grain-number').value = '1'; playback.load(source);
        $('edit-note').textContent = 'Новая сцена готова. Запустите песок или нарисуйте препятствия.';
    } catch (error) { $('error').textContent = error.message; }
});
$('tool').addEventListener('change', () => playback.pause());
$('select-grain').addEventListener('click', () => {
    playback.pause(); const id = Number($('grain-number').value) - 1;
    if (!Number.isInteger(id) || id < 0 || !lastState.cells.includes(id)) { $('error').textContent = 'Этой песчинки нет в текущем кадре.'; return; }
    selected = id; $('error').textContent = ''; playback.draw();
});
$('clear-selection').addEventListener('click', () => { selected = null; playback.pause(); });
$('open-gate').addEventListener('click', () => { playback.pause(); try { commit(paintSand(lastState, gateCells, 'erase')); } catch (error) { $('error').textContent = error.message; } });
function cellAt(event) {
    const rect = canvas.getBoundingClientRect(), geometry = sandGeometry(logicalWidth, logicalHeight);
    const px = (event.clientX - rect.left - canvas.clientLeft) * logicalWidth / canvas.clientWidth;
    const py = (event.clientY - rect.top - canvas.clientTop) * logicalHeight / canvas.clientHeight;
    const x = Math.floor((px - geometry.x) / geometry.size), y = Math.floor((py - geometry.y) / geometry.size);
    return x < 0 || y < 0 || x >= sandWorld.columns || y >= sandWorld.rows ? null : y * sandWorld.columns + x;
}
function paint(event) {
    const index = cellAt(event); if (index === null) return;
    const indices = sandBrush(strokeCell ?? index, index, Number($('brush').value)); strokeCell = index;
    try { stroke = paintSand(stroke, indices, $('tool').value); playback.draw(); }
    catch (error) { stroke = null; $('error').textContent = error.message; playback.draw(); }
}
canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    playback.pause();
    if ($('tool').value === 'inspect') {
        const index = cellAt(event); if (index !== null && lastState.cells[index] >= 0) {
            selected = lastState.cells[index]; $('grain-number').value = selected + 1; $('error').textContent = ''; playback.draw();
        }
    } else { canvas.setPointerCapture(event.pointerId); stroke = lastState; strokeCell = null; selected = null; paint(event); }
});
canvas.addEventListener('pointermove', event => { if (stroke) paint(event); });
canvas.addEventListener('pointerup', () => {
    if (!stroke) return; const edited = stroke; stroke = null;
    try { commit(edited); } catch (error) { $('error').textContent = error.message; playback.draw(); }
});
canvas.addEventListener('pointercancel', () => { stroke = null; playback.draw(); });
new ResizeObserver(() => playback.draw()).observe(canvas);
playback.load(createSandSource());
