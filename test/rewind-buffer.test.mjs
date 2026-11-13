import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRewindBuffer } from '@grundyjs/algiviz/playback';
import { createSceneRenderer } from '@grundyjs/algiviz/scene';

function tracked(input, { failAt = Infinity, error = new Error('source'), cleanupError } = {}) {
    let index = 0, reads = 0, returns = 0, acquisitions = 0;
    const iterator = {
        next() {
            assert.equal(this, iterator); reads++;
            if (reads === failAt) throw error;
            return index < input.length ? { done: false, value: input[index++] } : { done: true, value: 'ignored' };
        },
        return() { assert.equal(this, iterator); returns++; if (cleanupError) throw cleanupError; return { done: true }; }
    };
    return { source: { [Symbol.iterator]() { acquisitions++; return iterator; } },
        get reads() { return reads; }, get returns() { return returns; }, get acquisitions() { return acquisitions; } };
}

test('reads once on construction, replays without touching the source and evicts only at the live edge', () => {
    const objects = Array.from({ length: 8 }, (_, i) => Object.freeze({ index: 10 + i * 7 }));
    const source = tracked(objects), buffer = createRewindBuffer(source.source, { capacity: 3 });
    assert.ok(Object.isFrozen(buffer)); assert.equal(source.acquisitions, 1); assert.equal(source.reads, 1);
    assert.equal(buffer.current, objects[0]); assert.equal(buffer.previous(), objects[0]);
    assert.equal(buffer.canPrevious, false); assert.equal(buffer.canNext, true);
    for (let i = 1; i < objects.length; i++) {
        assert.equal(buffer.next(), objects[i]);
        assert.equal(buffer.position, i); assert.equal(buffer.endPosition, i);
        assert.equal(buffer.startPosition, Math.max(0, i - 2));
        for (let back = i - 1; back >= buffer.startPosition; back--) assert.equal(buffer.previous(), objects[back]);
        assert.equal(buffer.previous(), objects[buffer.startPosition]);
        for (let forward = buffer.startPosition + 1; forward <= i; forward++) assert.equal(buffer.next(), objects[forward]);
        assert.equal(source.reads, i + 1);
    }
    assert.equal(buffer.sourceEnded, false); // No hidden lookahead.
    assert.equal(buffer.next(), objects[7]); assert.equal(source.reads, 9);
    assert.equal(buffer.sourceEnded, true); assert.equal(buffer.canNext, false);
    assert.equal(buffer.previous(), objects[6]); assert.equal(buffer.canNext, true);
    assert.equal(buffer.sourceEnded, true); assert.equal(buffer.next(), objects[7]);
    assert.equal(buffer.next(), objects[7]); assert.equal(source.reads, 9);
    buffer.dispose(); buffer.dispose(); assert.equal(source.returns, 0); // Already exhausted naturally.
});

test('bounded navigation agrees with a full-history reference for all short action sequences', () => {
    for (let capacity = 1; capacity <= 4; capacity++) for (let length = 1; length <= 5; length++) {
        const input = Array.from({ length }, (_, i) => Object.freeze({ value: i }));
        for (let code = 0; code < 256; code++) {
            const source = tracked(input), buffer = createRewindBuffer(source.source, { capacity });
            let position = 0, end = 0, start = 0, sourceEnded = false, reads = 1;
            for (let bit = 0; bit < 8; bit++) {
                const forward = (code >> bit) & 1;
                if (forward) {
                    if (position < end) position++;
                    else if (!sourceEnded) {
                        reads++;
                        if (end + 1 < length) { position = ++end; start = Math.max(0, end - capacity + 1); }
                        else sourceEnded = true;
                    }
                } else position = Math.max(start, position - 1);
                assert.equal(forward ? buffer.next() : buffer.previous(), input[position]);
                assert.deepEqual([buffer.position, buffer.startPosition, buffer.endPosition, buffer.sourceEnded,
                    buffer.canPrevious, buffer.canNext], [position, start, end, sourceEnded, position > start, position < end || !sourceEnded]);
                assert.equal(source.reads, reads);
            }
            buffer.dispose(); assert.equal(source.returns, sourceEnded ? 0 : 1);
        }
    }
});

test('a long infinite source wraps the ring and only runs once for each newly requested value', () => {
    let produced = 0, closed = 0;
    function* source() { try { while (true) yield Object.freeze({ value: produced++ }); } finally { closed++; } }
    const buffer = createRewindBuffer(source(), { capacity: 7 });
    for (let i = 1; i <= 1000; i++) {
        assert.equal(buffer.next().value, i);
        if (i % 11 === 0) {
            const first = Math.max(0, i - 6);
            for (let j = i - 1; j >= first; j--) assert.equal(buffer.previous().value, j);
            for (let j = first + 1; j <= i; j++) assert.equal(buffer.next().value, j);
        }
    }
    assert.equal(produced, 1001); assert.equal(buffer.startPosition, 994);
    buffer.dispose(); assert.equal(closed, 1);
});

test('capacity is validated before source acquisition; values include undefined and are never frozen or cloned', () => {
    const source = tracked([1]);
    for (const capacity of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, undefined, null, '3'])
        assert.throws(() => createRewindBuffer(source.source, { capacity }), RangeError);
    assert.equal(source.acquisitions, 0);
    const object = { count: 1 }, token = Symbol('value'), callable = () => {};
    const input = [undefined, null, object, NaN, token, callable];
    const buffer = createRewindBuffer(input, { capacity: input.length });
    for (const value of input.slice(1)) assert.equal(buffer.next(), value);
    for (let i = input.length - 2; i >= 0; i--) assert.equal(buffer.previous(), input[i]);
    assert.equal(Object.isFrozen(object), false);
    buffer.dispose();
});

