import { createGraphTrace } from '@grundyjs/algiviz/graph';
import { createGraphRenderer } from '@grundyjs/algiviz/canvas/graph';
import { createCanvasViewport } from '@grundyjs/algiviz/canvas/viewport';
import { Player } from '@grundyjs/algiviz/player';
import { graphFrames, size } from './graph-canvas-fixtures.mjs';
import { graphTopologySteps } from './graph-topology-fixture.mjs';

const results = [], gallery = document.querySelector('#gallery'), f = graphFrames();
const ensure = (condition, message) => { if (!condition) throw Error(message); };
const equal = (a, b, message) => ensure(JSON.stringify(a) === JSON.stringify(b), message);
async function check(name, fn) {
    const item = document.createElement('li'); item.textContent = name; document.querySelector('#checks').append(item);
    try { await fn(); item.textContent += ' · PASS'; results.push({ name, passed: true }); }
    catch (error) { item.textContent += ' · FAIL: ' + error.message; results.push({ name, passed: false, error: String(error.stack ?? error) }); }
}
function canvas(title, width = 640, height = 400, ratio = 1) {
    const section = document.createElement('section'), label = document.createElement('h2'), canvas = document.createElement('canvas');
    label.textContent = title; canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); section.append(label, canvas); gallery.append(section);
    return { canvas, ctx: canvas.getContext('2d') };
}
function instrument(ctx, throwStroke) {
    const calls = [];
    const proxy = new Proxy(ctx, {
        get(target, key) {
            const value = Reflect.get(target, key, target);
            if (typeof value !== 'function') return value;
            return (...args) => { calls.push({ name: key, args, alpha: target.globalAlpha }); if (key === 'stroke' && throwStroke) throw throwStroke.error; return value.apply(target, args); };
        },
        set(target, key, value) { return Reflect.set(target, key, value, target); }
    });
    return { proxy, calls };
}
function pixels(ctx) { return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data; }
function green(ctx, rgb = [4, 120, 87]) { const data = pixels(ctx); let n = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] === rgb[0] && data[i + 1] === rgb[1] && data[i + 2] === rgb[2] && data[i + 3] === 255) n++;
    return n;
}
const styleKeys = ['globalAlpha','globalCompositeOperation','filter','shadowColor','shadowBlur','shadowOffsetX','shadowOffsetY',
    'fillStyle','strokeStyle','lineWidth','lineDashOffset','lineCap','lineJoin','miterLimit','font','textAlign','textBaseline','direction',
    'fontKerning','fontStretch','fontVariantCaps','letterSpacing','wordSpacing','textRendering'];
function state(ctx) { return { ...Object.fromEntries(styleKeys.filter(k => k in ctx).map(k => [k,ctx[k]])),
    dash: ctx.getLineDash(), transform: [...ctx.getTransform().toFloat64Array()] }; }
