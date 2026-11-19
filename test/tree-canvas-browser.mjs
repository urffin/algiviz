import {createTreeRenderer} from '@grundyjs/algiviz/canvas/tree';
import {createTreeTrace} from '@grundyjs/algiviz/tree';
import {createCanvasViewport} from '@grundyjs/algiviz/canvas/viewport';
import {Player} from '@grundyjs/algiviz/player';
import {states,rotation,endpoint,fixture} from './tree-canvas-fixtures.mjs';
import {slotBoundsFixture} from './tree-slot-fixtures.mjs';
import {slotBoundsIssues} from './tree-slot-oracle.mjs';
const checks=[],details=[],gallery=document.querySelector('#gallery');
const slotBounds=[];
const ensure=(condition,message)=>{if(!condition)throw Error(message);};
const equal=(a,b,message)=>ensure(JSON.stringify(a)===JSON.stringify(b),message);
async function check(name,fn){const item=document.createElement('li');document.querySelector('#checks').append(item);item.textContent=name;
    try{await fn();checks.push({name,passed:true});item.textContent+=' · PASS';}
    catch(error){checks.push({name,passed:false,error:String(error.stack??error)});item.textContent+=' · FAIL: '+error;}}
function view(title,width=640,height=400,ratio=1,visible=true){const canvas=document.createElement('canvas');canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    canvas.style.width=width+'px';if(visible){const section=document.createElement('section'),h=document.createElement('h2');h.textContent=title;section.append(h,canvas);gallery.append(section);}
    return {canvas,ctx:canvas.getContext('2d'),size:{width,height}};}
function instrument(context,overrides={}){const calls=[];return {calls,ctx:new Proxy(context,{
    get(target,key){if(key in overrides)return overrides[key];const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;
        return(...args)=>{const result=value.apply(target,args);calls.push({name:key,args,alpha:target.globalAlpha,lineWidth:target.lineWidth,fill:target.fillStyle,stroke:target.strokeStyle});return result;};},
    set(target,key,value){return Reflect.set(target,key,value,target);}})};}
const pixels=ctx=>ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height).data;
function green(ctx,theme='light'){const rgb=theme==='dark'?[52,211,153]:[4,120,87],p=pixels(ctx);let n=0;for(let i=0;i<p.length;i+=4)if(rgb.every((v,k)=>p[i+k]===v)&&p[i+3]===255)n++;return n;}
const styleKeys=['globalAlpha','globalCompositeOperation','filter','shadowColor','shadowBlur','shadowOffsetX','shadowOffsetY','fillStyle','strokeStyle','lineWidth','lineDashOffset','lineCap','lineJoin','miterLimit','font','textAlign','textBaseline','direction','fontKerning','fontStretch','fontVariantCaps','letterSpacing','wordSpacing','textRendering'];
const contextState=ctx=>({...Object.fromEntries(styleKeys.filter(k=>k in ctx).map(k=>[k,ctx[k]])),dash:ctx.getLineDash(),transform:[...ctx.getTransform().toFloat64Array()]});
function dirty(ctx){ctx.setTransform(2,.2,.1,1.5,7,9);ctx.globalAlpha=.2;ctx.globalCompositeOperation='xor';ctx.filter='blur(3px)';ctx.shadowColor='red';ctx.shadowBlur=6;ctx.setLineDash([7,3]);ctx.font='italic 22px serif';ctx.direction='rtl';if('letterSpacing'in ctx)ctx.letterSpacing='4px';}

/** Independent raster oracle: expand native obstacle strokes/shapes by the safety gap.
 * No renderer geometry, reservations or subdivision routines are imported. */
