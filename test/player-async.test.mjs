import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Player } from '@grundyjs/algiviz/player';
import { dom, control, shell, waitingLabel } from './player-test-dom.mjs';

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
const turn = () => new Promise(resolve => setImmediate(resolve));
async function pending(promise) {
    let settled = false; promise.then(() => { settled = true; }, () => { settled = true; });
    await turn(); assert.equal(settled, false);
}
function fixture(options = {}, finish = () => ({ done: true })) {
    const env = dom(), host = env.container(), viewport = env.doc.createElement('canvas');
    host.append(viewport);
    const generations = [], frames = [], errors = [], statuses = [];
    const ui = new Player(host, { viewport, asyncSource(signal) {
        const generation = { signal, reads: [], returns: 0 };
        generations.push(generation);
        const iterator = {
            next() { assert.equal(this, iterator); const gate = deferred(); generation.reads.push(gate); return gate.promise; },
            return() { assert.equal(this, iterator); generation.returns++; return finish(generation); },
        };
        return { [Symbol.asyncIterator]() { return iterator; } };
    }, render: frame => frames.push(frame), onError: error => errors.push(error), onStatus: state => statuses.push(state), ...options });
    return { ui, env, host, viewport, generations, frames, errors, statuses,
        async start(...args) { const value = args.length ? args[0] : 0; ui.start(); generations[0].reads[0].resolve({ value }); await turn(); },
        async value(value, generation = generations.at(-1)) { generation.reads.at(-1).resolve({ value }); await turn(); },
        async end(generation = generations.at(-1)) { generation.reads.at(-1).resolve({ done: true }); await turn(); },
    };
}

test('async widget validates exclusive source capabilities and options before initialization or moving a viewport', () => {
    const env = dom(), host = env.container(), viewport = env.doc.createElement('canvas'); host.append(viewport);
    let calls = 0; const asyncSource = async function* () { calls++; yield 1; };
    for (const extras of [{ source: () => [1] }, { history: () => [1], stepDurationMs: 10 }, { rewindCapacity: 0 }, { maxStepsPerFrame: Infinity }]) {
        assert.throws(() => new Player(host, { viewport, asyncSource, render() {}, ...extras }));
        assert.deepEqual(host.children, [viewport]);
    }
    assert.equal(calls, 0);
});

test('Start waits lazily, coalesces commands and installs one paused first frame', async () => {
    const f = fixture({ stepDurationMs: 100 }), { ui, env, host } = f;
    assert.equal(f.generations.length, 0); assert.equal(ui.frame, null);
    assert.equal(ui.status.waiting, false); assert.equal(ui.status.preparing, null);
    const closed = ui.closed; assert.equal(closed, ui.closed); await pending(closed);
    const accepted = ui.start();
    assert.equal(accepted.phase, 'idle'); assert.equal(accepted.started, false);
    assert.equal(accepted.preparing, 'start'); assert.equal(accepted.waiting, true);
    assert.equal(control(host, 'start').disabled, true); assert.equal(waitingLabel(host).textContent, 'Preparing playback');
    ui.start(); ui.restart(); ui.play(); ui.next();
    assert.equal(f.generations.length, 1); assert.equal(f.generations[0].reads.length, 1);
    assert.equal(env.scheduler.size, 0); assert.equal(f.frames.length, 0);
    await f.value(undefined);
    assert.equal(ui.status.phase, 'paused'); assert.equal(ui.status.started, true);
    assert.equal(ui.status.preparing, null); assert.equal(ui.status.waiting, false);
    assert.equal(ui.frame.current, undefined); assert.equal(ui.frame.stepIndex, 0); assert.equal(ui.frame.progress, 1);
    assert.equal(f.frames.length, 1); ui.dispose(); await ui.closed;
});

