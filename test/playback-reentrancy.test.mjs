import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlayer, createStatePlayer } from '@grundyjs/algiviz/playback';
import { createArrayPlayer, createArrayTrace } from '@grundyjs/algiviz/array';

const commands = {
    next: player => player.nextStep(), zero: player => player.advance(0),
    timed: player => player.advance(1), invalid: player => player.advance(NaN),
    dispose: player => player.dispose(),
};
function fixture(kind = 'steps', { timed = true, finalHoldMs = 25 } = {}) {
    const hooks = {}, stats = { acquisitions: 0, reads: 0, returns: 0, returnGets: 0, renders: 0, predicates: 0, maxDepth: 0 };
    const trace = createArrayTrace([3, 2, 1]);
    const array = [trace.start(), trace.swap(0, 1), trace.swap(1, 2), trace.done()];
    let player, firing = false, depth = 0;
    function fire(name) {
        if (!hooks[name] || firing) return;
        firing = true;
        try { hooks[name](player); } finally { firing = false; }
    }
    const steps = array.map((step, n) => ({
        get index() { fire('step-index'); return kind === 'array' ? step.index : 10 + n * 7; },
        get state() { fire('step-state'); return kind === 'array' ? step.state : n; },
        get event() { fire('step-event'); return kind === 'array' ? step.event : n === 3 ? 'done' : 'move'; },
    }));
    const iterator = {
        get next() {
            fire('next-get');
            return () => {
                depth++; stats.maxDepth = Math.max(stats.maxDepth, depth);
                try {
                    const n = stats.reads++; fire('next-call');
                    return {
                        get done() { fire('done-get'); return n >= steps.length; },
                        get value() { fire('value-get'); return kind === 'states' ? n : steps[n]; },
                    };
                } finally { depth--; }
            };
        },
        get return() {
            stats.returnGets++; fire('return-get');
            return () => {
                depth++; stats.maxDepth = Math.max(stats.maxDepth, depth);
                try { stats.returns++; fire('return-call'); return { done: true }; }
                finally { depth--; }
            };
        },
    };
    const source = { get [Symbol.iterator]() { fire('iterator-get'); return () => { stats.acquisitions++; fire('iterator-call'); return iterator; }; } };
    const options = {
        ...(timed ? { stepDurationMs: 100 } : {}), finalHoldMs,
        get render() { fire('render-get'); return () => { stats.renders++; fire('render'); }; },
        get isTerminal() { fire('predicate-get'); return step => { stats.predicates++; fire('predicate'); return step.event === 'done'; }; },
    };
    player = kind === 'states' ? createStatePlayer(source, options)
        : kind === 'array' ? createArrayPlayer(source, options) : createPlayer(source, options);
    return { player, hooks, stats,
        clear() { for (const key of Object.keys(hooks)) delete hooks[key]; },
        close() { this.clear(); player.dispose(); },
    };
}
function caught(player, command, stats) {
    const frame = player.frame, finished = player.finished, before = { ...stats };
    assert.throws(() => command(player), error => error.constructor === Error);
    assert.deepEqual(player.frame, frame); assert.equal(player.finished, finished); assert.deepEqual(stats, before);
}
function sequence(player) {
    const frames = [player.nextStep(), player.advance(25), player.nextStep(), player.advance(500), player.nextStep()];
    return frames.map(frame => ({ ...frame }));
}

for (const kind of ['steps', 'states', 'array']) {
    const stages = ['render', 'next-get', 'next-call', 'done-get', 'value-get',
        ...(kind === 'steps' ? ['predicate', 'predicate-get', 'render-get', 'step-index', 'step-state', 'step-event'] : [])];
    for (const stage of stages) test(`${kind}: caught commands from ${stage} preserve the outer result, timing and source counts`, () => {
        for (const command of Object.values(commands)) {
            const control = fixture(kind), subject = fixture(kind); let calls = 0;
            try {
                subject.hooks[stage] = player => { calls++; caught(player, command, subject.stats); };
                assert.deepEqual(sequence(subject.player), sequence(control.player));
                assert.ok(calls > 0, stage); assert.deepEqual(subject.stats, control.stats);
                assert.equal(subject.stats.maxDepth, 1);
            } finally { subject.close(); control.close(); }
        }
    });
}

