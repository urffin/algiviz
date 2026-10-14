import { test } from 'node:test';
import assert from 'node:assert/strict';
import { graphSteps, sampleGraph } from '../examples/graph-algorithm.mjs';
import { graphScene, createGraphRenderer } from '../examples/graph-scene.mjs';
import { createPlayer, createTimeline } from '@grundyjs/algiviz/playback';
import { createSceneFrame } from '@grundyjs/algiviz/scene';

function frozen(value) {
    if (value && typeof value === 'object') {
        assert.ok(Object.isFrozen(value));
        for (const child of Object.values(value)) frozen(child);
    }
}
test('BFS handles cycles, disconnected components, loops and duplicate connections', () => {
    const graphs = [sampleGraph, {
        nodes: [{id:'__proto__'}, {id:'x'}, {id:'isolated'}],
        edges: [{id:'loop',from:'x',to:'x'}, {id:'one',from:'x',to:'__proto__'},
            {id:'two',from:'x',to:'__proto__'}],
    }];
    // All undirected simple graphs on four nodes, with every possible start.
    for (let mask = 0; mask < 64; mask++) {
        const nodes = ['a','b','c','d'].map(id => ({id})), edges = [];
        let bit = 0;
        for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++, bit++)
            if (mask & (1 << bit)) edges.push({id:String(bit),from:nodes[a].id,to:nodes[b].id});
        graphs.push({nodes, edges});
    }
    for (const graph of graphs) for (const {id:start} of graph.nodes) {
        const before = JSON.stringify(graph), steps = [...graphSteps(graph,start)];
        const final = steps.at(-1).state, ids = graph.nodes.map(node=>node.id);
        // Independent shortest-path oracle using all-pairs relaxation.
        const d = ids.map((_,i)=>ids.map((_,j)=>i===j?0:Infinity));
        for (const edge of graph.edges) {
            const a=ids.indexOf(edge.from), b=ids.indexOf(edge.to);
            if (a !== b) d[a][b]=d[b][a]=1;
        }
        for (let k=0;k<ids.length;k++) for(let i=0;i<ids.length;i++)
            for(let j=0;j<ids.length;j++) d[i][j]=Math.min(d[i][j],d[i][k]+d[k][j]);
        assert.deepEqual(final.distances.map(item=>item.distance),
            d[ids.indexOf(start)].map(value=>Number.isFinite(value)?value:null));
        assert.equal(new Set(final.visited).size,final.visited.length);
        assert.equal(final.visited.length,final.distances.filter(item=>item.distance!==null).length);
        assert.equal(final.treeEdges.length,final.visited.length-1);
        assert.deepEqual(final.queue,[]);
        for (const [index,step] of steps.entries()) {
            assert.equal(step.index,index); frozen(step);
            assert.equal(new Set(step.state.queue).size,step.state.queue.length);
            assert.ok(step.state.queue.every(id=>!step.state.visited.includes(id)));
        }
        assert.equal(steps.at(-1).event.kind,'finished');
        assert.equal(JSON.stringify(graph),before);
    }
});

test('graph source validates lazily, isolates input and permits cancellation', () => {
    for (const graph of [
        {nodes:[],edges:[]},
        {nodes:[{id:'A'},{id:'A'}],edges:[]},
        {nodes:[{id:'A'}],edges:[{id:'bad',from:'A',to:'missing'}]},
        {nodes:[{id:'A'}],edges:[{id:'x',from:'A',to:'A'},{id:'x',from:'A',to:'A'}]},
    ]) assert.throws(()=>graphSteps(graph,'A').next());
    const graph = {nodes:[{id:'A'},{id:'B'}],edges:[{id:'ab',from:'A',to:'B'}]};
    const iterator = graphSteps(graph,'A'), first=iterator.next().value;
    graph.nodes[0].id='changed'; graph.edges[0].to='missing';
    assert.equal(iterator.next().value.state.graph,first.state.graph);
    assert.deepEqual([...iterator].at(-1).state.visited,['A','B']);
    const early=graphSteps(sampleGraph,'A'); early.next(); early.return();
    assert.equal(early.next().done,true);
});

test('graph scenes render finite geometry and history agrees with generator at all transitions', () => {
    const options={stepDurationMs:10,finalHoldMs:7};
    for (const start of ['A','F']) {
        const steps=[...graphSteps(sampleGraph,start)];
        const timeline=createTimeline(steps,options);
        let closed=false;
        function* source() { try {yield* graphSteps(sampleGraph,start);} finally {closed=true;} }
        const player=createPlayer(source(),{...options,isTerminal:step=>step.event.kind==='finished'});
        const renderer=createGraphRenderer();
        const calls=[];
        const ctx=new Proxy({canvas:{width:960,height:510}},{
            get(target,key){return key in target?target[key]:(...args)=>{
                for(const arg of args) if(typeof arg==='number') assert.ok(Number.isFinite(arg),String(key));
                calls.push(key);
            };},
        });
        for(let time=0;time<=timeline.durationMs;time++){
            const frame=time?player.advance(1):player.frame;
            assert.deepEqual(frame,timeline.sample(time));
            if(time%5===0) for(const width of [320,960]){
                ctx.canvas.width=width; renderer.render(ctx,frame);
                const scene=graphScene(frame.current);
                assert.equal(new Set(scene.objects.map(o=>o.id)).size,scene.objects.length);
                const resolved=createSceneFrame({...frame,previous:graphScene(frame.previous),current:scene});
                for(const object of resolved.objects) if(object.current?.type==='connection'){
                    assert.ok(resolved.get(object.current.data.from));
                    assert.ok(resolved.get(object.current.data.to));
                }
            }
        }
        assert.ok(player.finished && closed);
        assert.ok(calls.includes('arc') && calls.includes('fillText'));
        player.dispose();
    }
});
