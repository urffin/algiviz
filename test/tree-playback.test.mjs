import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTreeTrace, treeScene } from '@grundyjs/algiviz/tree';
import { createPlayer, createTimeline, createRewindBuffer, createAsyncSource } from '@grundyjs/algiviz/playback';
import { createSceneProjector } from '@grundyjs/algiviz/scene';
import { Player } from '@grundyjs/algiviz/player';
import { dom } from './player-test-dom.mjs';
import { input, layout, rotation, errorIs, endpoint } from './tree-test-fixtures.mjs';
const project = state => treeScene(state,{namespace:'playback'});
function commands(t) {
    return [
        () => t.start(),
        () => t.mark({nodes:[{id:'D',role:'visited'}],nodeCaptions:[{id:'D',text:'leaf'}]}),
        () => t.edit(rotation()),
        () => t.edit({nodes:t.state.tree.nodes.filter(n=>n.id!=='D'),links:t.state.tree.links.filter(l=>l.id!=='child')}),
        () => t.done({result:{nodeIds:['C'],linkIds:['right']}}),
    ];
}
function* steps(observe = () => {}) {
    const t=createTreeTrace(input(),{layout:layout()});observe('trace',t);
    try {
        for(const command of commands(t)){observe('read');yield command();}
        assert.fail('Read beyond tree terminal step');
    } finally {observe('close');}
}

test('tree playback: headless completion and timeline seeking restore hierarchy/marks/results without inverse edits', () => {
    const t=createTreeTrace(input(),{layout:layout()}), recorded=commands(t).map(command=>command());
    const timeline=createTimeline(recorded,{stepDurationMs:100,finalHoldMs:25});
    assert.equal(timeline.sample(0).current.tree.rootId,'A');
    const rotating=timeline.sample(150);assert.equal(rotating.previous.tree.rootId,'A');assert.equal(rotating.current.tree.rootId,'C');assert.equal(rotating.progress,.5);
    assert.deepEqual(timeline.sample(425).current.result,{nodeIds:['C'],linkIds:['right']});
    assert.equal(timeline.sample(100).current.nodeCaptions[0].id,'D');assert.deepEqual(timeline.sample(300).current.nodeCaptions,[]);
    const calls={read:0,close:0},player=createPlayer(steps(kind=>{if(kind in calls)calls[kind]++;}),{isTerminal:step=>step.event.type==='done'});
    for(let i=0;i<4;i++)player.nextStep();assert.equal(player.finished,true);assert.deepEqual(calls,{read:5,close:1});
    assert.equal(player.frame.current.tree.rootId,'C');player.dispose();player.dispose();assert.equal(calls.close,1);
});

test('tree playback: bounded ring replays removed nodes and retires old positions without rerunning trace commands', () => {
    const calls={read:0,close:0};const ring=createRewindBuffer(steps(kind=>{if(kind in calls)calls[kind]++;}),{capacity:3});
    const start=ring.current;ring.next();const rotationStep=ring.next();ring.next();const final=ring.next();
    assert.equal(final.event.type,'done');assert.equal(ring.startPosition,2);assert.equal(ring.previous().state.tree.nodes.length,3);
    assert.equal(ring.previous(),rotationStep);assert.equal(ring.current.state.tree.nodes.length,4);assert.equal(ring.current.state.tree.nodes[3].id,'D');
    assert.equal(ring.canPrevious,false);ring.next();assert.equal(ring.next(),final);assert.deepEqual(calls,{read:5,close:0});
    ring.dispose();ring.dispose();assert.equal(calls.close,1);assert.equal(start.state.tree.rootId,'A');assert.equal(start.state.result,null);
});

