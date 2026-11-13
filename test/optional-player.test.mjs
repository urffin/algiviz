import test from 'node:test';
import assert from 'node:assert/strict';
import { createStateController } from '../dist/player/controller.js';
import { Player } from '@grundyjs/algiviz/player';
import { createStatePlayer } from '@grundyjs/algiviz/playback';

function clock() {
    let id = 0;
    const callbacks = new Map();
    return { request(fn) { callbacks.set(++id, fn); return id; }, cancel(id) { callbacks.delete(id); },
        tick(now) { const pending = [...callbacks.values()]; callbacks.clear(); for (const fn of pending) fn(now); },
        get size() { return callbacks.size; } };
}
function fixture(options = {}) {
    const scheduler = clock(), stats = { factories: 0, reads: 0, closes: 0 }, frames = [], errors = [];
    const source = () => {
        stats.factories++;
        return (function* () { try { for (let n = 0; n < 4; n++) { stats.reads++; yield Object.freeze({ n }); } }
            finally { stats.closes++; } })();
    };
    const controller = createStateController({ source, scheduler, render: frame => frames.push(frame),
        onError: error => errors.push(error), ...options });
    return { controller, scheduler, stats, frames, errors };
}

function behind(options = {}) {
    const context = fixture({ stepDurationMs: 10, maxStepsPerFrame: 2,
        source: function* () { let n = 0; while (true) yield n++; }, ...options });
    context.controller.start(); context.controller.play(); context.scheduler.tick(0); context.scheduler.tick(100);
    assert.equal(context.controller.frame.stepIndex, 2);
    return context;
}

test('RAF budgets cap next requests and preserve all elapsed playback time across later frames', () => {
    for (const rewindCapacity of [undefined, 1, 4]) {
        let reads = 0, statuses = 0;
        const context = behind({ rewindCapacity, source: function* () { while (true) yield reads++; }, onStatus() { statuses++; } });
        const { controller: ui, scheduler, frames } = context;
        assert.equal(reads, 3);
        for (const position of [4, 6, 8, 10, 10]) {
            const count = frames.length, changes = statuses, before = reads;
            scheduler.tick(100);
            assert.equal(ui.frame.stepIndex, position); assert.equal(ui.frame.progress, 1);
            assert.equal(frames.length, count + 1); assert.equal(statuses, changes + 1);
            assert.ok(reads - before <= 2);
        }
        assert.equal(reads, 11); ui.dispose();
    }
});

test('budgeted playback reaches the same partial frame as headless full advance once debt drains', () => {
    for (const duration of [10, 0.3]) for (const limit of [1, 3]) for (const rewindCapacity of [undefined, 5]) {
        function* states() { let i = 0; while (true) yield Object.freeze({ i: i++ }); }
        const expected = createStatePlayer(states(), { stepDurationMs: duration }); expected.advance(99.75);
        const { controller: ui, scheduler } = fixture({ source: states, stepDurationMs: duration, maxStepsPerFrame: limit, rewindCapacity });
        ui.start(); ui.play(); scheduler.tick(0); scheduler.tick(99.75);
        for (let i = 0; i < Math.ceil(99.75 / duration / limit) + 2; i++) scheduler.tick(99.75);
        assert.equal(ui.frame.stepIndex, expected.frame.stepIndex);
        assert.deepEqual(ui.frame.current, expected.frame.current);
        assert.ok(Math.abs(ui.frame.progress - expected.frame.progress) < 1e-9);
        ui.dispose(); expected.dispose();
    }
});

test('EOF probes count against a frame budget and final hold time is never counted twice', () => {
    let calls = 0, returns = 0;
    const { controller: ui, scheduler } = fixture({ maxStepsPerFrame: 1, stepDurationMs: 10, finalHoldMs: 150,
        source: () => ({ [Symbol.iterator]: () => ({ next() {
            calls++; return calls <= 2 ? { value: calls - 1, done: false } : { done: true };
        }, return() { returns++; return { done: true }; } }) }) });
    ui.start(); ui.play(); scheduler.tick(0); scheduler.tick(100);
    assert.equal(calls, 2); assert.equal(ui.frame.stepIndex, 1); assert.equal(ui.status.phase, 'playing');
    scheduler.tick(100); assert.equal(calls, 3); assert.equal(ui.status.phase, 'playing'); // Hold 90/150 ms.
    scheduler.tick(100); assert.equal(calls, 3); assert.equal(ui.status.phase, 'playing'); // No debt remains.
    scheduler.tick(150); assert.equal(ui.status.phase, 'playing');
    scheduler.tick(160); assert.equal(ui.status.phase, 'finished'); assert.equal(scheduler.size, 0);
    ui.dispose(); assert.equal(calls, 3); assert.equal(returns, 0);
});

test('Pause, Next and Previous discard backlog while retaining exact manual step behavior', () => {
    for (const command of ['pause', 'next', 'previous']) {
        const { controller: ui, scheduler } = behind({ rewindCapacity: 8 });
        ui[command]();
        const position = command === 'next' ? 3 : command === 'previous' ? 1 : 2;
        assert.equal(ui.frame.stepIndex, position); assert.equal(ui.status.phase, 'paused'); assert.equal(scheduler.size, 0);
        ui.play(); scheduler.tick(1000); assert.equal(ui.frame.stepIndex, position);
        scheduler.tick(1005); assert.equal(ui.frame.stepIndex, position + 1); assert.equal(ui.frame.progress, 0.5);
        ui.dispose();
    }
    const { controller: ui, scheduler } = behind();
    ui.pause(); ui.play(); scheduler.tick(1000); scheduler.tick(1005);
    ui.next(); assert.equal(ui.frame.stepIndex, 3); assert.equal(ui.frame.progress, 1); // Complete partial, no extra read.
    ui.dispose();
});

test('speed changes preserve debt in playback milliseconds without multiplying it again', () => {
    const { controller: ui, scheduler } = behind(); // 80 ms pending.
    ui.setSpeed(2); scheduler.tick(500); assert.equal(ui.frame.stepIndex, 4); // No new wall time.
    scheduler.tick(505); assert.equal(ui.frame.stepIndex, 6); // Add 10 ms, keep previous debt.
    for (let i = 0; i < 8; i++) scheduler.tick(505);
    assert.equal(ui.frame.stepIndex, 11); assert.equal(ui.frame.progress, 1); ui.dispose();
});

test('buffer replay is budgeted even when it performs no new source reads', () => {
    let reads = 0;
    const { controller: ui, scheduler } = fixture({ rewindCapacity: 6, maxStepsPerFrame: 1, stepDurationMs: 10,
        source: function* () { let n = 0; while (true) { reads++; yield n++; } } });
    ui.start(); for (let i = 0; i < 5; i++) ui.next();
    for (let i = 0; i < 5; i++) ui.previous();
    ui.play(); scheduler.tick(0); scheduler.tick(100);
    assert.equal(ui.frame.stepIndex, 1); assert.equal(reads, 6);
    for (let i = 2; i <= 5; i++) { scheduler.tick(100); assert.equal(ui.frame.stepIndex, i); assert.equal(reads, 6); }
    scheduler.tick(100); assert.equal(ui.frame.stepIndex, 6); assert.equal(reads, 7);
    assert.deepEqual([ui.status.rewindStartIndex, ui.status.rewindEndIndex], [1, 6]); ui.dispose();
});

