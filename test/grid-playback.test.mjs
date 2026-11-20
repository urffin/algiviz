import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createGridTrace,gridScene} from '@grundyjs/algiviz/grid';
import {createPlayer,createTimeline,createRewindBuffer,createAsyncSource} from '@grundyjs/algiviz/playback';
import {createSceneProjector} from '@grundyjs/algiviz/scene';
import {Player} from '@grundyjs/algiviz/player';
import {dom} from './player-test-dom.mjs';
import {input,cell,endpoint} from './grid-test-fixtures.mjs';
const project=s=>gridScene(s,{namespace:'grid-playback'});
function commands(t){return[()=>t.start(),()=>t.mark({cells:[{row:0,column:0,role:'visited'}],cellCaptions:[{row:0,column:0,text:'0'}]}),
    ()=>t.edit({writes:[{row:0,column:1,value:9}],marks:{cells:[{row:0,column:1,role:'queued'}]}}),
    ()=>t.done({result:{cells:[cell(1,2)],path:[cell(0,0),cell(0,1),cell(1,1),cell(0,0)]}})];}
function* steps(observe=()=>{}){const t=createGridTrace(input());observe('trace',t);try{for(const command of commands(t)){observe('read');yield command();}assert.fail('Read beyond grid done');}finally{observe('close');}}

test('grid playback: completion stops at done and timeline restores values/captions/result',()=>{
    const t=createGridTrace(input()),recorded=commands(t).map(f=>f()),timeline=createTimeline(recorded,{stepDurationMs:100,finalHoldMs:25});
    assert.equal(timeline.sample(0).current.grid.values[1],1);assert.equal(timeline.sample(200).current.grid.values[1],9);assert.equal(timeline.sample(100).current.cellCaptions[0].text,'0');
    assert.equal(timeline.sample(250).previous.result,null);assert.equal(timeline.sample(250).current.result.path.length,4);assert.equal(timeline.sample(250).progress,.5);assert.equal(timeline.sample(325).current,recorded[3].state);
    const calls={read:0,close:0},player=createPlayer(steps(k=>{if(k in calls)calls[k]++;}),{isTerminal:s=>s.event.type==='done'});for(let i=0;i<3;i++)player.nextStep();assert.equal(player.finished,true);assert.deepEqual(calls,{read:4,close:1});assert.equal(player.frame.current.result.path.length,4);player.dispose();player.dispose();assert.equal(calls.close,1);
});
test('grid playback: bounded rewind replays exact snapshots without rerunning atomic writes',()=>{
    const calls={read:0,close:0},ring=createRewindBuffer(steps(k=>{if(k in calls)calls[k]++;}),{capacity:3});const first=ring.current;ring.next();const changed=ring.next(),final=ring.next();assert.equal(ring.startPosition,1);
    assert.equal(ring.previous(),changed);assert.equal(ring.current.state.result,null);assert.equal(ring.previous().state.grid.values[1],1);assert.equal(ring.canPrevious,false);assert.equal(ring.next(),changed);assert.equal(ring.next(),final);assert.deepEqual(calls,{read:4,close:0});assert.equal(first.state.grid.values[1],1);assert.equal(first.state.result,null);ring.dispose();ring.dispose();assert.equal(calls.close,1);
});
test('grid playback: Player stream Previous/Next and Restart preserve results and reset fresh traces',async()=>{
    for(const capacity of [2,4]){const env=dom(),calls={read:0,close:0},traces=[];const player=new Player(env.container(),{stepSource:()=>steps((k,v)=>{if(k==='trace')traces.push(v);else calls[k]++;}),isTerminal:s=>s.event.type==='done',rewindCapacity:capacity,render:f=>project(f.current)});
        player.start();const initial=player.frame.current;for(let i=0;i<3;i++)player.next();const final=player.frame.current;assert.equal(player.status.phase,'finished');assert.equal(final.result.path.length,4);assert.deepEqual(calls,{read:4,close:1});
        player.previous();assert.equal(player.frame.current.result,null);assert.equal(player.frame.current.grid.values[1],9);player.next();assert.equal(player.frame.current,final);assert.deepEqual(calls,{read:4,close:1});for(let i=0;i<6;i++)player.previous();assert.equal(player.status.rewindStartIndex,4-capacity);assert.equal(player.status.canPrevious,false);
        player.restart();assert.equal(traces.length,2);assert.deepEqual(player.frame.current,initial);assert.notEqual(player.frame.current,initial);assert.deepEqual(player.frame.current.cellMarks,[]);assert.deepEqual(player.frame.current.cellCaptions,[]);assert.equal(player.frame.current.result,null);assert.equal(final.result.path.length,4);
        for(let i=0;i<3;i++)player.next();assert.equal(player.status.phase,'finished');player.dispose();player.dispose();assert.deepEqual(await player.closed,{sources:[],errorCount:0,firstError:null});assert.equal(calls.close,2);assert.equal(env.scheduler.size,0);
    }
});
test('grid playback: state-only history seeking and Restart need no event or renderer cache',async()=>{
    const env=dom();let factories=0;const starts=[];const player=new Player(env.container(),{history(){factories++;const t=createGridTrace(input()),states=commands(t).map(f=>structuredClone(f().state));starts.push(states[0]);return states;},stepDurationMs:100,render:f=>{assert.equal(f.event,undefined);project(f.current)}});
    player.start();player.seek(300);assert.equal(player.frame.current.result.path.length,4);player.seek(100);assert.equal(player.frame.current.grid.values[1],1);assert.equal(player.frame.current.result,null);player.seek(200);assert.equal(player.frame.current.grid.values[1],9);player.previous();assert.equal(player.frame.current.grid.values[1],1);
    player.restart();assert.equal(factories,2);assert.notEqual(starts[0],starts[1]);assert.deepEqual(player.frame.current,starts[0]);assert.equal(player.frame.current.result,null);player.dispose();await player.closed;
});
test('grid playback: Pause freezes progress and Restart/dispose close an unfinished generator once',async()=>{
    const env=dom(),calls={read:0,close:0},player=new Player(env.container(),{stepSource:()=>steps(k=>{if(k in calls)calls[k]++;}),isTerminal:s=>s.event.type==='done',stepDurationMs:100,rewindCapacity:4,render:f=>project(f.current)});
    player.start();player.play();env.scheduler.tick(0);env.scheduler.tick(25);assert.equal(player.frame.progress,.25);const paused=player.frame;player.pause();env.scheduler.tick(1000);assert.equal(player.frame,paused);player.next();assert.equal(player.frame.progress,1);assert.equal(calls.read,2);
    player.restart();assert.equal(calls.close,1);assert.equal(player.frame.stepIndex,0);assert.deepEqual(player.frame.current.cellCaptions,[]);player.dispose();player.dispose();await player.closed;assert.equal(calls.close,2);assert.equal(env.scheduler.size,0);
});
test('grid playback: cloned async state carries path and result without events and cleans up',async()=>{
    const t=createGridTrace(input()),final=commands(t).map(f=>f()).at(-1).state;let closed=0;const source=createAsyncSource(async function*(){try{yield structuredClone(final);}finally{closed++;}});
    const next=await source.next();assert.equal(next.kind,'value');const pair=createSceneProjector(project)(endpoint(next.value));assert.equal(pair.event,undefined);assert.equal(pair.current.objects.at(-1).data.cellIds.length,4);source.dispose();source.dispose();await source.closed;assert.equal(closed,1);
});
