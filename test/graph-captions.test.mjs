import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGraphTrace, graphScene } from '@grundyjs/algiviz/graph';
import { createGraphRenderer } from '@grundyjs/algiviz/canvas/graph';
import { recording } from './graph-canvas-context.mjs';
const graph = { nodes: [{ id: 'A' }, { id: 'B' }, { id: '__proto__' }], edges: [{ id: 'A', from: 'A', to: 'B', directed: true, label: 'edge' }] };
const layout = [{ nodeId:'A',x:0,y:0 },{nodeId:'B',x:1,y:1},{nodeId:'__proto__',x:2,y:0}];
const trace = options => createGraphTrace(graph,{ layout,...options });
const endpoint = state => ({ previous:state,current:state,progress:1,stepIndex:0,event:undefined });
const poison = key => Object.defineProperty({},key,{get(){assert.fail('Getter called');}});
function draw(state, options={}, context=recording(640,400)) {createGraphRenderer({theme:'dark',...options}).render(context.ctx,endpoint(state),{width:640,height:400});return context;}
const captions = env => env.calls('fillText').filter(c=>String(c.args[0]).startsWith('d = '));

test('graph captions: initial capture, patch order, null/empty/no-op, layout/done preservation and retained snapshots',()=>{
 const input=[{id:'B',text:'d = 1'},{id:'A',text:'d = 0'}],t=trace({nodeCaptions:input}),first=t.start();
 assert.deepEqual(first.state.nodeCaptions,[input[1],input[0]]);input[0].text='changed';input.length=0;
 const marked=t.mark({nodes:[{id:'A',role:'active'}],edges:[{id:'A',role:'queued'}],nodeCaptions:[{id:'__proto__',text:''},{id:'B',text:'d = 2'}]});
 assert.deepEqual(marked.state.nodeCaptions.map(c=>c.id),['A','B','__proto__']);assert.deepEqual(marked.event.nodeCaptions.map(c=>c.id),['__proto__','B']);
 assert.equal(first.state.nodeCaptions[1].text,'d = 1');assert.ok(Object.isFrozen(marked.state.nodeCaptions));assert.ok(marked.state.nodeCaptions.every(Object.isFrozen));
 const clear=t.mark({nodeCaptions:[{id:'A',text:null}]}),noop=t.mark({nodeCaptions:[]});assert.deepEqual(noop.state,clear.state);assert.deepEqual(noop.event.nodeCaptions,[]);
 assert.equal(noop.index,clear.index+1);t.setLayout(layout);const done=t.done({result:{nodeIds:['B']}});
 assert.deepEqual(done.state.nodeCaptions,clear.state.nodeCaptions);assert.equal(first.state.nodeCaptions[0].text,'d = 0');assert.equal(done.state.graph,first.state.graph);
 assert.throws(()=>t.mark({nodeCaptions:[{id:'B',text:'late'}]}),Error);
});

test('graph captions: validation errors are atomic and obey node/edge/caption order without accessors/coercion',()=>{
 const invalid=[[null,TypeError],[{},TypeError],[new Array(1),TypeError],[[{}],TypeError],[[{id:'A',text:undefined}],TypeError],[[{id:'A',text:1}],TypeError],[[{id:'',text:'x'}],TypeError],[[{id:'missing',text:'x'}],RangeError],[[{id:'A',text:'x'},{id:'A',text:'x'}],RangeError],[[{id:'A',...poison('text')}],TypeError]];
 // Non-enumerable accessor is tested directly, without spreading it away.
 invalid.push([[Object.assign(poison('text'),{id:'A'})],TypeError]);
 for(const [value,Type] of invalid){const t=trace();t.start();const before=t.state;assert.throws(()=>t.mark({nodes:[{id:'A',role:'active'}],edges:[{id:'A',role:'visited'}],nodeCaptions:value}),Type);assert.equal(t.state,before);assert.equal(t.mark({}).index,1);}
 assert.throws(()=>trace({nodeCaptions:[{id:'A',text:null}]}),TypeError);
 assert.throws(()=>trace({layout:[{nodeId:'missing',x:0,y:0}],nodeCaptions:null}),RangeError);
 const t=trace();t.start();assert.throws(()=>t.mark({nodes:[{id:'missing',role:'x'}],nodeCaptions:null}),RangeError);
 assert.throws(()=>t.mark({edges:[{id:'missing',role:'x'}],nodeCaptions:null}),RangeError);
 const trap={};const source=new Proxy({},{getPrototypeOf(){throw trap;}});assert.throws(()=>t.mark({nodeCaptions:[source]}),error=>error===trap);
 let reentry=false;const proxy=new Proxy({id:'A',text:'x'},{getPrototypeOf(target){assert.throws(()=>t.mark({}),Error);reentry=true;return Reflect.getPrototypeOf(target);}});
 t.mark({nodeCaptions:[proxy]});assert.ok(reentry);t.done();assert.throws(()=>t.mark(new Proxy({},{getPrototypeOf(){assert.fail('Lifecycle must win');}})),Error);
});