function obstacleOracle(log,size){
    const mask=view('',Math.ceil(size.width),Math.ceil(size.height),1,false),ctx=mask.ctx;
    const arcs=log.filter(c=>c.name==='arc'),primary=log.filter(c=>c.name==='fillText'&&c.args.length===4);
    const boxes=log.filter(c=>c.name==='fillRect').slice(1),slotRects=log.filter(c=>c.name==='strokeRect');
    ctx.fillStyle='black';ctx.strokeStyle='black';ctx.lineCap='round';ctx.lineJoin='round';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    if('fontKerning'in ctx)ctx.fontKerning='none';
    for(const c of arcs){ctx.beginPath();ctx.arc(c.args[0],c.args[1],c.args[2]+1.9,0,Math.PI*2);ctx.fill();}
    for(const c of primary){const [text,x,y]=c.args,m=ctx.measureText(text),l=Math.min(-m.width/2,-m.actualBoundingBoxLeft),r=Math.max(m.width/2,m.actualBoundingBoxRight);
        const t=Math.min(-8,-m.actualBoundingBoxAscent),b=Math.max(8,m.actualBoundingBoxDescent);ctx.fillRect(x+l-1.9,y+t-1.9,r-l+3.8,b-t+3.8);}
    let path=[];
    for(const c of log){
        if(c.name==='beginPath')path=[];
        else if(['moveTo','lineTo','bezierCurveTo'].includes(c.name))path.push(c);
        else if(c.name==='stroke'&&path.some(p=>p.name==='bezierCurveTo'||p.name==='lineTo')){
            ctx.beginPath();for(const p of path)ctx[p.name](...p.args);ctx.lineWidth=c.lineWidth+3.8;ctx.stroke();
        }
    }
    for(const c of slotRects){const [x,y,w,h]=c.args;ctx.lineWidth=c.lineWidth+3.8;ctx.strokeRect(x,y,w,h);}
    function occupied([x,y,w,h]){const x0=Math.max(0,Math.ceil(x+.2)),y0=Math.max(0,Math.ceil(y+.2)),x1=Math.min(mask.canvas.width,Math.floor(x+w-.2)),y1=Math.min(mask.canvas.height,Math.floor(y+h-.2));
        if(x1<=x0||y1<=y0)return false;const p=ctx.getImageData(x0,y0,x1-x0,y1-y0).data;for(let i=3;i<p.length;i+=4)if(p[i]>80)return true;return false;}
    for(const [i,c]of boxes.entries()){
        const [x,y,w,h]=c.args;ensure(x>=4&&y>=4&&x+w<=size.width-4&&y+h<=size.height-4,'Optional box outside viewport');
        ensure(!occupied(c.args),'Optional text overlaps independent raster obstacles, box '+i);
        ctx.fillRect(x-1.9,y-1.9,w+3.8,h+3.8);
    }
    return {boxes:boxes.length,slots:slotRects.length};
}