test('budget and rewind retain known-terminal completion and final holds on replay', () => {
    const { controller: ui, scheduler, stats } = fixture({ maxStepsPerFrame: 1, rewindCapacity: 4, stepDurationMs: 10, finalHoldMs: 20 });
    ui.start(); for (let i = 0; i < 5; i++) ui.next(); assert.equal(ui.status.phase, 'finished');
    ui.previous(); ui.previous(); ui.previous(); assert.equal(ui.frame.stepIndex, 0);
    ui.play(); scheduler.tick(0); scheduler.tick(100); assert.equal(ui.frame.stepIndex, 1);
    scheduler.tick(100); assert.equal(ui.frame.stepIndex, 2);
    scheduler.tick(100); assert.equal(ui.frame.stepIndex, 3); assert.equal(ui.status.phase, 'finished');
    assert.equal(stats.reads, 4); assert.equal(stats.closes, 1); ui.dispose();
});

test('restart success and rejection both discard pending work and keep source ownership', () => {
    let rejected = false, closed = 0, factories = 0;
    const { controller: ui, scheduler, errors } = behind({ rewindCapacity: 4, source() {
        factories++; if (rejected) throw Error('rejected');
        return (function* () { try { let n = 0; while (true) yield n++; } finally { closed++; } })();
    } });
    rejected = true; ui.restart(); assert.equal(ui.frame.stepIndex, 2); assert.equal(closed, 0); assert.equal(errors.length, 1);
    ui.play(); scheduler.tick(1000); assert.equal(ui.frame.stepIndex, 2);
    rejected = false; ui.restart(); assert.equal(ui.frame.stepIndex, 0); assert.equal(closed, 1);
    ui.play(); scheduler.tick(2000); assert.equal(ui.frame.stepIndex, 0);
    assert.equal(factories, 3); ui.dispose(); ui.dispose(); assert.equal(closed, 2); assert.equal(scheduler.size, 0);
});

test('budget validation precedes source acquisition; manual mode and disabled budgets retain existing semantics', () => {
    let factories = 0;
    for (const maxStepsPerFrame of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '2', null])
        assert.throws(() => createStateController({ source() { factories++; return [0]; }, maxStepsPerFrame, render() {} }), RangeError);
    assert.throws(() => createStateController({ history() { factories++; return [0]; }, stepDurationMs: 10, maxStepsPerFrame: 2, render() {} }), /only available/);
    assert.equal(factories, 0);
    const manual = fixture({ maxStepsPerFrame: 1 }); manual.controller.start(); manual.controller.next();
    assert.equal(manual.stats.reads, 2); assert.throws(() => manual.controller.play(), /stepDurationMs/); manual.controller.dispose();
    for (const maxStepsPerFrame of [undefined, 1000]) {
        const { controller: ui, scheduler } = fixture({ maxStepsPerFrame, stepDurationMs: 1,
            source: function* () { let i = 0; while (true) yield i++; } });
        ui.start(); ui.play(); scheduler.tick(0); scheduler.tick(10000); // Existing wall clamp still applies.
        assert.equal(ui.frame.stepIndex, 100); ui.dispose();
    }
    const core = createStatePlayer((function* () { let n = 0; while (true) yield n++; })(), { stepDurationMs: 1 });
    assert.equal(core.advance(100).stepIndex, 100); core.dispose();
});

test('budgeted failures preserve primary errors, cancel queued work and permit a fresh restart', () => {
    for (const origin of ['source', 'render', 'status']) {
        const primary = new Error(origin), cleanup = new Error('cleanup'); let fail = true, closes = 0;
        const { controller: ui, scheduler, errors } = fixture({ maxStepsPerFrame: 2, stepDurationMs: 10, rewindCapacity: 4,
            source: () => ({ [Symbol.iterator]() { let n = 0; return {
                next() { if (fail && origin === 'source' && n === 3) throw primary; return { value: n++, done: false }; },
                return() { closes++; if (fail) throw cleanup; return { done: true }; }
            }; } }),
            render(frame) { if (fail && origin === 'render' && frame.stepIndex === 2) throw primary; },
            onStatus(status) { if (fail && origin === 'status' && status.stepIndex === 2) throw primary; } });
        ui.start(); ui.play(); scheduler.tick(0); scheduler.tick(100);
        if (origin === 'source') scheduler.tick(100);
        assert.equal(errors[0], primary); assert.equal(ui.status.phase, 'error'); assert.equal(scheduler.size, 0); assert.equal(closes, 1);
        fail = false; ui.restart(); ui.play(); scheduler.tick(1000); assert.equal(ui.frame.stepIndex, 0);
        ui.dispose(); assert.equal(closes, 2);
    }
});

test('non-finite accumulated playback time fails cleanly instead of draining an unbounded request', () => {
    let closes = 0;
    const { controller: ui, scheduler, errors } = fixture({ maxStepsPerFrame: 1, stepDurationMs: 1,
        source: function* () { try { let i = 0; while (true) yield i++; } finally { closes++; } } });
    ui.start(); ui.setSpeed(1e306); ui.play(); scheduler.tick(0); scheduler.tick(100);
    assert.equal(ui.frame.stepIndex, 1); scheduler.tick(200);
    assert.equal(ui.status.phase, 'error'); assert.ok(errors[0] instanceof RangeError); assert.equal(closes, 1);
    assert.equal(scheduler.size, 0); ui.dispose(); assert.equal(closes, 1);
});

test('optional modules import without DOM; manual initialization, no lookahead and extra completion request', () => {
    assert.equal(typeof Player, 'function'); assert.equal(typeof globalThis.document, 'undefined');
    assert.throws(() => Player(), TypeError);
    const { controller: ui, stats, frames } = fixture();
    assert.deepEqual(stats, { factories: 0, reads: 0, closes: 0 }); assert.equal(frames.length, 0);
    ui.start(); assert.equal(stats.reads, 1); assert.equal(ui.status.phase, 'paused');
    for (let n = 1; n <= 3; n++) { ui.next(); assert.equal(ui.frame.current.n, n); assert.equal(stats.reads, n + 1); }
    assert.equal(ui.status.phase, 'paused'); assert.equal(stats.closes, 0);
    const final = ui.frame.current;
    ui.next(); assert.equal(ui.status.phase, 'finished'); assert.equal(stats.closes, 1);
    assert.equal(ui.frame.current, final); assert.equal(ui.frame.stepIndex, 3);
    assert.equal(ui.status.canNext, false); assert.equal(Object.isFrozen(ui.status), true);
    ui.dispose(); ui.dispose(); assert.equal(stats.closes, 1);
    assert.equal(ui.frame.current, final); assert.throws(() => ui.next(), /disposed/);
});

