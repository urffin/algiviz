import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTreeTrace, treeScene } from '@grundyjs/algiviz/tree';
import { graphScene, createGraphTrace } from '@grundyjs/algiviz/graph';
import { createSceneProjector, createSceneFrame } from '@grundyjs/algiviz/scene';
import { input, layout, rotation, errorIs, accessor, endpoint, owned } from './tree-test-fixtures.mjs';
const trace = (kind = 'binary') => createTreeTrace(input(kind), { layout: layout() });
const project = state => treeScene(state, { namespace: 'tree' });
const clone = value => structuredClone(value);

test('tree: captures owned immutable structure now, without inspecting or freezing payload', () => {
    const model = input(), positions = layout(), payload = new Proxy({}, { ownKeys() { assert.fail('Payload inspected'); } });
    model.nodes[0].data = payload; model.links[0].data = payload;
    Object.defineProperty(model.nodes[0], 'ignored', { get() { assert.fail('Unknown field inspected'); } });
    const captions = [{ id: 'C', text: '' }, { id: 'A', text: 'root' }];
    const t = createTreeTrace(model, { layout: positions.reverse(), nodeCaptions: captions }), initial = t.state;
    model.nodes[0].id = 'changed'; model.links[0].parentId = 'changed'; positions[0].x = 99; captions[0].text = 'changed';
    assert.equal(initial.tree.nodes[0].id, 'A'); assert.equal(initial.tree.links[0].parentId, 'A');
    assert.equal(initial.tree.nodes[0].data, payload); assert.equal(initial.tree.links[0].data, payload);
    assert.equal(Object.isFrozen(payload), false); assert.equal(Object.hasOwn(initial.tree.nodes[0], 'ignored'), false);
    assert.deepEqual(initial.layout, layout()); assert.deepEqual(initial.nodeCaptions, [{ id: 'A', text: 'root' }, { id: 'C', text: '' }]);
    const start = t.start(); assert.equal(start.state, initial); owned(start); owned(initial); assert.ok(Object.isFrozen(t));
});

test('tree: empty/singleton/null-prototype input and no-op commands have explicit layout and consecutive indices', () => {
    for (const kind of ['ordered', 'binary']) {
        const t = createTreeTrace({ kind, rootId: null, nodes: [], links: [] }, { layout: [] });
        assert.equal(t.start().index, 0); let old = t.state;
        for (const command of [() => t.edit({}), () => t.mark({}), () => t.setLayout([])]) {
            const step = command(); assert.notEqual(step.state, old); assert.deepEqual(step.state, old); old = step.state; owned(step);
        }
        assert.equal(t.done({ result: {} }).index, 4); assert.deepEqual(t.state.result, { nodeIds: [], linkIds: [] });
        assert.deepEqual(project(t.state).objects, []);
    }
    const model = Object.assign(Object.create(null), { kind: 'ordered', rootId: ' ', nodes: [Object.assign(Object.create(null), { id: ' ' })], links: [] });
    const t = createTreeTrace(model, { layout: [{ nodeId: ' ', x: -2, y: 9 }] });
    assert.equal(project(t.state).objects[0].data.root, true); assert.equal(t.state.tree.rootId, ' ');
    for (const options of [undefined, null, {}, { layout: undefined }]) assert.throws(() => createTreeTrace(input(), options), errorIs(TypeError));
});

test('tree: binary right-only child remains right, slots are unique and ordered input has no slots', () => {
    const t = trace(); assert.equal(t.state.tree.links.find(l => l.parentId === 'B').slot, 'right');
    assert.equal(project(t.state).objects.filter(o => o.type === 'treeLink' && o.data.link.parentId === 'B').length, 1);
    const reversed = createTreeTrace({ ...input(), links: input().links.reverse() }, { layout: layout() });
    assert.equal(reversed.state.tree.links.find(l => l.childId === 'C').slot, 'right');
    const cases = [
        [m => { delete m.links[0].slot; }, TypeError], [m => { m.links[0].slot = null; }, TypeError],
        [m => { m.links[0].slot = ''; }, TypeError], [m => { m.links[0].slot = 'middle'; }, RangeError],
        [m => { m.links[0].slot = 'right'; }, RangeError],
    ];
    for (const [change, Type] of cases) { const m = input(); change(m); assert.throws(() => createTreeTrace(m, { layout: layout() }), errorIs(Type)); }
    assert.throws(() => createTreeTrace({ ...input(), kind: 'ordered' }, { layout: layout() }), errorIs(TypeError));
    const ordered = trace('ordered'); ordered.start(); const before = ordered.state;
    ordered.edit({ links: [...ordered.state.tree.links].reverse() });
    assert.deepEqual(ordered.state.tree.links.filter(l => l.parentId === 'A').map(l => l.childId), ['C', 'B']);
    assert.deepEqual(before.tree.links.filter(l => l.parentId === 'A').map(l => l.childId), ['B', 'C']);
});

