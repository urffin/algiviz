import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasViewport } from '../examples/canvas-viewport.mjs';
import { createStatePlayer } from '@grundyjs/algiviz/playback';

class Events {
    handlers = new Map();
    addEventListener(name, callback) {
        if (!this.handlers.has(name)) this.handlers.set(name, new Set());
        this.handlers.get(name).add(callback);
    }
    removeEventListener(name, callback) { this.handlers.get(name)?.delete(callback); }
    emit(name) { for (const callback of [...(this.handlers.get(name) ?? [])]) callback(); }
    get count() { return [...this.handlers.values()].reduce((sum, set) => sum + set.size, 0); }
}
function fixture({ ratio = 1.25, style = {}, observeError = false, mediaError = false } = {}) {
    const view = new Events(), frames = new Map(), observers = [], media = [], writes = [], transforms = [];
    let serial = 0, width = 800, height = 600, visible = true;
    const computed = { width: '300px', boxSizing: 'content-box', borderLeftWidth: '0px', borderRightWidth: '0px',
        borderTopWidth: '0px', borderBottomWidth: '0px', paddingLeft: '0px', paddingRight: '0px', paddingTop: '0px', paddingBottom: '0px', ...style };
    const context = { setTransform(...values) { transforms.push(values); } };
    const canvas = { ownerDocument: { defaultView: view }, style: { height: '111px' },
        getContext: () => context, getClientRects: () => visible ? [{}] : [],
        get width() { return width; }, set width(value) { width = value; writes.push(['width', value]); },
        get height() { return height; }, set height(value) { height = value; writes.push(['height', value]); } };
    view.devicePixelRatio = ratio;
    view.getComputedStyle = target => { assert.equal(target, canvas); return computed; };
    view.requestAnimationFrame = callback => { frames.set(++serial, callback); return serial; };
    view.cancelAnimationFrame = id => frames.delete(id);
    view.ResizeObserver = class {
        constructor(callback) { this.callback = callback; observers.push(this); }
        observe(target) { assert.equal(target, canvas); if (observeError) throw Error('observe failed'); this.connected = true; }
        disconnect() { this.connected = false; }
        fire() { this.callback(); }
    };
    view.matchMedia = query => {
        if (mediaError) throw Error('media failed');
        const item = new Events(); item.query = query; media.push(item); return item;
    };
    return { canvas, context, view, computed, observers, media, frames, writes, transforms,
        hide(value = true) { visible = !value; },
        flush() { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(); } };
}

test('viewport imports without DOM and respects fractional content dimensions and border-box height', () => {
    assert.equal(typeof globalThis.document, 'undefined');
    const env = fixture({ style: { width: '310.25px', boxSizing: 'border-box', borderLeftWidth: '1.25px', borderRightWidth: '1.75px',
        paddingLeft: '2px', paddingRight: '3px', borderTopWidth: '2px', borderBottomWidth: '4px', paddingTop: '3px', paddingBottom: '1px' } });
    const viewport = createCanvasViewport(env.canvas, { onResize() {} });
    assert.equal(env.writes.length, 0);
    const size = viewport.resize(width => width / 2);
    assert.deepEqual(size, { width: 302.25, height: 151.125, bitmapWidth: 378, bitmapHeight: 189, pixelRatio: 1.25 });
    assert.ok(Object.isFrozen(size));
    assert.equal(env.canvas.style.height, '161.125px');
    assert.deepEqual(env.transforms.at(-1), [378 / 302.25, 0, 0, 189 / 151.125, 0, 0]);
    viewport.resize(width => width / 2);
    assert.equal(env.writes.length, 2, 'unchanged dimensions must not clear the bitmap again');
    viewport.dispose();
});

test('content-box sizing excludes decoration from both logical axes', () => {
    const env = fixture({ style: { paddingLeft: '12px', paddingTop: '8px', borderTopWidth: '2px' } });
    const viewport = createCanvasViewport(env.canvas, { onResize() {} });
    assert.equal(viewport.resize(() => 200).width, 300);
    assert.equal(env.canvas.style.height, '200px');
    viewport.dispose();
});

test('resize notifications coalesce, ignore height feedback, and never advance the source', () => {
    const env = fixture();
    let player, reads = 0, redraws = 0;
    const viewport = createCanvasViewport(env.canvas, { onResize() { redraws++; draw(player.frame); } });
    function draw() { viewport.resize(width => width / 2); }
    player = createStatePlayer((function* () { for (let i = 0; i < 3; i++) { reads++; yield i; } })(), { render: draw });
    const frame = player.frame;
    env.observers[0].fire(); env.flush(); assert.equal(redraws, 0);
    env.computed.width = '450.5px';
    env.observers[0].fire(); env.observers[0].fire(); env.view.emit('resize');
    assert.equal(env.frames.size, 1); env.flush();
    assert.equal(redraws, 1); assert.equal(reads, 1); assert.deepEqual(player.frame, frame);
    assert.equal(env.canvas.width, Math.round(450.5 * 1.25));
    env.observers[0].fire(); env.flush(); assert.equal(redraws, 1);
    player.dispose(); viewport.dispose();
});

