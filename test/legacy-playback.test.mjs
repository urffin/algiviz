import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createArrayPlayer, createArrayTimeline } from '@grundyjs/algiviz/array';
import { createSortPlayer, createSortTimeline } from '@grundyjs/algiviz/core';

test('legacy playback exports remain aliases of supported array adapters', () => {
    assert.equal(createSortPlayer, createArrayPlayer);
    assert.equal(createSortTimeline, createArrayTimeline);
});