test('an infinite state source remains lazy and closes exactly once on early disposal', () => {
    let reads = 0, closes = 0;
    const { controller: ui } = fixture({ source: function* () { try { while (true) yield ++reads; } finally { closes++; } }, render() {} });
    ui.start(); for (let i = 0; i < 1000; i++) ui.next();
    assert.equal(reads, 1001); assert.equal(ui.frame.current, 1001);
    ui.dispose(); ui.dispose(); assert.equal(reads, 1001); assert.equal(closes, 1);
});

test('timed Play/Pause mixes with exact Next, speed, restart and final hold without extra reads', () => {
    const { controller: ui, scheduler, stats } = fixture({ stepDurationMs: 100, finalHoldMs: 50 });
    ui.start(); ui.play(); scheduler.tick(0); scheduler.tick(25);
    assert.equal(ui.frame.progress, 0.25); assert.equal(stats.reads, 2);
    ui.pause(); assert.equal(scheduler.size, 0); const partial = ui.frame;
    scheduler.tick(1000); assert.deepEqual(ui.frame, partial);
    ui.next(); assert.equal(ui.frame.progress, 1); assert.equal(stats.reads, 2);
    ui.next(); assert.equal(stats.reads, 3);
    ui.setSpeed(2); ui.play(); scheduler.tick(1000); scheduler.tick(1025);
    assert.equal(ui.frame.progress, 0.5); assert.equal(ui.frame.current.n, 3);
    ui.next(); assert.equal(scheduler.size, 0); assert.equal(stats.reads, 4);
    ui.next(); assert.equal(ui.status.phase, 'paused'); assert.equal(stats.closes, 1);
    ui.next(); assert.equal(ui.status.phase, 'finished'); assert.equal(stats.reads, 4);
    ui.restart(); assert.equal(ui.frame.current.n, 0); assert.equal(stats.factories, 2); assert.equal(ui.status.speed, 2);
    ui.dispose(); assert.equal(stats.closes, 2);
});

test('natural timed completion stops RAF; long stalls are capped and source order is retained', () => {
    const { controller: ui, scheduler, stats } = fixture({ stepDurationMs: 100 });
    ui.start(); ui.play(); scheduler.tick(0); scheduler.tick(10000);
    assert.equal(ui.frame.current.n, 1); assert.equal(scheduler.size, 1);
    for (let i = 1; i <= 5; i++) scheduler.tick(10000 + i * 100);
    assert.equal(ui.status.phase, 'finished'); assert.equal(stats.reads, 4);
    assert.equal(stats.closes, 1); assert.equal(scheduler.size, 0); ui.dispose();
});

test('a rejected restart preserves the old session and leaves it paused and usable', () => {
    let reject = false, reads = 0, closes = 0;
    const { controller: ui, scheduler, errors } = fixture({ stepDurationMs: 100, source() {
        if (reject) throw new Error('draft rejected');
        return (function* () { try { while (true) yield reads++; } finally { closes++; } })();
    } });
    ui.start(); ui.next(); const before = ui.frame;
    ui.play(); reject = true; ui.restart();
    assert.deepEqual(ui.frame, before); assert.equal(ui.status.phase, 'paused');
    assert.equal(ui.status.canNext, true); assert.equal(closes, 0); assert.equal(scheduler.size, 0);
    assert.equal(errors[0].message, 'draft rejected'); ui.next(); assert.equal(ui.frame.current, 2);
    reject = false; ui.restart(); assert.equal(closes, 1); ui.dispose(); assert.equal(closes, 2);
});

test('initial factory and empty-source failures allow retry; invalid configuration never invokes the source', () => {
    let invalid = true, closed = 0;
    const { controller: ui, errors } = fixture({ source: function* () { try { if (invalid) return; yield 42; } finally { closed++; } } });
    ui.start(); assert.equal(errors.length, 1); assert.equal(ui.status.canStart, true); assert.equal(closed, 1);
    invalid = false; ui.start(); assert.equal(ui.frame.current, 42); ui.dispose(); assert.equal(closed, 2);
    let factories = 0;
    for (const options of [{ stepDurationMs: 0 }, { finalHoldMs: -1 }, { stepDurationMs: 100, scheduler: null }])
        assert.throws(() => createStateController({ source() { factories++; }, render() {}, ...options }));
    assert.equal(factories, 0);
});

test('replacement cleanup failure also closes the prepared candidate and preserves the old readable frame', () => {
    const cleanup = new Error('old cleanup failed'); let sources = 0, closed = 0;
    const { controller: ui, errors } = fixture({ source() {
        const session = ++sources;
        return { [Symbol.iterator]() { return { next: () => ({ value: session, done: false }),
            return() { closed++; if (session === 1) throw cleanup; return { done: true }; } }; } };
    } });
    ui.start(); ui.restart();
    assert.equal(ui.frame.current, 1); assert.equal(closed, 2); assert.equal(ui.status.phase, 'error');
    assert.equal(errors[0], cleanup); assert.equal(ui.status.canRestart, true);
    ui.dispose(); assert.equal(closed, 2);
});

test('source and render errors cancel scheduling and keep precedence over cleanup failure', () => {
    for (const location of ['source', 'render']) {
        const primary = new Error(location), cleanup = new Error('cleanup'); let reads = 0, closes = 0;
        const { controller: ui, scheduler, errors } = fixture({ stepDurationMs: 100,
            source: () => ({ [Symbol.iterator]() { return {
                next() { if (++reads === 2 && location === 'source') throw primary; return { value: reads, done: false }; },
                return() { closes++; throw cleanup; },
            }; } }), render(frame) { if (frame.current === 2 && location === 'render') throw primary; } });
        ui.start(); ui.play(); scheduler.tick(0); scheduler.tick(25);
        assert.equal(ui.status.phase, 'error'); assert.equal(ui.status.canNext, false);
        assert.equal(scheduler.size, 0); assert.equal(errors[0], primary); assert.equal(closes, 1);
        ui.dispose(); assert.equal(closes, 1);
    }
});

test('status callback failures close the session and synchronous callback mutations are rejected', () => {
    let ui, mutate = false;
    const context = fixture({ stepDurationMs: 100, onStatus() { if (mutate) ui.next(); } });
    ui = context.controller; ui.start(); mutate = true; ui.play();
    assert.equal(ui.status.phase, 'error'); assert.equal(context.scheduler.size, 0);
    assert.match(context.errors[0].message, /callback/); assert.equal(context.stats.closes, 1);
    assert.throws(() => ui.dispose(), /disposed/); ui.dispose(); assert.equal(context.stats.closes, 1);
});

test('a failed initial render closes its source, can restart, and non-Error thrown values are reported', () => {
    let reject = true;
    const context = fixture({ render() { if (reject) throw null; } });
    context.controller.start();
    assert.equal(context.controller.status.phase, 'error'); assert.equal(context.controller.status.hasError, true);
    assert.deepEqual(context.errors, [null]); assert.equal(context.stats.closes, 1);
    reject = false; context.controller.restart();
    assert.equal(context.controller.status.phase, 'paused'); assert.equal(context.controller.status.hasError, false);
    context.controller.dispose(); assert.equal(context.stats.closes, 2);
});

