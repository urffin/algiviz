import assert from 'node:assert/strict';
const expected = {
    'canvas/grid': ['createGridRenderer'],
    grid: ['createGridTrace', 'gridScene'],
    'canvas/tree': ['createTreeRenderer'],
    tree: ['createTreeTrace', 'treeScene'],
    'canvas/graph': ['createGraphRenderer'],
    graph: ['createGraphTrace', 'graphScene'],
    playback: ['createPlayer', 'createStatePlayer', 'createStepEmitter', 'createTimeline', 'createRewindBuffer', 'createAsyncSource'],
    scene: ['createSceneFrame', 'createSceneProjector', 'createSceneRenderer'],
    array: ['createArrayPlayer', 'createArrayTimeline', 'createArrayTrace', 'defineArrayAlgorithm'],
    canvas: ['arrayScene', 'createArrayRenderer', 'createSortRenderer'],
    player: ['Player'],
    'canvas/viewport': ['createCanvasViewport'],
    worker: ['createWorkerSourceFactory', 'WorkerSourceError'],
    'worker/runtime': ['exposeWorkerSource'],
};
for (const suffix of ['/canvas/tree.js', '/canvas/tree-layout.js', '/canvas/tree-geometry.js', '/canvas/tree-labels.js', '/dist/canvas/tree.js'])
    await assert.rejects(import(`@grundyjs/algiviz${suffix}`), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
for (const [entry, names] of Object.entries(expected)) {
    const namespace = await import(`@grundyjs/algiviz/${entry}`);
    assert.deepEqual(Object.keys(namespace).sort(), names.sort(), entry);
}
const canvas = await import('@grundyjs/algiviz/canvas');
assert.equal(canvas.createArrayRenderer, canvas.createSortRenderer);
for (const suffix of ['/canvas/graph-captions.js', '/canvas/graph.js', '/canvas/graph-geometry.js', '/graph/types.js', '/graph/trace.js', '/graph/scene.js', '/graph/validation.js', '/graph/index.js'])
    await assert.rejects(import(`@grundyjs/algiviz${suffix}`), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
for (const suffix of ['', '/core', '/array/types.js', '/playback/player.js', '/playback/rewind-buffer.js', '/player/player.js', '/player/controller.js', '/player/mount.js', '/player/types.js', '/canvas/viewport.js', '/canvas/viewport/index.js', '/dist/canvas/viewport.js', '/dist/scene/index.js', '/package.json']) {
    await assert.rejects(import(`@grundyjs/algiviz${suffix}`), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
}
for (const suffix of ['/worker/index.js', '/worker/runtime.js', '/worker/types', '/worker/types.js', '/worker/error.js', '/worker/data.js', '/worker/protocol.js'])
    await assert.rejects(import(`@grundyjs/algiviz${suffix}`), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
for (const suffix of ['/playback/async-source.js', '/playback/state-steps.js', '/player/stream-playback.js', '/player/rewind-session.js',
    '/player/async-controller.js', '/player/async-session.js', '/player/close-report.js'])
    await assert.rejects(import(`@grundyjs/algiviz${suffix}`), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });

for (const suffix of ['/canvas/grid.js', '/canvas/grid-layout.js', '/canvas/grid-text.js', '/canvas/grid-state.js', '/dist/canvas/grid.js'])
    await assert.rejects(import(`@grundyjs/algiviz${suffix}`), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });

for (const suffix of ['/grid/index.js', '/grid/types.js', '/grid/trace.js', '/grid/scene.js', '/grid/attributes.js', '/grid/validation.js', '/dist/grid/index.js'])
    await assert.rejects(import(`@grundyjs/algiviz${suffix}`), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });

for (const suffix of ['/tree/index.js', '/tree/types.js', '/tree/trace.js', '/tree/scene.js', '/tree/validation.js', '/tree/attributes.js', '/dist/tree/index.js'])
    await assert.rejects(import(`@grundyjs/algiviz${suffix}`), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
