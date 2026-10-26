import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPlayer,createTimeline} from '@grundyjs/algiviz/playback';
import {pipelineSteps,tokenRenderer} from '../examples/visualization-pipeline.mjs';
test('explanation uses actual matched token states and interpolation, with seek/generator parity',()=>{
 const steps=[...pipelineSteps()];
 assert.equal(steps.length,10);
 assert.deepEqual(steps.slice(0,5).map(s=>s.state.stage),[0,1,2,3,4]);
 assert.deepEqual(steps.slice(5).map(s=>s.state.x),[60,70,80,90,100]);
 for(const step of steps){
  assert.ok(Object.isFrozen(step.state));
  assert.equal(step.state.transition.phase,'update');
  assert.equal(step.state.transition.id,'token-1');
  let x;tokenRenderer.render(value=>{x=value;},step.state.projected);
  assert.equal(x,step.state.x);
 }
 const timing={stepDurationMs:650,finalHoldMs:1000};
 const timeline=createTimeline(steps,timing);
 const player=createPlayer(pipelineSteps(),{...timing,isTerminal:s=>s.event==='done'});
 for(let time=0;time<timeline.durationMs;time+=125){assert.deepEqual(player.frame,timeline.sample(time));player.advance(125);}
 player.dispose();
 assert.equal(timeline.sample(0).current.stage,0);
 const early=pipelineSteps();early.next();assert.equal(early.return().done,true);
});