class Hub {
    listeners = new Map();
    addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn); }
    removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
    emit(name, event = {}) { for (const fn of [...(this.listeners.get(name) ?? [])]) fn(event); }
    get listenerCount() { return [...this.listeners.values()].reduce((n, set) => n + set.size, 0); }
}
class Element extends Hub {
    children = []; dataset = {}; attributes = new Map(); style = { setProperty(name, value) { this[name] = value; } };
    constructor(ownerDocument, tag) { super(); this.ownerDocument = ownerDocument; this.tag = tag; }
    get parentNode() { return this.parent ?? null; }
    contains(child) { return child === this || this.children.some(value => typeof value === 'object' && value.contains(child)); }
    matches(selector) { return selector === ':focus-visible' && !!this.focusVisible; }
    append(...children) { for (const child of children) { if (typeof child === 'object') { child.remove(); child.parent = this; } this.children.push(child); } }
    insertBefore(child, before) {
        if (before !== null && !this.children.includes(before)) throw new Error('Missing reference child');
        child.remove(); child.parent = this;
        this.children.splice(before === null ? this.children.length : this.children.indexOf(before), 0, child);
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
}
function dom() {
    const scheduler = clock(), doc = new Hub(), view = new Hub(), media = new Hub(), timers = new Map();
    let timerId = 0;
    doc.hidden = false; media.matches = false; doc.defaultView = view;
    doc.createElement = tag => new Element(doc, tag); doc.createElementNS = (_, tag) => new Element(doc, tag); view.matchMedia = () => media;
    view.requestAnimationFrame = fn => scheduler.request(fn); view.cancelAnimationFrame = id => scheduler.cancel(id);
    view.setTimeout = (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; };
    view.clearTimeout = id => timers.delete(id);
    return { doc, view, media, scheduler, timers,
        expireTimers() { const pending = [...timers.values()]; timers.clear(); for (const timer of pending) timer.fn(); },
        container: () => doc.createElement('section') };
}
const panel = container => container.children.find(child => typeof child === 'object' && child.className === 'algiviz-player')
    .children.find(child => child.dataset?.role === 'controls');
const control = (container, action) => panel(container).children.find(child => child.dataset?.action === action);

test('public widget forwards the RAF budget and hidden-document pause discards its backlog', () => {
    const env = dom(), container = env.container(); let reads = 0, closed = 0;
    const ui = new Player(container, { stepDurationMs: 10, rewindCapacity: 6, maxStepsPerFrame: 2, autoHide: false,
        source: function* () { try { while (true) yield reads++; } finally { closed++; } }, render() {} });
    control(container, 'start').emit('click'); control(container, 'play').emit('click');
    env.scheduler.tick(0); env.scheduler.tick(100);
    assert.equal(ui.frame.stepIndex, 2); assert.equal(reads, 3);
    env.doc.hidden = true; env.doc.emit('visibilitychange'); assert.equal(env.scheduler.size, 0);
    env.scheduler.tick(100); assert.equal(reads, 3);
    env.doc.hidden = false; env.doc.emit('visibilitychange');
    control(container, 'play').emit('click'); env.scheduler.tick(1000); assert.equal(ui.frame.stepIndex, 2);
    env.scheduler.tick(1005); assert.equal(ui.frame.progress, 0.5); assert.equal(reads, 4);
    control(container, 'previous').emit('click'); assert.equal(ui.frame.stepIndex, 2); assert.equal(ui.frame.progress, 1);
    const before = container.children.length;
    assert.throws(() => new Player(container, { source: () => [0], maxStepsPerFrame: 0, render() {} }), RangeError);
    assert.equal(container.children.length, before);
    ui.dispose(); assert.equal(closed, 1); assert.equal(env.doc.listenerCount, 0);
});

test('bounded streams replay a retained window, keep absolute indices and rewind after exhaustion', () => {
    const { controller: ui, stats } = fixture({ rewindCapacity: 3 });
    assert.equal(ui.status.rewindStartIndex, null); ui.start();
    assert.equal(ui.status.canPrevious, false); assert.equal(ui.status.rewindStartIndex, 0);
    for (let i = 1; i <= 3; i++) { ui.next(); assert.equal(ui.frame.stepIndex, i); }
    assert.deepEqual([ui.status.rewindStartIndex, ui.status.rewindEndIndex], [1, 3]);
    ui.previous(); assert.equal(ui.frame.current.n, 2); assert.equal(ui.frame.progress, 1);
    ui.previous(); assert.equal(ui.frame.current.n, 1); assert.equal(ui.status.canPrevious, false);
    ui.previous(); assert.equal(ui.frame.current.n, 1); assert.equal(stats.reads, 4);
    ui.next(); ui.next(); assert.equal(ui.frame.current.n, 3); assert.equal(ui.frame.stepIndex, 3);
    assert.equal(stats.reads, 4); assert.equal(ui.status.phase, 'paused');
    ui.next(); assert.equal(ui.status.phase, 'finished'); assert.equal(stats.closes, 1);
    assert.equal(ui.status.canPrevious, true); assert.equal(ui.status.canSeek, false);
    assert.equal(ui.status.positionMs, null); assert.equal(ui.status.durationMs, null);
    ui.previous(); assert.equal(ui.status.phase, 'paused'); assert.equal(ui.frame.stepIndex, 2);
    ui.next(); assert.equal(ui.status.phase, 'finished'); // Final buffered state is now known.
    assert.equal(ui.frame.stepIndex, 3); assert.equal(stats.reads, 4); assert.equal(stats.closes, 1);
    ui.dispose(); assert.equal(stats.closes, 1);
});

test('bounded timed playback agrees with ordinary streaming before any backward command', () => {
    const a = fixture({ stepDurationMs: 100, finalHoldMs: 50 });
    const b = fixture({ stepDurationMs: 100, finalHoldMs: 50, rewindCapacity: 3 });
    a.controller.start(); b.controller.start();
    for (const delta of [0, 1, 24, 75, 1, 99, 50, 50, 1, 49, 1, 100]) {
        // A direct session tick sequence also exercises partial frames and final hold.
        a.controller.play(); b.controller.play();
        a.scheduler.tick(0); b.scheduler.tick(0);
        a.scheduler.tick(delta); b.scheduler.tick(delta);
        a.controller.pause(); b.controller.pause();
        assert.deepEqual(b.controller.frame, a.controller.frame);
        assert.equal(b.controller.status.phase, a.controller.status.phase);
        assert.deepEqual(b.stats, a.stats);
    }
    a.controller.dispose(); b.controller.dispose();
});

test('Previous pauses a partial transition; Next and Play replay without additional source reads', () => {
    const { controller: ui, scheduler, stats } = fixture({ stepDurationMs: 100, rewindCapacity: 3 });
    ui.start(); ui.play(); scheduler.tick(0); scheduler.tick(25);
    assert.equal(ui.frame.current.n, 1); assert.equal(ui.frame.progress, 0.25);
    ui.previous(); assert.equal(ui.status.phase, 'paused'); assert.equal(scheduler.size, 0);
    assert.equal(ui.frame.current.n, 0); assert.equal(ui.frame.previous.n, 0); assert.equal(ui.frame.progress, 1);
    ui.play(); scheduler.tick(1000); scheduler.tick(1025);
    assert.equal(ui.frame.current.n, 1); assert.equal(ui.frame.progress, 0.25); assert.equal(stats.reads, 2);
    ui.next(); assert.equal(ui.frame.progress, 1); assert.equal(stats.reads, 2); assert.equal(scheduler.size, 0);
    ui.next(); assert.equal(ui.frame.current.n, 2); assert.equal(stats.reads, 3);
    ui.previous(); ui.setSpeed(2); ui.play(); scheduler.tick(2000); scheduler.tick(2025);
    assert.equal(ui.frame.current.n, 2); assert.equal(ui.frame.progress, 0.5); assert.equal(stats.reads, 3);
    scheduler.tick(2050); scheduler.tick(2100);
    assert.equal(ui.frame.current.n, 3); assert.equal(stats.reads, 4);
    ui.dispose(); assert.equal(stats.closes, 1);
});

test('known stream completion and final hold are restored when replaying the final buffered transition', () => {
    const { controller: ui, stats, scheduler } = fixture({ rewindCapacity: 3, stepDurationMs: 100, finalHoldMs: 50 });
    ui.start(); for (let i = 0; i < 3; i++) ui.next();
    ui.next(); assert.equal(ui.status.phase, 'paused'); assert.equal(stats.closes, 1);
    ui.previous(); assert.equal(ui.frame.current.n, 2);
    ui.next(); assert.equal(ui.frame.current.n, 3); assert.equal(ui.status.phase, 'paused');
    ui.play(); scheduler.tick(0); scheduler.tick(25); assert.equal(ui.status.phase, 'playing');
    scheduler.tick(50); assert.equal(ui.status.phase, 'finished'); assert.equal(scheduler.size, 0);
    ui.previous(); ui.next(); ui.next(); assert.equal(ui.status.phase, 'finished');
    assert.equal(stats.reads, 4); assert.equal(stats.closes, 1); ui.dispose();
});

test('one timed advance can exceed the window and retain only the latest absolute positions', () => {
    let reads = 0;
    const { controller: ui, scheduler } = fixture({ rewindCapacity: 3, stepDurationMs: 10,
        source: function* () { while (true) yield reads++; } });
    ui.start(); ui.setSpeed(8); ui.play(); scheduler.tick(0); scheduler.tick(100);
    assert.equal(ui.frame.stepIndex, 80); assert.equal(reads, 81);
    assert.deepEqual([ui.status.rewindStartIndex, ui.status.rewindEndIndex], [78, 80]);
    ui.previous(); ui.previous(); assert.equal(ui.frame.current, 78); assert.equal(ui.status.canPrevious, false);
    ui.next(); ui.next(); assert.equal(reads, 81); ui.next();
    assert.equal(ui.frame.stepIndex, 81); assert.equal(reads, 82); ui.dispose();
});

test('capacity one, singleton streams and invalid rewind configurations have explicit capabilities', () => {
    const { controller: ui } = fixture({ rewindCapacity: 1 });
    ui.start(); ui.next(); assert.equal(ui.status.canPrevious, false);
    ui.previous(); assert.equal(ui.frame.current.n, 1); assert.deepEqual([ui.status.rewindStartIndex, ui.status.rewindEndIndex], [1, 1]);
    ui.dispose();
    const single = fixture({ rewindCapacity: 5, source: () => [42] }).controller;
    single.start(); assert.equal(single.status.phase, 'paused'); single.next();
    assert.equal(single.status.phase, 'finished'); assert.equal(single.status.canPrevious, false); single.dispose();
    let calls = 0;
    for (const rewindCapacity of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null, '3'])
        assert.throws(() => createStateController({ source() { calls++; return [1]; }, rewindCapacity, render() {} }), RangeError);
    assert.throws(() => createStateController({ history() { calls++; return [1]; }, rewindCapacity: 3, stepDurationMs: 100, render() {} }), /only available/);
    assert.equal(calls, 0);
});

