import { createPlayer, createTimeline } from '@grundyjs/algiviz/playback';
import { timing, limits, configureControls, nextDelta, stepTime } from './player-settings.mjs';

// Browser glue shared by examples, deliberately outside the package API.
export function createDemoPlayer({ source, isTerminal, render, onError = error => { throw error; } }) {
    const $ = id => document.getElementById(id);
    const seek = $('seek') ?? $('time');
    const restart = $('restart') ?? $('reset');
    const note = $('mode-note') ?? $('mode-help');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    configureControls();
    let player, timeline, factory, mode = 'history', time = 0, running = false, last = null, request = 0;
    const finished = () => player ? player.finished : time >= timeline.durationMs;
    function pause() { running = false; last = null; cancelAnimationFrame(request); }
    function draw() {
        if (!player && !timeline) return;
        const frame = player ? player.frame : timeline.sample(time);
        seek.value = String(time);
        $('play').textContent = running ? 'Pause' : finished() ? 'Replay' : 'Play';
        render(reduced.matches ? { ...frame, previous: frame.current, progress: 1 } : frame,
            { running, finished: finished(), duration: timeline?.durationMs, mode });
    }
    function load(nextSource = factory ?? source, nextMode = mode) {
        // Construct before closing the old source, so invalid input preserves it.
        const nextPlayer = nextMode === 'generator' ? createPlayer(nextSource(nextMode), { ...timing, isTerminal }) : null;
        const nextTimeline = nextMode === 'history' ? createTimeline([...nextSource(nextMode)], timing) : null;
        pause(); player?.dispose();
        player = nextPlayer; timeline = nextTimeline; factory = nextSource; mode = nextMode; time = 0;
        $('mode').value = mode;
        seek.disabled = $('previous').disabled = !timeline;
        seek.max = String(timeline?.durationMs ?? 1);
        if ($('size')) $('size').max = String(limits[mode]);
        if ($('error')) $('error').textContent = '';
        note.textContent = timeline ? 'Full history stores all snapshots. Seeking and total duration are available.'
            : 'Generator mode retains only adjacent snapshots. Seeking is unavailable; restarting creates a new generator.';
        draw();
    }
    function attempt(action) { try { action(); } catch (error) { pause(); draw(); onError(error); } }
    function tick(now) {
        if (!running) return;
        attempt(() => {
            const delta = last === null ? 0 : Math.min(100, Math.max(0, now - last)) * Number($('speed').value);
            last = now;
            if (player) player.advance(delta); else time = Math.min(timeline.durationMs, time + delta);
            if (finished()) pause();
            draw();
            if (running) request = requestAnimationFrame(tick);
        });
    }
    $('play').onclick = () => attempt(() => {
        if (running) { pause(); draw(); return; }
        if (finished()) load();
        running = true; last = null; draw(); request = requestAnimationFrame(tick);
    });
    restart.onclick = () => attempt(() => load());
    $('mode').onchange = () => { attempt(() => load(factory, $('mode').value)); $('mode').value = mode; };
    $('speed').onchange = () => { last = null; };
    seek.oninput = () => { if (timeline) { pause(); time = Number(seek.value); draw(); } };
    for (const [id, direction] of [['previous', -1], ['next', 1]]) $(id).onclick = () => attempt(() => {
        pause();
        if (player) { if (direction > 0) player.advance(nextDelta(player.frame)); }
        else time = stepTime(time, direction, timeline.durationMs);
        draw();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); draw(); } });
    window.addEventListener('pagehide', () => { pause(); player?.dispose(); });
    window.addEventListener('pageshow', event => { if (event.persisted) attempt(() => load()); });
    reduced.addEventListener('change', draw);
    return { load, draw, get mode() { return mode; } };
}
