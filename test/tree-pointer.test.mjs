import { test } from 'node:test';
import assert from 'node:assert/strict';
import { treeSteps } from '../examples/tree-scene.mjs';
import { treePointerPosition } from '../examples/tree-pointer.mjs';
import { createSceneFrame } from '@grundyjs/algiviz/scene';
test('tree cursor visits shared ancestors rather than crossing between leaves', () => {
    const steps = [...treeSteps()];
    function at(index, progress) {
        const scene = createSceneFrame({ previous: steps[index - 1].state, current: steps[index].state, stepIndex: index, progress, event: steps[index].event });
        return treePointerPosition(scene.get('cursor'), scene, 960, 500);
    }
    function near(actual, x, y) { assert.ok(Math.abs(actual.x - x * 960) < 1e-8); assert.ok(Math.abs(actual.y - (y * 500 - 36)) < 1e-8); }
    near(at(4, 0), .13, .77); near(at(4, .5), .26, .47); near(at(4, 1), .39, .77);
    const eb = Math.hypot(.13 * 960, .30 * 500);
    const ba = Math.hypot(.24 * 960, .29 * 500);
    const ac = ba;
    near(at(5, eb / (eb + ba + ac)), .26, .47);
    near(at(5, (eb + ba) / (eb + ba + ac)), .5, .18);
    near(at(5, 1), .74, .47);
});