for(const kind of ['ordered','binary'])for(const theme of ['light','dark'])for(const [width,height]of [[960,480],[390,280]])for(const ratio of [1,1.25,2]){
    await check(`${kind} · ${theme} · ${width}×${height} · bitmap ${ratio}`,()=>{
        const show=ratio===1,canvas=view(`${kind}, ${theme}, ${width}×${height}`,width,height,ratio,show),r=createTreeRenderer({theme,emptySlots:'visible'}),s=states(kind),host=instrument(canvas.ctx);
        dirty(canvas.ctx);const saved=contextState(canvas.ctx);r.render(host.ctx,endpoint(s.done),canvas.size);
        equal(contextState(canvas.ctx),saved,'Context state leaked');ensure(green(canvas.ctx,theme)>450*ratio*ratio,'Green result pixels missing');
        const transforms=host.calls.find(c=>c.name==='setTransform').args;equal(transforms,[canvas.canvas.width/width,0,0,canvas.canvas.height/height,0,0],'Bitmap ratio ignored');
        const text=host.calls.filter(c=>c.name==='fillText').map(c=>c.args[0]);for(const caption of ['root','d=2','end'])ensure(text.includes(caption),'Caption omitted: '+caption);
        ensure(text.includes('L'),'Short link label omitted');
        const oracle=obstacleOracle(host.calls,canvas.size);if(kind==='binary')ensure(oracle.slots>0,'All empty markers omitted');else ensure(oracle.slots===0,'Ordered ghosts');
        details.push({kind,theme,width,height,ratio,...oracle,greenPixels:green(canvas.ctx,theme)});
    });
}
await check('Rotation p=0/0.5/1: attached old/new parents, raw interpolation and branch alphas',()=>{
    const v=view('Поворот: два прикреплённых маршрута в середине перехода'),r=createTreeRenderer({theme:'light',emptySlots:'visible'}),f=rotation(r),logs=[];
    for(const p of [0,.5,1]){const host=instrument(v.ctx);r.render(host.ctx,f.frame(p),v.size);logs.push(host.calls);}
    const arcs=logs.map(log=>log.filter(c=>c.name==='arc').map(c=>c.args));for(let n=0;n<3;n++)for(let axis=0;axis<2;axis++)ensure(Math.abs(arcs[1][n][axis]-(arcs[0][n][axis]+arcs[2][n][axis])/2)<1e-8,'Nonlinear interpolation');
    const middle=logs[1],curves=middle.filter(c=>c.name==='bezierCurveTo'),moves=middle.filter(c=>c.name==='moveTo').slice(0,4);
    ensure(curves.length===4&&curves.every(c=>c.alpha===.5),'Crossfade branches missing');
    for(const [i,[from,to]]of [[0,1],[1,0],[1,2],[0,2]].entries()){
        ensure(Math.abs(Math.hypot(moves[i].args[0]-arcs[1][from][0],moves[i].args[1]-arcs[1][from][1])-16)<1e-8,'Detached parent');
        ensure(Math.abs(Math.hypot(curves[i].args[4]-arcs[1][to][0],curves[i].args[5]-arcs[1][to][1])-16)<1e-8,'Detached child');}
    r.render(v.ctx,f.frame(.5),v.size);
});
await check('Tiny/overlapping layouts safely omit optional captions and slots',()=>{
    for(const kind of ['ordered','binary']){
        const v=view(`${kind}: 160×100`,160,100),r=createTreeRenderer({theme:'light',emptySlots:'visible'});r.render(v.ctx,endpoint(states(kind).done),v.size);
        const s=structuredClone(states(kind).start);s.layout=s.layout.map(p=>({...p,x:0,y:0}));const host=instrument(v.ctx);r.render(host.ctx,endpoint(s),v.size);
        obstacleOracle(host.calls,v.size);ensure(host.calls.filter(c=>c.name==='arc').length===7,'Primary nodes disappeared');
    }
});
await check('Native host failures restore context, preserve falsy primary errors, and allow redraw',()=>{
    const v=view('Контекст после исключения и сброса bitmap'),r=createTreeRenderer({theme:'light'}),f=endpoint(states().done);dirty(v.ctx);const saved=contextState(v.ctx);
    const wrapped=instrument(v.ctx,{stroke(){throw null;}});let caught=false;
    try{r.render(wrapped.ctx,f,v.size);}catch(error){caught=true;ensure(error===null,'Falsy primary replaced');}ensure(caught,'Host throw not propagated');equal(contextState(v.ctx),saved,'State leaked after host failure');
    r.render(v.ctx,f,v.size);ensure(green(v.ctx)>450,'Recovery lost result');v.canvas.width=v.canvas.width;r.render(v.ctx,f,v.size);ensure(green(v.ctx)>450,'Bitmap/context reset recovery failed');
});
await check('Custom gaps: omit a stub that would turn inward through its parent',()=>{
    const input={kind:'binary',rootId:'R',nodes:[{id:'R',label:''},{id:'B',label:''}],links:[{id:'l',parentId:'R',childId:'B',slot:'right'}]};
    const t=createTreeTrace(input,{layout:[{nodeId:'R',x:0,y:0},{nodeId:'B',x:0,y:27}]});
    const v=view('Custom gaps: безопасный пропуск слотов'),r=createTreeRenderer({theme:'light',horizontalGap:.001,emptySlots:'visible'}),host=instrument(v.ctx);
    r.render(host.ctx,endpoint(t.state),v.size);ensure(host.calls.filter(c=>c.name==='strokeRect').length===0,'Inward slot stub painted');
});
await check('Transparent background clears old result and matches a clean native canvas',()=>{
    const v=view('Прозрачный фон: перемотка снимает зелёный результат'),clean=view('',640,400,1,false),r=createTreeRenderer({theme:'light',colors:{background:'transparent'}}),f=states();
    r.render(v.ctx,endpoint(f.done),v.size);ensure(green(v.ctx)>450,'Missing result');r.render(v.ctx,endpoint(f.start),v.size);r.render(clean.ctx,endpoint(f.start),clean.size);
    ensure(green(v.ctx)===0,'Stale final pixels');equal([...pixels(v.ctx)],[...pixels(clean.ctx)],'Transparent repaint depends on old bitmap');
});
await check('Player stream/history: Pause, Next, rewind, Restart, resize/DPR and dispose cleanup',async()=>{
    for(const mode of ['stream','history']){
        const host=document.createElement('section');gallery.append(host);const v=view(`${mode}: Player с зелёным результатом`,480,300);host.append(v.canvas);
        const r=createTreeRenderer({theme:'light',emptySlots:'visible'});let player,viewport,reads=0,closes=0,runs=0,draws=0;
        const draw=frame=>{const size=viewport.resize(w=>w*.625);if(size){r.render(v.ctx,frame,size);draws++;}};
        viewport=createCanvasViewport(v.canvas,{onResize(){if(player?.frame)draw(player.frame);}});
        function* source(){runs++;try{const f=rotation(r);for(const step of [f.start,f.moved,f.done]){reads++;yield step;}}finally{closes++;}}
        const options=mode==='stream'?{stepSource:source,isTerminal:s=>s.event.type==='done',rewindCapacity:3}:{history:()=>[...source()].map(s=>s.state)};
        player=new Player(host,{...options,viewport:v.canvas,stepDurationMs:1000,render:draw});player.start();player.play();await new Promise(requestAnimationFrame);player.pause();
        const paused=player.frame;await new Promise(requestAnimationFrame);ensure(player.frame===paused,'Pause advanced frame');player.next();player.next();ensure(player.status.phase==='finished'&&green(v.ctx)>450,'Terminal result');
        const finalReads=reads;player.previous();ensure(green(v.ctx)===0,'Rewind retained result');player.next();ensure(green(v.ctx)>450&&reads===finalReads,'Replay reread source');
        v.canvas.style.width='390px';for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);
        ensure(v.canvas.width===Math.round(390*devicePixelRatio),'Viewport DPR mismatch');ensure(green(v.ctx)>450,'Resize lost result');ensure(reads===finalReads,'Resize read source');
        player.restart();ensure(green(v.ctx)===0&&runs===2,'Restart retained result');player.dispose();player.dispose();const report=await player.closed;viewport.dispose();ensure(closes===2&&report.errorCount===0,'Dispose cleanup');
        const before=draws;v.canvas.style.width='350px';await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);ensure(draws===before,'Disposed callbacks');
    }
});
function slotGeometry(calls){return{
    squares:calls.filter(c=>c.name==='strokeRect').map(c=>({x:c.args[0],y:c.args[1],width:c.args[2],height:c.args[3],lineWidth:c.lineWidth})),
    circles:calls.filter(c=>c.name==='arc').map(c=>({x:c.args[0],y:c.args[1],radius:c.args[2]})),
    boxes:calls.filter(c=>c.name==='fillRect').slice(1).map(c=>({x:c.args[0],y:c.args[1],width:c.args[2],height:c.args[3]}))};}
