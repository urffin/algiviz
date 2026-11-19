import { Player } from '@grundyjs/algiviz/player';
import { createTreeRenderer } from '@grundyjs/algiviz/canvas/tree';
import { createCanvasViewport } from '@grundyjs/algiviz/canvas/viewport';
import { prepareTreeSession, treeRewindCapacity } from './tree-player-session.mjs';

export function mountTreePlayerDemo() {
    const canvas = document.querySelector('canvas'), status = document.querySelector('#status'), modeInput = document.querySelector('#mode');
    const renderer = createTreeRenderer({ theme: 'dark', emptySlots: 'visible' });
    let player, viewport, mode = 'generator', restoreRequest = 0;
    const showError = error => { document.querySelector('#error').textContent = error instanceof Error ? error.message : String(error); };
    function mountViewport() { viewport = createCanvasViewport(canvas, { onResize() { if (player?.frame) render(player.frame); } }); }
    function render(frame) {
        const size = viewport.resize(width => Math.max(280, Math.min(440, width * .6)));
        if (size) renderer.render(viewport.context, { ...frame, previous: frame.previous.visual, current: frame.current.visual }, size);
        const text = `Step ${frame.stepIndex}: ${frame.current.message}`;
        if (status.textContent !== text) status.textContent = text;
    }
    function load(nextMode = mode) {
        const options = prepareTreeSession(nextMode, renderer.layout), speed = player?.status.speed ?? 1;
        player?.dispose();
        player = new Player(document.querySelector('#player'), { ...options, viewport: canvas, autoHide: false, render, onError: showError,
            onStatus(state) { status.setAttribute('aria-live', state.phase === 'playing' ? 'off' : 'polite'); } });
        mode = nextMode; modeInput.value = mode; document.querySelector('#error').textContent = '';
        document.querySelector('#mode-note').textContent = mode === 'history'
            ? 'Full history: drag the slider to inspect the rotation. Restart creates a fresh trace.'
            : `Generator: states are read on demand. Previous keeps the last ${treeRewindCapacity} steps. Restart creates a fresh trace.`;
        player.setSpeed(speed); player.start();
    }
    modeInput.innerHTML = `<option value="generator">Generator · last ${treeRewindCapacity} steps</option><option value="history">Full history · seeking</option>`;
    modeInput.onchange = () => { try { load(modeInput.value); } catch (error) { modeInput.value = mode; showError(error); } };
    window.addEventListener('pagehide', () => { cancelAnimationFrame(restoreRequest); player.dispose(); viewport.dispose(); });
    window.addEventListener('pageshow', event => {
        if (event.persisted) { mountViewport(); load(); }
        cancelAnimationFrame(restoreRequest); restoreRequest = requestAnimationFrame(() => { modeInput.value = mode; });
    });
    mountViewport(); load();
}