test('graph captions: scene canonicalization, legacy missing/undefined fields and independent identity/result',()=>{
 const t=trace({nodeCaptions:[{id:'A',text:'d = 0'},{id:'B',text:''}]});t.start();t.done({result:{nodeIds:['A']}});
 const scene=graphScene(t.state,{namespace:'main'}),a=scene.objects.find(o=>o.type==='graphNode'&&o.data.node.id==='A');
 assert.equal(a.data.caption,'d = 0');assert.equal(a.data.result,true);assert.equal(a.data.node.label,undefined);assert.equal(scene.objects.length,4);
 const {nodeCaptions,...legacy}=t.state;assert.ok(graphScene(legacy,{namespace:'main'}).objects.filter(o=>o.type==='graphNode').every(o=>o.data.caption===undefined));
 graphScene({...legacy,nodeCaptions:undefined},{namespace:'main'});
 for(const value of [null,[{id:'A',text:null}],[{id:'B',text:'b'},{id:'A',text:'a'}],[{id:'A',text:'x'},{id:'A',text:'x'}]])assert.throws(()=>graphScene({...legacy,nodeCaptions:value},{namespace:'main'}));
 const marked=t.state.nodeMarks;assert.deepEqual(marked,[]);assert.equal(nodeCaptions[0].text,'d = 0');
});

test('graph captions Canvas: measured boxes preserve base geometry, theme colors, state and deterministic replay/DPR',()=>{
 const t=trace({nodeCaptions:[{id:'A',text:'d = 0'},{id:'B',text:'d = 1'},{id:'__proto__',text:'d = ∞'}]}),old=t.start().state;
 const done=t.done({result:{nodeIds:['A'],edgeIds:['A']}}).state;
 for(const theme of ['light','dark']){const r=createGraphRenderer({theme}),logs=[];
  for(const ratio of [1,1.25,2]){const env=recording(640*ratio,400*ratio),initial=structuredClone(env.state);r.render(env.ctx,endpoint(done),{width:640,height:400});assert.deepEqual(env.state,initial);assert.equal(env.stack.length,0);assert.equal(captions(env).length,3);logs.push(env.calls('fillText').map(c=>c.args));}
  assert.deepEqual(logs[1],logs[0]);assert.deepEqual(logs[2],logs[0]);
 }
 const visible=draw(done),hidden=draw(done,{nodeCaptions:'hidden'});assert.deepEqual(visible.calls('arc').map(c=>c.args),hidden.calls('arc').map(c=>c.args));assert.deepEqual(visible.calls('bezierCurveTo').map(c=>c.args),hidden.calls('bezierCurveTo').map(c=>c.args));assert.equal(hidden.calls('measureText').length,0);assert.equal(captions(hidden).length,0);
 const r=createGraphRenderer({theme:'dark'});for(const state of [old,done,old,done]){const env=recording();r.render(env.ctx,endpoint(state),{width:640,height:400});assert.deepEqual(captions(env).map(c=>c.args),captions(draw(state)).map(c=>c.args));}
});

