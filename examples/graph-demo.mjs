import { createDemoPlayer } from './demo-player.mjs';
import { graphSteps, sampleGraph } from './graph-algorithm.mjs';
import { createGraphRenderer } from './graph-scene.mjs';
const $ = id => document.getElementById(id);
const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
const renderer = createGraphRenderer();
for (const node of sampleGraph.nodes) {
    const option = document.createElement('option');
    option.value = option.textContent = node.id;
    $('start').append(option);
}
const playback = createDemoPlayer({
    isTerminal: step => step.event.kind === 'finished',
    onError: error => { $('error').textContent = error.message; },
    render(frame, { running }) {
        renderer.render(ctx, frame);
        const state = frame.current;
        $('status').setAttribute('aria-live', running ? 'off' : 'polite');
        $('status').textContent = 'Step ' + frame.stepIndex + ': ' + frame.event.kind +
            (frame.event.target ? ' ' + frame.event.target : '') +
            ' · Queue: [' + state.queue.join(', ') + '] · Completed: [' + state.visited.join(', ') + ']';
        $('distances').textContent = state.distances.map(item => item.id + ': ' +
            (item.distance ?? (frame.event.kind === 'finished' ? 'unreachable' : 'not discovered'))).join(' · ');
    },
});
function load() {
    const start = $('start').value; // Capture selection so restart/mode changes replay the same input.
    playback.load(() => graphSteps(sampleGraph, start));
}
$('start').onchange = load;
new ResizeObserver(() => {
    canvas.width = Math.max(320, Math.round(canvas.getBoundingClientRect().width));
    playback.draw();
}).observe(canvas);
load();