test('manual Next coalesces, exposes Pause without timing, and Pause stages a single late value', async () => {
    const f = fixture(), { ui, host } = f; await f.start(0);
    ui.next(); ui.next(); ui.next();
    assert.equal(f.generations[0].reads.length, 2); assert.equal(ui.status.waiting, true); assert.equal(ui.status.canPause, true);
    const button = control(host, 'play');
    assert.equal(button.hidden, false); assert.equal(button.disabled, false); assert.equal(button.attributes.get('aria-label'), 'Pause');
    button.emit('click');
    assert.equal(ui.status.waiting, true); assert.equal(ui.status.canPause, false); assert.equal(f.generations[0].signal.aborted, false);
    const count = f.frames.length; await f.value(1);
    assert.equal(ui.frame.current, 0); assert.equal(f.frames.length, count); assert.equal(ui.status.waiting, false);
    ui.next(); assert.equal(ui.frame.current, 1); assert.equal(ui.frame.previous, 0); assert.equal(ui.frame.progress, 1);
    assert.equal(f.generations[0].reads.length, 2);
    ui.next(); await f.value(2); assert.equal(ui.frame.current, 2); assert.equal(ui.status.canPause, false);
    ui.dispose(); await ui.closed;
});

test('Play waits without RAF polling, starts at zero after arrival and does not accumulate wait time', async () => {
    const f = fixture({ stepDurationMs: 100, maxStepsPerFrame: 1 }), { ui, env } = f;
    await f.start(0); ui.play();
    assert.equal(ui.status.phase, 'playing'); assert.equal(ui.status.waiting, true); assert.equal(ui.status.canPause, true);
    assert.equal(env.scheduler.size, 0); env.scheduler.tick(50000); assert.equal(ui.frame.current, 0);
    await f.value(1); assert.equal(env.scheduler.size, 1); assert.equal(ui.frame.current, 0);
    env.scheduler.tick(50000); assert.equal(ui.frame.current, 1); assert.equal(ui.frame.progress, 0);
    env.scheduler.tick(50025); assert.equal(ui.frame.progress, 0.25);
    env.scheduler.tick(60000); assert.equal(ui.frame.progress, 1); assert.equal(ui.status.waiting, true); assert.equal(env.scheduler.size, 0);
    await f.value(2); env.scheduler.tick(100000); assert.equal(ui.frame.current, 2); assert.equal(ui.frame.progress, 0);
    ui.pause(); env.scheduler.tick(200000); assert.equal(ui.frame.progress, 0);
    ui.next(); assert.equal(ui.frame.progress, 1); assert.equal(f.generations[0].reads.length, 3);
    ui.dispose(); await ui.closed;
});

test('Next and Play change an outstanding request intent without additional reads', async () => {
    const f = fixture({ stepDurationMs: 100 }), { ui, env } = f; await f.start();
    ui.play(); ui.next(); assert.equal(ui.status.phase, 'paused'); await f.value(1);
    assert.equal(ui.frame.current, 1); assert.equal(ui.frame.progress, 1); assert.equal(env.scheduler.size, 0);
    ui.next(); ui.play(); await f.value(2);
    env.scheduler.tick(1000); assert.equal(ui.frame.current, 2); assert.equal(ui.frame.progress, 0);
    assert.equal(f.generations[0].reads.length, 3); ui.dispose(); await ui.closed;
});

