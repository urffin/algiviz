import { createGraphRenderer } from '@grundyjs/algiviz/canvas/graph';
import { createCanvasViewport } from '@grundyjs/algiviz/canvas/viewport';
import { Player } from '@grundyjs/algiviz/player';
import { dijkstraSteps, distanceLabel } from './dijkstra.mjs';
import { timing } from './player-settings.mjs';

const host = document.querySelector('#player');
const panes = host.querySelector('.panes');
const canvas = document.querySelector('#graph');
const distanceRows = document.querySelector('#distances');
const queueItems = document.querySelector('#queue');
const emptyQueue = document.querySelector('#empty-queue');
const status = document.querySelector('#status');
const renderer = createGraphRenderer({
    theme: 'dark', roleColors: {
        active: '#fbbf24', improved: '#fbbf24', settled: '#34d399',
        predecessor: '#60a5fa', unchanged: '#fb7185',
    },
});
let player, viewport, rendered;

function distanceRow({ vertex, distance, predecessor, settled }, focus) {
    const row = document.createElement('tr');
    const name = document.createElement('th');
    name.scope = 'row';
    name.textContent = vertex;
    row.append(name);
    for (const value of [distanceLabel(distance), predecessor ?? '—', settled ? 'Final' : 'Tentative']) {
        const cell = row.insertCell();
        cell.textContent = value;
    }
    row.classList.toggle('focused', focus === vertex);
    row.classList.toggle('settled', settled);
    return row;
}

function queueItem({ vertex, distance }) {
    const item = document.createElement('li');
    item.textContent = `${vertex} · ${distance}`;
    return item;
}

function render(frame) {
    const { current, event } = frame;
    const size = viewport.resize(width => Math.max(230, Math.min(290, width * .7)));
    if (size) {
        // The layout is fixed and roles change discretely with the other panels.
        renderer.render(viewport.context, { ...frame, previous: current.graph, current: current.graph, progress: 1 }, size);
    }
    if (rendered === current) return;
    rendered = current;
    distanceRows.replaceChildren(...current.distances.map(row => distanceRow(row, event.vertex)));
    queueItems.replaceChildren(...current.queue.map(queueItem));
    emptyQueue.hidden = current.queue.length > 0;
    status.textContent = current.message;
}

function mount() {
    viewport = createCanvasViewport(canvas, { onResize() { if (player?.frame) render(player.frame); } });
    player = new Player(host, {
        ...timing, viewport: panes, autoHide: false,
        stepHistory: () => Array.from(dijkstraSteps()),
        render,
        onStatus({ phase }) { status.setAttribute('aria-live', phase === 'playing' ? 'off' : 'polite'); },
    });
    player.start();
}

window.addEventListener('pagehide', () => {
    player.dispose();
    viewport.dispose();
    player = undefined;
    rendered = undefined;
});
window.addEventListener('pageshow', event => { if (event.persisted && !player) mount(); });
mount();
