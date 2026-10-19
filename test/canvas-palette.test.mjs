import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createArrayRenderer, createSortRenderer } from '@grundyjs/algiviz/canvas';
const palettes = {
 dark: {background:'#101827',text:'#f1f5f9',bar:'#94a3b8',sorted:'#34d399',active:'#fbbf24',held:'#c4b5fd'},
 light: {background:'#f8fafc',text:'#0f172a',bar:'#475569',sorted:'#047857',active:'#b45309',held:'#7c3aed'},
};
const custom = {background:'#112233',text:'#223344',bar:'#334455',sorted:'#445566',active:'#556677',held:'#667788'};
const items = [1,2,3,4].map((value,i)=>Object.freeze({id:String(i),value}));
const state = Object.freeze({slots:Object.freeze(items),held:null,sortedPrefixLength:1,sortedSuffixLength:1,comparisons:0,writes:0});
const heldState = Object.freeze({...state,slots:Object.freeze([items[0],null,items[2],items[3]]),held:items[1]});
const events = [{type:'start'},{type:'compare',leftId:'1',rightId:'2'},{type:'swap',leftId:'1',rightId:'2',left:1,right:2},{type:'highlight',itemIds:['1']},{type:'select',itemId:'1',from:1}];
const frames = events.map(event=>Object.freeze({previous:state,current:event.type==='select'?heldState:state,event:Object.freeze(event),progress:.5,stepIndex:1}));
function draw(renderer,frame,width=800) {
 const calls=[]; const ctx=new Proxy({canvas:{width,height:500}}, {
  get(o,k){return k in o?o[k]:(...args)=>calls.push([k,...args,k==='fillRect'||k==='fillText'?o.fillStyle:null]);},
  set(o,k,v){o[k]=v;return true;},
 });
 renderer.render(ctx,frame); return calls;
}
const geometry = calls=>calls.map(call=>call.slice(0,-1));
for(const theme of ['dark','light']) test(`${theme}: defaults, overrides, semantic colors and unchanged geometry`,()=>{
 const baseline=createArrayRenderer({theme}); const overridden=createArrayRenderer({theme,colors:Object.freeze({...custom})});
 const before=JSON.stringify(frames);
 for(const frame of frames) for(const width of [800,40]) {
  const a=draw(baseline,frame,width), b=draw(overridden,frame,width);
  assert.deepEqual(geometry(a),geometry(b));
  for(let i=0;i<a.length;i++) {
   const role=Object.keys(palettes[theme]).find(key=>palettes[theme][key]===a[i].at(-1));
   if(role) assert.equal(b[i].at(-1),custom[role]);
  }
  assert.equal(a.find(c=>c[0]==='fillRect').at(-1),palettes[theme].background);
  assert.ok(a.filter(c=>c[0]==='fillText').every(c=>c.at(-1)===palettes[theme].text));
 }
 const colors=new Set(frames.flatMap(f=>draw(baseline,f).map(c=>c.at(-1))));
 for(const color of Object.values(palettes[theme])) assert.ok(colors.has(color),color);
 assert.equal(JSON.stringify(frames),before);
 const input={background:custom.background,active:undefined};
 const copy={...input}; const partial=createArrayRenderer({theme,colors:input});
 assert.deepEqual(input,copy); input.background='#ffffff';
 const partialCalls=draw(partial,frames[1]);
 assert.equal(partialCalls.find(c=>c[0]==='fillRect').at(-1),custom.background);
 assert.ok(partialCalls.some(c=>c.at(-1)===palettes[theme].active));
 assert.deepEqual(draw(baseline,frames[0]),draw(createArrayRenderer({theme}),frames[0]));
 assert.deepEqual(draw(createSortRenderer({theme,colors:custom}),frames[0]),draw(overridden,frames[0]));
});
