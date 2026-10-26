import { createDemoPlayer } from './demo-player.mjs';
import { graphSteps, graphExamples } from './graph-algorithm.mjs';
import { createGraphRenderer, graphLayout } from './graph-scene.mjs';
const $ = id => document.getElementById(id);
const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
let shape = graphExamples[0].id, renderer = createGraphRenderer({ layout: shape });
const preset = () => graphExamples.find(example => example.id === $('graph').value);
const label = (state, id) => state.graph.nodes.find(node => node.id === id)?.label ?? '—';

export function describeGraphStep(frame) {
    const s = frame.current, e = frame.event;
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
const playback = createDemoPlayer({
    isTerminal: step => step.event.kind === 'finished',
    onError: error => { $('error').textContent = error.message; },
    render(frame, { running }) {
        const s = frame.current;
        const width = Math.max(180, canvas.clientWidth), height = graphLayout(width, s.graph.nodes.length, shape).height;
        const ratio = window.devicePixelRatio || 1;
        canvas.style.height = (height + 2) + 'px';
        const bitmapWidth = Math.round(width * ratio), bitmapHeight = Math.round(height * ratio);
        if (canvas.width !== bitmapWidth) canvas.width = bitmapWidth;
        if (canvas.height !== bitmapHeight) canvas.height = bitmapHeight;
        ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
        renderer.render(ctx, frame, width, height);
        const text = 'Step ' + frame.stepIndex + ': ' + describeGraphStep(frame);
        $('status').setAttribute('aria-live', running ? 'off' : 'polite');
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
    },
});
function options() {
    const example = preset();
    $('start').replaceChildren();
    $('target').replaceChildren();
    const none = document.createElement('option'); none.value = ''; none.textContent = 'No target'; $('target').append(none);
    for (const node of example.graph.nodes) for (const id of ['start', 'target']) {
        const option = document.createElement('option'); option.value = node.id; option.textContent = node.label ?? node.id;
        $(id).append(option);
    }
    $('start').value = example.start; $('target').value = example.target;
}
function load() {
    const example = preset(), start = $('start').value, target = $('target').value || null;
    if (!example) throw new RangeError('Choose a graph');
    // Capture applied inputs; mode switches and restart must not read draft controls.
    const source = () => graphSteps(example.graph, start, target);
    const previous = { shape, renderer };
    shape = example.id; renderer = createGraphRenderer({ layout: shape });
    try { playback.load(source); }
    catch (error) { ({ shape, renderer } = previous); playback.draw(); throw error; }
}
for (const example of graphExamples) {
    const option = document.createElement('option'); option.value = example.id; option.textContent = example.label;
    $('graph').append(option);
}
$('graph').onchange = options;
$('input-form').onsubmit = event => { event.preventDefault(); try { load(); } catch (error) { $('error').textContent = error.message; } };
new ResizeObserver(() => playback.draw()).observe(canvas);
window.addEventListener('resize', () => playback.draw());
options(); load();