test('a rejected bounded restart preserves the rewound buffer, while successful restart gets a fresh source', () => {
    let reject = false;
    const context = fixture({ rewindCapacity: 3 });
    const { controller: ui, stats } = context;
    ui.start(); ui.next(); ui.next(); ui.previous();
    // Rejection of a separately prepared candidate must preserve the old cursor.
    let factories = 0, closed = 0;
    const second = fixture({ rewindCapacity: 3, source() {
        factories++; if (reject) throw Error('rejected');
        return (function* () { try { yield 0; yield 1; yield 2; } finally { closed++; } })();
    } });
    second.controller.start(); second.controller.next(); second.controller.next(); second.controller.previous();
    const frame = second.controller.frame; reject = true; second.controller.restart();
    assert.deepEqual(second.controller.frame, frame); assert.equal(second.controller.status.phase, 'paused'); assert.equal(closed, 0);
    second.controller.previous(); assert.equal(second.controller.frame.current, 0);
    reject = false; second.controller.restart(); assert.equal(closed, 1); assert.equal(factories, 3);
    second.controller.dispose(); assert.equal(closed, 2);
    ui.restart(); assert.equal(ui.frame.current.n, 0); assert.equal(stats.factories, 2); assert.equal(stats.closes, 1); ui.dispose();
});

test('bounded-source, backward-render and replacement cleanup failures close sources exactly once', () => {
    for (const origin of ['source', 'render']) {
        const primary = new Error(origin), cleanup = new Error('cleanup'); let reads = 0, closes = 0, backward = false;
        const { controller: ui, errors } = fixture({ rewindCapacity: 3,
            source: () => ({ [Symbol.iterator]: () => ({
                next() { if (++reads === 3 && origin === 'source') throw primary; return { value: reads, done: false }; },
                return() { closes++; throw cleanup; }
            }) }), render() { if (backward && origin === 'render') throw primary; } });
        ui.start(); ui.next();
        if (origin === 'source') ui.next(); else { backward = true; ui.previous(); }
        assert.equal(ui.status.phase, 'error'); assert.equal(errors[0], primary); assert.equal(closes, 1);
        assert.equal(ui.status.canPrevious, false); ui.dispose(); assert.equal(closes, 1);
    }
    const cleanup = new Error('replace'); let acquired = 0, closed = 0;
    const { controller: ui, errors } = fixture({ rewindCapacity: 2, source() {
        const session = ++acquired; return { [Symbol.iterator]: () => ({ next: () => ({ value: session, done: false }),
            return() { closed++; if (session === 1) throw cleanup; return { done: true }; } }) };
    } });
    ui.start(); ui.restart(); assert.equal(ui.status.phase, 'error'); assert.equal(errors[0], cleanup);
    assert.equal(closed, 2); ui.dispose(); assert.equal(closed, 2);
});

