import { createSceneRenderer } from '@grundyjs/algiviz/scene';

const $ = id => document.getElementById(id);
const labels = { start: 'Начать', play: 'Воспроизвести', pause: 'Пауза', next: 'Следующее состояние', previous: 'Предыдущее состояние', replay: 'Повторить',
    restart: 'Сначала', speed: 'Скорость', group: 'Плеер визуализации', controls: 'Управление воспроизведением',
    idle: 'Нажмите «Начать»: будет прочитан первый снимок.', paused: 'Пауза', playing: 'Воспроизведение',
    finished: 'Завершено', disposed: 'Управление удалено', step: 'Состояние', error: 'Ошибка', ready: 'Готово',
    seek: 'Положение воспроизведения', time: 'Время воспроизведения', stream: 'ПОТОК', streamHint: 'Генератор · без перемотки' };
const nodes = [{ id: 'A', x: 90, y: 90 }, { id: 'B', x: 285, y: 40 },
    { id: 'C', x: 285, y: 140 }, { id: 'D', x: 510, y: 90 }];
const svg = $('graph'), elements = new Map(), ns = 'http://www.w3.org/2000/svg';
for (const [from, to] of [[0, 1], [0, 2], [1, 3], [2, 3]]) {
    const edge = document.createElementNS(ns, 'line');
    for (const [key, value] of Object.entries({ x1: nodes[from].x, y1: nodes[from].y, x2: nodes[to].x, y2: nodes[to].y, stroke: '#64748b', 'stroke-width': 3 }))
        edge.setAttribute(key, value);
    svg.append(edge);
}
for (const node of nodes) {
    const circle = document.createElementNS(ns, 'circle');
    for (const [key, value] of Object.entries({ cx: node.x, cy: node.y, r: 24, fill: '#26374f', stroke: '#91bfff', 'stroke-width': 2 })) circle.setAttribute(key, value);
    circle.dataset.node = node.id;
    const text = document.createElementNS(ns, 'text');
    for (const [key, value] of Object.entries({ x: node.x, y: node.y + 6, fill: '#edf4ff', 'text-anchor': 'middle', 'font-size': 18 })) text.setAttribute(key, value);
    text.textContent = node.id; svg.append(circle, text); elements.set(node.id, circle);
}
const graphRenderer = createSceneRenderer({ node(target, { current }) {
    target.get(current.id).setAttribute('fill', current.data.active ? '#9c82e9' : current.data.visited ? '#267b68' : '#26374f');
} });
const ctx = $('dot').getContext('2d');
const definitions = {
    dot: {
        recorded: true, stepDurationMs: 1000,
        values: () => [40, 200, 360, 560].map(x => Object.freeze({ x })),
        draw(frame) {
            ctx.clearRect(0, 0, 600, 180);
            ctx.fillStyle = '#b39bff'; ctx.beginPath();
            const x = frame.previous.x + (frame.current.x - frame.previous.x) * frame.progress;
            ctx.arc(x, 90, 18, 0, Math.PI * 2); ctx.fill();
        },
    },
    graph: {
        stepDurationMs: 1000,
        values: () => Array.from({ length: 5 }, (_, tick) => Object.freeze({ objects: Object.freeze(nodes.map((node, i) =>
            Object.freeze({ id: node.id, type: 'node', data: Object.freeze({ visited: i < tick, active: i === tick - 1 }) }))) })),
        draw: frame => graphRenderer.render(elements, frame),
    },
};
let mount;
const examples = Object.fromEntries(Object.entries(definitions).map(([id, definition]) => {
    const stats = { sources: 0, yielded: 0, closed: 0 };
    let ui;
    function metrics(state = ui?.status) {
        const counts = definition.recorded ? `Записей: ${stats.sources} · снимков: ${stats.yielded}`
            : `Источников: ${stats.sources} · yield: ${stats.yielded} · закрыто: ${stats.closed}`;
        $(`${id}-metrics`).textContent = `${counts}\nКадр: ${state?.stepIndex ?? '—'} · ${state?.phase ?? 'не подключён'}`;
    }
    function source() {
        stats.sources++;
        return (function* () {
            try { for (const value of definition.values()) { stats.yielded++; yield value; } }
            finally { stats.closed++; }
        })();
    }
    function attach() {
        const input = definition.recorded ? { history() {
            stats.sources++; const states = definition.values(); stats.yielded += states.length; return states;
        } } : { source };
        ui = mount($(`${id}-player`), { viewport: $(id), ...input, render: definition.draw, stepDurationMs: definition.stepDurationMs, labels, onStatus: metrics });
        $(`${id}-dispose`).disabled = false; $(`${id}-remount`).disabled = true;
    }
    $(`${id}-dispose`).onclick = () => {
        ui.dispose(); metrics(); $(`${id}-dispose`).disabled = true; $(`${id}-remount`).disabled = false;
    };
    $(`${id}-remount`).onclick = attach;
    metrics(); return [id, { attach }];
}));
$('load').onclick = async () => {
    $('load').disabled = true;
    try {
        ({ mountPlayer: mount } = await import('./optional-player.mjs'));
        for (const example of Object.values(examples)) example.attach();
        $('loading-status').textContent = 'Модуль подключён. Источники начнут читаться по кнопкам «Начать».';
    } catch (error) { $('loading-status').textContent = error.message; $('load').disabled = false; }
};
// pagehide disposes each widget; BFcache restoration remounts idle controls.
window.addEventListener('pageshow', event => { if (event.persisted && mount) for (const example of Object.values(examples)) example.attach(); });