test('tree: atomic rotation changes root and endpoints while preserving explicit node/link identities and attributes', () => {
    for (const kind of ['ordered', 'binary']) {
        const t = trace(kind); t.start(); const before = t.mark({ nodes: [{ id: 'A', role: 'active' }], links: [{ id: 'right', role: 'app:path' }], nodeCaptions: [{ id: 'A', text: '' }] }).state;
        const step = t.edit(rotation(kind)); owned(step);
        assert.equal(step.event.type, 'edit'); assert.equal(step.state.tree.rootId, 'C');
        assert.deepEqual(step.state.tree.nodes.map(n => n.id), before.tree.nodes.map(n => n.id));
        assert.deepEqual(step.state.tree.links.map(l => l.id), before.tree.links.map(l => l.id));
        assert.equal(before.tree.links[1].parentId, 'A'); assert.equal(step.state.tree.links[1].parentId, 'C');
        assert.deepEqual(step.state.nodeMarks, before.nodeMarks); assert.deepEqual(step.state.linkMarks, before.linkMarks); assert.deepEqual(step.state.nodeCaptions, before.nodeCaptions);
        assert.equal(step.state.layout[0].y, 1); assert.equal(before.layout[0].y, 0);
    }
});

test('tree: edit replaces collections, inserts with complete layout, prunes removed attributes and clears atomically', () => {
    const t = trace(); t.start();
    t.mark({ nodes: [{ id: 'A', role: 'stay' }, { id: 'B', role: 'remove' }, { id: 'D', role: 'remove' }], links: [{ id: 'A', role: 'remove' }, { id: 'right', role: 'stay' }], nodeCaptions: [{ id: 'B', text: 'remove' }, { id: 'C', text: 'stay' }] });
    const old = t.state;
    const nodes = [...old.tree.nodes, { id: 'E' }], links = [...old.tree.links, { id: 'new', parentId: 'C', childId: 'E', slot: 'right' }];
    assert.throws(() => t.edit({ nodes, links }), errorIs(RangeError)); assert.equal(t.state, old);
    const inserted = t.edit({ nodes, links, layout: [...layout(), { nodeId: 'E', x: 2, y: 2 }] }); assert.equal(inserted.index, 2);
    nodes[4].id = 'mutated'; links[3].slot = 'left'; assert.equal(t.state.tree.nodes[4].id, 'E'); assert.equal(t.state.tree.links[3].slot, 'right');
    assert.throws(() => t.edit({ nodes: [{ id: 'A' }, { id: 'C' }] }), errorIs(RangeError));
    t.edit({ nodes: [{ id: 'C' }, { id: 'A' }], links: [{ id: 'right', parentId: 'A', childId: 'C', slot: 'right' }] });
    assert.deepEqual(t.state.nodeMarks, [{ id: 'A', role: 'stay' }]); assert.deepEqual(t.state.linkMarks, [{ id: 'right', role: 'stay' }]);
    assert.deepEqual(t.state.nodeCaptions, [{ id: 'C', text: 'stay' }]); assert.deepEqual(t.state.layout.map(p => p.nodeId), ['C', 'A']);
    assert.equal(old.tree.nodes.length, 4); assert.equal(old.nodeMarks.length, 3);
    const beforeClear = t.state; assert.throws(() => t.edit({ nodes: [], links: [] }), errorIs(RangeError)); assert.equal(t.state, beforeClear);
    t.edit({ rootId: null, nodes: [], links: [] }); assert.deepEqual(t.state.tree.nodes, []); assert.deepEqual(t.state.layout, []); assert.deepEqual(t.state.nodeMarks, []);
    assert.throws(() => t.edit({ kind: 'binary' }), errorIs(TypeError));
});