test('bounded stream buttons expose only retained Previous, preserve recording controls and clean up scoped instances', () => {
    const env = dom(), container = env.container(), other = env.container(); let reads = 0, closes = 0;
    const ui = new Player(container, { rewindCapacity: 3, labels: { previous: 'Назад', step: 'Состояние', stream: 'ПОТОК' },
        source: function* () { try { for (let i = 0; i < 5; i++) { reads++; yield i; } } finally { closes++; } }, render() {} });
    const plain = new Player(other, { source: () => [0, 1], render() {} });
    const previous = control(container, 'previous'); assert.equal(previous.hidden, true);
    ui.start(); plain.start(); assert.equal(previous.hidden, false); assert.equal(previous.disabled, true);
    assert.equal(previous.attributes.get('aria-label'), 'Назад'); assert.equal(control(other, 'previous').hidden, true);
    for (let i = 0; i < 4; i++) control(container, 'next').emit('click');
    assert.equal(reads, 5); assert.equal(previous.disabled, false); assert.equal(control(container, 'seek').hidden, true);
    assert.equal(panel(container).children.find(child => child.dataset?.role === 'stream').textContent, 'ПОТОК · Состояние 2–4');
    previous.emit('click'); previous.emit('click'); assert.equal(ui.frame.current, 2); assert.equal(previous.disabled, true);
    control(container, 'next').emit('click'); assert.equal(ui.frame.current, 3); assert.equal(reads, 5);
    assert.equal(plain.frame.current, 0); ui.dispose(); assert.equal(closes, 1); assert.equal(env.doc.listenerCount, 1);
    previous.emit('click'); assert.equal(closes, 1); plain.dispose(); assert.equal(env.doc.listenerCount, 0);
});

test('scoped UI instances have no fixed IDs, preserve caller children and tear down only their own listeners', () => {
    const env = dom(), a = env.container(), b = env.container(), note = env.doc.createElement('p'); a.append(note);
    let aClosed = 0, bClosed = 0;
    const source = close => function* () { try { yield 0; yield 1; yield 2; } finally { close(); } };
    const first = new Player(a, { source: source(() => aClosed++), render() {}, labels: { start: 'Начать' } });
    const second = new Player(b, { source: source(() => bClosed++), render() {}, stepDurationMs: 100 });
    assert.ok(first instanceof Player); assert.ok(second instanceof Player);
    assert.equal(first.frame, null); assert.equal(second.frame, null);
    assert.equal(control(a, 'start').attributes.get('aria-label'), 'Начать'); assert.equal(control(a, 'restart').hidden, true);
    const oldNext = control(a, 'next'); control(a, 'start').emit('click'); control(a, 'next').emit('click');
    assert.equal(first.frame.current, 1); assert.equal(second.frame, null);
    control(b, 'start').emit('click'); control(b, 'play').emit('click');
    assert.equal(first.frame.current, 1); assert.equal(second.status.phase, 'playing');
    assert.equal(env.doc.listenerCount, 2); assert.equal(env.view.listenerCount, 2); assert.equal(env.media.listenerCount, 2);
    first.dispose(); first.dispose(); oldNext.emit('click');
    assert.deepEqual(a.children, [note]); assert.equal(aClosed, 1); assert.equal(bClosed, 0);
    assert.equal(second.status.phase, 'playing'); assert.equal(env.scheduler.size, 1);
    assert.equal(env.doc.listenerCount, 1); second.dispose(); assert.equal(bClosed, 1);
    assert.equal(env.doc.listenerCount + env.view.listenerCount + env.media.listenerCount, 0);
    assert.equal(env.scheduler.size, 0); assert.deepEqual(b.children, []);
});

test('hidden tabs pause without reading ahead; reduced motion redraws the same raw frame and pagehide cleans up', () => {
    const env = dom(), container = env.container(), frames = []; let reads = 0, closed = 0;
    const ui = new Player(container, { stepDurationMs: 100, render: frame => frames.push(frame),
        source: function* () { try { while (true) yield ++reads; } finally { closed++; } } });
    ui.start(); ui.play(); env.scheduler.tick(0); env.scheduler.tick(25);
    assert.equal(ui.frame.progress, 0.25); const before = ui.frame;
    env.media.matches = true; env.media.emit('change');
    assert.equal(reads, 2); assert.equal(frames.at(-1).progress, 1); assert.deepEqual(ui.frame, before);
    env.doc.hidden = true; env.doc.emit('visibilitychange');
    assert.equal(ui.status.phase, 'paused'); assert.equal(env.scheduler.size, 0); assert.equal(closed, 0);
    env.doc.hidden = false; env.doc.emit('visibilitychange'); assert.equal(ui.status.phase, 'paused');
    env.view.emit('pagehide'); assert.equal(closed, 1); assert.equal(ui.status.phase, 'disposed');
    assert.equal(container.children.length, 0); assert.equal(env.media.listenerCount, 0);
});

test('UI disposal removes DOM/listeners even when source cleanup throws; remount starts idle', () => {
    const env = dom(), container = env.container(), cleanup = new Error('cleanup'); let closed = 0;
    const ui = new Player(container, { render() {}, source: () => ({ [Symbol.iterator]: () => ({
        next: () => ({ value: 1, done: false }), return() { closed++; throw cleanup; },
    }) }) });
    ui.start(); const last = ui.frame;
    assert.throws(() => ui.dispose(), error => error === cleanup); ui.dispose();
    assert.equal(closed, 1); assert.deepEqual(ui.frame, last); assert.equal(container.children.length, 0);
    assert.equal(env.doc.listenerCount + env.view.listenerCount + env.media.listenerCount, 0);
    const remounted = new Player(container, { source: function* () { yield 7; }, render() {} });
    assert.equal(remounted.status.phase, 'idle'); assert.equal(remounted.frame, null); remounted.dispose();
});

test('programmatic speeds remain visible with at most one custom option and never consume a state', () => {
    const env = dom(), container = env.container(); let reads = 0;
    const ui = new Player(container, { stepDurationMs: 100, source: function* () { yield ++reads; }, render() {} });
    const select = panel(container).children.find(child => child.tag === 'label').children.find(child => child.tag === 'select');
    for (const speed of [1.5, 2.5, 3.5]) {
        ui.setSpeed(speed); assert.equal(select.value, String(speed)); assert.equal(select.children.length, 8);
        assert.equal(select.children.at(-1).textContent, `${speed}×`);
    }
    ui.setSpeed(1); assert.equal(select.children.length, 7); assert.equal(reads, 0); ui.dispose();
});