test('dispose while rewound closes the source once, releases the window and preserves current', () => {
    const source = tracked([0, 1, 2, 3]), buffer = createRewindBuffer(source.source, { capacity: 3 });
    buffer.next(); buffer.next(); buffer.previous();
    buffer.dispose(); buffer.dispose();
    assert.equal(source.returns, 1); assert.equal(source.reads, 3); assert.equal(buffer.current, 1);
    assert.deepEqual([buffer.position, buffer.startPosition, buffer.endPosition], [1, 1, 1]);
    assert.equal(buffer.canNext, false); assert.equal(buffer.canPrevious, false); assert.equal(buffer.sourceEnded, false);
    assert.throws(() => buffer.next(), /disposed/); assert.throws(() => buffer.previous(), /disposed/);
});

test('empty and failing construction preserve primary errors when cleanup also fails', () => {
    const error = new Error('source failed'), cleanupError = new Error('cleanup failed');
    const empty = tracked([], { cleanupError });
    assert.throws(() => createRewindBuffer(empty.source, { capacity: 2 }), RangeError);
    assert.equal(empty.returns, 1);
    const failed = tracked([1], { failAt: 1, error, cleanupError });
    assert.throws(() => createRewindBuffer(failed.source, { capacity: 2 }), e => e === error);
    assert.equal(failed.returns, 1);
});

test('read failure preserves current, closes once and disables further navigation', () => {
    const error = new Error('read failed');
    const source = tracked([0, 1, 2], { failAt: 3, error, cleanupError: new Error('cleanup') });
    const buffer = createRewindBuffer(source.source, { capacity: 3 }); buffer.next();
    assert.throws(() => buffer.next(), e => e === error);
    assert.equal(source.returns, 1); assert.equal(buffer.current, 1);
    assert.equal(buffer.canPrevious, false); assert.equal(buffer.canNext, false);
    assert.throws(() => buffer.previous(), /disposed/);
    buffer.dispose(); assert.equal(source.returns, 1);
});

test('a throwing iterator-result value getter cannot commit a partial new position', () => {
    const error = new Error('value'), source = tracked([1, 2]);
    const iterator = source.source[Symbol.iterator]();
    const next = iterator.next;
    let reads = 0;
    iterator.next = function () { return ++reads === 2 ? { done: false, get value() { throw error; } } : next.call(this); };
    const buffer = createRewindBuffer({ [Symbol.iterator]: () => iterator }, { capacity: 2 });
    assert.throws(() => buffer.next(), e => e === error);
    assert.equal(buffer.position, 0); assert.equal(buffer.current, 1); assert.equal(source.returns, 1);
});

test('standalone cleanup errors propagate once after the handle is already disposed', () => {
    const error = new Error('cleanup'), source = tracked([1, 2], { cleanupError: error });
    const buffer = createRewindBuffer(source.source, { capacity: 2 });
    assert.throws(() => buffer.dispose(), e => e === error);
    assert.equal(buffer.current, 1); assert.equal(buffer.canNext, false);
    assert.doesNotThrow(() => buffer.dispose()); assert.equal(source.returns, 1);
});

test('source callbacks cannot reenter navigation, while repeated dispose during cleanup is harmless', () => {
    let buffer, calls = 0, returned = 0;
    const source = { [Symbol.iterator]() { return this; }, next() {
        if (buffer) for (const method of ['next', 'previous', 'dispose']) assert.throws(() => buffer[method](), /busy/);
        return { done: false, value: calls++ };
    }, return() { returned++; buffer.dispose(); return { done: true }; } };
    buffer = createRewindBuffer(source, { capacity: 2 });
    assert.equal(buffer.next(), 1); assert.equal(buffer.previous(), 0);
    buffer.dispose(); assert.equal(returned, 1);
});

test('custom scenes and explicit steps replay with their own IDs, events and indices unchanged', () => {
    const steps = [11, 42, 90].map((index, i) => Object.freeze({ index, event: Object.freeze({ kind: 'visit', i }),
        state: Object.freeze({ objects: Object.freeze([{ id: 'node', type: 'node', data: Object.freeze({ label: ['A', 'B', 'C'][i] }) }]) }) }));
    const saved = JSON.stringify(steps), buffer = createRewindBuffer(steps, { capacity: 3 }), drawn = [];
    const renderer = createSceneRenderer({ node(output, transition, scene) {
        output.push([transition.current.data.label, scene.stepIndex, scene.event]);
    } });
    const draw = () => { const step = buffer.current; renderer.render(drawn, {
        previous: step.state, current: step.state, progress: 1, event: step.event, stepIndex: step.index
    }); };
    draw(); buffer.next(); draw(); buffer.next(); draw(); buffer.previous(); draw(); buffer.next(); draw();
    assert.deepEqual(drawn.map(v => v.slice(0, 2)), [['A', 11], ['B', 42], ['C', 90], ['B', 42], ['C', 90]]);
    assert.equal(buffer.position, 2); assert.equal(buffer.current, steps[2]);
    assert.equal(drawn[3][2], steps[1].event); assert.equal(JSON.stringify(steps), saved);
    buffer.dispose();
});
