import { Player } from '@grundyjs/algiviz/player';
import { createListRenderer } from '@grundyjs/algiviz/canvas/list';
import { createCanvasViewport } from '@grundyjs/algiviz/canvas/viewport';
import { prepareListSession, listRewindCapacity } from './list-player-algorithm.mjs';

const host = document.querySelector('#player');
const canvas = host.querySelector('canvas');
const status = document.querySelector('#status');
const modeInput = document.querySelector('#mode');
const errorOutput = document.querySelector('#error');
const renderer = createListRenderer({ theme: 'dark', presentNode: ({ node }) => ({ label: String(node.value) }) });
let player, viewport;
let mode = 'generator', speed = 1;

function showError(error) {
    errorOutput.textContent = error instanceof Error ? error.message : String(error);
}

function render(frame) {
    const size = viewport.resize(width => Math.max(180, Math.min(340, width * 0.44)));
    const { current, previous } = frame;
    if (size) renderer.render(viewport.context, { ...frame, current: current.visual, previous: previous.visual }, size);
    if (status.textContent !== current.message) status.textContent = current.message;
}

function load(nextMode) {
    const options = prepareListSession(nextMode, renderer.layout);
    speed = player?.status.speed ?? speed;
    player?.dispose();
    errorOutput.textContent = '';
    player = new Player(host, {
        ...options, viewport: canvas, autoHide: false, render, onError: showError,
        onStatus(state) { status.setAttribute('aria-live', state.phase === 'playing' ? 'off' : 'polite'); },
    });
    mode = nextMode;
    modeInput.value = mode;
    document.querySelector('#mode-note').textContent = mode === 'history'
        ? 'Drag the slider to inspect a transition.'
        : `Previous keeps up to ${listRewindCapacity} steps in the generator window.`;
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
