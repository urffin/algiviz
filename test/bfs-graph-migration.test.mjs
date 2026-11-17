import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { graphScene } from '@grundyjs/algiviz/graph';
import { createGraphRenderer } from '@grundyjs/algiviz/canvas/graph';
import { Player } from '@grundyjs/algiviz/player';
import { graphSteps, graphExamples } from '../examples/graph-algorithm.mjs';
import { graphPositions } from '../examples/graph-layout.mjs';
import { prepareGraphSession, graphRewindCapacity } from '../examples/graph-session.mjs';
import { limits } from '../examples/player-settings.mjs';
import { recording } from './graph-canvas-context.mjs';
import { dom } from './player-test-dom.mjs';

const before = JSON.parse(readFileSync(new URL('./fixtures/bfs-before-graph.json', import.meta.url), 'utf8'));
const main = graphExamples[0];
function semantic(step) {
    const { visual, event, ...state } = step.state;
    return { index: step.index, event: step.event, state: { ...state, graph: {
        nodes: state.graph.nodes.map(n => ({ id: n.id, label: n.label ?? n.id })),
        edges: state.graph.edges.map(e => ({ id: e.id, from: e.from, to: e.to }))
    } } };
}
function draw(frame) {
    const env = recording(640, 400);
    createGraphRenderer({ theme: 'dark', roleColors: { tree: '#a78bfa', path: '#34d399' } }).render(env.ctx,
        { ...frame, previous: frame.previous.visual, current: frame.current.visual }, { width: 640, height: 400 });
    return env;
}
const endpoint = step => ({ previous: step.state, current: step.state, progress: 1, stepIndex: step.index, event: step.event });

test('BFS migration: all 179 baseline runs and 6756 semantic steps remain identical', () => {
    let total = 0;
    for (const item of before.cases) {
        const steps = [...graphSteps(before.graphs[item.graphId], item.start, item.target)];
        assert.equal(steps.length, item.stepCount, item.name);
        const digest = createHash('sha256').update(JSON.stringify(steps.map(semantic))).digest('hex');
        assert.equal(digest, item.digest, item.name); total += steps.length;
    }
    assert.equal(total, before.totalSteps);
});

test('BFS migration: immutable graph marks/results project stable IDs, exact parent edges and green stock output', () => {
    for (const target of ['G', 'H', 'A', null]) {
        const steps = [...graphSteps(main.graph, 'A', target, { layout: graphPositions(main.graph, main.id) })];
        const final = steps.at(-1), s = final.state, scene = graphScene(s.visual, { namespace: 'bfs' });
        assert.equal(s.graph, s.visual.graph); assert.equal(s.event, final.event);
        assert.deepEqual(scene.objects.filter(o => o.type === 'graphNode' && o.data.result).map(o => o.data.node.id).sort(), [...s.path].sort());
        const parents = new Map(s.parents.map(p => [p.id, p.edge]));
        assert.deepEqual(s.visual.result?.edgeIds ?? [], s.path.slice(1).map(id => parents.get(id)));
        assert.equal(s.visual.result === null, target === null);
        assert.equal(steps[0].state.visual.result, null); assert.equal(steps[0].state.visual.nodeMarks[0].role, 'queued');
        for (const step of steps) {
            assert.ok(Object.isFrozen(step.state.visual)); assert.equal(step.state.visual.graph, s.graph);
            assert.equal(step.state.event, step.event);
        }
        const image = draw(endpoint(final));
        const greenNodes = image.calls('fill').slice(-main.graph.nodes.length).filter(c => c.state.fillStyle === '#34d399');
        assert.equal(greenNodes.length, s.path.length);
        assert.equal(image.calls('stroke').filter(c => c.state.strokeStyle === '#34d399').length, s.path.length ? s.path.length - 1 : 0);
        if (target === 'G') {
            const pathSteps = steps.filter(step => step.event.kind === 'path');
            assert.deepEqual(pathSteps.map(step => step.state.visual.nodeMarks.filter(m => m.role === 'path').length), [1, 2, 3, 4]);
        }
    }
});

test('BFS migration: direct Player supports both modes, bounded Previous, Restart and render without Frame.event', async () => {
    for (const mode of ['history', 'generator']) {
        const options = prepareGraphSession(main.graph, 'A', 'G', main.id, mode), env = dom(), frames = [];
        const player = new Player(env.container(), { ...options, render: frame => frames.push(frame) });
        player.start(); assert.equal(player.frame.current.event.kind, 'start');
        assert.equal(player.frame.current.target, 'G'); const first = player.frame.current;
        let clicks = 0;
        while (player.status.phase !== 'finished' && clicks++ < 150) player.next();
        assert.equal(player.status.phase, 'finished'); assert.deepEqual(player.frame.current.path, [...'ABDG']);
        assert.equal(player.frame.event === undefined, mode === 'history');
        const final = player.frame.current;
        for (let i = 0; i < 3 && player.frame.current === final; i++) player.previous();
        assert.notEqual(player.frame.current, final);
        for (let i = 0; i < 3 && player.frame.current !== final; i++) player.next();
        assert.equal(player.frame.current, final); assert.deepEqual(player.frame.current.visual.result.nodeIds, [...'ABDG']);
        if (mode === 'generator') {
            const end = player.status.rewindEndIndex;
            for (let i = 0; i < 100; i++) player.previous();
            assert.equal(player.status.rewindStartIndex, end - graphRewindCapacity + 1);
            assert.equal(player.status.canPrevious, false);
        } else { player.seek(0); assert.equal(player.frame.current, first); }
        player.restart(); assert.equal(player.frame.current.event.kind, 'start');
        assert.equal(player.frame.current.visual.result, null); assert.deepEqual(player.frame.current.queue, ['A']);
        assert.ok(!draw(player.frame).calls('fill').some(c => c.state.fillStyle === '#34d399'));
        player.dispose(); player.dispose(); await player.closed; assert.equal(env.scheduler.size, 0);
    }
});

