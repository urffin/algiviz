import { createTreeRenderer } from '@grundyjs/algiviz/canvas/tree';
import { createCanvasViewport } from '@grundyjs/algiviz/canvas/viewport';
import { mapFrame } from '@grundyjs/algiviz/playback';
import { Player } from '@grundyjs/algiviz/player';
import { createHeapArrayRenderer } from './heap-player-array.mjs';
import { prepareHeapPanelSession } from './heap-player-session.mjs';

const host = document.querySelector('#player');
const panes = host.querySelector('.panes');
const arrayCanvas = host.querySelector('#array-canvas'), treeCanvas = host.querySelector('#tree-canvas');
const modeInput = document.querySelector('#mode');
const status = document.querySelector('#status'), errorOutput = document.querySelector('#error');
const drawArray = createHeapArrayRenderer(), treeRenderer = createTreeRenderer({ theme: 'dark' });
let player, arrayViewport, treeViewport;
let mode = 'generator', speed = 1;

function render(frame) {
    const arraySize = arrayViewport.resize(() => 180);
    const treeSize = treeViewport.resize(() => 180);
    if (arraySize) drawArray(arrayViewport.context, frame, arraySize);
    if (treeSize) {
        treeRenderer.render(treeViewport.context, mapFrame(frame, state => state.tree), treeSize);
    }
    if (status.textContent !== frame.current.message) status.textContent = frame.current.message;
}

function showError(error) {
    errorOutput.textContent = error instanceof Error ? error.message : String(error);
}

function load(nextMode) {
    const options = prepareHeapPanelSession(nextMode);
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
    const onResize = () => { if (player?.frame) render(player.frame); };
    arrayViewport = createCanvasViewport(arrayCanvas, { onResize });
    treeViewport = createCanvasViewport(treeCanvas, { onResize });
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
    arrayViewport.dispose();
    treeViewport.dispose();
    player = undefined;
});
window.addEventListener('pageshow', event => {
    if (event.persisted && !player) mount();
    modeInput.value = mode;
});
mount();
