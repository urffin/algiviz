import { createGraphTrace } from '@grundyjs/algiviz/graph';
import { createGraphRenderer } from '@grundyjs/algiviz/canvas/graph';
import { Player } from '@grundyjs/algiviz/player';
import { graphSteps, graphExamples } from '../examples/graph-algorithm.mjs';
import { graphPositions } from '../examples/graph-layout.mjs';
const results=[],ensure=(value,message)=>{if(!value)throw Error(message);};
const equal=(a,b,message)=>ensure(JSON.stringify(a)===JSON.stringify(b),message);
async function check(name,run){const li=document.createElement('li');document.querySelector('#checks').append(li);try{const detail=await run();results.push({name,passed:true,...detail});li.textContent=name+' · PASS';}catch(error){results.push({name,passed:false,error:String(error.stack??error)});li.textContent=name+' · FAIL: '+error.message;}}
function canvas(w,h,ratio=1){const element=document.createElement('canvas');element.width=Math.round(w*ratio);element.height=Math.round(h*ratio);element.style.width=w+'px';element.style.height=h+'px';return {canvas:element,ctx:element.getContext('2d')};}
function capture(ctx,overrides={}){const calls=[];return {calls,proxy:new Proxy(ctx,{get(target,key){if(key in overrides)return overrides[key];const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;return(...args)=>{calls.push({name:key,args});return value.apply(target,args);};},set(target,key,value){return Reflect.set(target,key,value,target);}})};}
const endpoint=state=>({previous:state,current:state,progress:1,stepIndex:0,event:undefined});
const strip=state=>{const {nodeCaptions,...legacy}=state;return legacy;};
const captions=log=>log.filter(c=>c.name==='fillRect').slice(1).map(c=>({x:c.args[0],y:c.args[1],w:c.args[2],h:c.args[3]}));
const pixelData=ctx=>ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height).data;
function audit(frame,w=960,h=480,ratio=1,theme='dark'){
 const visible=canvas(w,h,ratio),base=canvas(w,h,ratio),wrapped=capture(visible.ctx);
 createGraphRenderer({theme}).render(wrapped.proxy,frame,{width:w,height:h});
 createGraphRenderer({theme,nodeCaptions:'hidden'}).render(base.ctx,frame,{width:w,height:h});
 const boxes=captions(wrapped.calls),pixels=pixelData(base.ctx),background=theme==='dark'?[16,24,39]:[248,250,252],sx=base.canvas.width/w,sy=base.canvas.height/h;
 for(const [i,b] of boxes.entries()){
  ensure(b.x>=4-1e-8&&b.y>=4-1e-8&&b.x+b.w<=w-4+1e-8&&b.y+b.h<=h-4+1e-8,'Caption outside viewport');
  for(const c of boxes.slice(i+1))ensure(b.x+b.w+2<=c.x||c.x+c.w+2<=b.x||b.y+b.h+2<=c.y||c.y+c.h+2<=b.y,'Caption reservations collide');
  // Independent raster oracle: the hidden graph must have only background in each reserved area and its near safety margin.
  for(let py=Math.max(0,Math.floor((b.y-1)*sy));py<Math.min(base.canvas.height,Math.ceil((b.y+b.h+1)*sy));py++)for(let px=Math.max(0,Math.floor((b.x-1)*sx));px<Math.min(base.canvas.width,Math.ceil((b.x+b.w+1)*sx));px++){
   const x=(px+.5)/sx,y=(py+.5)/sy;if(x<b.x-1||x>b.x+b.w+1||y<b.y-1||y>b.y+b.h+1)continue;
   const index=(py*base.canvas.width+px)*4;ensure(pixels[index]===background[0]&&pixels[index+1]===background[1]&&pixels[index+2]===background[2]&&pixels[index+3]===255,'Caption intersects rasterized graph obstacle');
  }
 }
 return {...visible,boxes,calls:wrapped.calls};
}
function show(name,view){const section=document.createElement('section'),title=document.createElement('h2');title.textContent=name;section.append(title,view.canvas);document.querySelector('#gallery').append(section);}
await document.fonts.ready;
const main=graphExamples[0],steps=[...graphSteps(main.graph,'A','G',{layout:graphPositions(main.graph,main.id)})],final=endpoint(steps.at(-1).state.visual);
for(const theme of ['dark','light'])for(const ratio of [1,1.25,2])await check('BFS: восемь расстояний, без пересечений · '+theme+' · bitmap '+ratio,()=>{
 const view=audit(final,960,480,ratio,theme);ensure(view.boxes.length===8,'Expected all eight distance captions');
 const text=view.calls.filter(c=>c.name==='fillText'&&String(c.args[0]).startsWith('d = ')).map(c=>c.args[0]);equal(text,['d = 0','d = 1','d = 1','d = 2','d = 2','d = 2','d = 3','d = ∞'],'Wrong text order');
 if(theme==='dark'&&ratio===1)show('BFS: зелёный путь и все восемь расстояний',view);
 return {captions:view.boxes.length,boxes:view.boxes};
});
for(const preset of graphExamples)for(const target of [preset.target,null,preset.start])await check('Пресет '+preset.id+' · цель '+target+' · 390×280 и 960×480',()=>{
 const list=[...graphSteps(preset.graph,preset.start,target,{layout:graphPositions(preset.graph,preset.id)})],counts=[];
 for(const index of [0,Math.min(13,list.length-1),list.length-1])for(const size of [[390,280],[960,480]])counts.push(audit(endpoint(list[index].state.visual),...size).boxes.length);
 return {visibleCounts:counts};
});
const moving=createGraphTrace({nodes:[{id:'A'},{id:'B'},{id:'C'}],edges:[{id:'ab',from:'A',to:'B',directed:true,label:'weight'},{id:'ba',from:'B',to:'A',directed:true},{id:'ab2',from:'A',to:'B'},{id:'loop',from:'A',to:'A',directed:true},{id:'loop2',from:'A',to:'A'},{id:'bc',from:'B',to:'C',weight:3}]},{layout:[{nodeId:'A',x:0,y:0},{nodeId:'B',x:1,y:0},{nodeId:'C',x:1,y:1}],nodeCaptions:[{id:'A',text:'d = 0'},{id:'B',text:'d = 1'},{id:'C',text:'d = 2'}]});
const before=moving.start().state,after=moving.setLayout([{nodeId:'A',x:0,y:1},{nodeId:'B',x:1,y:1},{nodeId:'C',x:0,y:0}]).state;
for(const p of [0,.25,.5,.75,1])await check('Кривые/петли/стрелки/веса и движение p='+p,()=>{const view=audit({previous:before,current:after,progress:p,event:undefined,stepIndex:0},640,400);ensure(view.boxes.length>0,'All stress captions hidden');if(p===.5)show('Петли, параллельные рёбра и подписи: p = 0.5',view);return {captions:view.boxes.length};});
await check('Длинные/пустые подписи и маленький Canvas пропускаются без потери State',()=>{
 for(const text of ['',' \n\t ','X'.repeat(100)]){const state=createGraphTrace({nodes:[{id:'A'}],edges:[]},{nodeCaptions:[{id:'A',text}]}).state;ensure(audit(endpoint(state),160,100).boxes.length===0,'Text should be omitted');ensure(state.nodeCaptions[0].text===text,'Stored text changed');}
 const tiny=canvas(8,8),log=capture(tiny.ctx);createGraphRenderer({theme:'dark'}).render(log.proxy,final,{width:8,height:8});ensure(captions(log.calls).length===0,'Tiny viewport leaked text');
});
await check('Hidden и старый снимок без nodeCaptions дают одинаковые пиксели и не измеряют текст',()=>{
 const a=canvas(960,480),b=canvas(960,480),wrapped=capture(a.ctx);createGraphRenderer({theme:'dark',nodeCaptions:'hidden'}).render(wrapped.proxy,final,{width:960,height:480});
 createGraphRenderer({theme:'dark'}).render(b.ctx,{...final,previous:strip(final.previous),current:strip(final.current)},{width:960,height:480});equal([...pixelData(a.ctx)],[...pixelData(b.ctx)],'Legacy/hidden bitmap mismatch');ensure(!wrapped.calls.some(c=>c.name==='measureText'),'Hidden measured text');
});
await check('Seek/replay и сериализация дают те же пиксели, текст и позиции',()=>{
 const view=canvas(960,480),r=createGraphRenderer({theme:'dark'});r.render(view.ctx,final,{width:960,height:480});const saved=[...pixelData(view.ctx)];
 r.render(view.ctx,endpoint(steps[0].state.visual),{width:960,height:480});r.render(view.ctx,final,{width:960,height:480});equal([...pixelData(view.ctx)],saved,'Visit-order changed bitmap');
 r.render(view.ctx,endpoint(structuredClone(final.current)),{width:960,height:480});equal([...pixelData(view.ctx)],saved,'Clone changed bitmap');
});
const keys=['font','fillStyle','strokeStyle','globalAlpha','globalCompositeOperation','textAlign','textBaseline'];
const state=ctx=>({...Object.fromEntries(keys.map(k=>[k,ctx[k]])),transform:[...ctx.getTransform().toFloat64Array()],dash:ctx.getLineDash()});
await check('measureText throw/NaN: исходная ошибка, без рисования, восстановление и повторный render',()=>{
 const view=canvas(960,480),r=createGraphRenderer({theme:'dark'});view.ctx.font='italic 24px serif';view.ctx.setTransform(2,0,0,2,7,9);const saved=state(view.ctx),primary={};
 for(const measure of [()=>{throw primary;},()=>({width:NaN})]){const wrapped=capture(view.ctx,{measureText:measure});let caught;try{r.render(wrapped.proxy,final,{width:960,height:480});}catch(e){caught=e;}ensure(caught===primary||caught instanceof RangeError,'Error replaced');ensure(!wrapped.calls.some(c=>c.name==='fillRect'),'Pixels written before measure failure');equal(state(view.ctx),saved,'Context state leaked');}
 r.render(view.ctx,final,{width:960,height:480});equal(state(view.ctx),saved,'Successful render leaked context');
 const secondary={},wrapped=capture(view.ctx,{measureText:()=>{throw primary;},restore:()=>{view.ctx.restore();throw secondary;}});let caught;try{r.render(wrapped.proxy,final,{width:960,height:480});}catch(e){caught=e;}ensure(caught===primary,'Restore masked primary measure throw');
});
for(const mode of ['history','generator'])await check('Настоящий Player/Canvas: '+mode+' · ∞/— при перемотке, Pause, Restart и dispose',async()=>{
 const host=document.createElement('div'),view=canvas(960,480),r=createGraphRenderer({theme:'dark'});host.append(view.canvas);document.body.append(host);
 let closes=0;function* source(){try{yield* graphSteps(main.graph,'A','G',{layout:graphPositions(main.graph,main.id)});}finally{closes++;}}
 const options=mode==='history'?{history:()=>steps.map(s=>s.state)}:{stepSource:source,isTerminal:s=>s.event.kind==='finished',rewindCapacity:32,maxStepsPerFrame:16};
 const p=new Player(host,{...options,viewport:view.canvas,autoHide:false,stepDurationMs:650,finalHoldMs:1000,render(frame){r.render(view.ctx,{...frame,previous:frame.previous.visual,current:frame.current.visual},{width:960,height:480});}});
 try{p.start();const text=id=>p.frame.current.visual.nodeCaptions.find(c=>c.id===id).text;ensure(text('H')==='d = —','Initial text wrong');let guard=0;while(p.status.phase!=='finished'&&guard++<100)p.next();ensure(text('H')==='d = ∞','Final text wrong');while(p.frame.stepIndex>=51)p.previous();ensure(text('H')==='d = —','Previous failed');p.next();ensure(text('H')==='d = ∞','Next failed');p.pause();const saved=p.frame;p.pause();ensure(p.frame===saved,'Pause changed frame');p.restart();ensure(text('H')==='d = —'&&p.frame.current.visual.result===null,'Restart leaked answer');p.dispose();p.dispose();await p.closed;if(mode==='generator')ensure(closes===2,'Sources not closed');ensure(host.querySelectorAll('[data-role="controls"]').length===0,'Controls left after disposal');}finally{p.dispose();host.remove();}
});
await check('Недостижимая цель H: пустой result, все восемь расстояний и H infinity',()=>{
 const list=[...graphSteps(main.graph,'A','H',{layout:graphPositions(main.graph,main.id)})],state=list.at(-1).state;
 ensure(state.visual.result.nodeIds.length===0&&state.path.length===0,'Unreachable result changed');ensure(state.visual.nodeCaptions.find(c=>c.id==='H').text==='d = ∞','Unreachable caption wrong');ensure(audit(endpoint(state.visual)).boxes.length===8,'Unreachable captions missing');
});
await check('Текущий текст при p=0, удаление без previous fallback, enter/exit captions',()=>{
 const t=createGraphTrace({nodes:[{id:'A'}],edges:[]},{nodeCaptions:[{id:'A',text:'d = 0'}]}),a=t.start().state,b=t.mark({nodeCaptions:[{id:'A',text:'d = 1'}]}).state,c=t.mark({nodeCaptions:[{id:'A',text:null}]}).state;
 const texts=view=>view.calls.filter(c=>c.name==='fillText'&&String(c.args[0]).startsWith('d = ')).map(c=>c.args[0]);
 equal(texts(audit({previous:a,current:b,progress:0})),['d = 1'],'Current caption did not apply at p=0');equal(texts(audit({previous:b,current:c,progress:0})),[],'Cleared caption came back');
 const empty=createGraphTrace({nodes:[],edges:[]}).state;
 ensure(audit({previous:empty,current:a,progress:0}).boxes.length===0,'Zero-presence enter caption drawn');ensure(audit({previous:empty,current:a,progress:.5}).boxes.length===1,'Enter caption missing');ensure(audit({previous:a,current:empty,progress:.5}).boxes.length===1,'Exit caption missing');ensure(audit({previous:a,current:empty,progress:1}).boxes.length===0,'Exit caption stuck');
});
const report={date:'2026-11-17',checkedAt:new Date().toISOString(),host:{userAgent:navigator.userAgent,devicePixelRatio:window.devicePixelRatio},passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,checks:results,scope:'Real Canvas TextMetrics, independent hidden-bitmap obstacle oracle, actual Player and snapshot source control; bitmap ratios are backing-store sizes, not three browser zoom settings'};
document.querySelector('#status').textContent='Проверки: '+report.passed+'/'+results.length+' · ошибок: '+report.failed;document.querySelector('#report').textContent=JSON.stringify(report,null,2);
