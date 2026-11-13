import assert from 'node:assert/strict';
const expected = {
    playback: ['createPlayer', 'createStatePlayer', 'createStepEmitter', 'createTimeline', 'createRewindBuffer'],
    scene: ['createSceneFrame', 'createSceneProjector', 'createSceneRenderer'],
    array: ['createArrayPlayer', 'createArrayTimeline', 'createArrayTrace', 'defineArrayAlgorithm'],
    canvas: ['arrayScene', 'createArrayRenderer', 'createSortRenderer'],
    player: ['Player'],
    'canvas/viewport': ['createCanvasViewport'],
};
for (const [entry, names] of Object.entries(expected)) {
    const namespace = await import(`@grundyjs/algiviz/${entry}`);
    assert.deepEqual(Object.keys(namespace).sort(), names.sort(), entry);
}
const canvas = await import('@grundyjs/algiviz/canvas');
assert.equal(canvas.createArrayRenderer, canvas.createSortRenderer);
for (const suffix of ['', '/core', '/array/types.js', '/playback/player.js', '/playback/rewind-buffer.js', '/player/player.js', '/player/controller.js', '/player/mount.js', '/player/types.js', '/canvas/viewport.js', '/canvas/viewport/index.js', '/dist/canvas/viewport.js', '/dist/scene/index.js', '/package.json']) {
    await assert.rejects(import(`@grundyjs/algiviz${suffix}`), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
}
for (const suffix of ['/playback/state-steps.js', '/player/stream-playback.js', '/player/rewind-session.js'])
    await assert.rejects(import(`@grundyjs/algiviz${suffix}`), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
