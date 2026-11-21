import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createListTrace,listScene} from '@grundyjs/algiviz/list';
import {createSceneFrame,createSceneProjector,createSceneRenderer} from '@grundyjs/algiviz/scene';
import {input,positions,options,slot,nodeId,pointerId,errorIs,throwsSame,owned} from './list-test-fixtures.mjs';
const running=()=>{const t=createListTrace(input(),options());t.start();return t};

test('list: owns immutable containers while retaining opaque required values',()=>{
    const opaque=new Proxy({},{get(){throw 'value read'},getPrototypeOf(){throw 'value inspected'},ownKeys(){throw 'value enumerated'}});
    const source=input(),layout=positions(),captions=[{id:'C',text:''},{id:'A',text:'first'}];source.nodes[0].value=opaque;
    const t=createListTrace(source,{layout,nodeCaptions:captions}),s=t.state;source.nodes[0].nextId=null;source.nodes.push({id:'X',value:0,nextId:null});layout[0].x=88;captions[0].text='changed';
    assert.equal(s.list.nodes[0].value,opaque);assert.equal(s.list.nodes[0].nextId,'B');assert.equal(s.layout[0].x,0);assert.deepEqual(s.nodeCaptions,[{id:'A',text:'first'},{id:'C',text:''}]);owned(s);
    assert.equal(listScene(s,{namespace:'opaque'}).objects.find(o=>o.type==='listNode').data.node.value,opaque);
});
test('list: values have no sentinel/coercion/deep-freeze policy',()=>{
    for(const value of [undefined,null,false,'',NaN,Infinity,-Infinity,0,new Uint8Array([1]),{nested:1}]){
        const t=createListTrace({headId:'A',nodes:[{id:'A',value,nextId:null}]},options(['A']));assert.equal(t.state.list.nodes[0].value,value);
        if(value&&typeof value==='object')assert.equal(Object.isFrozen(value),false);
    }
    assert.throws(()=>createListTrace({headId:'A',nodes:[{id:'A',nextId:null}]},options(['A'])),errorIs(TypeError));
});
test('list: empty and singleton lists retain the head slot and explicit null next',()=>{
    for(const ids of [[],['A']]){const t=createListTrace(input(ids),options(ids));t.start();t.edit({});t.mark({});t.setLayout(positions(ids));const s=t.done({result:{pointerIds:[slot()]}}).state;owned(s);const scene=listScene(s,{namespace:'list'});assert.equal(scene.objects.length,ids.length*2+1);assert.equal(scene.objects[0].id,pointerId());assert.equal(scene.objects[0].data.from,null);assert.equal(scene.objects[0].data.result,true);if(ids.length)assert.equal(scene.objects[1].data.to,null);}
});
test('list: lifecycle guards precede arguments; no-ops emit new outer states and consecutive indices',()=>{
    const t=createListTrace(input(),options()),initial=t.state,poison=new Proxy({},{getPrototypeOf(){throw 'inspected'}});
    for(const fn of [()=>t.edit(poison),()=>t.mark(poison),()=>t.setLayout(poison),()=>t.done(poison)])assert.throws(fn,errorIs(Error));
    const start=t.start();assert.equal(start.state,initial);assert.equal(start.index,0);assert.throws(()=>t.start(),errorIs(Error));
    let previous=initial;for(const [i,step]of [t.edit({}),t.mark({}),t.setLayout(positions())].entries()){assert.equal(step.index,i+1);assert.notEqual(step.state,previous);previous=step.state;assert.ok(Object.isFrozen(step));assert.ok(Object.isFrozen(step.event));owned(step.state)}
    assert.equal(t.done().index,4);for(const fn of [()=>t.start(),()=>t.edit(poison),()=>t.mark(poison),()=>t.setLayout(poison),()=>t.done(poison)])assert.throws(fn,errorIs(Error));assert.equal(t.dispose,undefined);
});
test('list: topology rejects invalid complete chains before options',()=>{
    const invalid=[{headId:'A',nodes:[]},{headId:null,nodes:input().nodes},{...input(),headId:'missing'},
        {headId:'A',nodes:[{id:'A',value:1,nextId:'missing'}]},
        {headId:'A',nodes:[{id:'A',value:1,nextId:'A'}]},
        {headId:'A',nodes:[{id:'A',value:1,nextId:'B'},{id:'B',value:2,nextId:'A'}]},
        {headId:'A',nodes:[{id:'A',value:1,nextId:null},{id:'B',value:2,nextId:null}]},
        {headId:'A',nodes:[{id:'A',value:1,nextId:'C'},{id:'B',value:2,nextId:'C'},{id:'C',value:3,nextId:null}]},
        {headId:'A',nodes:[{id:'A',value:1,nextId:null},{id:'B',value:2,nextId:'C'},{id:'C',value:3,nextId:'B'}]},
        {headId:'A',nodes:[{id:'A',value:1,nextId:null},{id:'A',value:2,nextId:null}]}];
    const poison=new Proxy({},{getPrototypeOf(){throw 'options'}});for(const model of invalid)assert.throws(()=>createListTrace(model,poison),errorIs(RangeError));
});
test('list: storage order differs from chain order and supports deep iterative validation',()=>{
    const source=input(['C','A','B']);source.headId='A';source.nodes[0].nextId=null;source.nodes[1].nextId='B';source.nodes[2].nextId='C';const t=createListTrace(source,options(['B','C','A']));assert.deepEqual(t.state.list.nodes.map(n=>n.id),['C','A','B']);assert.deepEqual(t.state.layout.map(p=>p.nodeId),['C','A','B']);
    const ids=Array.from({length:20000},(_,i)=>String(i));assert.equal(createListTrace(input(ids),options(ids)).state.list.nodes.length,20000);
});
test('list: insertion, roles and captions commit in one edit without an invalid intermediate state',()=>{
    const t=running(),before=t.state,nodes=before.list.nodes.map(n=>n.id==='A'?{...n,nextId:'X'}:n);nodes.push({id:'X',value:4,nextId:'B'});
    const step=t.edit({nodes,layout:positions(['A','B','C','X']),marks:{nodes:[{id:'X',role:'new'}],pointers:[{id:slot('A'),role:'changed'}],nodeCaptions:[{id:'X',text:''}]}});
    assert.equal(step.index,1);assert.deepEqual(step.event,{type:'edit'});assert.equal(step.state.list.nodes[0].nextId,'X');assert.equal(before.list.nodes[0].nextId,'B');assert.deepEqual(step.state.nodeCaptions,[{id:'X',text:''}]);owned(step.state);
});
test('list: intermediate allocation or bypass leaving unreachable nodes is rejected atomically',()=>{
    const t=running(),before=t.state;for(const nodes of [[...before.list.nodes,{id:'X',value:4,nextId:'B'}],before.list.nodes.map(n=>n.id==='A'?{...n,nextId:'C'}:n)]){assert.throws(()=>t.edit({nodes,layout:positions(nodes.map(n=>n.id))}),errorIs(RangeError));assert.equal(t.state,before)}
    assert.equal(t.edit({nodes:input(['A','X','B','C']).nodes,layout:positions(['A','X','B','C'])}).index,1);
});
test('list: deletion prunes positions, node/caption and owned-slot marks, preserving head and retargeted slots',()=>{
    const t=running();t.mark({nodes:[{id:'A',role:'a'},{id:'B',role:'b'}],pointers:[{id:slot(),role:'head'},{id:slot('A'),role:'retained'},{id:slot('B'),role:'removed'}],nodeCaptions:[{id:'B',text:'removed'},{id:'C',text:'retained'}]});
    t.edit({nodes:input(['A','C']).nodes});assert.deepEqual(t.state.layout.map(p=>p.nodeId),['A','C']);assert.deepEqual(t.state.nodeMarks,[{id:'A',role:'a'}]);assert.deepEqual(t.state.pointerMarks,[{id:slot(),role:'head'},{id:slot('A'),role:'retained'}]);assert.deepEqual(t.state.nodeCaptions,[{id:'C',text:'retained'}]);
    const before=t.state;assert.throws(()=>t.edit({nodes:input(['A']).nodes,marks:{pointers:[{id:slot('C'),role:null}]}}),errorIs(RangeError));assert.equal(t.state,before);
});
test('list: marks and captions patch canonically while mark events preserve caller order',()=>{
    const t=running(),step=t.mark({nodes:[{id:'C',role:'result'},{id:'A',role:'custom'}],pointers:[{id:slot('C'),role:'tail'},{id:slot(),role:'head'}],nodeCaptions:[{id:'C',text:''},{id:'A',text:'first'}]});
    assert.equal(step.event.nodes[0].id,'C');assert.equal(step.event.pointers[0].id.nodeId,'C');assert.deepEqual(step.state.nodeMarks.map(m=>m.id),['A','C']);assert.deepEqual(step.state.pointerMarks.map(m=>m.id),[slot(),slot('C')]);
    assert.ok(listScene(step.state,{namespace:'roles'}).objects.every(o=>!o.data.result));t.mark({nodes:[{id:'A',role:null}],pointers:[{id:slot(),role:null}],nodeCaptions:[{id:'C',text:null}]});assert.deepEqual(t.state.nodeCaptions,[{id:'A',text:'first'}]);owned(t.state);
});
test('list: failures late in an edit preserve state, index and both new/removed ID history',()=>{
    const t=running(),before=t.state;const candidate=input(['A','X']);
    assert.throws(()=>t.edit({...candidate,layout:positions(['A','X']),marks:{nodeCaptions:[{id:'X',text:99}]}}),errorIs(TypeError));assert.equal(t.state,before);
    assert.equal(t.edit({}).index,1);assert.equal(t.edit({nodes:input(['C','B','A']).nodes,headId:'C'}).index,2);
    assert.equal(t.edit({...candidate,layout:positions(['A','X'])}).index,3);assert.equal(t.state.list.nodes[1].id,'X');
});
test('list: retired IDs cannot return, retained IDs can change value and a fresh trace can restart',()=>{
    const t=running();t.edit({nodes:input(['A','C']).nodes});const before=t.state;assert.throws(()=>t.edit({nodes:input().nodes,layout:positions()}),errorIs(RangeError));assert.equal(t.state,before);
    t.edit({nodes:[{id:'A',value:88,nextId:'C'},{id:'C',value:99,nextId:null}]});assert.equal(t.state.list.nodes[0].value,88);
    t.edit({headId:null,nodes:[]});assert.throws(()=>t.edit({headId:'A',nodes:input(['A']).nodes,layout:positions(['A'])}),errorIs(RangeError));
    const fresh=createListTrace(input(),options());assert.equal(fresh.start().index,0);assert.equal(fresh.state.list.nodes[1].id,'B');
});
test('list: reversal retains node and slot identities and layout changes are explicit',()=>{
    const t=running(),before=listScene(t.state,{namespace:'list'});t.edit({headId:'C',nodes:input(['C','B','A']).nodes});const after=listScene(t.state,{namespace:'list'});assert.deepEqual(new Set(before.objects.map(o=>o.id)),new Set(after.objects.map(o=>o.id)));assert.equal(t.state.layout.find(p=>p.nodeId==='C').x,2);
    t.setLayout(positions(['A','C','B']));assert.equal(t.state.layout.find(p=>p.nodeId==='C').x,1);assert.equal(t.state.list.headId,'C');
});
test('list: complete layout is mandatory and new nodes cannot inherit an implicit position',()=>{
    assert.throws(()=>createListTrace(input()),errorIs(TypeError));const t=running(),before=t.state;
    for(const layout of [[],positions(['A','B']),positions(['A','B','X']),[{nodeId:'A',x:0,y:0},{nodeId:'A',x:1,y:0},{nodeId:'C',x:2,y:0}]])assert.throws(()=>t.setLayout(layout),errorIs(RangeError));
    assert.throws(()=>t.edit({nodes:input(['A','B','C','X']).nodes}),errorIs(RangeError));assert.equal(t.state,before);
    for(const x of [null,'0',{},undefined])assert.throws(()=>t.setLayout([{nodeId:'A',x,y:0},...positions().slice(1)]),errorIs(TypeError));for(const x of [NaN,Infinity,-Infinity])assert.throws(()=>t.setLayout([{nodeId:'A',x,y:0},...positions().slice(1)]),errorIs(RangeError));
});
test('list: result nodes and slots are independent ordered selections, including head/null slots',()=>{
    const t=running();t.mark({nodes:[{id:'B',role:'selected'}]});const nodes=['C','A'],pointers=[slot('C'),slot()];const step=t.done({result:{nodeIds:nodes,pointerIds:pointers}});nodes.pop();pointers[0].nodeId='A';assert.deepEqual(step.state.result,{nodeIds:['C','A'],pointerIds:[slot('C'),slot()]});owned(step.state);
    const scene=listScene(step.state,{namespace:'list'});assert.equal(scene.objects.find(o=>o.id===pointerId('C')).data.to,null);assert.equal(scene.objects.find(o=>o.id===pointerId('C')).data.result,true);assert.equal(scene.objects.find(o=>o.id===pointerId('A')).data.result,false);assert.equal(scene.objects.find(o=>o.id===nodeId('B')).data.role,'selected');assert.equal(scene.objects.find(o=>o.id===nodeId('B')).data.result,false);
});
test('list: absent and empty results differ; invalid results preserve lifecycle for corrected retry',()=>{
    for(const opts of [undefined,{}, {result:undefined}])assert.equal(running().done(opts).state.result,null);
    assert.deepEqual(running().done({result:{}}).state.result,{nodeIds:[],pointerIds:[]});
    for(const result of [null,{nodeIds:['missing']},{nodeIds:['A','A']},{pointerIds:[slot(),slot()]},{pointerIds:[slot('missing')]},{pointerIds:['A']}]){const t=running(),before=t.state;assert.throws(()=>t.done({result}));assert.equal(t.state,before);assert.equal(t.done({result:{pointerIds:[slot()]}}).index,1)}
});
test('list: pointer IDs use structural slot equality, closed kinds and owner membership',()=>{
    for(const id of [null,undefined,'A',{}, {kind:''},{kind:1},{kind:'next'},{kind:'next',nodeId:''}])assert.throws(()=>running().mark({pointers:[{id,role:'x'}]}),errorIs(TypeError));
    for(const id of [{kind:'prev',nodeId:'A'},{kind:'next',nodeId:'missing'}])assert.throws(()=>running().mark({pointers:[{id,role:'x'}]}),errorIs(RangeError));
    assert.throws(()=>running().mark({pointers:[{id:slot('A'),role:'one'},{id:{kind:'next',nodeId:'A'},role:'two'}]}),errorIs(RangeError));
    let reads=0;const id={kind:'head'};Object.defineProperty(id,'nodeId',{get(){reads++;throw 'unknown head field'}});const t=running();t.mark({pointers:[{id,role:'head'}]});assert.equal(reads,0);assert.deepEqual(t.state.pointerMarks[0].id,slot());
});
test('list: roles/captions reject duplicates, invalid text and unknown references atomically',()=>{
    for(const update of [{nodes:[{id:'A',role:''}]},{nodes:[{id:'A',role:false}]},{nodes:[{id:'A',role:'x'},{id:'A',role:null}]},{nodes:[{id:'missing',role:'x'}]},{nodeCaptions:[{id:'A',text:7}]},{nodeCaptions:[{id:'A',text:''},{id:'A',text:null}]}]){const t=running(),before=t.state;assert.throws(()=>t.mark(update));assert.equal(t.state,before)}
    assert.throws(()=>createListTrace(input(),{layout:positions(),nodeCaptions:[{id:'A',text:'x'},{id:'A',text:'y'}]}),errorIs(RangeError));
});
test('list: recognized fields require own data properties; unknown accessors and inherited optional fields are ignored',()=>{
    let calls=0;const source=input();Object.defineProperty(source.nodes[0],'value',{get(){calls++;return 1}});assert.throws(()=>createListTrace(source,options()),errorIs(TypeError));assert.equal(calls,0);
    const t=running(),update=Object.create(null);Object.defineProperty(update,'unknown',{get(){calls++;throw 'unknown'}});t.edit(update);assert.equal(calls,0);
    const inherited=Object.create(null);Object.setPrototypeOf(inherited,Object.prototype);Object.defineProperty(Object.prototype,'marks',{get(){calls++;throw 'inherited'},configurable:true});try{t.edit(inherited)}finally{delete Object.prototype.marks}assert.equal(calls,0);
    const nullNode=Object.assign(Object.create(null),{id:'__proto__',value:undefined,nextId:null});assert.equal(createListTrace({headId:'__proto__',nodes:[nullNode]},options(['__proto__'])).state.list.nodes[0].id,'__proto__');
});
test('list: array density precedes element records and rejects accessors/inherited elements',()=>{
    const first=new Proxy({},{getPrototypeOf(){throw 'record'}});assert.throws(()=>createListTrace({headId:'A',nodes:[first,,]},options()),errorIs(TypeError));
    let calls=0;const nodes=input().nodes;Object.defineProperty(nodes,1,{get(){calls++;throw 'getter'}});assert.throws(()=>createListTrace({headId:'A',nodes},options()),errorIs(TypeError));assert.equal(calls,0);
    const inherited=input().nodes,proto=Object.create(Array.prototype);Object.defineProperty(proto,1,{value:inherited[1]});delete inherited[1];Object.setPrototypeOf(inherited,proto);assert.throws(()=>createListTrace({headId:'A',nodes:inherited},options()),errorIs(TypeError));
    assert.throws(()=>createListTrace({headId:null,nodes:new Uint8Array()},options([])),errorIs(TypeError));
});
test('list: ceilings reject before element capture for nodes, layout, marks, captions and results',()=>{
    const oversized=length=>new Proxy(Array(length),{getOwnPropertyDescriptor(target,key){if(key!=='length')throw 'element';return Reflect.getOwnPropertyDescriptor(target,key)}});
    assert.throws(()=>createListTrace({headId:null,nodes:oversized(1000001)},options([])),errorIs(RangeError));const t=running();
    for(const fn of [()=>t.setLayout(oversized(4)),()=>t.mark({nodes:oversized(4)}),()=>t.mark({pointers:oversized(5)}),()=>t.mark({nodeCaptions:oversized(4)}),()=>t.done({result:{nodeIds:oversized(4)}}),()=>t.done({result:{pointerIds:oversized(5)}})])assert.throws(fn,errorIs(RangeError));
});
test('list: malformed reported array lengths fail before elements and recognized getters never run',()=>{
    for(const length of [-1,1.5,NaN,Infinity,'0',undefined,0x100000000]){
        const nodes=new Proxy([],{getOwnPropertyDescriptor(target,key){if(key==='length')return {value:length,writable:true,enumerable:false,configurable:false};throw 'element'}});
        assert.throws(()=>createListTrace({headId:null,nodes},options([])),errorIs(TypeError));
    }
    const t=running();let reads=0;for(const [method,key]of [['edit','nodes'],['mark','pointers'],['done','result']]){const value={};Object.defineProperty(value,key,{get(){reads++;throw 'getter'}});assert.throws(()=>t[method](value),errorIs(TypeError))}assert.equal(reads,0);
});
test('list: mark events and snapshots capture pointer/patch containers independently of caller mutation',()=>{
    const t=running(),id=slot('A'),nodes=[{id:'B',role:'active'}],pointers=[{id,role:'changed'}],nodeCaptions=[{id:'C',text:'tail'}];const step=t.mark({nodes,pointers,nodeCaptions});
    id.nodeId='C';nodes[0].role='changed';pointers.pop();nodeCaptions[0].text='changed';assert.deepEqual(step.event.pointers,[{id:slot('A'),role:'changed'}]);assert.deepEqual(step.state.nodeMarks,[{id:'B',role:'active'}]);assert.deepEqual(step.state.nodeCaptions,[{id:'C',text:'tail'}]);for(const value of [step.event.nodes,step.event.pointers,step.event.nodeCaptions,step.event.pointers[0],step.event.pointers[0].id])assert.ok(Object.isFrozen(value));
});
test('list: validation precedence covers descriptors, head, nodes, topology, retirement, layout and patches',()=>{
    const poison=new Proxy([],{getOwnPropertyDescriptor(){throw 'nodes'}});assert.throws(()=>createListTrace({headId:undefined,nodes:poison},options()),errorIs(TypeError));
    const t=running();assert.throws(()=>t.edit({headId:undefined,nodes:input().nodes,layout:null,marks:null}),errorIs(TypeError));
    t.edit({nodes:input(['A','C']).nodes});assert.throws(()=>t.edit({nodes:input().nodes,layout:new Proxy([],{getOwnPropertyDescriptor(){throw 'layout'}})}),errorIs(RangeError));
    assert.throws(()=>t.mark({nodes:[{id:'A',role:1}],pointers:[{id:{kind:'other'},role:'x'}]}),errorIs(TypeError));
    assert.throws(()=>t.done({result:{nodeIds:['missing'],pointerIds:[null]}}),errorIs(RangeError));
});
test('list: original Proxy exceptions, including falsy throws, preserve committed state and next index',()=>{
    for(const error of [undefined,null,false,0,'',Symbol('error'),new Error('original')]){const t=running(),before=t.state;const nodes=new Proxy([],{getOwnPropertyDescriptor(){throw error}});throwsSame(()=>t.edit({nodes}),error);assert.equal(t.state,before);assert.equal(t.edit({}).index,1)}
});
test('list: same-trace reentrancy guards arguments, permits state reads and another trace, and resets busy',()=>{
    const t=running(),other=running(),before=t.state;let guarded=0;const poison=new Proxy({},{getPrototypeOf(){throw 'nested argument'}});const update=new Proxy({},{getPrototypeOf(target){assert.equal(t.state,before);assert.throws(()=>t.edit(poison),errorIs(Error));assert.throws(()=>t.done(poison),errorIs(Error));other.mark({});guarded++;return Reflect.getPrototypeOf(target)}});
    assert.equal(t.edit(update).index,1);assert.ok(guarded);assert.equal(other.done().index,guarded+1);assert.equal(t.edit({}).index,2);
});
test('list: wrong records and scalar IDs are rejected without coercion',()=>{
    for(const value of [undefined,null,[],new Date(),1,'x'])assert.throws(()=>createListTrace(value,options()),errorIs(TypeError));
    for(const id of ['',0,null,undefined,{},new String('A')])assert.throws(()=>createListTrace({headId:'A',nodes:[{id,value:1,nextId:null}]},options(['A'])),errorIs(TypeError));
    const t=running();for(const value of [undefined,null,[],1]){assert.throws(()=>t.edit(value),errorIs(TypeError));assert.throws(()=>t.mark(value),errorIs(TypeError))}assert.throws(()=>t.done(null),errorIs(TypeError));
});
test('list scene: cloned snapshots preserve canonical data and original immutable node/position references',()=>{
    const t=running();const state=t.done({result:{nodeIds:['B'],pointerIds:[slot('A')]}}).state,clone=structuredClone(state),scene=listScene(clone,{namespace:'list'});assert.deepEqual(scene,listScene(state,{namespace:'list'}));
    const node=scene.objects.find(o=>o.id===nodeId('A'));assert.equal(node.data.node,clone.list.nodes[0]);assert.equal(node.data.position,clone.layout[0]);assert.equal(Object.isFrozen(clone.list.nodes[0]),false);assert.ok(Object.isFrozen(node.data));assert.ok(Object.isFrozen(scene.objects));
});
test('list scene: malformed, incomplete and noncanonical snapshots are rejected before projection',()=>{
    const t=running();t.mark({nodes:[{id:'A',role:'a'},{id:'C',role:'c'}],pointers:[{id:slot(),role:'h'},{id:slot('A'),role:'a'}],nodeCaptions:[{id:'A',text:'a'},{id:'B',text:'b'}]});const s=t.state;
    for(const patch of [{layout:[...s.layout].reverse()},{nodeMarks:[...s.nodeMarks].reverse()},{pointerMarks:[...s.pointerMarks].reverse()},{nodeCaptions:[...s.nodeCaptions].reverse()},{nodeMarks:[{id:'A',role:null}]},{result:{}},{result:{nodeIds:[],pointerIds:[slot('missing')]}},{list:{...s.list,headId:null}},{pointerMarks:undefined}])assert.throws(()=>listScene({...s,...patch},{namespace:'bad'}));
    const poison=new Proxy({},{getPrototypeOf(){throw 'snapshot'}});assert.throws(()=>listScene(poison,{namespace:''}),errorIs(TypeError));
});
test('list scene: IDs are namespace/domain separated, pointer targets and nulls are explicit',()=>{
    const t=createListTrace(input(['head','next','A\",next']),options(['head','next','A\",next'])),s=listScene(t.state,{namespace:'list'});assert.equal(new Set(s.objects.map(o=>o.id)).size,7);assert.deepEqual(s.objects.map(o=>o.type),['listPointer','listPointer','listPointer','listPointer','listNode','listNode','listNode']);assert.deepEqual(s.objects.map(o=>o.zIndex),[0,0,0,0,1,1,1]);
    assert.equal(s.objects[0].data.to,nodeId('head'));assert.equal(s.objects[1].data.from,nodeId('head'));assert.equal(s.objects[3].data.to,null);assert.equal(s.objects[4].data.head,true);assert.equal(s.objects[6].data.tail,true);assert.notEqual(s.objects[0].id,listScene(t.state,{namespace:'other'}).objects[0].id);
});
test('list scene: retargeting, new and removed nodes expose both endpoints at zero presence',()=>{
    const t=running(),before=t.state,after=t.edit({nodes:input(['A','X','B','C']).nodes,layout:positions(['A','X','B','C'])}).state,project=createSceneProjector(s=>listScene(s,{namespace:'list'}));
    const frame=createSceneFrame(project({previous:before,current:after,progress:0,stepIndex:1,event:{type:'edit'}})),p=frame.get(pointerId('A'));assert.equal(p.phase,'update');assert.equal(p.previous.data.to,nodeId('B'));assert.equal(p.current.data.to,nodeId('X'));assert.equal(frame.get(nodeId('X')).presence,0);assert.ok(frame.get(p.current.data.to));
    const removed=t.edit({nodes:input(['A','C']).nodes}).state,s=createSceneFrame(project({previous:after,current:removed,progress:1,stepIndex:2,event:undefined}));assert.equal(s.get(nodeId('B')).presence,0);assert.equal(s.get(pointerId('B')).phase,'exit');
    let pointerCount=0;createSceneRenderer({listPointer(_c,o,scene){pointerCount++;for(const e of [o.previous,o.current])if(e)for(const id of [e.data.from,e.data.to])if(id!==null)assert.ok(scene.get(id))},listNode(){}}).render(null,project({previous:after,current:removed,progress:.5,stepIndex:2,event:undefined}));assert.equal(pointerCount,5);
});
