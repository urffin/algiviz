import { createDemoPlayer } from './demo-player.mjs';
import { iterateDepthFirstSearch, dfsExamples } from './dfs-algorithm.mjs';
import { createDfsRenderer, dfsPositions, dfsLayout } from './dfs-scene.mjs';
const $ = id => document.getElementById(id);
const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
const colors = { canvasBackground:'#101827', text:'#f1f5f9', muted:'#cbd5e1', border:'#475569',
    sorted:'#34d399', active:'#fbbf24', held:'#c4b5fd', bar:'#94a3b8' };
const text = { graph:'GRAPH', stack:'CALL STACK', nextNeighbor:'Next neighbor / degree', bottom:'Bottom',
    empty:'Empty', top:'Top', startMark:'Start', targetMark:'Target', bothMark:'Start / target' };
let shape = 'layers', capacity = 8, renderer = createDfsRenderer(dfsPositions[shape], text, colors, capacity);
const label = (s, id) => s.graph.vertices.find(v => v.id === id)?.label ?? '—';
export function describeDfsStep({ current:s, event:e }) {
    const name = id => label(s,id);
    switch(e.type) {
        case 'start': return 'Enter ' + name(s.start) + ' at depth 0.';
        case 'inspect-edge': return 'Inspect ' + name(e.from) + ' → ' + name(e.to) + '.';
        case 'discover': return 'Enter ' + name(e.to) + '; suspend ' + name(e.from) + '. Depth: ' + s.depth[e.to] + '.';
        case 'skip': return 'Skip ' + name(e.to) + ': already discovered; do not enter again.';
        case 'return': return 'Finish ' + name(e.vertex) + (e.to === null ? '; the root call returns.' : '; return to ' + name(e.to) + ' and resume its next neighbor.');
        case 'traversal-done': return 'The call stack is empty; the reachable component is finished.';
        case 'path-step': return 'Follow parents backwards: add ' + name(e.vertex) + '.';
        case 'done': return 'Traversal complete.';
        default: throw Error('Unknown DFS event');
    }
}
const playback = createDemoPlayer({
    isTerminal: step => step.event.type === 'done',
    onError: error => { $('error').textContent = error.message; },
    render(frame, {running}) {
        const s = frame.current, width = Math.max(180, canvas.clientWidth);
        const height = dfsLayout(width, dfsPositions[shape], capacity).height;
        canvas.style.height = (height + 2) + 'px';
        const ratio = devicePixelRatio || 1;
        const w = Math.round(width * ratio), h = Math.round(height * ratio);
        if(canvas.width !== w) canvas.width = w;
        if(canvas.height !== h) canvas.height = h;
        ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
        const logical = new Proxy(ctx, { get(t,k) { if(k === 'canvas') return {width,height};
            const v = Reflect.get(t,k,t); return typeof v === 'function' ? v.bind(t) : v; },
            set(t,k,v) { return Reflect.set(t,k,v,t); } });
        renderer.render(logical, frame);
        $('status').setAttribute('aria-live', running ? 'off' : 'polite');
        const message = 'Step ' + frame.stepIndex + ': ' + describeDfsStep(frame);
        if($('status').textContent !== message) $('status').textContent = message;
        $('counters').textContent = 'Discovered: ' + s.discoveredCount + '/' + s.graph.vertices.length +
            ' · Finished: ' + s.finishedCount + ' · Neighbor entries inspected: ' + s.edgeChecks + ' · Largest stack: ' + s.maxStackSize;
        $('stack').textContent = 'Active calls, bottom to top: [' + s.stack.map(c => label(s,c.vertex)).join(', ') + ']';
        $('depths').textContent = 'DFS tree depths: ' + s.graph.vertices.map(v => label(s,v.id) + ':' + (s.depth[v.id] ?? (s.phase === 'traversal' ? '—' : '∞'))).join(' · ');
        $('result').textContent = s.phase !== 'done' ? 'Path reconstruction follows the full traversal.' :
            s.target === null ? 'Full traversal complete; no target selected.' : s.depth[s.target] === null ?
            'Target ' + label(s,s.target) + ' is unreachable.' : 'DFS tree path: ' + s.path.map(id => label(s,id)).join(' → ') +
            '. Length: ' + (s.path.length - 1) + ' edges. Not necessarily shortest.';
    }
});
const preset = () => dfsExamples.find(e => e.id === $('graph').value);
function options() {
    const e = preset(); $('start').replaceChildren(); $('target').replaceChildren();
    $('target').append(new Option('No target',''));
    for(const v of e.graph.vertices) for(const id of ['start','target']) $(id).append(new Option(v.label,v.id));
    $('start').value = e.start; $('target').value = e.target;
}
function load() {
    const e = preset(), start = $('start').value, target = $('target').value || null;
    if(!e) throw new RangeError('Choose a graph');
    const source = () => iterateDepthFirstSearch(e.graph,start,target);
    const old = {shape,capacity,renderer};
    shape = e.id; capacity = e.graph.vertices.length;
    renderer = createDfsRenderer(dfsPositions[shape], text, colors, capacity);
    try { playback.load(source); } catch(error) { ({shape,capacity,renderer}=old); playback.draw(); throw error; }
}
for(const e of dfsExamples) $('graph').append(new Option(e.label,e.id));
$('graph').onchange = options;
$('input-form').onsubmit = event => { event.preventDefault(); try { load(); } catch(error) { $('error').textContent = error.message; } };
new ResizeObserver(() => playback.draw()).observe(canvas);
addEventListener('resize', () => playback.draw());
options(); load();
