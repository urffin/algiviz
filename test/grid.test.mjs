import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createGridTrace,gridScene} from '@grundyjs/algiviz/grid';
import {createSceneProjector,createSceneFrame} from '@grundyjs/algiviz/scene';
import {input,cell,errorIs,throwsSame,own,endpoint} from './grid-test-fixtures.mjs';
const running=()=>{const t=createGridTrace(input());t.start();return t;};

test('grid: constructor owns immutable containers and opaque values without coercion',()=>{
    const opaque=new Proxy({},{get(){throw Error('payload inspected')},ownKeys(){throw Error('payload enumerated')},getPrototypeOf(){throw Error('payload inspected')}});
    const values=[opaque,false,'',null,undefined,NaN,Infinity,-Infinity,0],source={rows:3,columns:3,values};
    const captions=[{row:2,column:2,text:''},{row:0,column:0,text:'opaque'}],t=createGridTrace(source,{cellCaptions:captions}),state=t.state;
    values[0]='changed';captions[0].text='changed';source.rows=9;
    assert.equal(state.grid.values[0],opaque);assert.equal(state.grid.rows,3);assert.equal(state.grid.values[4],undefined);assert.ok(Number.isNaN(state.grid.values[5]));
    assert.deepEqual(state.cellCaptions,[{row:0,column:0,text:'opaque'},{row:2,column:2,text:''}]);assert.deepEqual(state.cellMarks,[]);assert.equal(state.result,null);own(state);
    const scene=gridScene(state,{namespace:'opaque'});assert.equal(scene.objects[0].data.value,opaque);own(scene);
});
test('grid: zero-area shapes preserve both dimensions and normalize negative zero',()=>{
    for(const [rows,columns]of [[0,0],[0,1000000],[1000000,0],[-0,-0]]){
        const t=createGridTrace({rows,columns,values:[]});assert.equal(Object.is(t.state.grid.rows,-0),false);assert.equal(Object.is(t.state.grid.columns,-0),false);
        assert.equal(t.state.grid.rows,rows===0?0:rows);assert.equal(t.state.grid.columns,columns===0?0:columns);
        t.start();t.edit({});t.mark({});const state=t.done({result:{}}).state;assert.deepEqual(state.result,{cells:[],path:[]});assert.deepEqual(gridScene(state,{namespace:'zero'}).objects,[]);
    }
    const t=running();const s=t.mark({cells:[{row:-0,column:-0,role:'x'}]});assert.equal(Object.is(s.state.cellMarks[0].row,-0),false);
});
test('grid: dimension type/range and product ceilings precede values or options capture',()=>{
    const boundary=createGridTrace({rows:1000,columns:1000,values:Array(1000000).fill(null)});
    assert.equal(boundary.state.grid.values.length,1000000);assert.equal(Object.isFrozen(boundary.state.grid.values),true);
    for(const value of ['2',null,undefined,true,{},2n])assert.throws(()=>createGridTrace({...input(),rows:value}),errorIs(TypeError));
    for(const value of [-1,.5,NaN,Infinity,-Infinity,Number.MAX_SAFE_INTEGER+1,1000001])for(const key of ['rows','columns'])assert.throws(()=>createGridTrace({...input(),[key]:value}),errorIs(RangeError));
    const poison=new Proxy([],{getOwnPropertyDescriptor(){throw 'too late'}});
    assert.throws(()=>createGridTrace({rows:1001,columns:1000,values:poison},new Proxy({},{getPrototypeOf(){throw 'options'}})),errorIs(RangeError));
    assert.throws(()=>createGridTrace({rows:1000001,columns:'bad',values:[]}),errorIs(RangeError));
    assert.throws(()=>createGridTrace({rows:'bad',columns:1000001,values:[]}),errorIs(TypeError));
});
test('grid: exact values length, density, own data indices and ordinary array storage',()=>{
    for(const values of [[],[0],Array(6),new Uint8Array(6),null,{},undefined])assert.throws(()=>createGridTrace({...input(),values}),errorIs(Array.isArray(values)&&values.length!==6?RangeError:TypeError));
    let calls=0;const access=Array(6).fill(0);Object.defineProperty(access,1,{get(){calls++;return 0}});assert.throws(()=>createGridTrace({...input(),values:access}),errorIs(TypeError));assert.equal(calls,0);
    const inherited=Array(6).fill(0),prototype=Object.create(Array.prototype);delete inherited[2];Object.defineProperty(prototype,2,{value:0});Object.setPrototypeOf(inherited,prototype);assert.throws(()=>createGridTrace({...input(),values:inherited}),errorIs(TypeError));
    const value=[undefined];assert.equal(createGridTrace({rows:1,columns:1,values:value}).state.grid.values[0],undefined);
});
test('grid: list and values ceilings reject before copying elements or inspecting records',()=>{
    const t=running(),tooLong=new Proxy(Array(7),{getOwnPropertyDescriptor(target,key){if(key!=='length')throw 'element read';return Reflect.getOwnPropertyDescriptor(target,key)}});
    for(const f of [()=>t.edit({values:tooLong}),()=>t.edit({writes:tooLong}),()=>t.mark({cells:tooLong}),()=>t.mark({cellCaptions:tooLong}),()=>t.done({result:{cells:tooLong}})])assert.throws(f,errorIs(RangeError));
    const longPath=new Proxy(Array(1000001),{getOwnPropertyDescriptor(target,key){if(key!=='length')throw 'path element read';return Reflect.getOwnPropertyDescriptor(target,key)}});assert.throws(()=>t.done({result:{path:longPath}}),errorIs(RangeError));
    const first=new Proxy({},{getPrototypeOf(){throw 'record inspected'}}),sparse=[first,,];assert.throws(()=>t.edit({writes:sparse}),errorIs(TypeError));
});
test('grid: exact lifecycle, no-op indices and immutable step/event wrappers',()=>{
    const t=createGridTrace(input()),initial=t.state;assert.throws(()=>t.edit({}),errorIs(Error));const first=t.start();assert.equal(first.index,0);assert.equal(first.state,initial);assert.throws(()=>t.start(),errorIs(Error));
    const edits=[t.edit({}),t.mark({}),t.edit({values:undefined,writes:undefined,marks:undefined,rows:undefined,columns:undefined})];
    for(const [i,step]of edits.entries()){assert.equal(step.index,i+1);assert.notEqual(step.state,i?edits[i-1].state:initial);own(step)}
    const done=t.done();assert.equal(done.index,4);assert.equal(done.state.result,null);own(done);
    for(const f of [()=>t.start(),()=>t.edit({}),()=>t.mark({}),()=>t.done()])assert.throws(f,errorIs(Error));
});
test('grid: swap values, mark roles and captions together in one atomic edit',()=>{
    const t=running(),old=t.state;const step=t.edit({writes:[{row:0,column:0,value:1},{row:0,column:1,value:0}],marks:{cells:[{row:1,column:2,role:'queued'},{row:0,column:0,role:'visited'}],cellCaptions:[{row:1,column:1,text:'d=2'},{row:0,column:0,text:''}]}});
    assert.equal(step.index,1);assert.deepEqual(step.event,{type:'edit'});assert.deepEqual(step.state.grid.values,[1,0,2,3,4,5]);assert.deepEqual(old.grid.values,[0,1,2,3,4,5]);
    assert.deepEqual(step.state.cellMarks,[{row:0,column:0,role:'visited'},{row:1,column:2,role:'queued'}]);assert.deepEqual(step.state.cellCaptions,[{row:0,column:0,text:''},{row:1,column:1,text:'d=2'}]);own(step);
});
test('grid: replacement preserves marks; null patches clear and events retain supplied order',()=>{
    const t=running();const marked=t.mark({cells:[{row:1,column:2,role:'result'},{row:0,column:0,role:'custom'}],cellCaptions:[{row:0,column:0,text:'zero'}]});
    assert.equal(marked.event.cells[0].row,1);const replace=t.edit({values:[5,4,3,2,1,0]});assert.deepEqual(replace.state.cellMarks,marked.state.cellMarks);assert.deepEqual(replace.state.cellCaptions,marked.state.cellCaptions);
    assert.ok(gridScene(replace.state,{namespace:'role'}).objects.every(o=>!o.data.result));
    t.mark({cells:[{row:0,column:0,role:null}],cellCaptions:[{row:0,column:0,text:null}]});assert.deepEqual(t.state.cellCaptions,[]);assert.deepEqual(t.state.cellMarks,[{row:1,column:2,role:'result'}]);
});
test('grid: value writes require presence, allow explicit undefined and never last-write-wins',()=>{
    const t=running();assert.throws(()=>t.edit({writes:[{row:0,column:0}]}),errorIs(TypeError));assert.throws(()=>t.edit({writes:[{row:0,column:0,value:9},{row:0,column:0,value:10}]}),errorIs(RangeError));
    const step=t.edit({writes:[{row:0,column:0,value:undefined}]});assert.equal(step.index,1);assert.equal(Object.hasOwn(step.state.grid.values,0),true);assert.equal(step.state.grid.values[0],undefined);
});
test('grid: failures in later patches preserve state identity, values, index and lifecycle',()=>{
    const invalid=[{writes:[{row:0,column:1,value:9}],marks:{cells:[{row:0,column:0,role:'ok'},{row:0,column:0,role:'duplicate'}]}},
        {values:[9,8,7,6,5,4],marks:{cellCaptions:[{row:0,column:0,text:'ok'},{row:2,column:0,text:'invalid'}]}},
        {writes:[{row:0,column:1,value:9}],marks:{cells:[{row:0,column:1,role:'ok'}],cellCaptions:[{row:0,column:1,text:12}]}}];
    for(const update of invalid){const t=running(),before=t.state;assert.throws(()=>t.edit(update));assert.equal(t.state,before);const retry=t.edit({writes:[{row:0,column:1,value:6}]});assert.equal(retry.index,1);assert.deepEqual(before.grid.values,input().values);assert.equal(t.done().index,2);}
});
test('grid: result cells are independent unique selections; paths preserve nonadjacent repeats',()=>{
    const t=running();t.mark({cells:[{row:0,column:0,role:'visited'}]});const path=[cell(0,0),cell(1,2),cell(0,0),cell(0,0)],selected=[cell(1,0),cell(0,1)],done=t.done({result:{cells:selected,path}});
    assert.deepEqual(done.state.result,{cells:selected,path});path.pop();selected.pop();assert.equal(done.state.result.path.length,4);assert.equal(done.state.result.cells.length,2);own(done);
    const scene=gridScene(done.state,{namespace:'result'}),cells=scene.objects.filter(o=>o.type==='gridCell'),route=scene.objects.at(-1);
    assert.equal(cells.filter(o=>o.data.result).length,4);assert.equal(cells[0].data.role,'visited');assert.equal(route.type,'gridPath');assert.equal(route.data.cellIds[0],route.data.cellIds[2]);assert.equal(route.data.cellIds[2],route.data.cellIds[3]);assert.equal(route.zIndex,1);
});
test('grid: absent result and empty result differ; singleton path declares a route without segments',()=>{
    for(const options of [undefined,{}, {result:undefined}]){const t=running();assert.equal(t.done(options).state.result,null)}
    const empty=running().done({result:{}}).state;assert.deepEqual(empty.result,{cells:[],path:[]});assert.equal(gridScene(empty,{namespace:'empty'}).objects.length,6);
    const single=running().done({result:{path:[cell(0,0)]}}).state;assert.equal(gridScene(single,{namespace:'one'}).objects.at(-1).data.cellIds.length,1);
});
test('grid: invalid result is atomic and cells validate before the path',()=>{
    for(const result of [null,{cells:[cell(0,0),cell(0,0)]},{cells:[cell(9,0)]},{path:[cell(-1,0)]},{path:[{row:0,column:'0'}]},{path:Array(1)}]){
        const t=running(),old=t.state;assert.throws(()=>t.done({result}));assert.equal(t.state,old);assert.equal(t.done({result:{path:[cell(0,0)]}}).index,1);
    }
    const t=running(),poison=new Proxy([],{getOwnPropertyDescriptor(){throw 'path'}});assert.throws(()=>t.done({result:{cells:[cell(0,0),cell(0,0)],path:poison}}),errorIs(RangeError));
});
test('grid: recognized data fields and null-prototype records; unknown accessors are ignored',()=>{
    let calls=0;const source=Object.assign(Object.create(null),input());Object.defineProperty(source,'ignored',{get(){calls++;throw 1}});const t=createGridTrace(source);t.start();
    const update=Object.create(null);update.writes=[Object.assign(Object.create(null),{row:0,column:0,value:7})];t.edit(update);assert.equal(t.state.grid.values[0],7);assert.equal(calls,0);
    const inherited=Object.create({rows:2});inherited.columns=3;inherited.values=[];assert.throws(()=>createGridTrace(inherited),errorIs(TypeError));
    for(const key of ['rows','columns','values']){const bad={...input()};Object.defineProperty(bad,key,{get(){calls++;return 0}});assert.throws(()=>createGridTrace(bad),errorIs(TypeError))}assert.equal(calls,0);
});
test('grid: deterministic precedence for forbidden shape, exclusivity, scalars and bounds',()=>{
    const t=running(),poison=new Proxy([],{getOwnPropertyDescriptor(){throw 'values'}});
    assert.throws(()=>t.edit({rows:2,values:poison,writes:[]}),errorIs(TypeError));assert.throws(()=>t.edit({values:poison,writes:[]}),errorIs(TypeError));
    assert.throws(()=>t.mark({cells:[{row:9,column:0,role:0}]}),errorIs(TypeError));assert.throws(()=>t.edit({writes:[{row:9,column:'0',value:1}]}),errorIs(TypeError));
    assert.throws(()=>t.mark({cells:[{row:9,column:0,role:'ok'}]}),errorIs(RangeError));assert.throws(()=>t.mark({cells:[{row:0,column:0,role:'ok'}],cellCaptions:null}),errorIs(TypeError));
    let reads=0;const invalid={rows:2};Object.defineProperty(invalid,'writes',{get(){reads++;return []}});assert.throws(()=>t.edit(invalid),errorIs(TypeError));assert.equal(reads,0);
});
test('grid: mark and edit require records; optional construction/done settings reject null',()=>{
    assert.throws(()=>createGridTrace(input(),null),errorIs(TypeError));const t=running();
    for(const arg of [undefined,null,[],new Date(),false]){assert.throws(()=>t.mark(arg),errorIs(TypeError));assert.throws(()=>t.edit(arg),errorIs(TypeError));}
    assert.throws(()=>t.done(null),errorIs(TypeError));assert.equal(t.done().index,1);
});
test('grid: numeric validation applies to coordinates, not opaque payload values',()=>{
    const t=running();for(const bad of [-1,.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>t.mark({cells:[{row:bad,column:0,role:'x'}]}),errorIs(RangeError));
    for(const bad of ['0',false,null,undefined,0n])assert.throws(()=>t.mark({cells:[{row:bad,column:0,role:'x'}]}),errorIs(TypeError));
    t.edit({writes:[{row:0,column:0,value:NaN},{row:0,column:1,value:Infinity}]});assert.ok(Number.isNaN(t.state.grid.values[0]));assert.equal(t.state.grid.values[1],Infinity);
});
test('grid: original opaque Proxy exceptions including falsy values propagate without partial commit',()=>{
    for(const thrown of [undefined,null,false,0,'',Symbol('failure'),new Error('opaque')]){
        const t=running(),before=t.state,update=new Proxy({},{getOwnPropertyDescriptor(){throw thrown}});throwsSame(()=>t.edit(update),thrown);assert.equal(t.state,before);assert.equal(t.edit({}).index,1);
        const badInput=new Proxy({},{getPrototypeOf(){throw thrown}});throwsSame(()=>createGridTrace(badInput),thrown);
    }
});
test('grid: same-trace reentrancy guards arguments, permits state reads and another idle trace',()=>{
    const t=running(),other=running(),before=t.state;let nestedReads=0,nested=0;
    const poison=new Proxy({},{getPrototypeOf(){nestedReads++;throw 'nested inspected'}});
    const update=new Proxy({writes:[{row:0,column:0,value:8}]},{getOwnPropertyDescriptor(target,key){
        assert.equal(t.state,before);assert.throws(()=>t.edit(poison),errorIs(Error));assert.throws(()=>t.done(poison),errorIs(Error));other.mark({});nested++;return Reflect.getOwnPropertyDescriptor(target,key);
    }});
    assert.equal(t.edit(update).state.grid.values[0],8);assert.equal(nestedReads,0);assert.ok(nested>0);
    const old=t.state,escaping=new Proxy({},{getOwnPropertyDescriptor(){t.mark({});}});assert.throws(()=>t.edit(escaping),errorIs(Error));assert.equal(t.state,old);assert.equal(t.edit({}).index,2);
});
test('grid: lifecycle precedes any argument inspection and dispose does not exist on traces',()=>{
    let inspected=0;const poison=new Proxy({},{getPrototypeOf(){inspected++;throw 1}}),t=createGridTrace(input());
    assert.throws(()=>t.edit(poison),errorIs(Error));t.start();t.done();assert.throws(()=>t.mark(poison),errorIs(Error));assert.throws(()=>t.done(poison),errorIs(Error));assert.equal(inspected,0);assert.equal('dispose' in t,false);
});
test('grid scene: Worker-style cloned snapshots preserve canonical data and opaque references',()=>{
    const t=running();t.mark({cells:[{row:1,column:2,role:'visited'},{row:0,column:1,role:'active'}],cellCaptions:[{row:0,column:0,text:''}]});const state=t.done({result:{path:[cell(0,1),cell(1,2),cell(0,1)]}}).state;
    const clone=structuredClone(state);assert.equal(Object.isFrozen(clone),false);assert.deepEqual(gridScene(clone,{namespace:'clone'}),gridScene(state,{namespace:'clone'}));
    const value={payload:1},custom={grid:{rows:1,columns:1,values:[value]},cellMarks:[],cellCaptions:[],result:null};assert.equal(gridScene(custom,{namespace:'custom'}).objects[0].data.value,value);assert.equal(Object.isFrozen(value),false);
});
test('grid scene: malformed and noncanonical snapshots are rejected before projection',()=>{
    const initial=structuredClone(running().state),invalid=[{...initial,cellMarks:[{row:1,column:1,role:'b'},{row:0,column:0,role:'a'}]},
        {...initial,cellMarks:[{row:0,column:0,role:null}]},{...initial,cellCaptions:[{row:1,column:1,text:''},{row:0,column:0,text:''}]},
        {...initial,result:{}},{...initial,result:undefined},{...initial,result:{cells:[cell(0,0),cell(0,0)],path:[]}},{...initial,cellMarks:undefined}];
    for(const state of invalid)assert.throws(()=>gridScene(state,{namespace:'invalid'}));
    const poison=new Proxy({},{getPrototypeOf(){throw 'snapshot'}});assert.throws(()=>gridScene(poison,{namespace:''}),errorIs(TypeError));
    for(const namespace of [undefined,null,0,''])assert.throws(()=>gridScene(initial,{namespace}),errorIs(TypeError));assert.equal(gridScene(initial,{namespace:' '}).objects.length,6);
});
test('grid scene: stable namespace/coordinate IDs survive writes and distinguish cells from paths',()=>{
    const t=running(),first=gridScene(t.state,{namespace:'["grid",0]'}),next=gridScene(t.edit({values:[5,4,3,2,1,0]}).state,{namespace:'["grid",0]'});
    assert.deepEqual(first.objects.map(o=>o.id),next.objects.map(o=>o.id));assert.notEqual(first.objects[0].id,gridScene(t.state,{namespace:'other'}).objects[0].id);
    const final=gridScene(t.done({result:{path:[cell(0,0),cell(0,1)]}}).state,{namespace:'["grid",0]'});assert.equal(new Set(final.objects.map(o=>o.id)).size,7);assert.deepEqual(final.objects.map(o=>o.zIndex),[0,0,0,0,0,0,1]);
});
test('grid scene: both endpoints and path presence are available through existing scene frames',()=>{
    const t=running(),previous=t.state,current=t.edit({writes:[{row:0,column:0,value:99}]}).state,project=createSceneProjector(s=>gridScene(s,{namespace:'frame'}));
    const pair=project({previous,current,progress:.5,stepIndex:1,event:undefined}),frame=createSceneFrame(pair),first=frame.objects[0];assert.equal(first.previous.data.value,0);assert.equal(first.current.data.value,99);assert.equal(first.progress,.5);
    const final=t.done({result:{path:[cell(0,0),cell(1,1)]}}).state,withPath=createSceneFrame(project({previous:current,current:final,progress:0,stepIndex:2,event:undefined})),path=withPath.objects.at(-1);assert.equal(path.phase,'enter');assert.equal(path.presence,0);assert.ok(withPath.get(path.current.data.cellIds[1]));
    assert.equal(project(endpoint(final)).event,undefined);
});