test('rewind replay progresses with a background request; arrival does not evict the retained window', async () => {
    const f = fixture({ stepDurationMs: 100, rewindCapacity: 3, maxStepsPerFrame: 1 }), { ui, env, host } = f;
    await f.start(0);
    for (const n of [1, 2]) { ui.next(); await f.value(n); }
    ui.next(); ui.previous(); ui.previous();
    assert.equal(ui.frame.stepIndex, 0); assert.equal(ui.status.waiting, true);
    ui.play(); env.scheduler.tick(0); env.scheduler.tick(25);
    assert.equal(ui.frame.stepIndex, 1); assert.equal(ui.frame.progress, 0.25);
    const stage = shell(host).children.find(child => child.dataset.role === 'viewport');
    assert.equal(stage.attributes.get('aria-busy'), 'false');
    await f.value(3);
    assert.deepEqual([ui.status.rewindStartIndex, ui.status.rewindEndIndex], [0, 2]);
    assert.equal(ui.frame.progress, 0.25); assert.equal(ui.status.waiting, false);
    ui.pause(); ui.next(); ui.next(); ui.next();
    assert.equal(ui.frame.stepIndex, 3); assert.deepEqual([ui.status.rewindStartIndex, ui.status.rewindEndIndex], [1, 3]);
    assert.equal(f.generations[0].reads.length, 4); ui.dispose(); await ui.closed;
});

test('Restart prepares one candidate then awaits old next/return cleanup, ignoring a late old rejection', async () => {
    const returning = deferred();
    const f = fixture({ rewindCapacity: 3 }, generation => generation === f.generations[0] ? returning.promise : { done: true });
    const { ui } = f; await f.start(0); ui.next(); const old = f.generations[0];
    ui.restart(); ui.restart(); ui.start();
    assert.equal(f.generations.length, 2); assert.equal(ui.status.preparing, 'restart');
    assert.equal(old.signal.aborted, false); assert.equal(ui.frame.current, 0);
    await f.value(100); assert.equal(old.signal.aborted, true); assert.equal(old.signal.reason, 'player:restart');
    assert.equal(old.returns, 0); assert.equal(ui.status.cleanupPending, true); assert.equal(ui.status.waiting, false);
    ui.restart(); assert.equal(f.generations.length, 2);
    old.reads[1].reject(undefined); await turn(); assert.equal(old.returns, 1); assert.equal(ui.frame.current, 0);
    returning.resolve({ done: true }); await turn();
    assert.equal(ui.frame.current, 100); assert.equal(ui.frame.stepIndex, 0); assert.equal(ui.status.phase, 'paused');
    assert.equal(ui.status.preparing, null); assert.equal(ui.status.cleanupPending, false); assert.deepEqual(f.errors, []);
    ui.dispose(); const report = await ui.closed; assert.equal(report.errorCount, 0); assert.equal(report.sources.length, 1);
});

test('candidate failure rolls back after cleanup, preserving the old session and quarantined value', async () => {
    const returning = deferred(), primary = new Error('candidate');
    const f = fixture({ stepDurationMs: 100 }, generation => generation === f.generations[1] ? returning.promise : { done: true });
    const { ui } = f; await f.start(0); ui.next(); const old = f.generations[0]; ui.restart();
    f.generations[1].reads[0].reject(primary); await turn();
    assert.equal(ui.status.preparing, 'restart'); assert.equal(ui.status.hasError, true); assert.equal(ui.status.phase, 'paused');
    assert.equal(old.signal.aborted, false); assert.equal(f.errors[0], primary);
    ui.play(); ui.next(); assert.equal(ui.status.hasError, true);
    old.reads[1].resolve({ value: 1 }); await turn(); assert.equal(ui.frame.current, 0);
    returning.resolve({ done: true }); await turn();
    assert.equal(ui.status.preparing, null); assert.equal(ui.status.hasError, true);
    ui.next(); assert.equal(ui.frame.current, 1); assert.equal(old.reads.length, 2);
    ui.dispose(); await ui.closed;
});

test('a quarantined old failure applies on rollback after the candidate failure notification', async () => {
    const f = fixture(), { ui } = f; await f.start(); ui.next(); ui.restart();
    const oldError = new Error('old'), candidateError = new Error('candidate');
    f.generations[0].reads[1].reject(oldError); await turn(); assert.deepEqual(f.errors, []);
    f.generations[1].reads[0].reject(candidateError); await turn();
    assert.deepEqual(f.errors, [candidateError, oldError]); assert.equal(ui.status.phase, 'error');
    ui.dispose(); await ui.closed;
});

