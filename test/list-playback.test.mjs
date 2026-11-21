import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createListTrace,listScene} from '@grundyjs/algiviz/list';
import {createPlayer,createTimeline,createRewindBuffer,createAsyncSource} from '@grundyjs/algiviz/playback';
import {Player} from '@grundyjs/algiviz/player';
import {dom} from './player-test-dom.mjs';
import {input,positions,options,slot,pointerId} from './list-test-fixtures.mjs';
const project=s=>listScene(s,{namespace:'list'});
function commands(t){return[()=>t.start(),()=>t.edit({nodes:input(['A','X','B','C']).nodes,layout:positions(['A','X','B','C']),marks:{pointers:[{id:slot('A'),role:'changed'}],nodeCaptions:[{id:'X',text:'new'}]}}),()=>t.edit({nodes:input(['A','X','C']).nodes}),()=>t.done({result:{nodeIds:['X'],pointerIds:[slot('A'),slot('C')]}})];}
function* steps(observe=()=>{}){const t=createListTrace(input(),options());observe('trace',t);try{for(const command of commands(t)){observe('read');yield command()}assert.fail('Read beyond list done')}finally{observe('close')}}

test('list playback: terminal completion avoids EOF reads and timeline retains topology/result',()=>{
    const t=createListTrace(input(),options()),recorded=commands(t).map(fn=>fn()),timeline=createTimeline(recorded,{stepDurationMs:100,finalHoldMs:25});
    assert.equal(timeline.sample(0).current.list.nodes[0].nextId,'B');assert.equal(timeline.sample(100).current.list.nodes[0].nextId,'X');assert.equal(timeline.sample(200).current.list.nodes.some(n=>n.id==='B'),false);assert.equal(timeline.sample(250).progress,.5);assert.equal(timeline.sample(325).current,recorded[3].state);
    const calls={read:0,close:0},player=createPlayer(steps(k=>{if(k in calls)calls[k]++}),{isTerminal:s=>s.event.type==='done'});for(let i=0;i<3;i++)player.nextStep();assert.equal(player.finished,true);assert.deepEqual(calls,{read:4,close:1});assert.deepEqual(player.frame.current.result.nodeIds,['X']);player.dispose();player.dispose();assert.equal(calls.close,1);
});
test('list playback: bounded rewind restores exact snapshots without reapplying topology or retirement',()=>{
    const calls={read:0,close:0},traces=[],ring=createRewindBuffer(steps((k,v)=>{if(k==='trace')traces.push(v);else calls[k]++}),{capacity:3});const first=ring.current;const insert=ring.next(),remove=ring.next(),final=ring.next();assert.equal(ring.startPosition,1);
    assert.equal(ring.previous(),remove);assert.equal(ring.previous(),insert);assert.equal(ring.current.state.list.nodes.some(n=>n.id==='B'),true);assert.equal(ring.canPrevious,false);assert.equal(ring.next(),remove);assert.equal(ring.next(),final);assert.deepEqual(calls,{read:4,close:0});assert.equal(first.state.list.nodes[0].nextId,'B');assert.equal(traces[0].state,final.state);ring.dispose();ring.dispose();assert.equal(calls.close,1);
});
test('list playback: eviction does not release retired IDs from the live trace',()=>{
    const t=createListTrace(input(),options());const states=[t.start(),t.edit({nodes:input(['A','C']).nodes}),t.edit({})],ring=createRewindBuffer(states,{capacity:1});ring.next();ring.next();assert.equal(ring.startPosition,2);assert.throws(()=>t.edit({nodes:input().nodes,layout:positions()}),RangeError);assert.equal(t.edit({}).index,3);ring.dispose();
});
test('list playback: Player stepSource supports Previous/Next and fresh-trace Restart',async()=>{
    for(const capacity of [2,4]){const env=dom(),calls={read:0,close:0},traces=[],player=new Player(env.container(),{stepSource:()=>steps((k,v)=>{if(k==='trace')traces.push(v);else calls[k]++}),isTerminal:s=>s.event.type==='done',rewindCapacity:capacity,render:f=>project(f.current)});
        player.start();const initial=player.frame.current;for(let i=0;i<3;i++)player.next();const final=player.frame.current;assert.equal(player.status.phase,'finished');assert.deepEqual(calls,{read:4,close:1});assert.deepEqual(final.result.nodeIds,['X']);
        player.previous();assert.equal(player.frame.current.result,null);player.next();assert.equal(player.frame.current,final);assert.deepEqual(calls,{read:4,close:1});for(let i=0;i<6;i++)player.previous();assert.equal(player.status.rewindStartIndex,4-capacity);assert.equal(player.status.canPrevious,false);
        player.restart();assert.equal(traces.length,2);assert.deepEqual(player.frame.current,initial);assert.notEqual(player.frame.current,initial);assert.deepEqual(player.frame.current.pointerMarks,[]);assert.equal(player.frame.current.result,null);assert.equal(player.frame.current.list.nodes[1].id,'B');assert.deepEqual(final.result.nodeIds,['X']);
        for(let i=0;i<3;i++)player.next();assert.equal(player.status.phase,'finished');player.dispose();player.dispose();assert.deepEqual(await player.closed,{sources:[],errorCount:0,firstError:null});assert.equal(calls.close,2);assert.equal(env.scheduler.size,0);
    }
});
test('list playback: state-only history seeks cloned snapshots and Restart resets selection',async()=>{
    const env=dom();let factories=0;const player=new Player(env.container(),{history(){factories++;const t=createListTrace(input(),options());return commands(t).map(fn=>structuredClone(fn().state))},stepDurationMs:100,render:f=>{assert.equal(f.event,undefined);project(f.current)}});
    player.start();player.seek(300);const final=player.frame.current;assert.deepEqual(final.result.nodeIds,['X']);player.seek(100);assert.equal(player.frame.current.list.nodes.length,4);assert.equal(player.frame.current.result,null);player.seek(200);assert.equal(player.frame.current.list.nodes.length,3);player.previous();assert.equal(player.frame.current.list.nodes.length,4);player.restart();assert.equal(factories,2);assert.equal(player.frame.current.list.nodes[0].nextId,'B');assert.equal(player.frame.current.result,null);player.dispose();await player.closed;
});
test('list playback: Pause freezes progress; Next, Restart and idempotent dispose preserve ownership',async()=>{
    const env=dom(),calls={read:0,close:0},player=new Player(env.container(),{stepSource:()=>steps(k=>{if(k in calls)calls[k]++}),isTerminal:s=>s.event.type==='done',stepDurationMs:100,rewindCapacity:4,render:f=>project(f.current)});
    player.start();player.play();env.scheduler.tick(0);env.scheduler.tick(25);assert.equal(player.frame.progress,.25);const paused=player.frame;player.pause();env.scheduler.tick(1000);assert.equal(player.frame,paused);player.next();assert.equal(player.frame.progress,1);assert.equal(calls.read,2);player.restart();assert.equal(calls.close,1);assert.equal(player.frame.stepIndex,0);assert.equal(player.frame.current.list.nodes[0].nextId,'B');player.dispose();player.dispose();await player.closed;assert.equal(calls.close,2);assert.equal(env.scheduler.size,0);
});
test('list playback: cloned async state preserves selected null slots independently of events',async()=>{
    const t=createListTrace(input(),options()),state=commands(t).map(fn=>fn()).at(-1).state;let closed=0;const source=createAsyncSource(async function*(){try{yield structuredClone(state)}finally{closed++}});const next=await source.next();assert.equal(next.kind,'value');const scene=project(next.value);assert.equal(scene.objects.find(o=>o.id===pointerId('C')).data.result,true);assert.equal(scene.objects.find(o=>o.id===pointerId('C')).data.to,null);source.dispose();source.dispose();await source.closed;assert.equal(closed,1);
});
test('list playback: empty-list terminal state is playable and rewindable',async()=>{
    const env=dom();const player=new Player(env.container(),{stepSource:function*(){const t=createListTrace(input([]),options([]));yield t.start();yield t.done({result:{pointerIds:[slot()]}})},isTerminal:s=>s.event.type==='done',rewindCapacity:2,render:f=>{assert.equal(project(f.current).objects.length,1)}});
    player.start();player.next();assert.equal(player.status.phase,'finished');assert.equal(project(player.frame.current).objects[0].data.result,true);player.previous();assert.equal(player.frame.current.result,null);player.next();assert.equal(player.status.phase,'finished');player.restart();assert.equal(player.frame.current.result,null);player.dispose();await player.closed;
});
