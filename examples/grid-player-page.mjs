import { Player } from '@grundyjs/algiviz/player';
import { createGridRenderer } from '@grundyjs/algiviz/canvas/grid';
import { createCanvasViewport } from '@grundyjs/algiviz/canvas/viewport';
import { gridBfsPresets, describeCell } from './grid-player-algorithm.mjs';
import { prepareGridSession, gridRewindCapacity } from './grid-player-session.mjs';

export function mountGridPlayerDemo() {
    const canvas = document.querySelector('canvas'), status = document.querySelector('#status');
    const modeInput = document.querySelector('#mode'), presetInput = document.querySelector('#preset');
    const renderer = createGridRenderer({ theme: 'dark', presentCell: ({ value }) => ({ label: value, color: value === '#' ? '#0b1220' : undefined }) });
    let player, viewport, mode = 'generator', selected = 'passages', restoreRequest = 0;
    const showError = error => { document.querySelector('#error').textContent = error instanceof Error ? error.message : String(error); };
    const update = (id, text) => { const node = document.querySelector(id); if (node.textContent !== text) node.textContent = text; };
    function render(frame) {
        const state = frame.current, grid = state.visual.grid;
        const size = viewport.resize(width => Math.max(180, Math.min(520, width * grid.rows / grid.columns)));
        if (size) renderer.render(viewport.context, { ...frame, previous: frame.previous.visual, current: state.visual }, size);
        update('#status', `Step ${frame.stepIndex}: ${state.message}`);
        update('#queue', `Queue, head → tail (${state.queue.length}): ${state.queue.map(describeCell).join(' → ') || 'empty'}`);
        update('#counters', `Discovered: ${state.counters.discovered} · Dequeued: ${state.counters.dequeued}`);
        update('#result', state.found === null ? 'The shortest path will appear here when the search finishes.'
            : state.found ? `Shortest path: ${state.path.length - 1} moves. ${state.path.map(describeCell).join(' → ')}` : 'No path. The target is unreachable.');
    }
    function mountViewport() { viewport = createCanvasViewport(canvas, { onResize() { if (player?.frame) render(player.frame); } }); }
    function load(nextMode = mode, nextPreset = selected) {
        const options = prepareGridSession(nextMode, gridBfsPresets[nextPreset]), speed = player?.status.speed ?? 1;
        player?.dispose();
        player = new Player(document.querySelector('#player'), { ...options, viewport: canvas, autoHide: false, render, onError: showError,
            onStatus(state) { status.setAttribute('aria-live', state.phase === 'playing' ? 'off' : 'polite'); } });
        mode = nextMode; selected = nextPreset; modeInput.value = mode; presetInput.value = selected;
        document.querySelector('#error').textContent = '';
        update('#mode-note', mode === 'history' ? 'Full history: seek to any recorded step. Restart creates a fresh search.'
            : `Generator: states are read on demand. Previous retains the last ${gridRewindCapacity} positions, including the current one. Restart creates a fresh search.`);
        player.setSpeed(speed); player.start();
    }
    for (const [id, preset] of Object.entries(gridBfsPresets)) presetInput.add(new Option(preset.label, id));
    modeInput.innerHTML = `<option value="generator">Generator · last ${gridRewindCapacity} steps</option><option value="history">Full history · seeking</option>`;
    for (const control of [modeInput, presetInput]) control.onchange = () => {
        try { load(modeInput.value, presetInput.value); }
        catch (error) { modeInput.value = mode; presetInput.value = selected; showError(error); }
    };
    window.addEventListener('pagehide', () => { cancelAnimationFrame(restoreRequest); player.dispose(); viewport.dispose(); });
    window.addEventListener('pageshow', event => {
        if (event.persisted) { mountViewport(); load(); }
        cancelAnimationFrame(restoreRequest); restoreRequest = requestAnimationFrame(() => { modeInput.value = mode; presetInput.value = selected; });
    });
    mountViewport(); load();
}