await check('T1: painted 4px viewport margin, omission and positive marker control at bitmap 1/1.25/2',()=>{
    for(const ratio of [1,1.25,2])for(const name of ['viewport','viewport-safe']){
        const f=slotBoundsFixture(name),v=view(`T1 ${name} · bitmap ${ratio}`,f.size.width,f.size.height,ratio,ratio===1),host=instrument(v.ctx);
        createTreeRenderer(f.options).render(host.ctx,endpoint(f.state),f.size);const geometry=slotGeometry(host.calls);
        equal(slotBoundsIssues(geometry,f.size),[],'Painted viewport margin violated');
        ensure(geometry.squares.length===(name==='viewport'?0:2),'Unsafe omission/positive control failed');
        const data=pixels(v.ctx);let markerPixels=0;for(let i=0;i<data.length;i+=4)if(data[i]===148&&data[i+1]===163&&data[i+2]===184&&data[i+3]===255)markerPixels++;
        ensure(name==='viewport'?markerPixels===0:markerPixels>0,'Native slot raster disagrees with marker control');
        slotBounds.push({name,ratio,squares:geometry.squares.length,markerPixels});
    }
});
await check('T1: full painted squares keep 2px from nodes, captions and other slots at bitmap 1/1.25/2',()=>{
    for(const ratio of [1,1.25,2])for(const name of ['node','caption','slot']){
        const f=slotBoundsFixture(name),v=view(`T1 ${name} · bitmap ${ratio}`,f.size.width,f.size.height,ratio,ratio===1),host=instrument(v.ctx);
        createTreeRenderer(f.options).render(host.ctx,endpoint(f.state),f.size);const geometry=slotGeometry(host.calls);
        ensure(geometry.squares.length>0&&geometry.circles.length===3,'Safe slot/node control missing');
        equal(slotBoundsIssues(geometry,f.size),[],'Painted reservation gap violated');
        slotBounds.push({name,ratio,squares:geometry.squares.length,captionBoxes:geometry.boxes.length});
    }
});
const report={date:new Date().toISOString(),host:{userAgent:navigator.userAgent,devicePixelRatio},checks,details,slotBounds,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length};
document.querySelector('#status').textContent=`Завершено: ${report.passed}/${checks.length}, ошибок ${report.failed}`;
document.querySelector('#report').textContent=JSON.stringify(report,null,2);
await fetch('/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});
