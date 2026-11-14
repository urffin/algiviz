import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Player } from '@grundyjs/algiviz/player';
import { createWorkerSourceFactory, WorkerSourceError } from '@grundyjs/algiviz/worker';
import { dom, control, shell, waitingLabel } from './player-test-dom.mjs';
import { deferred, transport, turn, fakeClock } from './worker-test-transport.mjs';

function fixture(options = {}) {
    const env = dom(), host = env.container(), viewport = env.doc.createElement('canvas'); host.append(viewport);
    const generations = [], sessions = [], frames = [], statuses = [], errors = [];
    let maximumOwned = 0;
    const factory = createWorkerSourceFactory({
        worker() {
            const generation = { id: generations.length, reads: [], cleanup: deferred(), returns: 0, report: null };
            const configuration = options.configure?.(generation.id) ?? {};
            generation.link = transport((_input, signal) => {
                generation.signal = signal;
                return { [Symbol.asyncIterator]: () => ({
                    next() { const gate = deferred(); generation.reads.push(gate); return gate.promise; },
                    return() {
                        generation.returns++;
                        if (configuration.cleanupError) throw new Error('Worker cleanup failed');
                        return generation.cleanup.promise;
                    },
                }) };
            }, { transfer: state => [state.buffer] });
            generations.push(generation);
            maximumOwned = Math.max(maximumOwned, generations.filter(g => !g.link.dead).length);
            return generation.link.worker;
        },
        input: () => ({ generation: generations.length - 1 }), shutdown: { gracePeriodMs: options.grace ?? 10000 },
    });
    const ui = new Player(host, { viewport, asyncSource(signal) {
        const index = generations.length;
        const session = factory(signal); sessions.push(session);
        void session.closed.then(report => { generations[index].report = report; });
        return session;
    }, render(frame) { frames.push(frame); }, onStatus: state => statuses.push(state), onError: error => errors.push(error),
        rewindCapacity: 3, ...options.player });
    const value = async (generation, index, read = generation.reads.at(-1)) => {
        read.resolve({ done: false, value: { generation: generation.id, index, buffer: new Uint8Array([generation.id, index]).buffer } });
        await turn();
    };
    return { ui, env, host, viewport, generations, sessions, frames, statuses, errors,
        get maximumOwned() { return maximumOwned; }, value,
        async start() { ui.start(); await turn(); await value(generations[0], 0); },
        async release(generation) { generation.cleanup.resolve({ done: true }); await turn(); },
        async close() {
            ui.dispose();
            for (let i = 0; i < 3; i++) {
                await turn();
                for (const generation of generations) {
                    for (const gate of generation.reads) gate.resolve({ done: true });
                    generation.cleanup.resolve({ done: true });
                }
            }
            return ui.closed;
        },
    };
}

test('Worker factory mounts through asyncSource lazily and Start coalesces until the transferred first frame', async () => {
    const f = fixture(), { ui, host } = f;
    try {
        assert.equal(f.generations.length, 0); assert.equal(ui.frame, null);
        const status = ui.start(); ui.start(); ui.restart(); ui.next();
        assert.equal(status.preparing, 'start'); assert.equal(status.waiting, true); assert.equal(f.generations.length, 1);
        assert.equal(control(host, 'start').disabled, true); assert.equal(waitingLabel(host).textContent, 'Preparing playback');
        assert.equal(shell(host).children.find(child => child.dataset.role === 'viewport').attributes.get('aria-busy'), 'true');
        await turn(); assert.equal(f.generations[0].reads.length, 1);
        await f.value(f.generations[0], 0);
        assert.equal(ui.status.phase, 'paused'); assert.equal(ui.frame.stepIndex, 0); assert.equal(ui.frame.progress, 1);
        assert.deepEqual([...new Uint8Array(ui.frame.current.buffer)], [0, 0]); assert.equal(f.frames.length, 1);
        assert.equal(f.generations[0].link.sent.filter(p => p.type === 'pull').length, 1);
    } finally { await f.close(); }
});

test('Worker Next coalesces; manual Pause stages arrival without cancelling or rendering, then Next consumes it', async () => {
    const f = fixture(), { ui, host } = f;
    try {
        await f.start(); const first = ui.frame.current;
        ui.next(); ui.next(); ui.next(); await turn();
        const old = f.generations[0]; assert.equal(old.reads.length, 2); assert.equal(ui.status.canPause, true);
        const pause = control(host, 'play'); assert.equal(pause.hidden, false); assert.equal(pause.attributes.get('aria-label'), 'Pause');
        pause.emit('click'); const renders = f.frames.length;
        await f.value(old, 1);
        assert.equal(ui.frame.current, first); assert.equal(f.frames.length, renders); assert.equal(old.signal.aborted, false);
        assert.equal(ui.status.waiting, false); assert.equal(ui.status.canPause, false);
        ui.next(); assert.equal(ui.frame.current.index, 1); assert.equal(old.reads.length, 2);
        assert.equal(ui.frame.progress, 1); assert.equal(ui.status.mode, 'stream'); assert.equal(ui.status.canSeek, false);
        ui.dispose(); await f.release(old); await ui.closed;
        assert.equal(first.buffer.byteLength, 2); assert.equal(ui.frame.current.buffer.byteLength, 2);
    } finally { await f.close(); }
});