test('tree: retired IDs cannot return, domains are independent and failed edits reserve or retire nothing', () => {
    const t = trace(); t.start(); const initial = t.state;
    const partial = { nodes: initial.tree.nodes.filter(n => n.id !== 'D'), links: initial.tree.links.filter(l => l.id !== 'child') };
    assert.throws(() => t.edit({ ...partial, layout: [] }), errorIs(RangeError)); assert.equal(t.state, initial);
    assert.equal(t.edit({}).index, 1); // D/child were not retired by the failed deletion.
    t.edit(partial);
    assert.throws(() => t.edit({ nodes: initial.tree.nodes, links: initial.tree.links, layout: initial.layout }), errorIs(RangeError));
    const before = t.state;
    const badNew = { nodes: [...before.tree.nodes, { id: 'E' }], links: [...before.tree.links, { id: 'new', parentId: 'C', childId: 'E', slot: 'right' }] };
    assert.throws(() => t.edit({ ...badNew, layout: [] }), errorIs(RangeError)); assert.equal(t.state, before);
    t.edit({ ...badNew, layout: [...before.layout, { nodeId: 'E', x: 2, y: 2 }] });
    // Replace relation 'right' with 'next', retiring only the old link ID.
    t.edit({ links: t.state.tree.links.map(l => l.id === 'right' ? { ...l, id: 'next' } : l) });
    assert.throws(() => t.edit({ links: t.state.tree.links.map(l => l.id === 'next' ? { ...l, id: 'right' } : l) }), errorIs(RangeError));
    t.edit({ nodes: [...t.state.tree.nodes, { id: 'right' }], links: [...t.state.tree.links, { id: 'D', parentId: 'C', childId: 'right', slot: 'left' }], layout: [...t.state.layout, { nodeId: 'right', x: 0, y: 2 }] });
    assert.ok(t.state.tree.nodes.some(n => n.id === 'right')); assert.ok(t.state.tree.links.some(l => l.id === 'D'));
    assert.doesNotThrow(() => project(initial)); assert.doesNotThrow(() => createTreeTrace(initial.tree, { layout: initial.layout }));
});

test('tree: roles/captions patch atomically in event order, snapshot order follows entities and null clears', () => {
    const t = trace(); t.start(); const nodes = [{ id: 'C', role: 'visited' }, { id: 'A', role: 'result' }];
    const step = t.mark({ nodes, links: [{ id: 'right', role: 'selected' }], nodeCaptions: [{ id: 'C', text: '' }, { id: 'A', text: 'root' }] });
    assert.deepEqual(step.event.nodes, nodes); assert.deepEqual(step.state.nodeMarks, [nodes[1], nodes[0]]); assert.equal(step.state.result, null); owned(step);
    nodes[0].role = 'changed'; assert.equal(step.event.nodes[0].role, 'visited');
    const before = t.state;
    assert.throws(() => t.mark({ nodes: [{ id: 'A', role: 'changed' }], nodeCaptions: [{ id: 'missing', text: 'bad' }] }), errorIs(RangeError)); assert.equal(t.state, before);
    t.mark({ nodes: [{ id: 'A', role: null }], links: [{ id: 'right', role: null }], nodeCaptions: [{ id: 'A', text: null }] });
    assert.deepEqual(t.state.nodeMarks, [{ id: 'C', role: 'visited' }]); assert.deepEqual(t.state.linkMarks, []);
    const scene = project(t.state); assert.equal(scene.objects.find(o => o.type === 'treeNode' && o.data.node.id === 'C').data.caption, '');
    assert.equal(scene.objects.find(o => o.type === 'treeNode' && o.data.node.id === 'A').data.caption, null);
    t.setLayout(layout().map(p => ({ ...p, x: p.x + 1 }))); assert.deepEqual(t.state.nodeCaptions, [{ id: 'C', text: '' }]);
});

test('tree: done selections are independent, unique, copied and keep caller order', () => {
    const t = trace(); t.start(); t.mark({ nodes: [{ id: 'A', role: 'active' }] }); const before = t.state;
    assert.throws(() => t.done({ result: { nodeIds: ['C', 'C'] } }), errorIs(RangeError));
    assert.throws(() => t.done({ result: { linkIds: ['right', 'right'] } }), errorIs(RangeError)); assert.equal(t.state, before);
    const nodeIds = ['C', 'A'], linkIds = ['child']; const done = t.done({ result: { nodeIds, linkIds } }); owned(done);
    nodeIds.reverse(); linkIds.length = 0; assert.deepEqual(done.state.result, { nodeIds: ['C', 'A'], linkIds: ['child'] });
    assert.equal(done.state.nodeMarks[0].role, 'active'); assert.equal(before.result, null);
    for (const options of [undefined, {}, { result: undefined }, { result: {} }, { result: { nodeIds: undefined } }]) {
        const t = trace(); t.start(); assert.deepEqual(t.done(options).state.result, options?.result === undefined ? null : { nodeIds: [], linkIds: [] });
    }
    const onlyLink = trace(); onlyLink.start(); onlyLink.done({ result: { linkIds: ['right'] } });
    const scene = project(onlyLink.state); assert.equal(scene.objects.filter(o => o.type === 'treeNode' && o.data.result).length, 0);
    assert.equal(scene.objects.filter(o => o.type === 'treeLink' && o.data.result).length, 1);
});