test('graph captions Canvas: current text at p=0, clear without old fallback, enter/exit presence and input-order priority',()=>{
 const t=trace({nodeCaptions:[{id:'A',text:'d = 0'}]}),a=t.start().state,b=t.mark({nodeCaptions:[{id:'A',text:'d = 1'}]}).state,c=t.mark({nodeCaptions:[{id:'A',text:null}]}).state;
 const r=createGraphRenderer({theme:'dark'});
 for(const [before,after,expected] of [[a,b,['d = 1']],[b,c,[]]]){const env=recording();const f={previous:before,current:after,progress:0};Object.defineProperty(f,'event',{get(){assert.fail('Event read');}});r.render(env.ctx,f,{width:640,height:400});assert.deepEqual(captions(env).map(c=>c.args[0]),expected);}
 const empty=createGraphTrace({nodes:[],edges:[]}).state;
 for(const [previous,current,p,expected] of [[empty,a,0,0],[empty,a,.5,1],[a,empty,.5,1],[a,empty,1,0]]){const env=recording();r.render(env.ctx,{previous,current,progress:p},{width:640,height:400});assert.equal(captions(env).length,expected);}
 const same=createGraphTrace({nodes:[{id:'A'},{id:'B'}],edges:[]},{layout:[{nodeId:'A',x:0,y:0},{nodeId:'B',x:0,y:0}],nodeCaptions:[{id:'A',text:'d = A'},{id:'B',text:'d = B'}]});same.start();same.done({result:{nodeIds:['B']}});assert.deepEqual(captions(draw(same.state)).map(c=>c.args[0]),['d = A','d = B']);
});

test('graph captions Canvas: normalization, blank/long/tiny suppression and hidden still validates snapshots',()=>{
 for(const text of ['', ' \t\n ', 'x'.repeat(50)]){const t=trace({nodeCaptions:[{id:'A',text}]});assert.equal(captions(draw(t.state)).length,0);assert.equal(t.state.nodeCaptions[0].text,text);}
 const t=trace({nodeCaptions:[{id:'A',text:'d\t\n=\u2028 0'}]});assert.equal(captions(draw(t.state))[0].args[0],'d =  0');
 const small=recording(8,8);createGraphRenderer({theme:'dark'}).render(small.ctx,endpoint(t.state),{width:8,height:8});assert.equal(captions(small).length,0);
 for(const value of ['always',null,1,()=>{}])assert.throws(()=>createGraphRenderer({theme:'dark',nodeCaptions:value}),TypeError);
 const invalid={...t.state,nodeCaptions:[{id:'A',text:null}]},env=recording();assert.throws(()=>draw(invalid,{nodeCaptions:'hidden'},env),TypeError);assert.equal(env.commands.length,0);
 const zero=recording(0,0);createGraphRenderer({theme:'dark'}).render(zero.ctx,endpoint(t.state),{width:0,height:0});assert.equal(zero.commands.length,0);
});

test('graph captions Canvas: missing ink bounds suppress text; invalid metrics/host failures occur before pixels and restore context',()=>{
 const t=trace({nodeCaptions:[{id:'A',text:'d = 0'}]}),r=createGraphRenderer({theme:'dark'});
 function host(measure,restore){const env=recording(),proxy=new Proxy(env.ctx,{get(target,key){if(key==='measureText')return measure;if(key==='restore'&&restore)return restore;return target[key];},set(target,key,value){target[key]=value;return true;}});return {...env,proxy};}
 for(const metrics of [{width:30},{width:NaN},{width:30,actualBoundingBoxLeft:Infinity}]){
  const env=host(()=>metrics),before=structuredClone(env.state);
  if(!Number.isFinite(metrics.width)||metrics.actualBoundingBoxLeft===Infinity){assert.throws(()=>r.render(env.proxy,endpoint(t.state),{width:640,height:400}),RangeError);assert.equal(env.calls('fillRect').length,0);}else{r.render(env.proxy,endpoint(t.state),{width:640,height:400});assert.equal(captions(env).length,0);}
  assert.deepEqual(env.state,before);assert.equal(env.stack.length,0);
 }
 const primary={},env=host(()=>{throw primary;}),before=structuredClone(env.state);assert.throws(()=>r.render(env.proxy,endpoint(t.state),{width:640,height:400}),e=>e===primary);assert.deepEqual(env.state,before);assert.equal(env.calls('fillRect').length,0);
 const failing=host(()=>{throw primary;},()=>{throw Error('restore');});assert.throws(()=>r.render(failing.proxy,endpoint(t.state),{width:640,height:400}),e=>e===primary);
 let nested=false;const recursive=host(text=>{assert.throws(()=>r.render(recursive.proxy,endpoint(t.state),{width:640,height:400}),Error);nested=true;return {width:6,actualBoundingBoxLeft:3,actualBoundingBoxRight:3,actualBoundingBoxAscent:6,actualBoundingBoxDescent:6};});r.render(recursive.proxy,endpoint(t.state),{width:640,height:400});assert.ok(nested);assert.ok(captions(draw(t.state)).length);
});