test('an old cleanup failure rejects replacement, closes the candidate and retains the readable frame', async () => {
    const cleanup = new Error('old return');
    const f = fixture({}, generation => { if (generation === f.generations[0]) throw cleanup; return { done: true }; });
    const { ui } = f; await f.start(0); ui.restart(); await f.value(100);
    assert.equal(ui.status.phase, 'error'); assert.equal(ui.frame.current, 0); assert.equal(ui.status.preparing, null);
    assert.equal(f.generations[1].signal.aborted, true); assert.deepEqual(f.errors, [cleanup]);
    ui.dispose(); const report = await ui.closed;
    assert.equal(report.errorCount, 1); assert.equal(report.firstError.phase, 'return'); assert.equal(report.firstError.error, cleanup);
});

test('dispose during a first read releases UI now but closed waits for physical cleanup and late diagnostics', async () => {
    const returning = deferred(), f = fixture({}, () => returning.promise), { ui, env, host, viewport } = f;
    ui.start(); const generation = f.generations[0];
    ui.dispose(); ui.dispose(); const notifications = f.statuses.length;
    assert.deepEqual(host.children, [viewport]); assert.equal(env.doc.listenerCount, 0); assert.equal(env.view.listenerCount, 0);
    assert.equal(env.timers.size, 0); assert.equal(ui.status.phase, 'disposed'); assert.equal(ui.status.preparing, null);
    assert.equal(ui.status.cleanupPending, true); assert.equal(ui.status.waiting, false); assert.equal(ui.frame, null);
    assert.equal(generation.signal.reason, 'player:dispose'); await pending(ui.closed);
    generation.reads[0].reject(undefined); await turn(); assert.equal(generation.returns, 1); await pending(ui.closed);
    returning.resolve({ done: true }); const report = await ui.closed;
    assert.equal(report.sources.length, 1); assert.deepEqual(report.sources[0].lateReadError, { error: undefined });
    assert.equal(report.errorCount, 0); assert.equal(ui.status.cleanupPending, false);
    assert.equal(f.statuses.length, notifications); assert.equal(f.frames.length, 0); assert.equal(f.errors.length, 0);
    assert.throws(() => ui.next(), /disposed/);
});

test('dispose during Restart cancels both sessions and freezes the last presented frame', async () => {
    const f = fixture(), { ui } = f; await f.start(4); ui.next(); ui.restart();
    const last = ui.frame; ui.dispose(); const count = f.statuses.length;
    assert.equal(f.generations.length, 2); assert.equal(f.generations.every(gen => gen.signal.aborted), true);
    f.generations[0].reads[1].resolve({ value: 9 }); f.generations[1].reads[0].resolve({ value: 10 });
    const report = await ui.closed;
    assert.equal(report.sources.length, 2); assert.equal(ui.frame, last); assert.equal(f.statuses.length, count);
    assert.equal(f.generations.every(gen => gen.returns === 1), true);
});

test('empty preparation and source errors recover only after cleanup, without detached notification rejections', async () => {
    const notification = new Error('onError'), returning = deferred(), errors = [];
    const f = fixture({ onError(error) { errors.push(error); throw notification; } }, () => returning.promise);
    const { ui } = f; ui.start(); await f.end();
    assert.equal(ui.status.phase, 'error'); assert.ok(errors[0] instanceof RangeError); assert.equal(ui.status.canStart, true);
    ui.start(); await f.value(1); ui.next();
    const primary = new Error('active'); f.generations[1].reads[1].reject(primary); await turn();
    assert.equal(ui.status.phase, 'error'); assert.equal(ui.status.cleanupPending, true); assert.equal(errors[1], primary);
    ui.restart(); assert.equal(f.generations.length, 2);
    returning.resolve({ done: true }); await turn(); ui.restart(); await f.value(2);
    assert.equal(ui.status.phase, 'paused'); ui.dispose(); const report = await ui.closed;
    assert.equal(report.errorCount, 2); assert.equal(report.firstError.error, notification);
});