test('integrated player hosts the same viewport and restores its original position and drawing on disposal', () => {
    for (const cleanupThrows of [false, true]) {
        const env = dom(), container = env.container();
        const before = env.doc.createElement('p'), viewport = env.doc.createElement('canvas'), after = env.doc.createElement('p');
        const drawing = { tokenX: 200 }; viewport.drawing = drawing;
        container.append(before, viewport, after);
        let reads = 0, closes = 0;
        const cleanup = new Error('cleanup');
        const ui = new Player(container, { viewport, render() {}, source: function* () {
            try { while (true) yield ++reads; } finally { closes++; if (cleanupThrows) throw cleanup; }
        } });
        const root = container.children[1], stage = root.children.find(child => child.dataset?.role === 'viewport');
        assert.equal(stage.children[0], viewport); assert.equal(viewport.parentNode, stage);
        assert.equal(root.children.includes(panel(container)), true); assert.equal(reads, 0);
        control(container, 'start').emit('click'); control(container, 'next').emit('click');
        assert.equal(reads, 2);
        if (cleanupThrows) assert.throws(() => ui.dispose(), error => error === cleanup);
        else ui.dispose();
        ui.dispose(); assert.equal(closes, 1);
        assert.deepEqual(container.children, [before, viewport, after]); assert.equal(viewport.drawing, drawing);
        assert.equal(env.doc.listenerCount + env.view.listenerCount + env.media.listenerCount, 0);
    }
});

test('a viewport outside the supplied container is rejected without moving DOM or creating a source', () => {
    const env = dom(), container = env.container(), other = env.container(), viewport = env.doc.createElement('svg');
    other.append(viewport); let reads = 0;
    const options = { viewport, source: function* () { yield ++reads; }, render() {} };
    assert.throws(() => new Player(container, options), /direct child/);
    assert.deepEqual(container.children, []); assert.deepEqual(other.children, [viewport]); assert.equal(reads, 0);
});

test('explicit recordings seek and step backwards without recreating history; seeking stops RAF', () => {
    let factories = 0;
    const { controller: ui, scheduler } = fixture({ source: undefined, stepDurationMs: 100,
        history() { factories++; return [0, 1, 2, 3]; } });
    assert.equal(factories, 0); assert.equal(ui.status.canSeek, false);
    ui.start(); assert.equal(factories, 1); assert.equal(ui.status.durationMs, 300); assert.equal(ui.status.mode, 'recording');
    ui.play(); scheduler.tick(0); scheduler.tick(25);
    assert.equal(ui.frame.progress, 0.25);
    ui.seek(150); assert.equal(scheduler.size, 0); assert.equal(ui.status.phase, 'paused');
    assert.equal(ui.frame.current, 2); assert.equal(ui.frame.previous, 1); assert.equal(ui.frame.progress, 0.5);
    ui.previous(); assert.equal(ui.status.positionMs, 100); ui.next(); assert.equal(ui.status.positionMs, 200);
    ui.seek(1000); assert.equal(ui.status.positionMs, 300); assert.equal(ui.status.phase, 'finished');
    assert.equal(ui.status.canSeek, true); assert.equal(ui.status.canPrevious, true);
    ui.previous(); assert.equal(ui.status.phase, 'paused'); assert.equal(ui.status.positionMs, 200);
    ui.seek(-10); assert.equal(ui.frame.current, 0); assert.equal(ui.status.canPrevious, false);
    assert.throws(() => ui.seek(Infinity), /finite/); assert.equal(factories, 1);
    ui.restart(); assert.equal(factories, 2); assert.equal(ui.frame.current, 0); ui.dispose();
});

test('recording final holds and singleton histories retain core timeline semantics', () => {
    const { controller: ui } = fixture({ source: undefined, history: () => [0, 1], stepDurationMs: 100, finalHoldMs: 50 });
    ui.start(); ui.next(); assert.equal(ui.status.positionMs, 100); assert.equal(ui.status.phase, 'paused');
    ui.next(); assert.equal(ui.status.positionMs, 150); assert.equal(ui.status.phase, 'finished');
    ui.previous(); assert.equal(ui.status.positionMs, 100); assert.equal(ui.frame.current, 1); ui.dispose();
    const singleton = fixture({ source: undefined, history: () => [42], stepDurationMs: 100 }).controller;
    singleton.start(); assert.equal(singleton.status.phase, 'finished'); assert.equal(singleton.status.canSeek, false);
    assert.equal(singleton.frame.current, 42); singleton.dispose();
});

test('recordings require explicit dense arrays and timing, and invalid replacement preserves the previous session', () => {
    let value = [0, 1, 2], consumed = 0;
    const { controller: ui, errors } = fixture({ source: undefined, history: () => value, stepDurationMs: 100 });
    ui.start(); ui.seek(150); const previous = ui.frame;
    for (const invalid of [[], new Array(2), { *[Symbol.iterator]() { consumed++; yield 1; } }]) {
        value = invalid; ui.restart(); assert.deepEqual(ui.frame, previous);
        assert.equal(ui.status.positionMs, 150); assert.equal(ui.status.canSeek, true);
    }
    assert.equal(errors.length, 3); assert.equal(consumed, 0); ui.dispose();
    assert.throws(() => createStateController({ history: () => [1], render() {} }), /stepDurationMs/);
    assert.throws(() => createStateController({ source: () => [], history: () => [], render() {} }), /exactly one/);
});

test('seeking is unavailable for streams even when the iterable eventually finishes', () => {
    const { controller: ui, stats } = fixture();
    ui.start(); assert.equal(ui.status.mode, 'stream'); assert.equal(ui.status.canSeek, false);
    assert.equal(ui.status.durationMs, null); assert.throws(() => ui.seek(0), /stream/);
    assert.throws(() => ui.previous(), /stream/); assert.equal(stats.reads, 1);
    for (let n = 0; n < 4; n++) ui.next();
    assert.equal(ui.status.phase, 'finished'); assert.equal(ui.status.canSeek, false); ui.dispose();
});

test('media controls have accessible icon labels, a capability-driven optional seek bar, and Replay', () => {
    for (const seekBar of [true, false]) {
        const env = dom(), container = env.container(); let captures = 0;
        const ui = new Player(container, { history() { captures++; return [0, 1, 2]; }, stepDurationMs: 100, seekBar, render() {} });
        const seek = control(container, 'seek');
        assert.equal(seek.hidden, !seekBar); assert.equal(seek.disabled, true); assert.equal(captures, 0);
        assert.equal(control(container, 'start').dataset.icon, 'play');
        assert.equal(control(container, 'start').attributes.get('aria-label'), 'Start');
        control(container, 'start').emit('click'); assert.equal(seek.disabled, false);
        control(container, 'play').emit('click'); assert.equal(control(container, 'play').dataset.icon, 'pause');
        assert.equal(control(container, 'play').attributes.get('aria-label'), 'Pause');
        seek.value = '150'; seek.emit('input'); assert.equal(ui.status.positionMs, 150); assert.equal(ui.status.phase, 'paused');
        control(container, 'previous').emit('click'); assert.equal(ui.status.positionMs, 100);
        ui.seek(200); assert.equal(control(container, 'play').dataset.icon, 'restart');
        assert.equal(control(container, 'play').attributes.get('aria-label'), 'Replay');
        control(container, 'play').emit('click'); assert.equal(captures, 2); assert.equal(ui.status.phase, 'playing');
        ui.dispose(); assert.equal(env.scheduler.size, 0);
    }
    const env = dom(), container = env.container();
    const ui = new Player(container, { source: function* () { yield 1; }, render() {}, seekBar: true });
    assert.equal(control(container, 'seek').hidden, true); assert.equal(control(container, 'previous').hidden, true); ui.dispose();
});

