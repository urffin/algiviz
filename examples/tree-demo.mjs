import { createTimeline, createPlayer } from '@grundyjs/algiviz/playback';
import { treeSteps, treeRenderer } from './tree-scene.mjs';
import { timing, configureControls, nextDelta, stepTime } from './player-settings.mjs';

const $ = id => document.getElementById(id);
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
configureControls();
let timeline, player, time = 0, request = 0, last = null, running = false;
const finished = () => player ? player.finished : time >= timeline.durationMs;
function draw() {
    ctx.fillStyle = '#101827'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const frame = player ? player.frame : timeline.sample(time);
    treeRenderer.render(ctx, reduced.matches ? { ...frame, previous: frame.current, progress: 1 } : frame);
    $('seek').value = String(time);
    const text = `${frame.event.kind}${frame.event.active ? ': ' + frame.event.active.toUpperCase() : ''} · step ${frame.stepIndex}`;
    if ($('status').textContent !== text) $('status').textContent = text;
    $('play').textContent = running ? 'Pause' : finished() ? 'Replay' : 'Play';
}
function pause() { running = false; last = null; cancelAnimationFrame(request); }
function load() {
    pause(); player?.dispose();
    player = timeline = null;
    if ($('mode').value === 'generator') player = createPlayer(treeSteps(), { ...timing, isTerminal: step => step.event.kind === 'finished' });
    else timeline = createTimeline([...treeSteps()], timing);
    time = 0;
    $('seek').max = String(timeline?.durationMs ?? 1);
    $('seek').disabled = $('previous').disabled = Boolean(player);
    $('mode-note').textContent = player ? 'Generator mode retains only adjacent snapshots. Seeking is unavailable; restarting creates a new generator.' : 'Full history stores all snapshots. Seeking and total duration are available.';
    draw();
}
function tick(now) {
    if (!running) return;
    const delta = last === null ? 0 : Math.min(now - last, 100) * Number($('speed').value);
    last = now;
    if (player) player.advance(delta); else time = Math.min(timeline.durationMs, time + delta);
    if (finished()) pause();
    draw();
    if (running) request = requestAnimationFrame(tick);
}
$('play').onclick = () => {
    if (running) { pause(); draw(); return; }
    if (finished()) load();
    running = true; last = null; draw(); request = requestAnimationFrame(tick);
};
$('seek').oninput = () => { pause(); time = Number($('seek').value); draw(); };
$('restart').onclick = load;
$('mode').onchange = load;
$('speed').onchange = () => { last = null; };
for (const [id, direction] of [['previous', -1], ['next', 1]]) $(id).onclick = () => {
    pause();
    if (player) { if (direction > 0) player.advance(nextDelta(player.frame)); }
    else time = stepTime(time, direction, timeline.durationMs);
    draw();
};
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); draw(); } });
window.addEventListener('pagehide', () => { pause(); player?.dispose(); });
window.addEventListener('pageshow', event => { if (event.persisted) load(); });
reduced.addEventListener('change', draw);
load();