test('tree: malformed records/scalars and forbidden hierarchy fail before construction commits', () => {
    for (const value of [undefined, null, [], new Map(), new Date(), 3, 'tree', {}, accessor('kind', { rootId: null, nodes: [], links: [] })]) {
        assert.throws(() => createTreeTrace(value, { layout: [] }), errorIs(TypeError));
    }
    const cases = [
        [m => { m.kind = ''; }, TypeError], [m => { m.kind = 'forest'; }, RangeError],
        [m => { m.rootId = 0; }, TypeError], [m => { m.rootId = ''; }, TypeError],
        [m => { m.rootId = null; }, RangeError], [m => { m.rootId = 'unknown'; }, RangeError],
        [m => { m.nodes[0].id = ''; }, TypeError], [m => { m.nodes[0].label = 1; }, TypeError],
        [m => { m.nodes[1].id = 'A'; }, RangeError], [m => { m.links[1].id = 'A'; }, RangeError],
        [m => { m.links[0].parentId = 'missing'; }, RangeError], [m => { m.links[0].childId = null; }, TypeError],
        [m => { m.links[0].childId = 'missing'; }, RangeError], [m => { m.links[0].childId = 'A'; }, RangeError],
        [m => { m.links[1].childId = 'B'; }, RangeError], [m => { m.links.pop(); }, RangeError],
        [m => { m.links.push({ id: 'cycle', parentId: 'D', childId: 'A', slot: 'right' }); }, RangeError],
        [m => { m.links[2].childId = 'C'; }, RangeError],
    ];
    for (const [change, Type] of cases) { const m = input(); change(m); assert.throws(() => createTreeTrace(m, { layout: layout() }), errorIs(Type)); }
    const disconnected = { kind: 'ordered', rootId: 'A', nodes: [{id:'A'},{id:'B'},{id:'C'}], links:[{id:'b',parentId:'B',childId:'C'},{id:'c',parentId:'C',childId:'B'}] };
    assert.throws(() => createTreeTrace(disconnected, { layout: [] }), errorIs(RangeError));
    assert.throws(() => createTreeTrace({ kind:'binary', rootId:'A', nodes:[], links:[] }, {layout:[]}), errorIs(RangeError));
});

test('tree: dense own arrays, data descriptors and malformed reported lengths are checked without getters/coercion', () => {
    const bad = [null, {}, new Set(), new Uint8Array(1), new Array(1), accessor('0', [{}]), Object.setPrototypeOf(new Array(1), Object.assign(Object.create(Array.prototype), {0:{}}))];
    for (const value of bad) for (const field of ['nodes', 'links']) assert.throws(() => createTreeTrace({ ...input(), [field]:value }, {layout:layout()}), errorIs(TypeError));
    for (const value of [NaN, -1, 1.5, '1', 0x100000000]) {
        const nodes = new Proxy([], { getOwnPropertyDescriptor(target,key) { if(key==='length')return {...Reflect.getOwnPropertyDescriptor(target,key),value};assert.fail('Elements read before length validation'); } });
        assert.throws(() => createTreeTrace({ ...input(), nodes }, {layout:layout()}), errorIs(TypeError));
    }
    for (const key of ['id','label','data']) { const m=input();m.nodes[0]=accessor(key,m.nodes[0]);assert.throws(()=>createTreeTrace(m,{layout:layout()}),errorIs(TypeError)); }
    for (const key of ['id','parentId','childId','slot','label','data']) { const m=input();m.links[0]=accessor(key,m.links[0]);assert.throws(()=>createTreeTrace(m,{layout:layout()}),errorIs(TypeError)); }
    class Record { id = 'A'; }
    const m=input();m.nodes[0]=new Record();assert.throws(()=>createTreeTrace(m,{layout:layout()}),errorIs(TypeError));
    const poisonedNode=accessor('id',{}), nodes=[poisonedNode,,];
    assert.throws(()=>createTreeTrace({...input(),nodes},{layout:layout()}), e=>e.constructor===TypeError&&!e.message.includes('Getter invoked'));
});

