import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createTreeTrace} from '@grundyjs/algiviz/tree';
import {createTreeRenderer} from '@grundyjs/algiviz/canvas/tree';
import {recording} from './tree-canvas-context.mjs';
import {fixture,states,rotation,endpoint,size} from './tree-canvas-fixtures.mjs';
const renderer=(options={})=>createTreeRenderer({theme:'light',...options});
function draw(frame,r=renderer(),w=640,h=400,logical=size){const env=recording(w,h);r.render(env.ctx,frame,logical);return env;}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const pixelCommands=env=>env.commands.filter(c=>['clearRect','fillRect','strokeRect','fill','stroke','fillText'].includes(c.name));
function accessor(key,base={}){return Object.defineProperty(base,key,{get(){assert.fail('Accessor called: '+key);}});}
const exactError=(fn,value)=>{let caught=false;try{fn();}catch(error){caught=true;assert.equal(error,value);}assert.ok(caught);};
const nodes=env=>env.calls('arc').map(c=>c.args);

test('tree Canvas layout: exact ordered leaf ranks, binary extended in-order, arbitrary storage order and frozen copies',()=>{
    const r=renderer();assert.equal(typeof globalThis.document,'undefined');
    for(const kind of ['ordered','binary']) assert.deepEqual(r.layout({kind,rootId:null,nodes:[],links:[]}),[]);
    const ordered={kind:'ordered',rootId:'R',nodes:['B','X','R','A'].map(id=>({id})),links:[
        {id:'a',parentId:'R',childId:'A'},{id:'b',parentId:'R',childId:'B'},{id:'x',parentId:'A',childId:'X'}]};
    assert.deepEqual(r.layout(ordered),[{nodeId:'B',x:.5,y:2},{nodeId:'X',x:-.5,y:4},{nodeId:'R',x:0,y:0},{nodeId:'A',x:-.5,y:2}]);
    assert.deepEqual(r.layout({...ordered,links:[ordered.links[1],ordered.links[0],ordered.links[2]]}).map(p=>p.x),[-.5,.5,0,.5]);
    for(const slot of ['left','right']){
        const input={kind:'binary',rootId:'R',nodes:[{id:'R'},{id:'B'}],links:[{id:'l',parentId:'R',childId:'B',slot}]};
        assert.deepEqual(r.layout(input),[{nodeId:'R',x:0,y:0},{nodeId:'B',x:slot==='left'?-2:2,y:2}]);
        const output=renderer({horizontalGap:3,levelGap:5}).layout(input);
        assert.deepEqual(output,[{nodeId:'R',x:0,y:0},{nodeId:'B',x:slot==='left'?-6:6,y:5}]);
        assert.ok(Object.isFrozen(output)&&output.every(Object.isFrozen));assert.notEqual(r.layout(input),r.layout(input));
    }
    const f=rotation(r);assert.deepEqual(f.moved.state.layout.map(p=>[p.nodeId,p.x,p.y]),[['R',-4,2],['B',0,0],['A',-2,4]]);
});
test('tree Canvas layout: depth-safe chains, opaque payloads, invalid topologies and overflowing gaps',()=>{
    const count=12000,nodes=Array.from({length:count},(_,i)=>({id:''+i}));
    const links=nodes.slice(1).map((n,i)=>({id:'l'+i,parentId:''+i,childId:n.id,slot:'right'}));
    const input={kind:'binary',rootId:'0',nodes,links}, result=renderer().layout(input);
    assert.equal(result.at(-1).x,2*(count-1));assert.equal(result.at(-1).y,2*(count-1));
    const payload=new Proxy({}, {get(){assert.fail('Payload read');},ownKeys(){assert.fail('Payload traversed');}});
    assert.equal(renderer().layout({kind:'ordered',rootId:'r',nodes:[{id:'r',data:payload}],links:[]}).length,1);
    assert.throws(()=>renderer().layout({...input,links:links.slice(1)}),RangeError);
    assert.throws(()=>renderer({horizontalGap:Number.MAX_VALUE}).layout(input),RangeError);
    assert.throws(()=>renderer({levelGap:Number.MAX_VALUE}).layout(input),RangeError);
});
test('tree Canvas options: captures once, descriptor validation and deterministic error priority',()=>{
    for(const options of [null,[],{},accessor('theme'),{theme:'bad'},{theme:'light',colors:[]},{theme:'light',colors:accessor('node')},
        {theme:'light',colors:{result:''}},{theme:'light',roleColors:{x:undefined}},{theme:'light',roleColors:accessor('x')},
        {theme:'light',horizontalGap:'1'},{theme:'light',emptySlots:true},{theme:'light',nodeCaptions:'always'}])assert.throws(()=>createTreeRenderer(options),TypeError);
    for(const key of ['horizontalGap','levelGap']) for(const n of [0,-1,NaN,Infinity])assert.throws(()=>renderer({[key]:n}),RangeError);
    assert.throws(()=>renderer({horizontalGap:-1,nodeCaptions:'bad'}),RangeError);
    const options={theme:'light',colors:{result:'lime'},roleColors:{active:'red'},horizontalGap:2,emptySlots:'visible'};
    const r=createTreeRenderer(options);options.colors.result='pink';options.roleColors.active='blue';options.horizontalGap=9;
    const env=draw(endpoint(states().done),r);assert.ok(env.calls('fill').some(c=>c.state.fillStyle==='lime'));
    assert.ok(env.calls('fill').some(c=>c.state.fillStyle==='red'));assert.ok(Object.isFrozen(r));
});
test('tree Canvas geometry: attached crossfade branches, slot changes, current styling and linear node motion',()=>{
    const f=rotation(),envs=[0,.5,1].map(p=>draw(f.frame(p)));
    assert.equal(envs[1].calls('bezierCurveTo').length,4);assert.deepEqual(envs[1].calls('stroke').map(c=>c.state.globalAlpha),[.5,.5,.5,.5]);
    const arcs=nodes(envs[1]);const starts=envs[1].calls('moveTo').map(c=>c.args),ends=envs[1].calls('bezierCurveTo').map(c=>c.args.slice(-2));
    for(const [i,[from,to]] of [[0,1],[1,0],[1,2],[0,2]].entries()){
        close(Math.hypot(starts[i][0]-arcs[from][0],starts[i][1]-arcs[from][1]),16);
        close(Math.hypot(ends[i][0]-arcs[to][0],ends[i][1]-arcs[to][1]),16);
    }
    for(let i=0;i<3;i++)for(let axis=0;axis<2;axis++)close(arcs[i][axis],(nodes(envs[0])[i][axis]+nodes(envs[2])[i][axis])/2);
    const t=createTreeTrace({kind:'binary',rootId:'R',nodes:[{id:'R'},{id:'B'}],links:[{id:'x',parentId:'R',childId:'B',slot:'left'}]},
        {layout:[{nodeId:'R',x:0,y:0},{nodeId:'B',x:1,y:2}]});
    const a=t.start(),b=t.edit({links:[{id:'x',parentId:'R',childId:'B',slot:'right'}]});
    const env=draw({previous:a.state,current:b.state,progress:.5,event:undefined,stepIndex:0});
    assert.equal(env.calls('stroke').length,2);assert.ok(env.calls('moveTo')[0].args[0]<env.calls('moveTo')[1].args[0]);
});
test('tree Canvas empty slots: N+1 markers, hidden fit parity, no ordered ghosts, slot color independent from result',()=>{
    const single=createTreeTrace({kind:'binary',rootId:'R',nodes:[{id:'R'}],links:[]},{layout:[{nodeId:'R',x:0,y:0}]});single.start();
    const s=single.done({result:{nodeIds:['R']}}).state,show=draw(endpoint(s),renderer({emptySlots:'visible'})),hide=draw(endpoint(s));
    assert.equal(show.calls('strokeRect').length,2);assert.deepEqual(nodes(show),nodes(hide));assert.equal(hide.calls('strokeRect').length,0);
    assert.ok(show.calls('strokeRect').every(c=>c.state.strokeStyle==='#94a3b8'));assert.equal(show.calls('fill')[0].state.fillStyle,'#047857');
    for(const kind of ['ordered','binary']){
        const env=draw(endpoint(states(kind).start),renderer({emptySlots:'visible'}));
        if(kind==='ordered')assert.equal(env.calls('strokeRect').length,0);else assert.ok(env.calls('strokeRect').length>0);
    }
    const f=rotation();const start=draw(endpoint(f.start.state),renderer({emptySlots:'visible'}));
    assert.equal(start.calls('strokeRect').length,4,'N+1 slots on spaced three-node binary fixture');
    assert.deepEqual(nodes(start),nodes(draw(endpoint(f.start.state))));
});
test('tree Canvas text: state captions, current clear, no payload coercion, labels and captions actually paint',()=>{
    const f=states('ordered'),env=draw(endpoint(f.start),renderer({emptySlots:'visible'}),960,480,{width:960,height:480});
    const text=env.calls('fillText').map(c=>c.args[0]);for(const expected of ['L','d=2','end','root'])assert.ok(text.includes(expected),expected);
    const hidden=draw(endpoint(f.start),renderer({nodeCaptions:'hidden'}));assert.ok(!hidden.calls('measureText').some(c=>['d=2','end','root'].includes(c.args[0])));
    const t=createTreeTrace(f.start.tree,{layout:f.start.layout,nodeCaptions:f.start.nodeCaptions});const a=t.start();
    const b=t.mark({nodeCaptions:f.start.nodeCaptions.map(c=>({id:c.id,text:null}))});
    const clear=draw({previous:a.state,current:b.state,progress:0,event:undefined,stepIndex:0});
    assert.ok(!clear.calls('fillText').some(c=>['d=2','end','root'].includes(c.args[0])));
    const odd=structuredClone(f.start);odd.tree.nodes[0].label='a\n\t b';odd.nodeCaptions[0].text='   ';
    assert.ok(draw(endpoint(odd)).calls('fillText').some(c=>c.args[0]==='a  b'));
});
test('tree Canvas custom gaps: an empty stub cannot turn back inside its own parent circle',()=>{
    const input={kind:'binary',rootId:'R',nodes:[{id:'R',label:''},{id:'B',label:''}],links:[{id:'l',parentId:'R',childId:'B',slot:'right'}]};
    const t=createTreeTrace(input,{layout:[{nodeId:'R',x:0,y:0},{nodeId:'B',x:0,y:27}]});
    const env=draw(endpoint(t.state),renderer({horizontalGap:.001,emptySlots:'visible'}));
    assert.equal(env.calls('strokeRect').length,0);
});
test('tree Canvas enter/exit: opacity is linear, ghosts follow their owners once, exiting text and endpoints remain available',()=>{
    const r=renderer({emptySlots:'visible'}),input={kind:'binary',rootId:'R',nodes:[{id:'R',label:'root'}],links:[]};
    const t=createTreeTrace(input,{layout:r.layout(input)}),a=t.start();
    const candidate={...input,nodes:[...input.nodes,{id:'B',label:'old leaf'}],links:[{id:'l',parentId:'R',childId:'B',slot:'right'}]};
    const b=t.edit({nodes:candidate.nodes,links:candidate.links,layout:r.layout(candidate)});
    const entering=draw({previous:a.state,current:b.state,progress:.25,event:undefined,stepIndex:0},r);
    assert.deepEqual(entering.calls('arc').map(c=>c.state.globalAlpha),[1,.25]);
    assert.equal(entering.calls('bezierCurveTo')[0].state.globalAlpha,.25);
    assert.ok(entering.calls('strokeRect').some(c=>c.state.globalAlpha===.25),'Entering owner ghosts must not use p²');
    const c=t.edit({nodes:input.nodes,links:[],layout:r.layout(input)});
    const exiting=draw({previous:b.state,current:c.state,progress:.25,event:undefined,stepIndex:0},r);
    assert.deepEqual(exiting.calls('arc').map(c=>c.state.globalAlpha),[1,.75]);
    assert.ok(exiting.calls('fillText').some(c=>c.args[0]==='old leaf'&&c.state.globalAlpha===.75));
    assert.ok(exiting.calls('strokeRect').some(c=>c.state.globalAlpha===.75));
    for(const p of [0,1]) draw({previous:b.state,current:c.state,progress:p,event:undefined,stepIndex:0},r);
});
test('tree Canvas rewiring resolves distinct old/new node generations, never a hybrid parent center',()=>{
    const r=renderer(),input={kind:'ordered',rootId:'R',nodes:[{id:'R'},{id:'A'}],links:[{id:'l',parentId:'R',childId:'A'}]};
    const t=createTreeTrace(input,{layout:r.layout(input)}),a=t.start();
    const candidate={kind:'ordered',rootId:'X',nodes:[{id:'X'},{id:'Y'}],links:[{id:'l',parentId:'X',childId:'Y'}]};
    const b=t.edit({rootId:'X',nodes:candidate.nodes,links:candidate.links,layout:r.layout(candidate)});
    const env=draw({previous:a.state,current:b.state,progress:.5,event:undefined,stepIndex:0}),arcs=nodes(env);
    const starts=env.calls('moveTo'),ends=env.calls('bezierCurveTo');assert.equal(ends.length,2);
    for(const [i,[from,to]]of [[2,3],[0,1]].entries()){
        close(starts[i].args[0],arcs[from][0]);close(starts[i].args[1],arcs[from][1]+16);
        close(ends[i].args[4],arcs[to][0]);close(ends[i].args[5],arcs[to][1]-16);
    }
});
test('tree Canvas result: green nodes/links are independent, rewind/repaint use snapshots, transparent backgrounds clear',()=>{
    for(const theme of ['light','dark']){
        const f=states(),r=renderer({theme,roleColors:{active:'red'},colors:{background:'transparent'}});
        const final=draw(endpoint(f.done),r),green=theme==='light'?'#047857':'#34d399';
        assert.equal(final.calls('stroke')[0].state.strokeStyle,green);assert.equal(final.calls('fill')[3].state.fillStyle,green);
        assert.equal(final.calls('fill')[1].state.fillStyle,'red');
        assert.ok(!draw(endpoint(f.start),r).calls('fill').some(c=>c.state.fillStyle===green));
        assert.equal(final.calls('clearRect').length,1);assert.ok(final.commands.findIndex(c=>c.name==='clearRect')<final.commands.findIndex(c=>c.name==='fillRect'));
        assert.ok(final.commands.findLastIndex(c=>c.name==='measureText')<final.commands.findIndex(c=>c.name==='clearRect'));
    }
});
test('tree Canvas DPR and context: rounded backing-store ratios, no resizing, full save/restore and neutral drawing state',()=>{
    const logical={width:301.25,height:173.5},f=endpoint(states().done),logs=[];
    for(const dpr of [1,1.25,2]){
        const w=Math.round(logical.width*dpr),h=Math.round(logical.height*dpr),env=recording(w,h),original=structuredClone(env.state);
        Object.defineProperty(env.ctx.canvas,'width',{get:()=>w,set(){assert.fail('Bitmap resized');}});
        Object.defineProperty(env.ctx.canvas,'height',{get:()=>h,set(){assert.fail('Bitmap resized');}});
        renderer({emptySlots:'visible'}).render(env.ctx,f,logical);
        assert.deepEqual(env.calls('setTransform')[0].args,[w/logical.width,0,0,h/logical.height,0,0]);
        assert.deepEqual(env.state,original);assert.equal(env.stack.length,0);
        const state=env.calls('clearRect')[0].state;assert.equal(state.globalAlpha,1);assert.equal(state.filter,'none');
        assert.equal(state.globalCompositeOperation,'source-over');assert.equal(state.letterSpacing,'0px');assert.deepEqual(state.dash,[]);
        logs.push(pixelCommands(env).map(c=>[c.name,c.args]));
    }
    assert.deepEqual(logs[0],logs[1]);assert.deepEqual(logs[0],logs[2]);
});
test('tree Canvas validation: descriptor/order guarantees, mismatch even empty, no Canvas calls on invalid inputs',()=>{
    const f=endpoint(states().start),r=renderer(),env=recording();
    const bad={...f.current,nodeCaptions:[{id:'unknown',text:'x'}]};
    for(const [frame,logical,error] of [[f,null,TypeError],[f,{width:-1,height:1},RangeError],[{...f,progress:NaN},size,RangeError],
        [accessor('previous',{...f,progress:-1}),size,TypeError],[{...f,previous:bad},size,RangeError],[{...f,current:bad},{width:0,height:0},RangeError]]){
        assert.throws(()=>r.render(env.ctx,frame,logical),error);assert.equal(env.commands.length,0);
    }
    const empty=kind=>createTreeTrace({kind,rootId:null,nodes:[],links:[]},{layout:[]}).state;
    assert.throws(()=>r.render(env.ctx,{...f,previous:empty('ordered'),current:empty('binary')},{width:0,height:0}),RangeError);
    const eventless=accessor('event',accessor('stepIndex',{previous:f.previous,current:f.current,progress:0}));
    r.render(env.ctx,eventless,size);assert.ok(env.calls('arc').length);
    const zero=recording(0,2);r.render(zero.ctx,f,size);assert.equal(zero.commands.length,0);
    const huge=structuredClone(f.current);huge.layout[0].x=-Number.MAX_VALUE;huge.layout[1].x=Number.MAX_VALUE;
    assert.throws(()=>r.render(recording().ctx,endpoint(huge),size),RangeError);
});
test('tree Canvas metrics: numeric failures precede missing fields/pixels, missing bounds omit optional text and slots',()=>{
    const f=endpoint(states().start),r=renderer({emptySlots:'visible'});
    for(const metrics of [{width:undefined,actualBoundingBoxRight:Infinity},{width:-1},{width:NaN},{width:3,actualBoundingBoxAscent:Infinity}]){
        const env=recording();env.ctx.measureText=()=>metrics;assert.throws(()=>r.render(env.ctx,f,size),RangeError);assert.equal(pixelCommands(env).length,0);assert.equal(env.stack.length,0);
    }
    const env=recording();env.ctx.measureText=()=>({width:6});r.render(env.ctx,f,size);
    assert.ok(env.calls('arc').length);assert.equal(env.calls('strokeRect').length,0);assert.ok(env.calls('fillText').every(c=>c.args.length===4));
});
test('tree Canvas validation priority and opaque proxies: previous wins, bitmap getters preserved, failures do not poison later calls',()=>{
    const f=endpoint(states().start),r=renderer(),primary=Symbol('proxy'),env=recording();let currentReads=0;
    const previous=new Proxy({}, {getPrototypeOf(){throw primary;}}),current=new Proxy({}, {getPrototypeOf(){currentReads++;throw Error('current');}});
    exactError(()=>r.render(env.ctx,{...f,previous,current},size),primary);assert.equal(currentReads,0);assert.equal(env.commands.length,0);
    const canvas=new Proxy({},{get(){throw primary;}});Object.defineProperty(env.ctx,'canvas',{value:canvas});
    exactError(()=>r.render(env.ctx,f,{width:0,height:0}),primary);assert.equal(env.commands.length,0);
    const input=new Proxy({}, {getPrototypeOf(){throw false;}});exactError(()=>r.layout(input),false);
    assert.equal(draw(f,r).calls('arc').length,7);
});
test('tree Canvas host failures: primary opaque throws, save/restore ownership, recovery and recursive guards',()=>{
    const f=endpoint(states().start),r=renderer();
    for(const primary of [undefined,null,false,0,'',Symbol('host'),new Error('host')]){
        const env=recording(),save=env.ctx.save,restore=env.ctx.restore;env.ctx.save=()=>{save();};env.ctx.measureText=()=>{throw primary;};
        env.ctx.restore=()=>{restore();throw new Error('secondary');};exactError(()=>r.render(env.ctx,f,size),primary);assert.equal(env.stack.length,0);
        assert.equal(draw(f,r).calls('arc').length,7);
    }
    for(const method of ['save','setTransform','clearRect','stroke','fillText','restore']){
        const env=recording(),error={method},original=env.ctx[method];
        env.ctx[method]=(...args)=>{if(method==='restore')original(...args);throw error;};exactError(()=>r.render(env.ctx,f,size),error);
        assert.equal(env.calls('restore').length,method==='save'?0:1);draw(f,r);
    }
    const env=recording(),measure=env.ctx.measureText;let nested=0;
    env.ctx.measureText=text=>{assert.throws(()=>r.layout(null),e=>e.constructor===Error);assert.throws(()=>r.render(null,null,null),e=>e.constructor===Error);nested++;return measure(text);};
    r.render(env.ctx,f,size);assert.ok(nested>0);assert.equal(r.layout(f.current.tree).length,7);
    const input=new Proxy(f.current.tree,{getOwnPropertyDescriptor(target,key){assert.throws(()=>r.layout(null),e=>e.constructor===Error);return Reflect.getOwnPropertyDescriptor(target,key);}});
    assert.equal(r.layout(input).length,7);draw(f,r);
});
