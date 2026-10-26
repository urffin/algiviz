import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iterateDepthFirstSearch as dfs, dfsExamples } from '../examples/dfs-algorithm.mjs';
import { createDfsRenderer, dfsScene, dfsPositions, dfsLayout } from '../examples/dfs-scene.mjs';
import { createPlayer, createTimeline } from '@grundyjs/algiviz/playback';

function reference(graph,start,target) {
    const neighbors = new Map(graph.vertices.map(v => [v.id,[]]));
    for(const e of graph.edges) { neighbors.get(e.source).push(e.target); neighbors.get(e.target).push(e.source); }
    const order=[], finish=[], parent=new Map(), depth=new Map(); let checks=0, max=0;
    function visit(v,p,d) { parent.set(v,p); depth.set(v,d); order.push(v); max=Math.max(max,d+1);
        for(const n of neighbors.get(v)) { checks++; if(!depth.has(n)) visit(n,v,d+1); }
        finish.push(v);
    }
    visit(start,null,0);
    const path=[];
    if(target !== null && depth.has(target)) for(let v=target;v !== null;v=parent.get(v)) path.push(v);
    return {order,finish,parent,depth,checks,max,path:path.reverse()};
}
function frozen(x) { if(x && typeof x === 'object') { assert.ok(Object.isFrozen(x)); Object.values(x).forEach(frozen); } }
test('DFS matches an independent recursive oracle on every simple four-vertex graph', () => {
    let runs=0;
    for(let mask=0;mask<64;mask++) {
        const vertices=['__proto__','constructor','C','D'].map(id => ({id,label:id}));
        const edges=[]; let bit=0;
        for(let i=0;i<4;i++) for(let j=i+1;j<4;j++,bit++) if(mask & 1<<bit) edges.push({source:vertices[i].id,target:vertices[j].id});
        for(const input of [edges,[...edges].reverse()]) for(const {id:start} of vertices) for(const target of [null,...vertices.map(v=>v.id)]) {
            const graph={vertices,edges:input}, expected=reference(graph,start,target), steps=[...dfs(graph,start,target)], s=steps.at(-1).state;
            assert.deepEqual(s.order,expected.order); assert.deepEqual(s.finishOrder,expected.finish);
            assert.deepEqual(s.path,expected.path); assert.equal(s.edgeChecks,expected.checks); assert.equal(s.maxStackSize,expected.max);
            assert.deepEqual(s.stack,[]);
            for(const v of vertices) { assert.equal(s.depth[v.id],expected.depth.get(v.id) ?? null); assert.equal(s.parent[v.id],expected.parent.get(v.id) ?? null); }
            for(const [i,step] of steps.entries()) {
                assert.equal(step.index,i); frozen(step);
                const stack=step.state.stack;
                assert.equal(new Set(stack.map(c=>c.vertex)).size,stack.length);
                assert.deepEqual(stack.map(c=>c.vertex),step.state.order.filter(id=>step.state.status[id] === 'visiting'));
                for(let j=0;j<stack.length;j++) { const c=stack[j]; assert.equal(step.state.depth[c.vertex],j);
                    assert.ok(c.nextNeighbor>=0 && c.nextNeighbor<=step.state.graph.adjacency[c.vertex].length); }
            }
            runs++;
        }
    }
    assert.equal(runs,2560);
});
test('DFS default result, validation, input isolation and early disposal', () => {
    const e=dfsExamples[0], s=[...dfs(e.graph,e.start,e.target)].at(-1).state;
    assert.deepEqual(s.order,[...'ABD GECF'.replaceAll(' ','')]);
    assert.deepEqual(s.finishOrder,[...'FCEGDBA']); assert.deepEqual(s.path,[...'ABDGECF']);
    assert.equal(s.edgeChecks,18); assert.equal(s.maxStackSize,7); assert.equal(s.depth.H,null);
    for(const input of [{vertices:[],edges:[]},{vertices:[{id:'A',label:'A'},{id:'A',label:'A'}],edges:[]},
        {vertices:[{id:'A',label:'A'}],edges:[{source:'A',target:'A'}]},
        {vertices:[{id:'A',label:'A'}],edges:[{source:'A',target:'B'}]}]) assert.throws(()=>dfs(input,'A').next());
    assert.throws(()=>dfs(e.graph,'missing').next()); assert.throws(()=>dfs(e.graph,'A','missing').next());
    const input=structuredClone(e.graph), iterator=dfs(input,'A','F'), first=iterator.next().value;
    input.vertices[0].label='changed'; input.edges.length=0;
    assert.deepEqual([...iterator].at(-1).state.path,s.path); assert.equal(first.state.graph.vertices[0].label,'A');
    const early=dfs(e.graph,'A'); early.next(); early.return(); assert.equal(early.next().done,true);
});
test('DFS history/generator frames agree; scene remains finite on resize and reverse seeks', () => {
    const text={graph:'Graph',stack:'Stack',nextNeighbor:'Next neighbor',bottom:'Bottom',empty:'Empty',top:'Top',startMark:'Start',targetMark:'Target',bothMark:'S/T'};
    const colors={canvasBackground:'#101827',text:'#fff',muted:'#aaa',border:'#444',sorted:'#34d399',active:'#fbbf24',held:'#c4b5fd',bar:'#94a3b8'};
    for(const e of dfsExamples) for(const target of [e.target,null,e.start]) {
        const steps=[...dfs(e.graph,e.start,target)], options={stepDurationMs:8,finalHoldMs:5};
        const timeline=createTimeline(steps,options); let closed=false;
        function* source() { try { yield* dfs(e.graph,e.start,target); } finally { closed=true; } }
        const player=createPlayer(source(),{...options,isTerminal:step=>step.event.type==='done'});
        for(let t=0;t<=timeline.durationMs;t++) assert.deepEqual(t ? player.advance(1) : player.frame,timeline.sample(t));
        assert.ok(closed && player.finished); player.dispose();
        const renderer=createDfsRenderer(dfsPositions[e.id],text,colors,e.graph.vertices.length);
        for(const width of [232,320,390,699,700,960]) {
            const height=dfsLayout(width,dfsPositions[e.id],e.graph.vertices.length).height;
            const ctx=new Proxy({canvas:{width,height}},{get(t,k) { return k in t?t[k]:(...args)=>{
                for(const arg of args) if(typeof arg==='number') assert.ok(Number.isFinite(arg),String(k));
            }; }});
            for(let t=timeline.durationMs;t>=0;t-=4) {
                const frame=timeline.sample(t), scene=dfsScene(frame.current);
                assert.equal(new Set(scene.objects.map(o=>o.id)).size,scene.objects.length);
                assert.equal(scene.objects.filter(o=>o.type==='call').length,frame.current.stack.length);
                renderer.render(ctx,frame);
            }
        }
    }
});