test('tree: complete layouts, mark/caption inputs and result references have transactional validation', () => {
    const t=trace();t.start();const before=t.state;
    const operations=[
        [()=>t.setLayout([]),RangeError], [()=>t.setLayout([...layout(),layout()[0]]),RangeError],
        [()=>t.setLayout(layout().map((p,i)=>i===0?{...p,x:Infinity}:p)),RangeError],
        [()=>t.setLayout(layout().map((p,i)=>i===0?{...p,y:'0'}:p)),TypeError],
        [()=>t.setLayout(layout().map((p,i)=>i===0?{...p,nodeId:'missing'}:p)),RangeError],
        [()=>t.mark(),TypeError], [()=>t.mark({nodes:[{id:'A',role:''}]}),TypeError],
        [()=>t.mark({nodes:[{id:'A',role:'ok'},{id:'A',role:null}]}),RangeError],
        [()=>t.mark({links:[{id:'missing',role:'x'}]}),RangeError],
        [()=>t.mark({nodeCaptions:[{id:'A',text:undefined}]}),TypeError],
        [()=>t.mark({nodeCaptions:[{id:'A',text:'x'},{id:'A',text:null}]}),RangeError],
        [()=>t.done(null),TypeError], [()=>t.done({result:null}),TypeError],
        [()=>t.done({result:{nodeIds:['missing']}}),RangeError], [()=>t.done({result:{linkIds:[3]}}),TypeError],
        [()=>t.edit({kind:null}),TypeError], [()=>t.edit(null),TypeError],
        [()=>t.edit({rootId:null}),RangeError], [()=>t.edit({layout:[]}),RangeError],
    ];
    for(const [run,Type]of operations){assert.throws(run,errorIs(Type));assert.equal(t.state,before);}
    assert.equal(t.mark({}).index,1);
    for(const text of [undefined,null,3])assert.throws(()=>createTreeTrace(input(),{layout:layout(),nodeCaptions:[{id:'A',text}]}),errorIs(TypeError));
    assert.throws(()=>createTreeTrace(input(),{layout:layout(),nodeCaptions:[{id:'A',text:''},{id:'A',text:'x'}]}),errorIs(RangeError));
});

test('tree: lifecycle/busy guards precede arguments, preserve state and release after opaque throws', () => {
    const t=trace(), poison=new Proxy({}, {getPrototypeOf(){assert.fail('Lifecycle/busy inspected arguments');}});
    for(const [name,arg]of [['edit',poison],['mark',poison],['setLayout',poison],['done',poison]])assert.throws(()=>t[name](arg),errorIs(Error));
    t.start();assert.throws(()=>t.start(),errorIs(Error));
    const old=t.state, other=trace();other.start();let observations=0;
    const nested=new Proxy({}, {getOwnPropertyDescriptor(target,key){
        observations++;assert.equal(t.state,old);assert.throws(()=>t.edit(poison),errorIs(Error));assert.throws(()=>t.done(poison),errorIs(Error));
        assert.equal(other.mark({}).index,observations);return Reflect.getOwnPropertyDescriptor(target,key);
    }});
    t.mark(nested);assert.equal(observations,3);
    for(const thrown of [null,undefined,false,0,'',Symbol('opaque'),new Error('primary')]){
        const before=t.state;let didThrow=false;
        try{t.edit(new Proxy({}, {getPrototypeOf(){throw thrown;}}));}catch(e){didThrow=true;assert.equal(e,thrown);}
        assert.equal(didThrow,true);assert.equal(t.state,before);t.edit({});
    }
    t.done();const final=t.state;
    for(const [name,arg]of [['start',poison],['edit',poison],['mark',poison],['setLayout',poison],['done',poison]])assert.throws(()=>t[name](arg),errorIs(Error));
    assert.equal(t.state,final);
});

