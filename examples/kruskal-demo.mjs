import { createGraphRenderer } from '@grundyjs/algiviz/canvas/graph';
import { createCanvasViewport } from '@grundyjs/algiviz/canvas/viewport';
import { mapFrame } from '@grundyjs/algiviz/playback';
import { Player } from '@grundyjs/algiviz/player';
import { prepareKruskalSession } from './kruskal.mjs';

const host = document.querySelector('#player');
const panes = host.querySelector('.panes');
const status = document.querySelector('#status');
const modeInput = document.querySelector('#mode');
const errorOutput = document.querySelector('#error');
const roleColors = { accepted: '#60a5fa', rejected: '#f87171' };
const renderers = ['graph', 'forest'].map(key => ({
    key, canvas: document.querySelector('#' + key + '-canvas'),
    renderer: createGraphRenderer({ theme: 'dark', roleColors, topologyTransitions: true }),
}));
let player, viewports;
let mode = 'generator', speed = 1;

function showError(error) {
    errorOutput.textContent = error instanceof Error ? error.message : String(error);
}

function render(frame) {
    const { current } = frame;
    for (const { key, renderer, viewport } of viewports) {
        const size = viewport.resize(width => Math.max(220, Math.min(290, width * .64)));
        if (size) renderer.render(viewport.context, mapFrame(frame, state => state[key]), size);
    }
    const message = `${current.message} Total weight: ${current.totalWeight}.`;
    if (status.textContent !== message) status.textContent = message;
}

function load(nextMode) {
    const options = prepareKruskalSession(nextMode);
    speed = player?.status.speed ?? speed;
    player?.dispose();
    errorOutput.textContent = '';
    player = new Player(host, {
        ...options, viewport: panes, autoHide: false, render, onError: showError,
        onStatus({ phase }) { status.setAttribute('aria-live', phase === 'playing' ? 'off' : 'polite'); },
    });
    mode = nextMode;
    modeInput.value = mode;
    player.setSpeed(speed);
    player.start();
}

function mount() {
    viewports = renderers.map(({ key, renderer, canvas }) => ({
        key, renderer, viewport: createCanvasViewport(canvas, { onResize() { if (player?.frame) render(player.frame); } }),
    }));
    load(mode);
}

modeInput.addEventListener('change', () => {
    try { load(modeInput.value); }
    catch (error) { modeInput.value = mode; showError(error); }
});
window.addEventListener('pagehide', () => {
    if (!player) return;
    speed = player.status.speed;
    player.dispose();
    for (const { viewport } of viewports) viewport.dispose();
    player = undefined;
    viewports = undefined;
});
window.addEventListener('pageshow', event => {
    if (event.persisted && !player) mount();
    modeInput.value = mode;
});
mount();
