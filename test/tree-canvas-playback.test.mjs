import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Player} from '@grundyjs/algiviz/player';
import {createTreeRenderer} from '@grundyjs/algiviz/canvas/tree';
import {createTreeTrace} from '@grundyjs/algiviz/tree';
import {createTimeline} from '@grundyjs/algiviz/playback';
import {dom} from './player-test-dom.mjs';
import {recording} from './tree-canvas-context.mjs';
import {rotation,size} from './tree-canvas-fixtures.mjs';

test('tree Canvas Player: Next, Pause, rewind, terminal green, Restart and idempotent dispose',async()=>{
    for(const mode of ['stream','history']){
        const env=dom(),host=env.container(),renderer=createTreeRenderer({theme:'light',emptySlots:'visible'});
        const canvas=recording(),last=()=>canvas.calls('fill').slice(-3).map(c=>c.state.fillStyle);
        let reads=0,closed=0,runs=0,latest;
        function* source(){runs++;try{const f=rotation(renderer);for(const step of [f.start,f.moved,f.done]){reads++;yield step;}}finally{closed++;}}
        const options=mode==='stream'?{stepSource:source,isTerminal:s=>s.event.type==='done',rewindCapacity:3}
            :{history:()=>[...source()].map(s=>s.state)};
        const player=new Player(host,{...options,stepDurationMs:100,render:frame=>{latest=frame;renderer.render(canvas.ctx,frame,size);}});
        player.start();const initial=player.frame.current;assert.ok(!last().includes('#047857'));
        player.play();env.scheduler.tick(0);env.scheduler.tick(50);assert.equal(latest.progress,.5);
        player.pause();const paused=latest;env.scheduler.tick(900);assert.equal(latest,paused);
        player.next();player.next();assert.equal(player.status.phase,'finished');assert.ok(last().includes('#047857'));
        const done=player.frame.current,readsAtDone=reads;player.previous();assert.equal(player.frame.current.result,null);assert.ok(!last().includes('#047857'));
        player.next();assert.equal(player.frame.current,done);assert.equal(reads,readsAtDone);assert.ok(last().includes('#047857'));
        if(mode==='history'){player.seek(50);assert.equal(player.frame.progress,.5);assert.ok(!last().includes('#047857'));}
        player.restart();assert.equal(runs,2);assert.deepEqual(player.frame.current,initial);assert.notEqual(player.frame.current,initial);assert.ok(!last().includes('#047857'));
        player.dispose();player.dispose();const report=await player.closed;assert.equal(report.errorCount,0);assert.equal(closed,2);
        assert.equal(env.scheduler.size,0);assert.equal(host.children.length,0);
    }
});
test('tree Canvas history: state-only random seeking and unchanged source final result after rewind',()=>{
    const f=rotation(),timeline=createTimeline([f.start,f.moved,f.done],{stepDurationMs:100,finalHoldMs:0}),r=createTreeRenderer({theme:'dark'});
    for(const ms of [200,50,0,150,200,25]){
        const env=recording();r.render(env.ctx,timeline.sample(ms),size);assert.equal(env.stack.length,0);
        assert.equal(env.calls('fill').some(c=>c.state.fillStyle==='#34d399'),ms>=100);
    }
    assert.deepEqual(f.done.state.result,{nodeIds:['B'],linkIds:['pivot']});
});
