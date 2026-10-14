import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStepEmitter, createPlayer, createTimeline } from '@grundyjs/algiviz/playback';

test('step emitter preserves custom values and numbers only successful captures', () => {
    const original = new Map([['value', 1]]);
    let fails = true;
    const emit = createStepEmitter(() => {
        if (fails) throw new Error('capture failed');
        return original;
    });
    assert.throws(() => emit('update'), /capture failed/);
    fails = false;
    const event = { kind: 'update' }, first = emit(event), second = emit(null);
    assert.equal(first.index, 0); assert.equal(second.index, 1);
    assert.ok(Object.isFrozen(first));
    assert.equal(first.state, original); assert.equal(first.event, event);
    assert.equal(Object.isFrozen(event), false);
    assert.equal(createStepEmitter(() => 42)('start').index, 0);
});
test('snapshot callback isolates mutable workspace; separate iterators agree with history', () => {
    function* source() {
        const values = [];
        const emit = createStepEmitter(() => Object.freeze([...values]));
        yield emit('start');
        values.push(1); yield emit('append');
        values.push(2); yield emit('done');
    }
    const steps = [...source()];
    assert.deepEqual(steps.map(s=>s.state), [[],[1],[1,2]]);
    const timing = { stepDurationMs: 10, finalHoldMs: 5 };
    const history = createTimeline(steps, timing);
    const player = createPlayer(source(), { ...timing, isTerminal: s=>s.event==='done' });
    for(let time=0;time<=history.durationMs;time++)
        assert.deepEqual(time ? player.advance(1) : player.frame, history.sample(time));
    player.dispose();
});
