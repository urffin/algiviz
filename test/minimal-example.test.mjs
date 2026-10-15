import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenSteps, createTokenPlayer } from '../examples/minimal.mjs';

test('standalone custom object renders interpolated positions and restarts independently', () => {
    let position, saved = 0;
    const ctx = { canvas: { width: 600, height: 120 },
        save() { saved++; }, restore() { saved--; }, clearRect() {}, beginPath() {}, fill() {},
        arc(x, y) { position = [x, y]; },
    };
    const player = createTokenPlayer(ctx);
    assert.deepEqual(position, [24, 60]);
    player.advance(300);
    assert.deepEqual(position, [116, 60]);
    player.advance(1500);
    assert.equal(player.finished, true);
    assert.deepEqual(position, [576, 60]);
    assert.equal(saved, 0);
    player.dispose();
    const restarted = createTokenPlayer(ctx);
    assert.deepEqual(position, [24, 60]);
    restarted.dispose();
    const steps = [...tokenSteps()];
    assert.deepEqual(steps.map(s => s.index), [0, 1, 2, 3]);
    assert.deepEqual(steps.map(s => s.state.objects[0].data.x), [0, 1, 2, 3]);
    assert.ok(steps.every(s => Object.isFrozen(s.state.objects[0].data)));
});
