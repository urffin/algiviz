import { createGraphRenderer } from '@grundyjs/algiviz/canvas/graph';
import { createCanvasViewport } from '@grundyjs/algiviz/canvas/viewport';
import { Player } from '@grundyjs/algiviz/player';
import { prepareContractionSession } from './graph-contraction.mjs';

const host = document.querySelector('#player');
const canvas = host.querySelector('canvas');
const status = document.querySelector('#status');
const modeInput = document.querySelector('#mode');
const errorOutput = document.querySelector('#error');
const renderer = createGraphRenderer({ theme: 'dark', topologyTransitions: true });
let player, viewport;
let mode = 'generator', speed = 1;

function showError(error) {
    errorOutput.textContent = error instanceof Error ? error.message : String(error);
}

function render(frame) {
    const size = viewport.resize(width => Math.max(230, Math.min(420, width * .54)));
    const { previous, current } = frame;
    if (size) renderer.render(viewport.context, { ...frame, previous: previous.visual, current: current.visual }, size);
    if (status.textContent !== current.message) status.textContent = current.message;
}

function load(nextMode) {
    const options = prepareContractionSession(nextMode);
    speed = player?.status.speed ?? speed;
    player?.dispose();
    errorOutput.textContent = '';
    player = new Player(host, {
        ...options, viewport: canvas, autoHide: false, render, onError: showError,
        onStatus({ phase }) { status.setAttribute('aria-live', phase === 'playing' ? 'off' : 'polite'); },
    });
    mode = nextMode;
    modeInput.value = mode;
    player.setSpeed(speed);
    player.start();
}

function mount() {
    viewport = createCanvasViewport(canvas, { onResize() { if (player?.frame) render(player.frame); } });
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
    viewport.dispose();
    player = undefined;
});
window.addEventListener('pageshow', event => {
    if (event.persisted && !player) mount();
    modeInput.value = mode;
});
mount();