for (const stage of ['render', 'predicate', 'next-get', 'next-call', 'done-get', 'value-get', 'step-state']) {
    test(`uncaught reentrancy from ${stage} disposes once and preserves the primary Error over cleanup`, () => {
        const f = fixture(); let primary;
        f.hooks[stage] = player => {
            try { player.nextStep(); } catch (error) { primary = error; throw error; }
            assert.fail('Nested command was accepted');
        };
        f.hooks['return-call'] = () => { throw new Error('secondary cleanup'); };
        try {
            assert.throws(() => f.player.nextStep(), error => error === primary && error.constructor === Error);
            f.clear(); assert.ok(f.player.frame); assert.equal(f.stats.returns, 1); assert.equal(f.stats.maxDepth, 1);
            assert.throws(() => f.player.advance(0), /disposed/); f.player.dispose(); assert.equal(f.stats.returns, 1);
        } finally { f.close(); }
    });
}

for (const kind of ['steps', 'states', 'array']) test(`${kind}: manual validation stays nonfatal while callback reentrancy takes precedence`, () => {
    const f = fixture(kind, { timed: false });
    try {
        const before = f.player.frame;
        assert.throws(() => f.player.advance(NaN), RangeError); assert.throws(() => f.player.advance(1), /stepDurationMs/);
        assert.deepEqual(f.player.frame, before); assert.equal(f.stats.reads, 1); assert.equal(f.stats.returns, 0);
        f.hooks.render = player => { caught(player, commands.timed, f.stats); caught(player, commands.invalid, f.stats); };
        assert.equal(f.player.nextStep().progress, 1); assert.equal(f.stats.reads, 2);
    } finally { f.close(); }
});

for (const kind of ['steps', 'states', 'array']) for (const stage of ['return-get', 'return-call']) {
    test(`${kind}: explicit dispose is already terminal in ${stage} and repeated dispose is harmless`, () => {
        const f = fixture(kind); let calls = 0;
        f.hooks[stage] = player => {
            calls++; const frame = player.frame;
            player.dispose(); player.dispose();
            assert.throws(() => player.nextStep(), error => error.constructor === Error);
            assert.throws(() => player.advance(NaN), error => error.constructor === Error);
            assert.deepEqual(player.frame, frame);
        };
        f.player.dispose(); f.player.dispose();
        assert.equal(calls, 1); assert.equal(f.stats.returnGets, 1); assert.equal(f.stats.returns, 1); assert.equal(f.stats.maxDepth, 1);
    });
}

for (const stage of ['return-get', 'return-call']) test(`uncaught advance from explicit disposal ${stage} propagates once without retrying cleanup`, () => {
    const f = fixture(); let primary;
    f.hooks[stage] = player => {
        player.dispose();
        try { player.advance(0); } catch (error) { primary = error; throw error; }
    };
    assert.throws(() => f.player.dispose(), error => error === primary && error.constructor === Error);
    f.player.dispose(); assert.equal(f.stats.returnGets, 1); assert.equal(f.stats.returns, stage === 'return-get' ? 0 : 1);
    f.clear(); assert.ok(f.player.frame); assert.throws(() => f.player.nextStep(), /disposed/);
});

for (const kind of ['steps', 'states', 'array']) for (const value of [undefined, new Error('primary')]) {
    test(`${kind}: failure latches disposal before source cleanup and preserves ${String(value)}`, () => {
        const f = fixture(kind); let cleaned = false;
        f.hooks['next-call'] = () => { throw value; };
        f.hooks['return-call'] = player => {
            cleaned = true; player.dispose(); player.dispose();
            assert.throws(() => player.nextStep(), error => error.constructor === Error);
            throw new Error('secondary return failure');
        };
        try {
            assert.throws(() => f.player.nextStep(), error => error === value);
            assert.equal(cleaned, true); assert.equal(f.stats.maxDepth, 1); assert.equal(f.stats.returns, 1);
            f.clear(); f.player.dispose(); assert.equal(f.stats.returns, 1); assert.ok(f.player.frame);
        } finally { f.close(); }
    });
}