function dirty(ctx) {
    ctx.setTransform(2, .2, .1, 1.5, 17, 9); ctx.globalAlpha = .3; ctx.globalCompositeOperation = 'xor'; ctx.filter = 'blur(2px)';
    ctx.shadowColor = 'red'; ctx.shadowBlur = 9; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 3;
    ctx.setLineDash([7,3]); ctx.lineDashOffset = 3; ctx.font = 'italic 22px serif'; ctx.direction = 'rtl';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
}
const light = canvas('Результат: зелёные вершина B и ребро A → B'), r = createGraphRenderer({ theme: 'light' });
await check('Настоящий Canvas: зелёные пиксели результата и стрелок', () => { r.render(light.ctx, f.endpoint(f.done), size); ensure(green(light.ctx) > 800, 'Result green pixels missing'); });
await check('Контекст восстановлен: transform/styles/dash/text spacing', () => { dirty(light.ctx); const saved = state(light.ctx); r.render(light.ctx,f.endpoint(f.done),size); equal(state(light.ctx),saved,'Canvas state leaked'); });
await check('Тот же кадр: чистый и загрязнённый контекст дают одинаковые пиксели', () => {
    const clean = document.createElement('canvas'); clean.width = 640; clean.height = 400; const ctx = clean.getContext('2d');
    r.render(ctx,f.endpoint(f.done),size); equal([...pixels(ctx)],[...pixels(light.ctx)],'Inherited context affected bitmap');
});
await check('Исходная ошибка stroke сохранена; контекст восстановлен и повторный render работает', () => {
    const primary = {}, saved = state(light.ctx), wrapped = instrument(light.ctx,{ error: primary }); let caught = false;
    try { r.render(wrapped.proxy,f.endpoint(f.done),size); } catch (error) { caught = true; ensure(error === primary,'Primary changed'); }
    ensure(caught,'Expected stroke failure'); equal(state(light.ctx),saved,'State leaked after throw'); r.render(light.ctx,f.endpoint(f.done),size);
});
await check('Неверный кадр отвергнут до save и изменения bitmap', () => {
    const before = pixels(light.ctx), wrapped = instrument(light.ctx); let caught = false;
    try { r.render(wrapped.proxy,{ ...f.endpoint(f.done),progress:NaN },size); } catch(error) { caught = error instanceof RangeError; }
    ensure(caught && wrapped.calls.length === 0,'Invalid frame touched Canvas'); equal([...pixels(light.ctx)],[...before],'Invalid frame changed pixels');
});
for (const ratio of [1,1.25,2]) {
    await check('Настоящий bitmap DPR ' + ratio + ': размер, геометрия, зелёный результат', () => {
        const view = canvas('Bitmap ratio ' + ratio,301.25,173.5,ratio), wrapped = instrument(view.ctx);
        const logical = { width:301.25,height:173.5 }; dirty(view.ctx); const saved = state(view.ctx);
        r.render(wrapped.proxy,f.endpoint(f.done),logical); equal(state(view.ctx),saved,'DPR state leak');
        const transform = wrapped.calls.find(c => c.name === 'setTransform').args;
        equal(transform,[view.canvas.width/logical.width,0,0,view.canvas.height/logical.height,0,0],'Rounded bitmap ratio ignored');
        ensure(green(view.ctx) > 500 * ratio * ratio,'Scaled result missing');
    });
}
let motion;
await check('Интерполяция p=0/0.25/0.5/1 на Canvas: raw progress и связанные рёбра', () => {
    const view = canvas('Движение вершин: p = 0.25'), logs = [];
    for (const p of [0,.25,.5,1]) { const wrapped=instrument(view.ctx); r.render(wrapped.proxy,f.motion(p),size); logs.push(wrapped.calls); }
    const points = logs.map(log=>log.filter(c=>c.name==='arc').map(c=>c.args));
    for(let i=0;i<4;i++)ensure(Math.abs(points[1][i][0]-(points[0][i][0]*.75+points[3][i][0]*.25))<1e-8,'Nonlinear node motion');
    const curves=logs.map(log=>log.filter(c=>c.name==='bezierCurveTo').map(c=>c.args));
    curves[1].forEach((curve,i)=>curve.forEach((v,j)=>ensure(Math.abs(v-(curves[0][i][j]*.75+curves[3][i][j]*.25))<1e-8,'Edge detached from endpoints')));
    r.render(view.ctx,f.motion(.25),size); motion=logs[3];
});
await check('Три отдельные полосы, две петли и три стрелки', () => {
    const curves=motion.filter(c=>c.name==='bezierCurveTo'); ensure(curves.length===5,'Edge count');
    ensure(motion.filter(c=>c.name==='closePath').length===3,'Arrow count');
    ensure(JSON.stringify(curves[0].args)!==JSON.stringify(curves[2].args),'Parallel lanes coincide');
    ensure(curves[4].args[1]<curves[3].args[1],'Loop radii coincide');
});
await check('Тёмная тема: зелёный результат #34d399', () => {
    const view=canvas('Тёмная тема');createGraphRenderer({theme:'dark'}).render(view.ctx,f.endpoint(f.done),size);ensure(green(view.ctx,[52,211,153])>800,'Dark green missing');
});
const paintFrame = value => ({ previous:value,current:value,progress:1,event:undefined,stepIndex:0 });
for(const [name,input] of [['Пустой граф',{nodes:[],edges:[]}],['Одиночная вершина с петлёй',{nodes:[{id:'A',label:''}],edges:[{id:'loop',from:'A',to:'A',directed:true}]}]]) {
    await check(name,()=>{const view=canvas(name,320,180);r.render(view.ctx,paintFrame(createGraphTrace(input).state),{width:320,height:180});ensure(pixels(view.ctx)[3]===255,'Background not painted');});
}
await check('CanvasViewport: реальные CSS/DPR, resize без продвижения источника и dispose', async () => {
    const view=canvas('CanvasViewport: resize'), canvasElement=view.canvas;let draws=0;
    let viewport;const draw=()=>{const s=viewport.resize(w=>w*.6);if(s){r.render(view.ctx,f.endpoint(f.done),s);draws++;}};
    viewport=createCanvasViewport(canvasElement,{onResize:draw});canvasElement.style.width='500.25px';draw();
    ensure(canvasElement.width===Math.round(500.25*window.devicePixelRatio),'Native DPR bitmap mismatch');
    canvasElement.style.width='450.5px';await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
    ensure(canvasElement.width===Math.round(450.5*window.devicePixelRatio),'Resize not applied');ensure(green(view.ctx)>500,'Resize lost result');
    viewport.dispose();const before=draws;canvasElement.style.width='400px';await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
    ensure(draws===before,'Disposed viewport redrew');
});
await check('Player: result → Previous → Next → Restart → dispose', async () => {
    const host=document.createElement('section'), canvasElement=document.createElement('canvas');host.append(canvasElement);gallery.append(host);canvasElement.style.width='480px';
    const ctx=canvasElement.getContext('2d');let closes=0,reads=0,player;const renderer=createGraphRenderer({theme:'light'});
    const viewport=createCanvasViewport(canvasElement,{onResize(){if(player?.frame)draw(player.frame);}});
    function draw(frame){const s=viewport.resize(w=>w*.6);if(s)renderer.render(ctx,frame,s);}
    player=new Player(host,{viewport:canvasElement,rewindCapacity:4,stepSource:function*(){
        const trace=createGraphTrace({nodes:[{id:'A',label:''}],edges:[]});try{reads++;yield trace.start();reads++;yield trace.mark({nodes:[{id:'A',role:'active'}]});reads++;yield trace.done({result:{nodeIds:['A']}});}finally{closes++;}
    },isTerminal:s=>s.event.type==='done',render:draw});
    player.start();player.next();player.next();ensure(green(ctx)>500&&closes===1,'Terminal result/closure missing');
    player.previous();ensure(green(ctx)===0,'Previous retained final style');player.next();ensure(green(ctx)>500&&reads===3,'Replay advanced source or lost result');
    player.restart();ensure(green(ctx)===0&&reads===4,'Restart retained result');player.dispose();player.dispose();await player.closed;viewport.dispose();ensure(closes===2,'Source cleanup count');
});
const [oldGraph, newGraph, finalGraph] = [...graphTopologySteps()].map(step => step.state);
const transition = { previous: oldGraph, current: newGraph, progress: .5, stepIndex: 1, event: undefined };
for (const theme of ['light', 'dark']) {
    for (const ratio of [1, 1.25, 2]) {
        await check(`Динамические маршруты · ${theme} · DPR ${ratio}`, () => {
            const logical = { width: 420.25, height: 300.5 };
            const view = canvas(`Динамические маршруты · ${theme} · DPR ${ratio}`, logical.width, logical.height, ratio);
            const renderer = createGraphRenderer({ theme, topologyTransitions: true });
            dirty(view.ctx);
            const saved = state(view.ctx);
            for (const [progress, alphas] of [[0, [1, 1]], [.25, [.75, .25, .25, .75]], [.5, [.5, .5, .5, .5]], [1, [1, 1]]]) {
                const wrapped = instrument(view.ctx);
                renderer.render(wrapped.proxy, { ...transition, progress }, logical);
                equal(wrapped.calls.filter(call => call.name === 'stroke').map(call => call.alpha), alphas, 'Wrong branch opacity');
                equal(wrapped.calls.find(call => call.name === 'setTransform').args,
                    [view.canvas.width / logical.width, 0, 0, view.canvas.height / logical.height, 0, 0], 'Wrong transform');
                equal(state(view.ctx), saved, 'Canvas state leaked');
            }
            renderer.render(view.ctx, paintFrame(finalGraph), logical);
            ensure(green(view.ctx, theme === 'light' ? [4, 120, 87] : [52, 211, 153]) > 200, 'Missing result color');
            renderer.render(view.ctx, transition, logical);
        });
    }
}