test('BFS migration: stream prepares one step only, consumes lazily and closes actual sources on Restart/dispose', async () => {
    const options = prepareGraphSession(main.graph, 'A', 'G', main.id, 'generator'), original = options.stepSource;
    let reads = 0, closes = 0, factories = 0;
    options.stepSource = function* () { factories++; try { for (const step of original()) { reads++; yield step; } } finally { closes++; } };
    const env = dom(), p = new Player(env.container(), { ...options, render() {} });
    assert.equal(reads, 0); p.start(); assert.equal(reads, 1); p.next(); assert.equal(reads, 2);
    p.previous(); p.next(); assert.equal(reads, 2);
    p.restart(); assert.equal(factories, 2); assert.equal(reads, 3); assert.equal(closes, 1);
    p.dispose(); await p.closed; assert.equal(closes, 2);
});

test('BFS migration: input validation precedes replacement and rejects unsupported algorithm inputs and demo limits', () => {
    for (const mode of ['history', 'generator']) {
        assert.throws(() => prepareGraphSession(main.graph, 'missing', 'G', main.id, mode), RangeError);
        assert.throws(() => prepareGraphSession(main.graph, 'A', 'missing', main.id, mode), RangeError);
        const graph = { nodes: [{ id: 'A' }], edges: [{ id: 'loop', from: 'A', to: 'A', directed: true }] };
        assert.throws(() => prepareGraphSession(graph, 'A', null, 'circle', mode), /undirected/);
        graph.edges[0] = { id: 'loop', from: 'A', to: 'A', weight: 1 };
        assert.throws(() => prepareGraphSession(graph, 'A', null, 'circle', mode), /unweighted/);
        const tooLarge = { nodes: Array.from({ length: limits[mode] + 1 }, (_, i) => ({ id: String(i) })), edges: [] };
        assert.throws(() => prepareGraphSession(tooLarge, '0', null, 'circle', mode), /limit/);
    }
    assert.throws(() => prepareGraphSession(main.graph, 'A', 'G', main.id, 'invalid'), RangeError);
});

// A browser import-map omission can leave an otherwise valid Node example blank.
test('BFS migration: import map covers every public entry used by the active modules', () => {
    function dependencies(url, seen = new Set()) {
        if (seen.has(url.href)) return [];
        seen.add(url.href);
        const source = readFileSync(url, 'utf8'), names = [];
        for (const match of source.matchAll(/from ['"]([^'"]+)['"]/g)) {
            if (match[1].startsWith('@grundyjs/')) names.push(match[1]);
            else if (match[1].startsWith('.')) names.push(...dependencies(new URL(match[1], url), seen));
        }
        return names;
    }
    for (const page of ['../examples/graph.html', '../examples/graph-player.html', '../examples/dfs.html', './profile-browser.html', './array-dispatch-browser.html']) {
        const url = new URL(page, import.meta.url), html = readFileSync(url, 'utf8');
        const imports = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
        const entry = html.match(/<script type="module" src="([^"]+)"/)[1];
        for (const name of dependencies(new URL(entry, url))) assert.ok(imports[name], page + ': ' + name);
    }
    const html = readFileSync(new URL('../examples/graph.html', import.meta.url), 'utf8');
    assert.ok(!html.includes('id="play"') && !html.includes('id="seek"'), 'Legacy controller controls remained');
});


test('BFS captions: real trace distances survive rewind across discovery/completion and Restart in both Player modes',async()=>{
 for(const mode of ['history','generator']){
  const env=dom(),p=new Player(env.container(),{...prepareGraphSession(main.graph,'A','G',main.id,mode),render(){}});
  const text=id=>p.frame.current.visual.nodeCaptions.find(c=>c.id===id).text;
  p.start();assert.equal(text('A'),'d = 0');assert.equal(text('H'),'d = —');
  let guard=0;while(p.status.phase!=='finished'&&guard++<100)p.next();assert.equal(text('H'),'d = ∞');assert.equal(text('G'),'d = 3');
  while(p.frame.stepIndex>=51)p.previous();assert.equal(text('H'),'d = —');p.next();assert.equal(text('H'),'d = ∞');
  p.restart();assert.equal(text('H'),'d = —');assert.equal(text('E'),'d = —');assert.equal(p.frame.current.visual.result,null);
  p.dispose();await p.closed;
 }
 const steps=[...graphSteps(main.graph,'A','G',{layout:graphPositions(main.graph,main.id)})];
 const image=draw(endpoint(steps.at(-1)));assert.equal(image.calls('fillText').filter(c=>String(c.args[0]).startsWith('d = ')).length,8);
});