test('DPR-only changes rearm the resolution query and respect an explicit cap', () => {
    const env = fixture({ ratio: 1 });
    let redraws = 0;
    const viewport = createCanvasViewport(env.canvas, { maxPixelRatio: 2, onResize() { redraws++; viewport.resize(() => 100); } });
    viewport.resize(() => 100);
    env.view.devicePixelRatio = 3;
    env.media[0].emit('change'); env.flush();
    assert.equal(redraws, 1); assert.equal(env.canvas.width, 600);
    assert.equal(env.media[0].count, 0); assert.equal(env.media[1].query, '(resolution: 3dppx)');
    const writes = env.writes.length;
    env.view.devicePixelRatio = 4; env.media[1].emit('change'); env.flush();
    assert.equal(redraws, 1); assert.equal(env.writes.length, writes);
    assert.equal(env.media[1].count, 0); assert.equal(env.media[2].count, 1);
    env.view.devicePixelRatio = 1.5; env.view.emit('resize'); env.flush();
    assert.equal(redraws, 2); assert.equal(env.canvas.width, 450);
    viewport.dispose();
});

test('missing or invalid host DPR falls back to one without rounding tiny bitmaps to zero', () => {
    for (const ratio of [undefined, 0, -1, NaN, Infinity]) {
        const env = fixture({ ratio, style: { width: '0.2px' } }); env.view.devicePixelRatio = ratio;
        const viewport = createCanvasViewport(env.canvas, { onResize() {} });
        assert.deepEqual(viewport.resize(() => 0.1), { width: 0.2, height: 0.1, bitmapWidth: 1, bitmapHeight: 1, pixelRatio: 1 });
        viewport.dispose();
    }
});

test('display-none and zero-width canvases preserve the bitmap and redraw on becoming measurable', () => {
    const env = fixture(); let redraws = 0, heights = 0;
    const viewport = createCanvasViewport(env.canvas, { onResize() { redraws++; viewport.resize(height); } });
    function height() { heights++; return 120; }
    viewport.resize(height); const writes = env.writes.length;
    env.hide(); assert.equal(viewport.resize(height), null); assert.equal(heights, 1);
    env.computed.width = '0px'; env.hide(false); assert.equal(viewport.resize(height), null);
    assert.equal(env.writes.length, writes); assert.equal(env.canvas.style.height, '120px');
    env.computed.width = '300px'; env.observers[0].fire(); env.flush();
    assert.equal(redraws, 1); assert.equal(heights, 2); assert.equal(env.writes.length, writes);
    viewport.dispose();
});

test('invalid height and numeric overflow are rejected before changing CSS or bitmap attributes', () => {
    const env = fixture(); const viewport = createCanvasViewport(env.canvas, { onResize() {} });
    for (const value of [0, -1, NaN, Infinity, '100']) assert.throws(() => viewport.resize(() => value), RangeError);
    assert.throws(() => viewport.resize(100), TypeError);
    const error = Error('layout failed'); assert.throws(() => viewport.resize(() => { throw error; }), e => e === error);
    assert.throws(() => viewport.resize(() => 2 ** 40), RangeError);
    env.computed.width = (2 ** 40) + 'px'; assert.throws(() => viewport.resize(() => 100), RangeError);
    assert.equal(env.writes.length, 0); assert.equal(env.canvas.style.height, '111px');
    viewport.dispose();
});

test('invalid construction and partial observer setup leave no listeners behind', () => {
    for (const maxPixelRatio of [0, -1, NaN, '2', null]) {
        const env = fixture(); assert.throws(() => createCanvasViewport(env.canvas, { maxPixelRatio, onResize() {} }), RangeError);
        assert.equal(env.observers.length, 0);
    }
    assert.throws(() => createCanvasViewport(null, { onResize() {} }), TypeError);
    const missing = fixture(); assert.throws(() => createCanvasViewport(missing.canvas), TypeError);
    for (const config of [{ observeError: true }, { mediaError: true }]) {
        const env = fixture(config); assert.throws(() => createCanvasViewport(env.canvas, { onResize() {} }), /failed/);
        assert.equal(env.observers[0].connected, false); assert.equal(env.view.count, 0);
    }
});

test('dispose cancels pending work, preserves drawing dimensions, and is terminal and idempotent', () => {
    const env = fixture(); let redraws = 0;
    const viewport = createCanvasViewport(env.canvas, { onResize() { redraws++; } });
    viewport.resize(() => 200); const writes = env.writes.length, cssHeight = env.canvas.style.height;
    env.observers[0].fire(); assert.equal(env.frames.size, 1);
    viewport.dispose(); viewport.dispose(); env.flush();
    env.observers[0].fire(); env.media[0].emit('change'); env.view.emit('resize');
    assert.equal(redraws, 0); assert.equal(env.frames.size, 0); assert.equal(env.view.count, 0); assert.equal(env.media[0].count, 0);
    assert.equal(env.observers[0].connected, false); assert.equal(env.writes.length, writes); assert.equal(env.canvas.style.height, cssHeight);
    assert.throws(() => viewport.resize(() => 200), /disposed/);
});

test('disposal during the layout callback prevents later bitmap mutations', () => {
    const env = fixture(); const viewport = createCanvasViewport(env.canvas, { onResize() {} });
    assert.throws(() => viewport.resize(() => { viewport.dispose(); return 120; }), /disposed/);
    assert.equal(env.writes.length, 0); assert.equal(env.canvas.style.height, '111px');
});
