import assert from 'node:assert/strict';
const expected = {
    playback: ['createPlayer', 'createStepEmitter', 'createTimeline'],
    scene: ['createSceneFrame', 'createSceneProjector', 'createSceneRenderer'],
    array: ['createArrayPlayer', 'createArrayTimeline', 'createArrayTrace', 'defineArrayAlgorithm'],
    canvas: ['arrayScene', 'createArrayRenderer', 'createSortRenderer'],
};
for (const [entry, names] of Object.entries(expected)) {
    const namespace = await import(`@grundyjs/algiviz/${entry}`);
    assert.deepEqual(Object.keys(namespace).sort(), names.sort(), entry);
}
const canvas = await import('@grundyjs/algiviz/canvas');
assert.equal(canvas.createArrayRenderer, canvas.createSortRenderer);
for (const suffix of ['', '/core', '/array/types.js', '/playback/player.js', '/dist/scene/index.js', '/package.json']) {
    await assert.rejects(import(`@grundyjs/algiviz${suffix}`), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
}
