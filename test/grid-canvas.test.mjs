import assert from 'node:assert/strict';import {test} from 'node:test';
import {createGridRenderer} from '@grundyjs/algiviz/canvas/grid';
import {createGridTrace} from '@grundyjs/algiviz/grid';
import {recording} from './tree-canvas-context.mjs';
import {states,size,cell,endpoint,presentCell} from './grid-canvas-fixtures.mjs';
import {throwsSame,errorIs} from './grid-test-fixtures.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const frames=()=>{const s=states();return{...s,pair:{previous:s.changed.state,current:s.done.state,progress:.5,stepIndex:2,event:undefined}}};
const render=(renderer,state,dimensions=size)=>{const env=recording(dimensions.width,dimensions.height);renderer.render(env.ctx,state,dimensions);return env};
const fills=env=>env.calls('fillRect').slice(1);
const core=env=>env.calls('stroke').filter(c=>c.state.strokeStyle==='#1d4ed8'||c.state.strokeStyle==='#fbbf24');

test('grid Canvas: frozen render-only API and captured constructor settings without DOM',()=>{
    let calls=0;const colors={cell:'#abc'},roleColors={visited:'#def'},options={theme:'light',colors,roleColors,presentCell(){calls++;return {label:'x'}}},r=createGridRenderer(options);
    assert.deepEqual(Object.keys(r),['render']);assert.ok(Object.isFrozen(r));assert.equal(calls,0);colors.cell='red';roleColors.visited='blue';options.presentCell=()=>({color:'pink'});
    const s=states(),env=render(r,endpoint(s.changed.state));assert.equal(calls,6);assert.equal(fills(env)[0].state.fillStyle,'#def');assert.equal(fills(env)[1].state.fillStyle,'#abc');
});
test('grid Canvas: constructor validation, own-data options and original opaque throws',()=>{
    for(const option of [{},{theme:'sepia'},{theme:'light',presentCell:0},{theme:'light',cellCaptions:'all'},{theme:'light',path:false},{theme:'light',colors:{cell:''}},{theme:'light',roleColors:{x:undefined}}])assert.throws(()=>createGridRenderer(option),errorIs(TypeError));
    for(const gap of [-1,Infinity,NaN])assert.throws(()=>createGridRenderer({theme:'light',cellGap:gap}),errorIs(RangeError));
    let calls=0;assert.throws(()=>createGridRenderer({get theme(){calls++;return 'light'}}),errorIs(TypeError));assert.equal(calls,0);
    throwsSame(()=>createGridRenderer(new Proxy({},{getPrototypeOf(){throw 0}})),0);
});
test('grid Canvas: complete inset borders fit viewport across themes/sizes/backing ratios',()=>{
    const s=states();for(const theme of ['light','dark'])for(const dimensions of [size,{width:390,height:280},{width:108,height:108}])for(const ratio of [1,1.25,2]){
        const env=recording(dimensions.width*ratio,dimensions.height*ratio),r=createGridRenderer({theme,cellGap:0});r.render(env.ctx,endpoint(s.start.state),dimensions);const cells=fills(env),borders=env.calls('strokeRect');assert.equal(cells.length,6);assert.equal(borders.length,6);
        for(let i=0;i<cells.length;i++){const[x,y,w,h]=cells[i].args,[bx,by,bw,bh]=borders[i].args,half=borders[i].state.lineWidth/2;assert.ok(x>=4&&y>=4&&x+w<=dimensions.width-4&&y+h<=dimensions.height-4);near(bx-half,x);near(by-half,y);near(bx+bw+half,x+w);near(by+bh+half,y+h);}
        assert.deepEqual(env.calls('setTransform')[0].args,[ratio,0,0,ratio,0,0]);assert.equal(env.ctx.canvas.width,dimensions.width*ratio);
    }
    const env=render(createGridRenderer({theme:'light'}),endpoint(s.start.state));near(fills(env)[0].args[0],4);near(fills(env)[5].args[0],224);near(fills(env)[5].args[1],114);near(fills(env)[5].args[2],100);
});
test('grid Canvas: zero dimensions are validated no-ops; empty/thin grids paint only background',()=>{
    const s=states();let calls=0;const r=createGridRenderer({theme:'light',presentCell(){calls++;return {}}});
    for(const [dimensions,bw,bh]of [[{width:0,height:100},100,100],[size,0,100],[size,100,0]]){const env=recording(bw,bh);r.render(env.ctx,endpoint(s.start.state),dimensions);assert.equal(env.commands.length,0)}
    for(const dimensions of [{width:8,height:100},{width:100,height:7}]){const env=render(r,endpoint(s.start.state),dimensions);assert.equal(env.calls('fillRect').length,1);assert.equal(env.calls('measureText').length,0)}
    const empty=createGridTrace({rows:0,columns:3,values:[]}).state,env=render(r,endpoint(empty));assert.equal(env.calls('fillRect').length,1);assert.equal(calls,0);
    assert.throws(()=>r.render(recording(0,0).ctx,{...endpoint(s.start.state),current:{...s.start.state,cellMarks:undefined}},{width:0,height:0}),errorIs(TypeError));
});
test('grid Canvas: endpoint shapes, input order and hidden snapshots validate before host access',()=>{
    const r=createGridRenderer({theme:'light',path:'hidden',cellCaptions:'hidden'}),s=states();let host=0;const ctx={get canvas(){host++;throw 'host'}};
    const other=createGridTrace({rows:3,columns:2,values:[0,1,2,3,4,5]}).state;assert.throws(()=>r.render(ctx,{...endpoint(s.start.state),current:other},size),errorIs(RangeError));assert.equal(host,0);
    const a=createGridTrace({rows:0,columns:3,values:[]}).state,b=createGridTrace({rows:0,columns:4,values:[]}).state;assert.throws(()=>r.render(ctx,{...endpoint(a),current:b},size),errorIs(RangeError));
    for(const progress of [-.1,NaN,Infinity,1.1])assert.throws(()=>r.render(ctx,{...endpoint(s.start.state),progress},size),errorIs(RangeError));
    assert.throws(()=>r.render(ctx,endpoint(s.start.state),{width:'10',height:10}),errorIs(TypeError));
    assert.throws(()=>r.render(ctx,endpoint({...s.done.state,result:{cells:[],path:[cell(10,0)]}}),size),errorIs(RangeError));assert.equal(host,0);
});
test('grid Canvas: ignores event/index getters, defaults never inspect or coerce values',()=>{
    let inspected=0;const value=new Proxy({},{get(){inspected++;throw 'value'},ownKeys(){inspected++;throw 'value'}}),state=createGridTrace({rows:1,columns:1,values:[value]}).state;
    const frame={previous:state,current:state,progress:0,get event(){throw 'event'},get stepIndex(){throw 'index'}};
    const env=render(createGridRenderer({theme:'light'}),frame);assert.equal(env.calls('fillText').length,0);assert.equal(inspected,0);
});
test('grid Canvas: presenter is current-only row-major once, with frozen copied wrappers and void this',()=>{
    const s=states(),source=structuredClone(s.changed.state),seen=[],returns=[];let shared={label:'first'};
    const r=createGridRenderer({theme:'light',presentCell:function(view,snapshot){assert.equal(this,undefined);assert.ok(Object.isFrozen(view)&&Object.isFrozen(snapshot)&&Object.isFrozen(snapshot.grid.values));assert.notEqual(snapshot,source);seen.push([view.row,view.column,view.value]);
        source.grid.values[0]=100;shared.label=String(view.value);returns.push(shared);return shared;}});
    const env=render(r,{...endpoint(s.start.state,0),current:source});assert.deepEqual(seen,[[0,0,9],[0,1,1],[0,2,2],[1,0,3],[1,1,4],[1,2,5]]);assert.deepEqual(env.calls('fillText').filter(c=>!String(c.args[0]).startsWith('d=')).map(c=>c.args[0]),['9','1','2','3','4','5']);assert.equal(returns.length,6);
});
test('grid Canvas: presentation errors precede Canvas methods even under selected/hidden data',()=>{
    const s=states();for(const returned of [null,Promise.resolve({}),[],()=>({}),{label:3},{color:''},{get label(){throw 'getter'}}]){
        const env=recording(),r=createGridRenderer({theme:'light',path:'hidden',cellCaptions:'hidden',presentCell:()=>returned});assert.throws(()=>r.render(env.ctx,endpoint(s.done.state,0),size),errorIs(TypeError));assert.equal(env.commands.length,0);
    }
    for(const thrown of [undefined,null,false,0,'',new Error('presenter')]){const env=recording();throwsSame(()=>createGridRenderer({theme:'light',presentCell(){throw thrown}}).render(env.ctx,endpoint(s.done.state),size),thrown);assert.equal(env.commands.length,0)}
});
test('grid Canvas: recursive presenter/host render is rejected before nested argument inspection',()=>{
    const s=states(),poison=new Proxy({},{getPrototypeOf(){throw 'nested read'}});let r,attempts=0;
    r=createGridRenderer({theme:'light',presentCell(){attempts++;assert.throws(()=>r.render(null,poison,poison),errorIs(Error));return {label:'ok'}}});render(r,endpoint(s.start.state));assert.equal(attempts,6);
    let fail=true;const second=createGridRenderer({theme:'light',presentCell(){if(fail)second.render(null,poison,poison);return {}}});assert.throws(()=>render(second,endpoint(s.start.state)),errorIs(Error));fail=false;render(second,endpoint(s.start.state));
});
test('grid Canvas: result and custom/built-in roles outrank presentation fills with result text',()=>{
    const s=states(),r=createGridRenderer({theme:'light',roleColors:{visited:'#123456'},presentCell:()=>({label:'v',color:'#abcdef'})});
    const changed=render(r,endpoint(s.changed.state));assert.equal(fills(changed)[0].state.fillStyle,'#123456');assert.equal(fills(changed)[2].state.fillStyle,'#abcdef');
    const final=render(r,endpoint(s.done.state,0));assert.equal(fills(final)[0].state.fillStyle,'#047857');assert.equal(fills(final)[1].state.fillStyle,'#047857');assert.equal(fills(final)[5].state.fillStyle,'#047857');assert.equal(final.calls('fillText')[0].state.fillStyle,'#ffffff');
});
test('grid Canvas: values/captions/fills are discrete-current at every raw progress',()=>{
    const s=frames(),r=createGridRenderer({theme:'light',presentCell});for(const progress of [0,.25,.5,1]){const env=render(r,{...s.pair,progress});assert.equal(env.calls('fillText')[0].args[0],'9');assert.equal(fills(env)[0].state.fillStyle,'#047857');assert.ok(env.calls('fillText').some(c=>c.args[0]==='d=0'))}
});
test('grid Canvas: changed paths crossfade without vertex morphing or shared segment deduplication',()=>{
    const s=states(),previous=structuredClone(s.done.state);previous.result.path=[cell(0,0),cell(0,1)];
    for(const progress of [0,.25,.5,1]){const env=render(createGridRenderer({theme:'light'}),{previous,current:s.done.state,progress});assert.deepEqual(core(env).map(c=>c.state.globalAlpha),progress===0?[1]:progress===1?[1]:[1-progress,progress]);}
    const env=render(createGridRenderer({theme:'light'}),{previous,current:s.done.state,progress:.5});assert.equal(env.calls('moveTo').length,2);assert.equal(env.calls('lineTo').length,3);assert.equal(env.calls('clip')[0].args[0],'evenodd');
});
test('grid Canvas: unchanged paths draw once; repeated/singleton/hidden paths preserve membership',()=>{
    const s=states();for(const progress of [0,.5,1])assert.deepEqual(core(render(createGridRenderer({theme:'light'}),endpoint(s.done.state,progress))).map(c=>c.state.globalAlpha),[1]);
    for(const path of [[cell(0,0)],[cell(0,0),cell(0,0),cell(0,0)]]){const state=structuredClone(s.done.state);state.result={cells:[],path};const env=render(createGridRenderer({theme:'light'}),endpoint(state));assert.equal(core(env).length,0);assert.equal(fills(env)[0].state.fillStyle,'#047857');}
    const hidden=render(createGridRenderer({theme:'light',path:'hidden'}),endpoint(s.done.state));assert.equal(core(hidden).length,0);assert.equal(fills(hidden)[5].state.fillStyle,'#047857');
});
test('grid Canvas: paired measured text fits cells and paths clip text without background patches',()=>{
    const s=states(),env=render(createGridRenderer({theme:'light',presentCell}),endpoint(s.done.state));const texts=env.calls('fillText'),holes=env.calls('rect').slice(1);assert.equal(texts.length,8);assert.equal(holes.length,texts.length);assert.equal(env.calls('fillRect').length,7);
    for(let i=0;i<texts.length;i++){const c=texts[i],[label,x,y]=c.args,font=parseFloat(c.state.font),w=label.length*6,minY=Math.min(-.8*font,-6),maxY=Math.max(.2*font,6),[left,top,width,height]=holes[i].args;near(left,x-w/2-1);near(top,y+minY-1);near(width,w+2);near(height,maxY-minY+2);assert.ok(left>=5&&top>=5&&left+width<=size.width-5&&top+height<=size.height-5)}
    assert.ok(env.commands.findIndex(c=>c.name==='clip')<env.commands.findIndex(c=>c.name==='fillText'));assert.ok(env.commands.findIndex(c=>c.name==='clearRect')>env.commands.findLastIndex(c=>c.name==='measureText'));
});
test('grid Canvas: newline normalization, fallback metrics, omission and hidden captions',()=>{
    const state=createGridTrace({rows:1,columns:1,values:[1]},{cellCaptions:[{row:0,column:0,text:'d\n1'}]}).state;
    const env=recording(108,108);env.ctx.measureText=value=>({width:value.length*5});createGridRenderer({theme:'light',presentCell:()=>({label:'a\r\n\u2028b'})}).render(env.ctx,endpoint(state),{width:108,height:108});assert.deepEqual(env.calls('fillText').map(c=>c.args[0]),['a b','d 1']);
    const small=render(createGridRenderer({theme:'light',presentCell:()=>({label:'too long '.repeat(50)})}),endpoint(state),{width:25,height:25});assert.equal(small.calls('fillText').length,0);assert.equal(fills(small).length,1);
    const hidden=render(createGridRenderer({theme:'light',cellCaptions:'hidden'}),endpoint(state),{width:108,height:108});assert.equal(hidden.calls('measureText').length,0);
});
test('grid Canvas: invalid metrics and original metric getters fail before clear and restore state',()=>{
    const s=states();for(const metrics of [{width:-1},{width:Infinity},{width:2,actualBoundingBoxLeft:NaN}]){const env=recording(),before=structuredClone(env.state);env.ctx.measureText=()=>metrics;assert.throws(()=>createGridRenderer({theme:'light',presentCell}).render(env.ctx,endpoint(s.start.state),size),errorIs(RangeError));assert.equal(env.calls('clearRect').length,0);assert.deepEqual(env.state,before);assert.equal(env.stack.length,0)}
    const env=recording();env.ctx.measureText=()=>({get width(){throw 0}});throwsSame(()=>createGridRenderer({theme:'light',presentCell}).render(env.ctx,endpoint(s.start.state),size),0);assert.equal(env.calls('clearRect').length,0);
});
test('grid Canvas: explicit DPR transforms and dirty context state are restored',()=>{
    const s=states(),env=recording(656,654),before=structuredClone(env.state);createGridRenderer({theme:'dark',presentCell}).render(env.ctx,endpoint(s.done.state),size);assert.deepEqual(env.calls('setTransform')[0].args,[2,0,0,3,0,0]);assert.deepEqual(env.state,before);assert.equal(env.stack.length,0);
    const command=env.calls('fillRect')[0];assert.equal(command.state.globalAlpha,1);assert.equal(command.state.globalCompositeOperation,'source-over');assert.equal(command.state.filter,'none');assert.equal(command.state.textBaseline,'alphabetic');assert.equal(command.state.letterSpacing,'0px');assert.equal(command.state.shadowBlur,0);
});
test('grid Canvas: host errors recover acquired saves and busy across all paint stages',()=>{
    const s=states(),r=createGridRenderer({theme:'light',presentCell});for(const method of ['save','setTransform','measureText','clearRect','fillRect','strokeRect','clip','stroke','fillText','restore']){
        const env=recording(),before=structuredClone(env.state),original=env.ctx[method],failure={method};let first=true;
        env.ctx[method]=(...args)=>{if(first){first=false;if(method==='restore')original(...args);throw failure;}return original(...args)};
        throwsSame(()=>r.render(env.ctx,endpoint(s.done.state),size),failure);assert.equal(env.stack.length,0,method);assert.deepEqual(env.state,before,method);r.render(env.ctx,endpoint(s.start.state),size);
    }
});
test('grid Canvas: falsy primary stroke error wins over both nested restore failures',()=>{
    const s=states();for(const primary of [undefined,null,false,0,'']){const env=recording(),original=env.ctx.restore;env.ctx.stroke=()=>{throw primary};env.ctx.restore=()=>{original();throw 'secondary'};throwsSame(()=>createGridRenderer({theme:'light',presentCell}).render(env.ctx,endpoint(s.done.state),size),primary);assert.equal(env.stack.length,0);assert.equal(env.calls('restore').length,2)}
});
test('grid Canvas: validates unrepresentable geometry before callbacks and Canvas methods',()=>{
    const s=states();let calls=0;const r=createGridRenderer({theme:'light',cellGap:Number.MAX_VALUE,presentCell(){calls++;return {}}}),env=recording();assert.throws(()=>r.render(env.ctx,endpoint(s.start.state),size),errorIs(RangeError));assert.equal(calls,0);assert.equal(env.commands.length,0);
    const huge=recording();assert.throws(()=>createGridRenderer({theme:'light'}).render(huge.ctx,endpoint(s.start.state),{width:1e308,height:1e308}),errorIs(RangeError));assert.equal(huge.commands.length,0);
});
test('grid Canvas: reset/redraw clears prior pixels and has no final-selection cache',()=>{
    const s=states(),r=createGridRenderer({theme:'light',colors:{background:'transparent'},presentCell}),env=recording();r.render(env.ctx,endpoint(s.done.state),size);assert.ok(fills(env).some(c=>c.state.fillStyle==='#047857'));env.commands.length=0;env.ctx.canvas.width=984;env.ctx.canvas.height=654;r.render(env.ctx,endpoint(s.start.state),size);assert.equal(env.calls('clearRect').length,1);assert.ok(!fills(env).some(c=>c.state.fillStyle==='#047857'));assert.deepEqual(env.calls('setTransform')[0].args,[3,0,0,3,0,0]);
});
