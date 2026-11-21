import { Player } from '@grundyjs/algiviz/player';
import { createCanvasViewport } from '@grundyjs/algiviz/canvas/viewport';
import { graphExamples } from './graph-presets.mjs';
import { prepareGraphSession, graphRewindCapacity } from './graph-session.mjs';

const label = (state, id) => { const node = state.graph.nodes.find(node => node.id === id); return node ? node.label ?? node.id : '—'; };

export function describeGraphStep(frame) {
    const s = frame.current, e = s.event;
    switch (e.kind) {
        case 'start': return `Discover ${label(s, s.start)} at distance 0 and enqueue it.`;
        case 'dequeue': return `Take ${label(s, e.target)} from the front of the queue.`;
        case 'examine': return `Inspect neighbor ${label(s, e.target)} of ${label(s, e.source)}.`;
        case 'discover': return `Discover ${label(s, e.target)} at distance ${s.distances.find(item => item.id === e.target).distance}. Parent: ${label(s, e.source)}. Mark now and enqueue.`;
        case 'skip': return `Skip ${label(s, e.target)}: already discovered. Keep its parent and do not enqueue again.`;
        case 'settle': return `All neighbors of ${label(s, e.target)} have been inspected.`;
        case 'traversal-done': return 'The queue is empty. Every reachable vertex has been processed.';
        case 'path': return `Follow parents towards the start: add ${label(s, e.target)}.`;
        case 'finished': return 'Traversal complete.';
        default: return e.kind;
    }
}

// Each example supplies one drawing per canvas in the Player's viewport.
export function mountGraphDemo(createDrawing, prepareSession = prepareGraphSession) {
    const $ = id => document.getElementById(id), host = $('player');
    const stage = host.firstElementChild, canvases = [...host.querySelectorAll('canvas')];
    let player, viewports, drawings, applied, mode = 'history', restoreRequest = 0;
    const preset = () => graphExamples.find(example => example.id === $('graph').value);
    const showError = error => { $('error').textContent = error instanceof Error ? error.message : String(error); };
    function mountViewports() {
        viewports = canvases.map(canvas => createCanvasViewport(canvas, {
            onResize() { if (player?.frame) render(player.frame); },
        }));
    }
    mountViewports();

    function render(frame) {
        const s = frame.current;
        for (const [index, viewport] of viewports.entries()) {
            const drawing = drawings[index], size = viewport.resize(width => drawing.height(width, s));
            if (size) drawing.render(viewport.context, frame, size);
        }
        const text = 'Step ' + frame.stepIndex + ': ' + describeGraphStep(frame);
        $('status').setAttribute('aria-live', player?.status.phase === 'playing' ? 'off' : 'polite');
        if ($('status').textContent !== text) $('status').textContent = text;
        $('counters').textContent = `Discovered: ${s.discoveredCount} / ${s.graph.nodes.length} · Processed: ${s.processedCount} · Neighbor entries inspected: ${s.edgeChecks} · Largest queue: ${s.maxQueueSize}`;
        $('queue').textContent = `Start: ${label(s, s.start)} · Target: ${s.target === null ? 'none' : label(s, s.target)} · Current: ${label(s, s.current)} · Queue, front first: [${s.queue.map(id => label(s, id)).join(', ')}]`;
        $('distances').textContent = s.distances.map(item => label(s, item.id) + ': ' +
            (item.distance ?? (s.phase === 'traversal' ? '—' : '∞'))).join(' · ');
        const targetDistance = s.distances.find(item => item.id === s.target)?.distance;
        $('result').textContent = s.phase === 'finished' ? s.target === null ? 'Full traversal complete; no target selected.'
            : targetDistance === null ? `Target ${label(s, s.target)} is unreachable from ${label(s, s.start)}.`
            : `Shortest path: ${s.path.map(id => label(s, id)).join(' → ')}. Length: ${s.path.length - 1} edges.`
            : s.phase === 'path' ? 'Restoring from target to start: ' + s.path.map(id => label(s, id)).join(' → ')
            : 'A path is restored after the full reachable component has been traversed.';
    }
    function load(next = applied, nextMode = mode) {
        if (!next) throw new RangeError('Choose a graph');
        const options = prepareSession(next.graph, next.start, next.target, next.id, nextMode);
        const nextDrawing = createDrawing(next.id);
        const speed = player?.status.speed ?? 1;
        player?.dispose();
        drawings = [nextDrawing].flat();
        player = new Player(host, { ...options, viewport: stage, autoHide: false, render, onError: showError,
            onStatus(status) { $('status').setAttribute('aria-live', status.phase === 'playing' ? 'off' : 'polite'); } });
        applied = next; mode = nextMode; $('mode').value = mode; $('error').textContent = '';
        $('mode-note').textContent = mode === 'history' ? 'Full history retains all snapshots and supports seeking.'
            : 'Generator mode is lazy; Previous retains the last ' + graphRewindCapacity + ' steps. Restart creates a fresh source.';
        player.setSpeed(speed); player.start();
    }
    function options() {
        const example = preset();
        $('start').replaceChildren(); $('target').replaceChildren();
        const none = document.createElement('option'); none.value = ''; none.textContent = 'No target'; $('target').append(none);
        for (const node of example.graph.nodes) for (const id of ['start', 'target']) {
            const option = document.createElement('option'); option.value = node.id; option.textContent = node.label ?? node.id; $(id).append(option);
        }
        $('start').value = example.start; $('target').value = example.target;
    }
    for (const example of graphExamples) {
        const option = document.createElement('option'); option.value = example.id; option.textContent = example.label; $('graph').append(option);
    }
    $('mode').innerHTML = '<option value="history">Full history · seeking</option><option value="generator">Generator · last ' + graphRewindCapacity + ' steps</option>';
    $('graph').onchange = options;
    $('input-form').onsubmit = event => { event.preventDefault(); try {
        const example = preset();
        load({ id: example.id, graph: example.graph, start: $('start').value, target: $('target').value || null }, $('mode').value);
    } catch (error) { showError(error); } };
    $('mode').onchange = () => { try { load(applied, $('mode').value); } catch (error) { $('mode').value = mode; showError(error); } };
    window.addEventListener('pagehide', () => {
        cancelAnimationFrame(restoreRequest);
        player?.dispose();
        viewports.forEach(viewport => viewport.dispose());
    });
    window.addEventListener('pageshow', event => {
        if (event.persisted) { mountViewports(); try { load(); } catch (error) { showError(error); } }
        cancelAnimationFrame(restoreRequest); restoreRequest = requestAnimationFrame(() => { $('mode').value = mode; });
    });
    options(); const first = preset(); load({ id: first.id, graph: first.graph, start: first.start, target: first.target });
}