test('Worker stalls suspend RAF and clock debt; arrival begins at zero progress and Pause/Next preserve one request', async () => {
    const f = fixture({ player: { stepDurationMs: 100, maxStepsPerFrame: 1 } }), { ui, env } = f;
    try {
        await f.start(); ui.play(); await turn();
        assert.equal(ui.status.phase, 'playing'); assert.equal(ui.status.waiting, true); assert.equal(env.scheduler.size, 0);
        env.scheduler.tick(900000); await f.value(f.generations[0], 1);
        assert.equal(env.scheduler.size, 1); env.scheduler.tick(900100);
        assert.equal(ui.frame.current.index, 1); assert.equal(ui.frame.progress, 0);
        env.scheduler.tick(900125); assert.equal(ui.frame.progress, 0.25);
        ui.pause(); ui.next(); assert.equal(ui.frame.progress, 1); assert.equal(f.generations[0].reads.length, 2);
        ui.next(); await turn(); assert.equal(f.generations[0].reads.length, 3); assert.equal(ui.status.canPause, true);
        ui.play(); ui.pause(); await f.value(f.generations[0], 2);
        assert.equal(ui.frame.current.index, 1); ui.next(); assert.equal(ui.frame.current.index, 2);
        assert.equal(f.generations[0].reads.length, 3);
    } finally { await f.close(); }
});

test('Worker Restart prepares one candidate, waits old read/return, then installs paused with at most two Workers', async () => {
    const f = fixture(), { ui } = f;
    try {
        await f.start(); ui.next(); await turn(); const old = f.generations[0]; const frame = ui.frame;
        ui.restart(); ui.restart(); await turn(); const candidate = f.generations[1];
        assert.equal(f.generations.length, 2); assert.equal(old.signal.aborted, false); assert.equal(ui.frame, frame);
        await f.value(candidate, 10);
        assert.equal(old.signal.aborted, true); assert.equal(old.signal.reason.kind, 'restart');
        assert.equal(ui.status.preparing, 'restart'); assert.equal(ui.status.cleanupPending, true); assert.equal(old.returns, 0);
        assert.equal(ui.frame, frame); assert.equal(candidate.reads.length, 1); ui.restart(); assert.equal(f.generations.length, 2);
        old.reads[1].reject(new Error('late old read')); await turn(); assert.equal(old.returns, 1);
        await f.release(old);
        assert.equal(ui.frame.current.generation, 1); assert.equal(ui.frame.current.index, 10); assert.equal(ui.frame.stepIndex, 0);
        assert.equal(ui.status.phase, 'paused'); assert.equal(ui.status.preparing, null); assert.equal(old.link.terminations, 1);
        assert.equal(old.report.lateReadError.error.remote.message, 'late old read'); assert.deepEqual(f.errors, []); assert.equal(f.maximumOwned, 2);
    } finally { await f.close(); }
});

test('failed Worker candidate rolls back after its cleanup, preserving an old ready value and source ownership', async () => {
    const f = fixture(), { ui } = f;
    try {
        await f.start(); ui.next(); await turn(); const old = f.generations[0];
        ui.restart(); await turn(); const candidate = f.generations[1];
        candidate.reads[0].reject(new Error('candidate failed')); await turn();
        assert.equal(ui.status.hasError, true); assert.equal(ui.status.preparing, 'restart'); assert.equal(f.errors.length, 1);
        assert.ok(f.errors[0] instanceof WorkerSourceError); assert.equal(old.signal.aborted, false);
        await f.value(old, 1); assert.equal(ui.frame.current.index, 0);
        await f.release(candidate);
        assert.equal(ui.status.preparing, null); assert.equal(ui.status.phase, 'paused'); assert.equal(ui.status.canNext, true);
        ui.next(); assert.equal(ui.frame.current.index, 1); assert.equal(old.reads.length, 2);
        assert.equal(candidate.link.terminations, 1); assert.equal(old.link.terminations, 0); assert.equal(f.maximumOwned, 2);
    } finally { await f.close(); }
});

test('actual old Worker cleanup failure aborts replacement and releases candidate while retaining readable buffers', async () => {
    const f = fixture({ configure: id => ({ cleanupError: id === 0 }) }), { ui } = f;
    try {
        await f.start(); const first = ui.frame.current;
        ui.restart(); await turn(); const candidate = f.generations[1]; await f.value(candidate, 100);
        assert.equal(ui.status.phase, 'error'); assert.equal(f.errors.length, 1); assert.equal(f.errors[0].code, 'cleanup');
        assert.equal(ui.frame.current, first); assert.equal(first.buffer.byteLength, 2); assert.equal(ui.status.canPlay, false);
        await f.release(candidate); assert.equal(ui.status.preparing, null); assert.equal(ui.status.cleanupPending, false);
        assert.deepEqual(f.generations.map(g => g.link.terminations), [1, 1]);
    } finally { await f.close(); }
});