for (const kind of ['steps', 'array']) for (const uncaught of [false, true]) {
    test(`${kind}: normal terminal return ${uncaught ? 'fails on' : 'can catch'} an initial nested dispose`, () => {
        const f = fixture(kind); let primary;
        try {
            f.player.nextStep(); f.player.nextStep();
            f.hooks['return-call'] = player => {
                assert.equal(player.finished, false);
                if (!uncaught) { caught(player, commands.dispose, f.stats); caught(player, commands.next, f.stats); return; }
                try { player.dispose(); } catch (error) { primary = error; throw error; }
            };
            if (uncaught) {
                assert.throws(() => f.player.nextStep(), error => error === primary && error.constructor === Error);
                assert.throws(() => f.player.nextStep(), /disposed/);
            } else {
                assert.equal(f.player.nextStep().progress, 1); assert.equal(f.player.finished, false);
                f.player.nextStep(); assert.equal(f.player.finished, true); f.player.advance(0);
            }
            assert.equal(f.stats.returns, 1); assert.equal(f.stats.maxDepth, 1);
        } finally { f.close(); }
    });
}

test('plain natural EOF releases the source without introducing return and finished redraw is still protected', () => {
    const f = fixture('states', { finalHoldMs: 0 });
    try {
        for (let n = 0; n < 4; n++) f.player.nextStep();
        assert.equal(f.player.finished, true); assert.equal(f.stats.returns, 0);
        f.hooks.render = player => { caught(player, commands.zero, f.stats); caught(player, commands.dispose, f.stats); };
        f.player.nextStep(); f.player.advance(0); assert.equal(f.stats.reads, 5); assert.equal(f.stats.returns, 0);
    } finally { f.close(); }
});

for (const uncaught of [false, true]) test(`idle frame getter ${uncaught ? 'propagates a rejection without disposal' : 'permits nested reads but rejects mutation'}`, () => {
    const f = fixture(); let calls = 0, primary;
    f.hooks['step-state'] = player => {
        calls++; assert.ok(player.frame); assert.equal(player.finished, false);
        if (!uncaught) { for (const command of Object.values(commands)) caught(player, command, f.stats); return; }
        try { player.nextStep(); } catch (error) { primary = error; throw error; }
    };
    try {
        if (uncaught) assert.throws(() => f.player.frame, error => error === primary && error.constructor === Error);
        else assert.ok(f.player.frame);
        assert.ok(calls > 0); assert.equal(f.stats.returns, 0); assert.equal(f.stats.reads, 1);
        f.clear(); f.player.nextStep(); assert.equal(f.stats.reads, 2);
    } finally { f.close(); }
});

for (const catchInA of [false, true]) test(`A to B to A uses per-instance protection, with the error ${catchInA ? 'caught in A' : 'uncaught'}`, () => {
    const a = fixture(), b = fixture(); let primary;
    a.hooks.render = () => {
        try { b.player.nextStep(); } catch (error) { if (!catchInA) throw error; }
    };
    b.hooks.render = () => {
        assert.ok(a.player.frame);
        try { a.player.nextStep(); } catch (error) { primary = error; throw error; }
    };
    try {
        if (catchInA) { a.player.nextStep(); assert.equal(a.stats.returns, 0); a.clear(); a.player.nextStep(); }
        else { assert.throws(() => a.player.nextStep(), error => error === primary); assert.equal(a.stats.returns, 1); }
        assert.equal(b.stats.returns, 1); assert.equal(a.stats.maxDepth, 1); assert.equal(b.stats.maxDepth, 1);
    } finally { a.close(); b.close(); }
});
test('A can advance idle B, and B may catch an attempt to mutate busy A', () => {
    const a = fixture(), b = fixture();
    a.hooks.render = () => b.player.nextStep();
    b.hooks.render = () => caught(a.player, commands.dispose, a.stats);
    try { a.player.nextStep(); assert.equal(a.stats.reads, 2); assert.equal(b.stats.reads, 2); assert.equal(a.stats.returns, 0); assert.equal(b.stats.returns, 0); }
    finally { a.close(); b.close(); }
});

