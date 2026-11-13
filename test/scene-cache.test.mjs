import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSceneFrame, createSceneRenderer } from '@grundyjs/algiviz/scene';

const node = (id, x = 0, zIndex = 0) => Object.freeze({ id, type: 'node', data: Object.freeze({ x }), zIndex });
const scene = (...objects) => Object.freeze({ objects: Object.freeze(objects) });
const frame = (previous, current, progress = .5, event = 'move', stepIndex = 1) => ({ previous, current, progress, event, stepIndex });

test('repeated endpoint pair produces fresh immutable frames with current metadata and full lookup', () => {
    const previous = scene(node('gone', 1), node('same', 2));
    const current = scene(node('same', 3), node('new', 4));
    const retained = [];
    const renderer = createSceneRenderer({ node(_, object, resolved) {
        if (object === resolved.objects[0]) retained.push(resolved);
        assert.equal(resolved.get(object.id), object);
        assert.equal(resolved.get('absent'), undefined);
    } });
    for (const [i, p] of [0, .25, 1, .5, 0].entries()) renderer.render(null, frame(previous, current, p, { i }, i));
    assert.equal(new Set(retained).size, 5);
    for (const [i, resolved] of retained.entries()) {
        const p = [0, .25, 1, .5, 0][i];
        assert.equal(resolved.progress, p); assert.equal(resolved.stepIndex, i); assert.deepEqual(resolved.event, { i });
        assert.equal(resolved.get('new').presence, p); assert.equal(resolved.get('gone').presence, 1 - p);
        assert.equal(resolved.get('same').presence, 1);
        assert.equal(resolved.get('same').previous, previous.objects[1]);
        assert.equal(resolved.get('same').current, current.objects[0]);
        assert(Object.isFrozen(resolved) && Object.isFrozen(resolved.objects) && resolved.objects.every(Object.isFrozen));
        if (i) assert.notEqual(resolved.get('same'), retained[0].get('same'));
    }
    renderer.render(null, frame(scene(), scene(node('other')), 1));
    assert.deepEqual(retained[0].objects.map(o => o.id), ['same', 'new', 'gone']);
    assert.equal(retained[0].get('new').presence, 0);
});

test('seeking, reversed pairs and new scene identities preserve layers, ties and enter/exit boundaries', () => {
    const a = scene(node('gone', 1, -2), node('a', 2, 1), node('b', 3, 1));
    const b = scene(node('b', 4, 0), node('new', 5, 0), node('a', 6, 0));
    const c = scene(node('a', 80, -3), node('b', 90, 5));
    const calls = []; const retained = [];
    const renderer = createSceneRenderer({ node(ctx, object, resolved) { ctx.push(object); if (object === resolved.objects[0]) retained.push(resolved); } });
    for (const f of [frame(a,b,0), frame(a,b,1), frame(b,c), frame(c,b), frame(a,b,.3), frame(b,a), frame(a,scene(...b.objects))]) {
        calls.length = 0; renderer.render(calls, f);
        assert.deepEqual(calls, createSceneFrame(f).objects);
    }
    assert.deepEqual(retained[0].objects.map(o=>o.id), ['gone','b','new','a']);
    assert.equal(retained[0].get('new').presence, 0);
    assert.equal(retained[1].get('gone').presence, 0);
    assert.equal(retained[2].get('a').current.data.x, 80);
});

test('invalid progress on a cached pair and invalid replacement scenes fail before callbacks', () => {
    let draws = 0;
    const renderer = createSceneRenderer({ node() { draws++; } });
    const a = scene(node('a')), b = scene(node('b'));
    renderer.render(null, frame(a,b)); draws = 0;
    const invalid = [
        ...[NaN, Infinity, -.1, 1.1].map(p=>frame(a,b,p)),
        frame(a,scene(node('x'),node('x'))), frame(scene(node('x'),node('x')),b),
        frame(a,scene(node('x'),{id:'y',type:'missing',data:{}})),
        frame(a,scene({id:'a',type:'other',data:{}})),
        frame(a,scene(node('x'),node('y',0,NaN))), frame(a,scene(node(''))),
        frame(a,scene({id:'bad',type:'',data:{}}))
    ];
    for (const f of invalid) { assert.throws(()=>renderer.render(null,f)); assert.equal(draws,0); }
    renderer.render(null,frame(a,b,1,'retry',9)); assert.equal(draws,2);
});

test('reentrant rendering and callback errors cannot change a retained outer frame or context', () => {
    const a = scene(node('a',1),node('b',2)), b = scene(node('a',3),node('b',4));
    const innerA = scene(node('inside',8)), innerB = scene(node('inside',9));
    const log=[], frames=[]; let nested=false, fail=false;
    const renderer=createSceneRenderer({ node(ctx,object,resolved) {
        frames.push(resolved); log.push([ctx,object.id,resolved.event]);
        if (fail) throw Error('draw failed');
        if (!nested && object.id==='a') {
            nested=true; renderer.render('inner',frame(innerA,innerB,.8,'inner',3));
            assert.equal(resolved.get('b').current.data.x,4);
        }
    } });
    renderer.render('outer',frame(a,b,.2,'outer',2));
    assert.deepEqual(log,[['outer','a','outer'],['inner','inside','inner'],['outer','b','outer']]);
    assert.equal(frames[0],frames[2]); assert.equal(frames[0].get('inside'),undefined);
    fail=true; assert.throws(()=>renderer.render('fail',frame(a,b,.6,'fail')),/draw failed/);
    fail=false; renderer.render('retry',frame(a,b,1,'retry',4));
    assert.equal(frames.at(-1).progress,1); assert.equal(frames[0].progress,.2);
});

test('renderer instances with different registries do not share cached validation', () => {
    const f=frame(scene(node('a')),scene(node('b')));
    const seen=[]; const first=createSceneRenderer({node:(_,o)=>seen.push(o.id)});
    const second=createSceneRenderer({other(){ throw Error('must not draw'); }});
    first.render(null,f); assert.throws(()=>second.render(null,f),/No visualization for scene type: node/);
    first.render(null,{...f,progress:1}); assert.deepEqual(seen,['b','a','b','a']);
});

test('standalone matching keeps validating every call and owns no renderer cache', () => {
    const mutable={objects:[node('a')]}, f=frame(scene(),mutable);
    const first=createSceneFrame(f); mutable.objects.push(node('a'));
    assert.throws(()=>createSceneFrame(f),/Duplicate/);
    assert.equal(first.get('a').current.data.x,0);
});
