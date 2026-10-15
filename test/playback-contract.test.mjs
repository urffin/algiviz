import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlayer, createTimeline } from '@grundyjs/algiviz/playback';
const timing = { stepDurationMs: 100, finalHoldMs: 25 };
const steps = [10, 25, 90].map((index, state) => ({ index, state, event: state === 2 ? 'done' : 'move' }));

test('generic timeline preserves source indices and matches player at boundaries and hold', () => {
    const timeline = createTimeline(steps, timing);
    const player = createPlayer(steps, { ...timing, isTerminal: s => s.event === 'done' });
    let previous = 0;
    for (const time of [0, 1, 50, 100, 101, 199, 200, 224, 225, 300]) {
        assert.deepEqual(player.advance(time - previous), timeline.sample(time));
        previous = time;
    }
    assert.equal(timeline.durationMs, 225);
    assert.equal(timeline.sample(-1).stepIndex, 10);
    assert.equal(timeline.sample(50).stepIndex, 25);
    assert.equal(timeline.sample(300).stepIndex, 90);
    assert.equal(timeline.sample(0).stepIndex, 10); // Seeking backward is independent.
});

for (const phase of ['construction', 'advance']) for (const origin of ['source', 'predicate', 'render']) {
    test(`preserves ${origin} error during ${phase} when cleanup also throws`, () => {
        const primary = new Error('primary');
        const cleanup = new Error('cleanup');
        let fail = phase === 'construction', returned = 0, next = 0;
        const source = {
            [Symbol.iterator]() { return this; },
            next() {
                if (fail && origin === 'source') throw primary;
                return { done: false, value: steps[next++ % steps.length] };
            },
            return() { returned++; throw cleanup; },
        };
        const options = { ...timing,
            isTerminal() { if (fail && origin === 'predicate') throw primary; return false; },
            render() { if (fail && origin === 'render') throw primary; },
        };
        if (fail) assert.throws(() => createPlayer(source, options), e => e === primary);
        else {
            const player = createPlayer(source, options);
            fail = true;
            assert.throws(() => player.advance(1), e => e === primary);
            assert.throws(() => player.advance(1), /disposed/);
            assert.doesNotThrow(() => player.dispose());
            assert.ok(player.frame);
        }
        assert.equal(returned, 1);
    });
}

for (const phase of ['construction', 'advance', 'dispose']) {
    test(`surfaces standalone cleanup failure during ${phase} exactly once`, () => {
        const cleanup = new Error('cleanup');
        let returned = 0, next = 0;
        const source = {
            [Symbol.iterator]() { return this; },
            next() { return { done: false, value: { index: next++, state: 0, event: 'move' } }; },
            return() { returned++; throw cleanup; },
        };
        const options = { ...timing, isTerminal: s => phase === 'construction' || (phase === 'advance' && s.index === 1) };
        if (phase === 'construction') assert.throws(() => createPlayer(source, options), e => e === cleanup);
        else {
            const player = createPlayer(source, options);
            assert.throws(() => phase === 'dispose' ? player.dispose() : player.advance(100), e => e === cleanup);
            assert.throws(() => player.advance(1), /disposed/);
            assert.doesNotThrow(() => player.dispose());
        }
        assert.equal(returned, 1);
    });
}