function overlayFixture(options = {}) {
    const env = dom(), container = env.container(), viewport = env.doc.createElement('canvas'); container.append(viewport);
    let reads = 0, closed = 0;
    const ui = new Player(container, { viewport, stepDurationMs: 100, render() {},
        source: function* () { try { while (true) yield ++reads; } finally { closed++; } }, ...options });
    const root = container.children[0];
    return { ...env, container, viewport, ui, root, get reads() { return reads; }, get closed() { return closed; } };
}

test('overlay controls hide after inactivity without pausing playback and reappear on pointer activity', () => {
    const env = overlayFixture();
    assert.equal(env.root.dataset.overlay, 'true'); assert.equal(env.root.dataset.controls, 'visible'); assert.equal(env.timers.size, 0);
    env.ui.start(); env.ui.play(); env.scheduler.tick(0); env.scheduler.tick(25);
    assert.equal(env.timers.size, 1); assert.equal([...env.timers.values()][0].delay, 2000);
    env.expireTimers(); assert.equal(env.root.dataset.controls, 'hidden'); assert.equal(env.ui.status.phase, 'playing');
    env.scheduler.tick(50); assert.equal(env.ui.frame.progress, 0.5); assert.equal(env.root.dataset.controls, 'hidden');
    env.root.emit('pointermove'); assert.equal(env.root.dataset.controls, 'visible');
    panel(env.container).emit('pointerenter'); assert.equal(env.timers.size, 0); env.expireTimers();
    assert.equal(env.root.dataset.controls, 'visible');
    panel(env.container).emit('pointerleave'); env.expireTimers(); assert.equal(env.root.dataset.controls, 'hidden');
    env.ui.dispose(); assert.equal(env.closed, 1); assert.equal(env.scheduler.size, 0);
});

test('keyboard focus and the native speed picker pin controls, while pointer focus alone does not', () => {
    const env = overlayFixture(); env.ui.start();
    const next = control(env.container, 'next'), outside = env.doc.createElement('button');
    next.focusVisible = true; env.root.emit('focusin', { target: next }); env.expireTimers();
    assert.equal(env.root.dataset.controls, 'visible'); assert.equal(env.timers.size, 0);
    env.root.emit('focusout', { target: next, relatedTarget: outside }); env.expireTimers();
    assert.equal(env.root.dataset.controls, 'hidden');
    next.focusVisible = false; env.root.emit('focusin', { target: next }); env.expireTimers();
    assert.equal(env.root.dataset.controls, 'hidden');
    const speed = panel(env.container).children.find(child => child.tag === 'label').children.find(child => child.tag === 'select');
    env.root.emit('focusin', { target: speed }); env.expireTimers(); assert.equal(env.root.dataset.controls, 'visible');
    env.root.emit('focusout', { target: speed, relatedTarget: outside }); env.expireTimers();
    assert.equal(env.root.dataset.controls, 'hidden');
    env.ui.dispose(); assert.equal(env.timers.size, 0);
});

test('a held touch/drag keeps controls visible until release or cancellation; errors are never hidden', () => {
    let fail = false;
    const env = overlayFixture({ render() { if (fail) throw new Error('draw failed'); } });
    env.ui.start(); env.expireTimers(); assert.equal(env.root.dataset.controls, 'hidden');
    env.root.emit('pointerdown', { pointerId: 7, pointerType: 'touch', target: env.viewport });
    env.root.emit('pointerleave'); env.expireTimers(); assert.equal(env.root.dataset.controls, 'visible');
    assert.equal(env.reads, 1);
    env.doc.emit('pointercancel', { pointerId: 7 }); env.expireTimers(); assert.equal(env.root.dataset.controls, 'hidden');
    env.root.emit('pointerdown', { pointerId: 8, target: env.viewport });
    env.doc.emit('pointerup', { pointerId: 8 }); env.expireTimers(); assert.equal(env.root.dataset.controls, 'hidden');
    fail = true; env.ui.next(); env.expireTimers(); assert.equal(env.root.dataset.controls, 'visible');
    assert.equal(env.ui.status.phase, 'error'); assert.equal(env.timers.size, 0); env.ui.dispose();
});

test('overlay teardown cancels timers/listeners and autoHide false preserves the ordinary footer', () => {
    const env = overlayFixture(); env.ui.start();
    const late = [...env.timers.values()][0].fn;
    env.ui.dispose(); const visibility = env.root.dataset.controls; late();
    assert.equal(env.root.dataset.controls, visibility); assert.equal(env.timers.size, 0); assert.equal(env.closed, 1);
    assert.equal(env.doc.listenerCount + env.view.listenerCount + env.media.listenerCount, 0);
    assert.deepEqual(env.container.children, [env.viewport]);
    const fixed = overlayFixture({ autoHide: false }); fixed.ui.start(); fixed.expireTimers();
    assert.equal(fixed.root.dataset.overlay, 'false'); assert.equal(fixed.root.dataset.controls, 'visible');
    assert.equal(fixed.timers.size, 0); fixed.ui.dispose();
});

test('a rejected reentrant widget disposal keeps its shell recoverable for later cleanup', () => {
    const env = dom(), container = env.container(), viewport = env.doc.createElement('canvas'); container.append(viewport);
    let ui, reject = false, closes = 0;
    ui = new Player(container, { viewport,
        source: function* () { try { yield 0; yield 1; } finally { closes++; } },
        render() { if (reject) ui.dispose(); },
    });
    ui.start(); reject = true; ui.next();
    assert.equal(ui.status.phase, 'error'); assert.equal(closes, 1);
    assert.equal(container.children[0].className, 'algiviz-player');
    ui.dispose(); assert.equal(ui.status.phase, 'disposed');
    assert.deepEqual(container.children, [viewport]); assert.equal(closes, 1);
    assert.equal(env.timers.size + env.doc.listenerCount + env.view.listenerCount + env.media.listenerCount, 0);
});

test('labels copy defaults for explicit undefined; malformed UI options fail before mounting', () => {
    const env = dom(), container = env.container(); let reads = 0;
    const options = { source: function* () { yield ++reads; }, render() {} };
    const ui = new Player(container, { ...options, labels: { start: undefined } });
    assert.equal(control(container, 'start').attributes.get('aria-label'), 'Start'); ui.dispose();
    for (const invalid of [{ autoHide: 'false' }, { seekBar: 1 }, { labels: { start: '' } },
        { labels: { play: null } }, { onError: true }, { onStatus: null }, { viewport: null }])
        assert.throws(() => new Player(container, { ...options, ...invalid }), TypeError);
    assert.equal(container.children.length, 0); assert.equal(reads, 0);
});
