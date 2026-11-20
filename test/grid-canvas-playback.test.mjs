import assert from 'node:assert/strict';import {test} from 'node:test';
import {Player} from '@grundyjs/algiviz/player';import {createGridRenderer} from '@grundyjs/algiviz/canvas/grid';
import {createTimeline} from '@grundyjs/algiviz/playback';import {dom} from './player-test-dom.mjs';
import {recording} from './tree-canvas-context.mjs';import {states,size,presentCell} from './grid-canvas-fixtures.mjs';
test('grid Canvas Player: stream/history Pause, Next, rewind, Restart and dispose restore pixels from snapshots',async()=>{
    for(const mode of ['stream','history']){const env=dom(),canvas=recording(),r=createGridRenderer({theme:'light',presentCell});let reads=0,closed=0,runs=0,last;
        function* source(){runs++;try{const f=states();for(const s of [f.start,f.changed,f.done]){reads++;yield s}}finally{closed++}}
        const options=mode==='stream'?{stepSource:source,isTerminal:s=>s.event.type==='done',rewindCapacity:3}:{history:()=>[...source()].map(s=>s.state)};
        const player=new Player(env.container(),{...options,stepDurationMs:100,render:frame=>{canvas.commands.length=0;last=frame;r.render(canvas.ctx,frame,size)}}),green=()=>canvas.calls('fillRect').some(c=>c.state.fillStyle==='#047857');
        player.start();const initial=player.frame.current;assert.equal(green(),false);player.play();env.scheduler.tick(0);env.scheduler.tick(50);assert.equal(last.progress,.5);player.pause();const paused=last;env.scheduler.tick(1000);assert.equal(last,paused);
        for(let i=0;i<4&&player.status.phase!=='finished';i++)player.next();assert.equal(player.status.phase,'finished');assert.ok(green());const final=player.frame.current,finalReads=reads;
        player.previous();assert.equal(player.frame.current.result,null);assert.equal(green(),false);player.next();assert.equal(player.frame.current,final);assert.ok(green());assert.equal(reads,finalReads);
        if(mode==='history'){player.seek(150);assert.equal(player.frame.progress,.5);const core=canvas.calls('stroke').filter(c=>c.state.strokeStyle==='#1d4ed8');assert.deepEqual(core.map(c=>c.state.globalAlpha),[.5])}
        player.restart();assert.equal(runs,2);assert.deepEqual(player.frame.current,initial);assert.notEqual(player.frame.current,initial);assert.equal(green(),false);player.dispose();player.dispose();assert.equal((await player.closed).errorCount,0);assert.equal(closed,2);assert.equal(env.scheduler.size,0);
    }
});
test('grid Canvas timeline: state-only cloned endpoints render direct seeks without retained plans',()=>{
    const f=states(),timeline=createTimeline([f.start,f.changed,f.done],{stepDurationMs:100,finalHoldMs:0}),r=createGridRenderer({theme:'dark',presentCell}),canvas=recording();
    for(const time of [200,0,150,100,200]){const frame=structuredClone(timeline.sample(time));frame.event=undefined;canvas.commands.length=0;r.render(canvas.ctx,frame,size);assert.equal(canvas.calls('fillRect').some(c=>c.state.fillStyle==='#34d399'),time>100);}
});