test('tree: mixed-error precedence follows envelope, node/link, hierarchy, retirement, layout and caption order', () => {
    const m=input();m.nodes[1].id='A';m.links=new Proxy([], {getOwnPropertyDescriptor(){throw new Error('links too early');}});
    assert.throws(()=>createTreeTrace(m,{layout:[]}),errorIs(RangeError));
    const wrong=input();wrong.rootId='missing';wrong.links[0].childId='alsoMissing';
    assert.throws(()=>createTreeTrace(wrong,accessor('layout')),errorIs(RangeError));
    const t=trace();t.start();const old=t.state;
    assert.throws(()=>t.mark({nodes:[{id:'missing',role:'x'}],links:new Proxy([], {getOwnPropertyDescriptor(){assert.fail('links before node validation');}})}),errorIs(RangeError));
    assert.throws(()=>t.edit({kind:'binary',nodes:new Proxy([], {getOwnPropertyDescriptor(){assert.fail('nodes before kind');}})}),errorIs(TypeError));
    assert.equal(t.state,old);
    t.edit({nodes:old.tree.nodes.filter(n=>n.id!=='D'),links:old.tree.links.filter(l=>l.id!=='child')});
    assert.throws(()=>t.edit({nodes:old.tree.nodes,links:old.tree.links,layout:new Proxy([], {getOwnPropertyDescriptor(){assert.fail('layout before retired node');}})}),errorIs(RangeError));
});

test('tree: scene validates cloned/application snapshots and retains original endpoint references', () => {
    const t=trace();t.start();t.mark({nodes:[{id:'A',role:'visited'},{id:'C',role:'active'}],links:[{id:'A',role:'path'},{id:'right',role:'path'}],nodeCaptions:[{id:'A',text:''},{id:'C',text:'c'}]});t.done({result:{linkIds:['right']}});
    const state=clone(t.state), scene=project(state); // Caller-owned records remain unfrozen.
    assert.equal(Object.isFrozen(state),false);assert.ok(Object.isFrozen(scene));assert.ok(Object.isFrozen(scene.objects));
    const node=scene.objects.find(o=>o.type==='treeNode'&&o.data.node.id==='A'),link=scene.objects.find(o=>o.type==='treeLink'&&o.data.link.id==='A');
    assert.equal(node.data.node,state.tree.nodes[0]);assert.equal(node.data.position,state.layout[0]);assert.equal(link.data.link,state.tree.links[0]);
    assert.ok(Object.isFrozen(node.data));assert.equal(node.data.caption,'');assert.equal(node.data.root,true);assert.equal(link.data.role,'path');
    const variants=[
        [{...state,layout:[...state.layout].reverse()},RangeError],
        [{...state,nodeMarks:[...state.nodeMarks].reverse()},RangeError],
        [{...state,linkMarks:[...state.linkMarks].reverse()},RangeError],
        [{...state,nodeCaptions:[...state.nodeCaptions].reverse()},RangeError],
        [{...state,nodeCaptions:undefined},TypeError],
        [{...state,nodeMarks:[{id:'A',role:null}]},TypeError],
        [{...state,result:undefined},TypeError],
        [{...state,result:{nodeIds:['A'],linkIds:undefined}},TypeError],
        [{...state,result:{nodeIds:['A','A'],linkIds:[]}},RangeError],
        [{...state,result:{nodeIds:[],linkIds:['missing']}},RangeError],
        [{...state,tree:{...state.tree,rootId:'B'}},RangeError],
    ];
    for(const [value,Type]of variants){assert.throws(()=>project(value),errorIs(Type));assert.equal(project(state).objects.length,7);}
    for(const options of [undefined,null,{},[],{namespace:''},{namespace:3},accessor('namespace')])assert.throws(()=>treeScene(state,options),errorIs(TypeError));
    const invalid=new Proxy({}, {getPrototypeOf(){assert.fail('snapshot read before namespace');}});
    assert.throws(()=>treeScene(invalid,{namespace:''}),errorIs(TypeError));
});