test('forced old Worker shutdown allows Restart and is observable without fabricating a cleanup error', async () => {
    const clock = fakeClock(), f = fixture({ grace: 10 }), { ui } = f;
    try {
        await f.start(); ui.next(); await turn(); const old = f.generations[0];
        ui.restart(); await turn(); await f.value(f.generations[1], 50);
        assert.equal(ui.status.cleanupPending, true); assert.equal(ui.frame.current.generation, 0);
        clock.advance(10); await turn();
        assert.equal(old.report.termination.kind, 'forced'); assert.equal(old.report.cleanup.count, 0);
        assert.equal(ui.frame.current.generation, 1); assert.equal(ui.status.phase, 'paused'); assert.deepEqual(f.errors, []);
        ui.dispose(); clock.advance(10); await ui.closed; assert.equal(clock.count, 0);
    } finally { await f.close(); clock.restore(); }
});

test('dispose during initial Worker wait removes UI immediately but closed waits cleanup with no late UI callbacks', async () => {
    const f = fixture(), { ui, host, viewport } = f;
    try {
        ui.start(); await turn(); const generation = f.generations[0]; const closed = ui.closed;
        ui.dispose(); const frames = f.frames.length, statuses = f.statuses.length, errors = f.errors.length;
        assert.equal(viewport.parentNode, host); assert.equal(shell(host), undefined); assert.equal(ui.status.phase, 'disposed');
        assert.equal(ui.status.cleanupPending, true); let finished = false; closed.then(() => { finished = true; });
        await f.value(generation, 99); assert.equal(generation.returns, 1); assert.equal(finished, false);
        await f.release(generation); const report = await closed;
        assert.equal(report.sources.length, 1); assert.equal(report.sources[0].reason, 'player:dispose');
        assert.equal(generation.report.termination.kind, 'acknowledged'); assert.equal(ui.status.cleanupPending, false);
        assert.deepEqual([f.frames.length, f.statuses.length, f.errors.length], [frames, statuses, errors]);
        assert.equal(ui.closed, closed); ui.dispose(); assert.equal(generation.link.terminations, 1);
    } finally { await f.close(); }
});

test('dispose during Worker candidate preparation closes both sources and never installs a late candidate', async () => {
    const f = fixture(), { ui } = f;
    try {
        await f.start(); ui.next(); await turn(); ui.restart(); await turn();
        const first = ui.frame.current; ui.dispose(); const count = [f.frames.length, f.statuses.length, f.errors.length];
        for (const generation of f.generations) await f.value(generation, 99);
        assert.equal(ui.frame.current, first);
        for (const generation of f.generations) await f.release(generation);
        const report = await ui.closed;
        assert.equal(report.sources.length, 2); assert.equal(report.errorCount, 0); assert.equal(f.maximumOwned, 2);
        assert.deepEqual(f.generations.map(g => g.link.terminations), [1, 1]);
        assert.deepEqual([f.frames.length, f.statuses.length, f.errors.length], count);
    } finally { await f.close(); }
});

test('paused Worker operational error is reported once and preserves its last transferred frame', async () => {
    const f = fixture(), { ui } = f;
    try {
        await f.start(); ui.next(); ui.pause(); await turn(); const current = ui.frame.current;
        f.generations[0].reads[1].reject(undefined); await turn();
        assert.equal(ui.status.phase, 'error'); assert.equal(ui.frame.current, current); assert.equal(current.buffer.byteLength, 2);
        assert.equal(f.errors.length, 1); assert.equal(f.errors[0].remote.thrownKind, 'undefined');
        await f.release(f.generations[0]); assert.equal(ui.status.cleanupPending, false); assert.equal(f.errors.length, 1);
    } finally { await f.close(); }
});

test('Worker EOF stays staged on Pause, terminates once, and Restart creates a fresh session after completion', async () => {
    const f = fixture(), { ui } = f;
    try {
        await f.start(); ui.next(); ui.pause(); await turn(); const old = f.generations[0];
        old.reads[1].resolve({ done: true, value: 'ignored' }); await turn();
        assert.equal(ui.status.phase, 'paused'); assert.equal(ui.status.waiting, false); assert.equal(ui.frame.stepIndex, 0);
        assert.equal(old.link.terminations, 1); ui.next(); assert.equal(ui.status.phase, 'finished');
        ui.restart(); await turn(); await f.value(f.generations[1], 0);
        assert.equal(ui.frame.current.generation, 1); assert.equal(ui.status.phase, 'paused'); assert.equal(old.link.terminations, 1);
    } finally { await f.close(); }
});