test('EOF stays staged on Pause and final holds reset when replaying retained states', async () => {
    const f = fixture({ stepDurationMs: 100, finalHoldMs: 50, rewindCapacity: 3 }), { ui, env } = f;
    await f.start(0); ui.next(); await f.value(1); ui.next(); ui.pause(); await f.end();
    assert.equal(ui.status.phase, 'paused'); assert.equal(f.generations[0].returns, 0);
    ui.play(); env.scheduler.tick(1000); assert.equal(ui.status.phase, 'playing');
    env.scheduler.tick(1025); assert.equal(ui.status.phase, 'playing'); env.scheduler.tick(1050); assert.equal(ui.status.phase, 'finished');
    ui.previous(); ui.next(); assert.equal(ui.status.phase, 'paused'); ui.next(); assert.equal(ui.status.phase, 'finished');
    await pending(ui.closed); ui.dispose(); assert.equal((await ui.closed).sources[0].kind, 'completed');
});

test('Replay autoplays only its current successful preparation; Pause cancels it without cancelling preparation', async () => {
    for (const cancel of [false, true]) {
        const f = fixture({ stepDurationMs: 100 }), { ui, host } = f; await f.start(); ui.next(); await f.end();
        control(host, 'play').emit('click'); assert.equal(ui.status.preparing, 'restart'); assert.equal(ui.status.canPause, true);
        assert.equal(control(host, 'play').attributes.get('aria-label'), 'Pause');
        if (cancel) control(host, 'play').emit('click');
        await f.value(10);
        assert.equal(ui.status.phase, cancel ? 'paused' : 'playing');
        if (!cancel) { assert.equal(f.generations[1].reads.length, 2); ui.pause(); f.generations[1].reads[1].resolve({ done: true }); await turn(); }
        ui.dispose(); await ui.closed;
    }
});

test('hidden-document pause clears pending manual presentation and Replay; reduced motion does not read ahead', async () => {
    const f = fixture({ stepDurationMs: 100 }), { ui, env } = f; await f.start(0); ui.play();
    env.doc.hidden = true; env.doc.emit('visibilitychange'); await f.value(1);
    assert.equal(ui.frame.current, 0); assert.equal(ui.status.phase, 'paused'); assert.equal(env.scheduler.size, 0);
    env.doc.hidden = false; env.doc.emit('visibilitychange'); assert.equal(ui.status.phase, 'paused');
    ui.play(); env.scheduler.tick(0); env.scheduler.tick(25);
    env.media.matches = true; env.media.emit('change');
    assert.equal(ui.frame.progress, 0.25); assert.equal(f.frames.at(-1).progress, 1); assert.equal(f.generations[0].reads.length, 2);
    env.view.emit('pagehide'); assert.equal(ui.status.phase, 'disposed'); await ui.closed;
});

test('async cached work obeys the RAF limit, carries debt once, and discards it at a real data stall', async () => {
    for (const maxStepsPerFrame of [1, 2]) {
        const f = fixture({ stepDurationMs: 10, rewindCapacity: 6, maxStepsPerFrame }), { ui, env } = f;
        await f.start(0);
        for (let value = 1; value <= 5; value++) { ui.next(); await f.value(value); }
        for (let i = 0; i < 5; i++) ui.previous();
        ui.play(); env.scheduler.tick(0); env.scheduler.tick(100);
        assert.equal(ui.frame.stepIndex, maxStepsPerFrame);
        for (let i = 0; i < 6; i++) {
            const before = ui.frame.stepIndex; env.scheduler.tick(100);
            assert.ok(ui.frame.stepIndex - before <= maxStepsPerFrame);
        }
        assert.equal(ui.frame.stepIndex, 5); assert.equal(ui.status.waiting, true); assert.equal(env.scheduler.size, 0);
        assert.equal(f.generations[0].reads.length, 7);
        await f.value(6); env.scheduler.tick(10000);
        assert.equal(ui.frame.stepIndex, 6); assert.equal(ui.frame.progress, 0);
        ui.dispose(); await ui.closed;
    }
});

