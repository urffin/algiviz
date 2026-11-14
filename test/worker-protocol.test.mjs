import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextId } from '../dist/worker/protocol.js';

test('request IDs stop at the safe integer boundary instead of wrapping or aliasing', () => {
    assert.equal(nextId(Number.MAX_SAFE_INTEGER - 1), Number.MAX_SAFE_INTEGER);
    for (const n of [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, -1, NaN, Infinity, 0.5]) assert.throws(() => nextId(n), RangeError);
});