test('tree playback: Player stream Previous/Next restores snapshots, Restart resets topology and retired IDs', async () => {
    for(const capacity of [2,5]){
        const env=dom(),host=env.container(),calls={read:0,close:0},traces=[],renders=[];
        const player=new Player(host,{stepSource:()=>steps((kind,value)=>{if(kind==='trace')traces.push(value);else calls[kind]++;}),
            isTerminal:step=>step.event.type==='done',rewindCapacity:capacity,render:frame=>renders.push(project(frame.current))});
        assert.equal(traces.length,0);player.start();const initial=player.frame.current;
        for(let i=0;i<4;i++)player.next();assert.equal(player.status.phase,'finished');const final=player.frame.current;
        assert.deepEqual(calls,{read:5,close:1});assert.equal(final.tree.nodes.length,3);assert.equal(final.tree.rootId,'C');
        const removed=initial.tree.nodes[3];assert.throws(()=>traces[0].edit({nodes:[removed]}),errorIs(Error));
        player.previous();assert.equal(player.frame.current.result,null);player.next();assert.equal(player.frame.current,final);
        assert.deepEqual(calls,{read:5,close:1});for(let i=0;i<8;i++)player.previous();
        assert.equal(player.status.rewindStartIndex,5-capacity);assert.equal(player.status.canPrevious,false);
        if(capacity===5){assert.equal(player.frame.current,initial);player.next();player.next();assert.equal(player.frame.current.tree.nodes.length,4);}
        player.restart();assert.equal(traces.length,2);assert.notEqual(player.frame.current,initial);assert.deepEqual(player.frame.current,initial);
        assert.deepEqual([player.status.rewindStartIndex,player.status.rewindEndIndex],[0,0]);assert.equal(player.frame.current.tree.nodes[3].id,'D');
        // The same initial IDs may be retired again in the fresh trace without touching old snapshots.
        player.next();player.next();player.next();player.next();assert.equal(player.status.phase,'finished');
        assert.equal(final.tree.nodes.length,3);assert.deepEqual(initial.nodeMarks,[]);
        player.dispose();player.dispose();assert.deepEqual(await player.closed,{sources:[],errorCount:0,firstError:null});
        assert.equal(calls.close,2);assert.equal(env.scheduler.size,0);assert.equal(host.children.length,0);assert.ok(renders.length>5);
    }
});

test('tree playback: history seek/Previous and Restart use snapshot state with undefined events', async () => {
    const env=dom();let factories=0;const originals=[];
    const player=new Player(env.container(),{history(){factories++;const t=createTreeTrace(input(),{layout:layout()});const states=commands(t).map(f=>f().state);originals.push(states);return states;},
        stepDurationMs:100,render:frame=>{assert.equal(frame.event,undefined);project(frame.current);}});
    player.start();player.seek(400);assert.equal(player.frame.current.result.nodeIds[0],'C');
    player.seek(100);assert.equal(player.frame.current.tree.nodes.length,4);assert.equal(player.frame.current.tree.rootId,'A');
    player.seek(200);assert.equal(player.frame.current.tree.rootId,'C');player.previous();assert.equal(player.frame.current.tree.rootId,'A');
    player.restart();assert.equal(factories,2);assert.deepEqual(player.frame.current,originals[0][0]);assert.notEqual(player.frame.current,originals[0][0]);
    assert.equal(originals[0][4].result.nodeIds[0],'C');player.dispose();await player.closed;
});

test('tree playback: Pause freezes interpolation and Restart/dispose close in-flight generators once', async () => {
    const env=dom(),calls={read:0,close:0};
    const player=new Player(env.container(),{stepSource:()=>steps(kind=>{if(kind in calls)calls[kind]++;}),isTerminal:s=>s.event.type==='done',
        stepDurationMs:100,rewindCapacity:5,render:frame=>project(frame.current)});
    player.start();player.play();env.scheduler.tick(0);env.scheduler.tick(25);assert.equal(player.frame.progress,.25);
    const old=player.frame;player.pause();env.scheduler.tick(1000);assert.equal(player.frame,old);
    player.next();assert.equal(player.frame.progress,1);assert.equal(calls.read,2);
    player.restart();assert.equal(calls.close,1);assert.equal(player.frame.stepIndex,0);assert.equal(player.frame.current.tree.rootId,'A');assert.deepEqual(player.frame.current.nodeCaptions,[]);
    player.dispose();player.dispose();await player.closed;assert.equal(calls.close,2);assert.equal(env.scheduler.size,0);
});

test('tree playback: cloned async states project without events and preserve cleanup', async () => {
    const t=createTreeTrace(input(),{layout:layout()});const final=commands(t).map(f=>f()).at(-1).state;let closed=0;
    const source=createAsyncSource(async function*(){try{yield structuredClone(final);}finally{closed++;}});
    const next=await source.next();assert.equal(next.kind,'value');const projected=createSceneProjector(project)(endpoint(next.value));
    assert.equal(projected.event,undefined);assert.equal(projected.current.objects.find(o=>o.type==='treeNode'&&o.data.result).data.node.id,'C');
    source.dispose();await source.closed;assert.equal(closed,1);
});