test('undefined/null states stay distinct and fractional timing reaches exact endpoints', async () => {
    const f = fixture({ stepDurationMs: 0.3 }), { ui, env } = f;
    await f.start(undefined); ui.next(); await f.value(null);
    assert.equal(ui.frame.previous, undefined); assert.equal(ui.frame.current, null);
    ui.play(); await f.value({ x: 1 }); env.scheduler.tick(0); env.scheduler.tick(0.3);
    assert.equal(ui.frame.progress, 1); assert.equal(ui.frame.previous, null);
    // The frame boundary does not prefetch until more playback time is requested.
    assert.equal(f.generations[0].reads.length, 3);
    ui.dispose(); await ui.closed;
});

test('render/status errors close both source and intent; async notification failures stay in bounded diagnostics', async () => {
    for (const origin of ['render', 'status']) {
        const primary = new Error(origin), cleanup = new Error('return'), notification = new Error('onError');
        let armed = false, statusFailures = 0, notifications = 0;
        const f = fixture({
            render() { if (armed && origin === 'render') throw primary; },
            onStatus(state) { if (armed && origin === 'status' && state.stepIndex === 1) { statusFailures++; throw primary; } },
            onError(error) { notifications++; assert.equal(error, primary); throw notification; },
        }, () => { throw cleanup; });
        await f.start(0); armed = true; f.ui.next(); await f.value(1);
        assert.equal(f.ui.status.phase, 'error'); assert.equal(f.ui.frame.stepIndex, 1);
        armed = false; f.ui.dispose(); const report = await f.ui.closed;
        assert.equal(notifications, 1); assert.equal(report.errorCount, statusFailures + 2);
        assert.equal(report.firstError.error, origin === 'status' ? primary : notification);
    }
});

test('disposed callbacks cannot be followed by another queued error notification', async () => {
    let f; const notifications = [];
    f = fixture({ onError(error) { notifications.push(error); f.ui.dispose(); } });
    await f.start(); f.ui.next(); const oldError = new Error('old'); f.ui.restart();
    f.generations[0].reads[1].reject(oldError); await turn();
    f.generations[1].reads[0].reject(new Error('candidate')); await turn();
    assert.equal(f.ui.status.phase, 'disposed'); assert.equal(notifications.length, 1); await f.ui.closed;
});

test('widget closed waits for UI teardown even when teardown throws, and retains only a summary across restarts', async () => {
    const f = fixture(), { ui, env, host, viewport } = f; await f.start(0);
    const teardown = new Error('remove listener'), original = env.doc.removeEventListener.bind(env.doc);
    env.doc.removeEventListener = (name, listener) => { original(name, listener); throw teardown; };
    assert.throws(() => ui.dispose(), error => error === teardown);
    assert.deepEqual(host.children, [viewport]); assert.equal(env.doc.listenerCount, 0); assert.equal(env.view.listenerCount, 0);
    const report = await ui.closed;
    assert.ok(report.errorCount > 0); assert.equal(report.firstError.error, teardown); assert.equal(report.firstError.phase, 'dispose');
    assert.ok(Object.isFrozen(report)); assert.ok(Object.isFrozen(report.sources)); assert.ok(Object.isFrozen(report.firstError));

    const error = new Error('callback'); const context = fixture({ onError() { throw error; } });
    for (let i = 0; i < 12; i++) {
        context.ui.start(); context.generations.at(-1).reads[0].reject(new Error('factory read')); await turn();
    }
    context.ui.dispose(); const summary = await context.ui.closed;
    assert.equal(summary.sources.length, 0); assert.equal(summary.errorCount, 12); assert.equal(summary.firstError.error, error);
});
