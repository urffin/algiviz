import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneFrame } from '@grundyjs/algiviz/scene';
import { createLifecyclePlayer, lifecycleRenderer, lifecycleStates } from '../examples/object-lifecycle.mjs';
import { timing } from '../examples/player-settings.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('mixed controls handle enter/update/exit and detect completion without lookahead', () => {
    const events = [], frames = [];
    const p = createLifecyclePlayer({ notify: e => events.push(e), render: f => frames.push(f) });
    const reads = () => events.filter(e => e.kind === 'yield').length;
    assert.equal(reads(), 1);
    p.advance(timing.stepDurationMs / 4);
    let a = createSceneFrame(p.frame).get('A');
    assert.equal(a.phase, 'enter'); assert.equal(a.previous, null); assert.equal(a.presence, .25);
    p.nextStep(); assert.equal(reads(), 2); assert.equal(p.frame.progress, 1);
    p.advance(timing.stepDurationMs / 4);
    let scene = createSceneFrame(p.frame);
    assert.equal(scene.get('A').phase, 'update'); assert.equal(scene.get('B').phase, 'enter');
    p.nextStep(); assert.equal(reads(), 3);
    p.advance(timing.stepDurationMs / 4);
    scene = createSceneFrame(p.frame);
    assert.equal(scene.get('A').phase, 'exit'); assert.equal(scene.get('A').current, null);
    assert.equal(scene.get('A').presence, .75);
    p.nextStep(); assert.equal(reads(), 4);
    p.nextStep(); // B exits, empty current scene.
    assert.equal(p.frame.current.objects.length, 0);
    assert.equal(createSceneFrame(p.frame).get('B').presence, 0);
    p.nextStep(); // C enters. Last state is not yet known to be final.
    assert.equal(p.finished, false); assert.equal(reads(), 6);
    p.nextStep(); assert.equal(p.finished, true); assert.equal(reads(), 6);
    assert.equal(events.filter(e => e.kind === 'closed').length, 1);
    assert.equal(p.frame.stepIndex, 5);
    assert.equal(frames.length, 10);
});

test('early dispose freezes a partial exit, closes once, and restart uses a fresh source', () => {
    const events = [];
    const p = createLifecyclePlayer({ notify: e => events.push(e) });
    p.nextStep(); p.nextStep(); p.advance(timing.stepDurationMs / 4);
    const frame = p.frame, count = events.length;
    p.dispose(); p.dispose();
    assert.equal(events.length, count + 1);
    assert.equal(events.at(-1).kind, 'closed');
    assert.deepEqual(p.frame, frame);
    assert.throws(() => p.advance(0), /disposed/);
    assert.throws(() => p.nextStep(), /disposed/);
    const restarted = createLifecyclePlayer();
    assert.equal(restarted.frame.stepIndex, 0); assert.deepEqual(restarted.frame.current.objects, []);
    restarted.dispose();
});

test('renderer interpolates geometry, fades presence and restores caller state', () => {
    const stack = [], circles = [];
    const ctx = { globalAlpha: .4, fillStyle: 'caller',
        save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle }); },
        restore() { Object.assign(this, stack.pop()); },
        beginPath() {}, arc(x) { circles.push({ x, alpha: this.globalAlpha }); }, fill() {}, fillText() {},
    };
    const states = [...lifecycleStates()];
    const frame = { previous: states[2], current: states[3], progress: .25, stepIndex: 3, event: undefined };
    lifecycleRenderer.render(ctx, frame);
    assert.deepEqual(circles, [{ x: 390, alpha: 1 }, { x: 260, alpha: .75 }]);
    assert.equal(ctx.globalAlpha, .4); assert.equal(ctx.fillStyle, 'caller'); assert.equal(stack.length, 0);
    circles.length = 0;
    lifecycleRenderer.render(ctx, { ...frame, progress: 1 });
    assert.deepEqual(circles, [{ x: 300, alpha: 1 }]);
    assert.ok(Object.isFrozen(states[0].objects));
    assert.notEqual(states[1].objects, states[2].objects);
});

test('page controls preserve the last drawing after dispose and reset diagnostics on restart', () => {
    const html = readFileSync(new URL('../examples/object-lifecycle.html', import.meta.url), 'utf8');
    const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;\r?\n/gm, '');
    const element = () => ({ textContent: '', disabled: false, children: [],
        append(child) { this.children.push(child); }, replaceChildren(...children) { this.children = children; } });
    const ids = Object.fromEntries(['advance','next','dispose','restart','status','log','objects'].map(id => [id, element()]));
    let clears = 0;
    const ctx = { save() {}, restore() {}, clearRect() { clears++; }, beginPath() {}, arc() {}, fill() {}, fillText() {} };
    const events = {};
    const scope = vm.createContext({ createSceneFrame, createLifecyclePlayer, lifecycleRenderer, timing,
        document: { getElementById: id => ids[id], createElement: element,
            querySelector: () => ({ getContext: () => ctx }) },
        window: { addEventListener: (kind, callback) => { events[kind] = callback; } },
    });
    vm.runInContext(script, scope);
    assert.match(ids.status.textContent, /выдано 1/);
    ids.advance.onclick();
    assert.match(ids.status.textContent, /progress 0.25/);
    assert.equal(ids.objects.children[0].children[1].textContent, 'enter');
    ids.next.onclick();
    assert.match(ids.status.textContent, /выдано 2/);
    ids.next.onclick(); ids.advance.onclick(); // Partial exit of A.
    assert.equal(ids.objects.children.find(row => row.children[0].textContent === 'A').children[1].textContent, 'exit');
    const before = clears;
    ids.dispose.onclick();
    assert.equal(clears, before);
    assert.equal(ids.next.disabled, true); assert.equal(ids.advance.disabled, true);
    assert.match(ids.status.textContent, /закрытий 1/);
    assert.equal(ids.log.textContent.match(/closed/g).length, 1);
    ids.restart.onclick();
    assert.equal(ids.next.disabled, false);
    assert.equal(ids.log.textContent, 'yield 0\n');
    for (let i = 0; i < 6; i++) ids.next.onclick();
    assert.match(ids.status.textContent, /Генератор завершён/);
    assert.equal(ids.log.textContent.match(/closed/g).length, 1);
    events.pagehide();
    assert.equal(ids.log.textContent.match(/closed/g).length, 1);
    events.pageshow({ persisted: true });
    assert.match(ids.status.textContent, /выдано 1 · закрытий 0/);
});