for (const fail of [false, true]) test(`callback-scheduled work runs after ${fail ? 'failure and sees disposal' : 'return as an independent command'}`, async () => {
    const f = fixture(); const primary = new Error('render failed'); let scheduled;
    f.hooks.render = player => {
        if (!scheduled) scheduled = Promise.resolve().then(() => player.nextStep());
        if (fail) throw primary;
    };
    try {
        if (fail) {
            assert.throws(() => f.player.nextStep(), error => error === primary);
            f.clear(); await assert.rejects(scheduled, /disposed/); assert.equal(f.stats.reads, 2); assert.equal(f.stats.returns, 1);
        } else {
            f.player.nextStep(); assert.equal(f.stats.reads, 2); f.clear(); await scheduled;
            assert.equal(f.stats.reads, 3); assert.equal(f.player.frame.current, 2);
        }
    } finally { f.close(); }
});

test('source acquisition during construction can control an older idle player without an early new handle', () => {
    const older = fixture(); let player, acquisitions = 0, renders = 0;
    try {
        player = createStatePlayer({ [Symbol.iterator]() {
            acquisitions++; assert.equal(player, undefined); older.player.nextStep();
            return [0, 1][Symbol.iterator]();
        } }, { render() { renders++; assert.equal(player, undefined); } });
        assert.equal(acquisitions, 1); assert.equal(renders, 1); assert.equal(older.stats.reads, 2);
    } finally { player?.dispose(); older.close(); }
});

test('generator finally observes explicit disposal before it runs', () => {
    let player, closes = 0;
    player = createStatePlayer((function* () {
        try { yield 0; yield 1; }
        finally { closes++; player.dispose(); assert.throws(() => player.nextStep(), error => error.constructor === Error); }
    })());
    player.dispose(); player.dispose(); assert.equal(closes, 1); assert.equal(player.frame.current, 0);
});

test('construction of B inside A keeps A protected through iterator acquisition and initial rendering', () => {
    const a = fixture(), children = []; let acquisitions = 0, renders = 0;
    a.hooks.render = () => {
        for (const command of Object.values(commands)) {
            let child;
            child = createStatePlayer({ get [Symbol.iterator]() {
                caught(a.player, command, a.stats);
                return () => { acquisitions++; caught(a.player, command, a.stats); return [0, 1][Symbol.iterator](); };
            } }, { render() { renders++; caught(a.player, command, a.stats); } });
            children.push(child);
        }
    };
    try {
        a.player.nextStep(); assert.equal(acquisitions, 5); assert.equal(renders, 5); assert.equal(a.stats.reads, 2);
        a.clear();
        // Later child renders occur after A's protection ends.
        for (const child of children) child.dispose();
        a.player.nextStep(); assert.equal(a.stats.reads, 3);
    } finally { for (const child of children) child.dispose(); a.close(); }
});

test('native generator body catches rejected commands without another generator entry', () => {
    let player, closes = 0, resumed = 0;
    player = createStatePlayer((function* () {
        try {
            yield 0;
            resumed++;
            for (const command of Object.values(commands)) assert.throws(() => command(player), error => error.constructor === Error);
            yield 1;
        } finally { closes++; }
    })());
    try { assert.equal(player.nextStep().current, 1); assert.equal(resumed, 1); assert.equal(closes, 0); }
    finally { player.dispose(); }
    assert.equal(closes, 1);
});