test('tree: injective scene IDs distinguish graph/tree/domain/namespace and survive layout/root/endpoint changes', () => {
    const ids=['__proto__','constructor','["x","tree","node"]','with|separator','"'];
    const model={kind:'ordered',rootId:ids[0],nodes:ids.map(id=>({id})),links:ids.slice(1).map((id,i)=>({id,parentId:ids[0],childId:ids[i+1]}))};
    const state=createTreeTrace(model,{layout:ids.map((nodeId,x)=>({nodeId,x,y:0}))}).state;
    const tree=treeScene(state,{namespace:'shared'}), graph=graphScene(createGraphTrace({nodes:model.nodes,edges:[]}).state,{namespace:'shared'});
    const all=[...tree.objects,...graph.objects];assert.equal(new Set(all.map(o=>o.id)).size,all.length);
    assert.equal(new Set(treeScene(state,{namespace:'other'}).objects.map(o=>o.id)).size,tree.objects.length);
    for(const l of tree.objects.filter(o=>o.type==='treeLink'))assert.equal(tree.objects.find(n=>n.id===l.data.from).data.node.id,l.data.link.parentId);
    const t=trace(),before=project(t.start().state),after=project(t.edit(rotation()).state);
    assert.deepEqual(after.objects.map(o=>o.id),before.objects.map(o=>o.id));
    assert.notEqual(after.objects[1].data.from,before.objects[1].data.from);
});

test('tree: scene transitions resolve both endpoint generations and exits with no Event or Canvas', () => {
    const t=trace(),before=t.start().state,after=t.edit(rotation()).state;
    const projector=createSceneProjector(project), frame=createSceneFrame(projector(endpoint(after,before,.5)));
    const link=frame.objects.find(o=>o.current.type==='treeLink'&&o.current.data.link.id==='right');
    assert.equal(link.phase,'update');assert.equal(frame.get(link.previous.data.from).previous.data.node.id,'A');
    assert.equal(frame.get(link.current.data.from).current.data.node.id,'C');assert.equal(link.previous.data.link.slot,'right');assert.equal(link.current.data.link.slot,'left');
    assert.equal(frame.event,undefined);
    const empty=t.edit({rootId:null,nodes:[],links:[]}).state;
    const exits=createSceneFrame({previous:project(after),current:project(empty),progress:1,stepIndex:3,event:undefined});
    const exit=exits.objects.find(o=>o.previous.type==='treeLink');assert.equal(exit.phase,'exit');assert.equal(exits.get(exit.previous.data.from).presence,0);
});

test('tree: deep valid binary chains validate/project iteratively without recursion overflow', () => {
    const size=12000,nodes=Array.from({length:size},(_,i)=>({id:String(i)}));
    const links=nodes.slice(1).map((node,i)=>({id:'edge'+i,parentId:String(i),childId:node.id,slot:'right'}));
    const t=createTreeTrace({kind:'binary',rootId:'0',nodes,links},{layout:nodes.map((node,i)=>({nodeId:node.id,x:0,y:i}))});
    t.start();assert.equal(project(t.state).objects.length,2*size-1);assert.equal(t.edit({}).index,1);assert.equal(t.done().state.tree.nodes.length,size);
});

test('tree: invalid reparenting/root-only edits roll back, while an atomic root-and-link rotation succeeds', () => {
    const t=trace();t.start();const before=t.state;
    const cycle=before.tree.links.map(l=>l.id==='A'?{...l,parentId:'D',slot:'left'}:l);
    assert.throws(()=>t.edit({links:cycle}),errorIs(RangeError));assert.equal(t.state,before);
    assert.throws(()=>t.edit({rootId:'C'}),errorIs(RangeError));assert.equal(t.state,before);
    const valid=t.edit(rotation());assert.equal(valid.index,1);assert.equal(valid.state.tree.rootId,'C');
});

test('tree: inserted node/link enter with resolvable new endpoints and stable identity through deletion', () => {
    const t=trace(),before=t.start().state;
    const after=t.edit({nodes:[...before.tree.nodes,{id:'E'}],links:[...before.tree.links,{id:'new',parentId:'C',childId:'E',slot:'right'}],layout:[...before.layout,{nodeId:'E',x:2,y:2}]}).state;
    const frame=createSceneFrame({previous:project(before),current:project(after),progress:.5,stepIndex:1,event:undefined});
    const enters=frame.objects.filter(o=>o.phase==='enter');assert.equal(enters.length,2);
    const link=enters.find(o=>o.current.type==='treeLink');assert.equal(link.previous,null);
    assert.equal(frame.get(link.current.data.to).current.data.node.id,'E');assert.equal(frame.get(link.current.data.to).presence,.5);
    const removed=t.edit({nodes:before.tree.nodes,links:before.tree.links}).state;
    const exits=createSceneFrame({previous:project(after),current:project(removed),progress:1,stepIndex:2,event:undefined});
    const exit=exits.objects.find(o=>o.id===link.id);assert.equal(exit.phase,'exit');assert.equal(exits.get(exit.previous.data.to).presence,0);
});