await check('Прежний режим: пропуск, undefined и false дают одинаковый bitmap', () => {
    const view = canvas('Обычный режим', 400, 280);
    const standard = createGraphRenderer({ theme: 'dark' });
    const wrapped = instrument(view.ctx);
    standard.render(wrapped.proxy, transition, { width: 400, height: 280 });
    const expected = view.canvas.toDataURL();
    equal(wrapped.calls.filter(call => call.name === 'stroke').map(call => call.alpha), [1, .5, .5], 'Default edge no longer morphs');
    for (const topologyTransitions of [undefined, false]) {
        createGraphRenderer({ theme: 'dark', topologyTransitions }).render(view.ctx, transition, { width: 400, height: 280 });
        ensure(view.canvas.toDataURL() === expected, 'Explicit default changed pixels');
    }
});

for (const mode of ['stream', 'history']) {
    await check(`Динамический Player · ${mode} · Previous, Seek, Restart и resize`, async () => {
        const view = canvas(`Перемотка · ${mode}`, 430, 280);
        const renderer = createGraphRenderer({ theme: 'light', topologyTransitions: true, colors: { background: 'transparent' } });
        let player, edits = 0;
        const viewport = createCanvasViewport(view.canvas, { onResize() { if (player?.frame) draw(player.frame); } });
        function draw(frame) {
            const dimensions = viewport.resize(width => width * .7);
            if (dimensions) renderer.render(view.ctx, frame, dimensions);
        }
        function* steps() {
            for (const step of graphTopologySteps()) {
                if (step.event.type === 'edit') edits++;
                yield step;
            }
        }
        const source = mode === 'stream' ? { stepSource: steps, isTerminal: step => step.event.type === 'done', rewindCapacity: 3 }
            : { history: () => Array.from(steps(), step => step.state) };
        player = new Player(view.canvas.parentElement, { ...source, viewport: view.canvas, stepDurationMs: 100, render: draw });
        try {
            player.start();
            const initial = view.canvas.toDataURL();
            player.next();
            const edited = view.canvas.toDataURL();
            ensure(edited !== initial, 'Edit did not change the bitmap');
            player.previous();
            ensure(view.canvas.toDataURL() === initial, 'Previous did not remove the new target');
            player.next();
            ensure(view.canvas.toDataURL() === edited && edits === 1, 'Replay changed the frame or reran the edit');
            player.next();
            ensure(green(view.ctx) > 200, 'Done did not highlight the result');
            if (mode === 'history') {
                player.seek(50);
                const middle = view.canvas.toDataURL();
                ensure(middle !== initial && middle !== edited, 'Seek missed the crossfade');
                player.seek(200);
                player.seek(50);
                ensure(view.canvas.toDataURL() === middle, 'Seek depended on draw order');
            }
            player.restart();
            ensure(view.canvas.toDataURL() === initial, 'Restart retained old pixels');
            const startFrame = player.frame;
            const editCount = edits;
            view.canvas.style.width = '370px';
            await new Promise(requestAnimationFrame);
            await new Promise(requestAnimationFrame);
            await new Promise(requestAnimationFrame);
            ensure(view.canvas.width === Math.round(370 * devicePixelRatio), 'Wrong backing size after resize');
            ensure(player.frame === startFrame && edits === editCount, 'Resize advanced playback');
            const empty = createGraphTrace({ nodes: [], edges: [] }).state;
            draw(paintFrame(empty));
            ensure(pixels(view.ctx).every(value => value === 0), 'Transparent empty frame left previous pixels');
        } finally {
            player.dispose();
            viewport.dispose();
            const closed = await player.closed;
            ensure(closed.errorCount === 0, 'Player cleanup failed');
        }
    });
}

const report={date:new Date().toISOString().slice(0,10),host:{userAgent:navigator.userAgent,devicePixelRatio:window.devicePixelRatio},checks:results,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length};
document.querySelector('#status').textContent=`Завершено: ${report.passed}/${results.length}, ошибок ${report.failed}`;
document.querySelector('#report').textContent=JSON.stringify(report,null,2);
await fetch('/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});
