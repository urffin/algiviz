import assert from 'node:assert/strict';
import { build, version as esbuildVersion } from 'esbuild';
import { mkdtemp, readFile, writeFile, mkdir, cp, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve, join, relative, isAbsolute, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run test:bundle');
const { values } = parseArgs({ options: { report: { type: 'string' } } });
const workspace = await mkdtemp(join(tmpdir(), 'algiviz-bundle-'));
const runNpm = (args, cwd) => execFileSync(process.execPath, [npm, ...args], {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
});
const existing = ['playback', 'scene', 'array', 'canvas']
    .map(name => `export * from '@grundyjs/algiviz/${name}';`).join('\n');
const sources = {
    gridCanvas: "export { createGridRenderer } from '@grundyjs/algiviz/canvas/grid';",
    gridCanvasDynamic: existing + "\nexport async function loadGridCanvas() { return import('@grundyjs/algiviz/canvas/grid'); }",
    grid: "export { createGridTrace, gridScene } from '@grundyjs/algiviz/grid';",
    gridDynamic: `${existing}\nexport async function loadGrid() { return import('@grundyjs/algiviz/grid'); }`,
    treeCanvas: "export { createTreeRenderer } from '@grundyjs/algiviz/canvas/tree';",
    treeCanvasDynamic: existing + "\nexport async function loadTreeCanvas() { return import('@grundyjs/algiviz/canvas/tree'); }",
    existing,
    tree: "export { createTreeTrace, treeScene } from '@grundyjs/algiviz/tree';",
    treeDynamic: `${existing}\nexport async function loadTree() { return import('@grundyjs/algiviz/tree'); }`,
    graphCanvas: "export { createGraphRenderer } from '@grundyjs/algiviz/canvas/graph';",
    graphCanvasDynamic: `${existing}\nexport async function loadGraphCanvas() { return import('@grundyjs/algiviz/canvas/graph'); }`,
    graph: "export { createGraphTrace, graphScene } from '@grundyjs/algiviz/graph';",
    graphDynamic: `${existing}\nexport async function loadGraph() { return import('@grundyjs/algiviz/graph'); }`,
    viewport: "export { createCanvasViewport } from '@grundyjs/algiviz/canvas/viewport';",
    viewportDynamic: `${existing}\nexport async function loadCanvasViewport() { return import('@grundyjs/algiviz/canvas/viewport'); }`,
    static: `${existing}\nexport { Player } from '@grundyjs/algiviz/player';`,
    dynamic: `${existing}\nexport async function loadPlayer() { return import('@grundyjs/algiviz/player'); }`,
    worker: "export { createWorkerSourceFactory, WorkerSourceError } from '@grundyjs/algiviz/worker';",
    workerRuntime: "export { exposeWorkerSource } from '@grundyjs/algiviz/worker/runtime';",
    workerDynamic: `${existing}\nexport async function loadWorker() { return import('@grundyjs/algiviz/worker'); }`,
    workerPlayerDynamic: `${existing}\nexport async function loadWorkerPlayer() { return Promise.all([import('@grundyjs/algiviz/player'), import('@grundyjs/algiviz/worker')]); }`,
};

async function bundle(directory, name, minify, code) {
    await writeFile(join(directory, 'entry.mjs'), code);
    const outdir = `output/${name}/${minify ? 'minified' : 'raw'}`;
    const result = await build({ absWorkingDir: directory, entryPoints: ['entry.mjs'],
        outdir, bundle: true, splitting: true, format: 'esm', platform: 'browser',
        target: 'es2022', minify, metafile: true, legalComments: 'none',
        outExtension: { '.js': '.mjs' }, logLevel: 'silent',
    });
    const outputs = result.metafile.outputs;
    const entry = Object.keys(outputs).find(key => outputs[key].entryPoint === 'entry.mjs');
    assert.ok(entry, 'Missing entry output');
    const initial = new Set();
    function visit(key) {
        if (initial.has(key)) return;
        assert.ok(outputs[key], `Missing output ${key}`); initial.add(key);
        for (const imported of outputs[key].imports) {
            if (imported.external || imported.kind === 'dynamic-import') continue;
            const target = outputs[imported.path] ? imported.path : posix.join(posix.dirname(key), imported.path);
            visit(target);
        }
    }
    visit(entry);
    const files = new Map(await Promise.all(Object.keys(outputs).map(async key => [key, await readFile(join(directory, key))])));
    const stats = keys => {
        const list = [...keys];
        return { bytes: list.reduce((n, key) => n + files.get(key).length, 0),
            gzipBytes: list.reduce((n, key) => n + gzipSync(files.get(key)).length, 0), files: list };
    };
    return { entry, files, outputs, initial, stats: { initial: stats(initial), total: stats(files.keys()) } };
}

try {
    const packed = JSON.parse(runNpm(['pack', '--json', '--pack-destination', workspace], root))[0];
    assert.equal(packed.filename, packed.filename.split(/[\\/]/).at(-1));
    const current = join(workspace, 'current'), baseline = join(workspace, 'baseline');
    await mkdir(current); await mkdir(baseline);
    await writeFile(join(current, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    runNpm(['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', join(workspace, packed.filename)], current);
    const installed = join(current, 'node_modules/@grundyjs/algiviz');
    const baselinePackage = join(baseline, 'node_modules/@grundyjs/algiviz');
    await mkdir(join(baselinePackage, 'dist'), { recursive: true });
    const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
    const baselineManifest = structuredClone(manifest);
    delete baselineManifest.exports['./player'];
    delete baselineManifest.exports['./canvas/viewport'];
    baselineManifest.files = baselineManifest.files.filter(path => path !== 'dist/player');
    await writeFile(join(baselinePackage, 'package.json'), JSON.stringify(baselineManifest));
    for (const name of ['playback', 'scene', 'array', 'canvas'])
        await cp(join(installed, 'dist', name), join(baselinePackage, 'dist', name), { recursive: true });

    for (const name of ['viewport.js', 'viewport.d.ts']) await rm(join(baselinePackage, 'dist/canvas', name));
    const withoutViewport = join(workspace, 'without-viewport');
    const withoutViewportPackage = join(withoutViewport, 'node_modules/@grundyjs/algiviz');
    await cp(installed, withoutViewportPackage, { recursive: true });
    const withoutViewportManifest = structuredClone(manifest);
    delete withoutViewportManifest.exports['./canvas/viewport'];
    await writeFile(join(withoutViewportPackage, 'package.json'), JSON.stringify(withoutViewportManifest));
    for (const name of ['viewport.js', 'viewport.d.ts']) await rm(join(withoutViewportPackage, 'dist/canvas', name));

    const report = { package: `${manifest.name}@${manifest.version}`, esbuild: esbuildVersion,
        node: process.version, format: 'browser ESM, ES2022, splitting, no source maps',
        baseline: 'Same four module files without the optional entry/files, not a registry-version comparison',
        variants: {} };
    for (const minify of [false, true]) {
        const prior = await bundle(baseline, 'baseline', minify, existing);
        for (const [name, code] of Object.entries(sources)) {
            const result = await bundle(current, name, minify, code);
            const initialModules = [...result.initial].flatMap(key => Object.keys(result.outputs[key].inputs));
            if (!['graph', 'graphCanvas'].includes(name)) assert.equal(initialModules.some(path => path.includes('/dist/graph/')), false, `${name}: graph code in initial bundle`);
            const allModules = Object.values(result.outputs).flatMap(output => Object.keys(output.inputs));
            if (!['tree', 'treeCanvas'].includes(name)) assert.equal(initialModules.some(path => path.includes('/dist/tree/')), false, 'Unexpected initial tree dependency');
            if (!['tree', 'treeDynamic', 'treeCanvas', 'treeCanvasDynamic'].includes(name)) assert.equal(allModules.some(path => path.includes('/dist/tree/')), false, 'Unrelated entry loaded tree code');
            const canvasTree = path => /\/canvas\/tree(?:-layout|-geometry|-labels)?\.js$/.test(path);
            if (!['treeCanvas', 'treeCanvasDynamic'].includes(name)) assert.equal(allModules.some(canvasTree), false, 'Unrelated entry loaded Canvas tree');
            if (name === 'treeCanvas' || name === 'treeCanvasDynamic') {
                assert.ok(allModules.some(path => path.endsWith('/canvas/tree.js')));
                assert.equal(allModules.some(path => /\/(tree\/trace|tree\/index|canvas\/graph|graph\/trace)\.js$/.test(path)), false, 'Tree Canvas loaded another backend/trace builder');
                if (name === 'treeCanvas') assert.equal(allModules.some(path => path.endsWith('/canvas/index.js')), false, 'Tree Canvas loaded array renderer');
                if (name === 'treeCanvasDynamic') {
                    assert.ok(result.files.size > result.initial.size, 'Tree Canvas not deferred');
                    assert.equal(initialModules.some(canvasTree), false);
                }
            }
            if (!['grid', 'gridDynamic', 'gridCanvas', 'gridCanvasDynamic'].includes(name)) assert.equal(allModules.some(path => path.includes('/dist/grid/')), false, 'Unrelated entry loaded grid code');
            const canvasGrid = path => /\/canvas\/grid(?:-layout|-state|-text)?\.js$/.test(path);
            if (!['gridCanvas', 'gridCanvasDynamic'].includes(name)) assert.equal(allModules.some(canvasGrid), false, 'Unrelated entry loaded Canvas grid');
            if (name === 'gridCanvas' || name === 'gridCanvasDynamic') {
                assert.ok(allModules.some(path => path.endsWith('/canvas/grid.js')));
                assert.equal(allModules.some(path => /\/(grid\/trace|grid\/index|canvas\/graph|canvas\/tree|tree\/trace)\.js$/.test(path)), false, 'Grid Canvas loaded another backend/trace builder');
                if (name === 'gridCanvas') assert.equal(allModules.some(path => path.endsWith('/canvas/index.js')), false);
                else { assert.ok(result.files.size > result.initial.size, 'Grid Canvas not deferred');assert.equal(initialModules.some(canvasGrid), false); }
            }
            if (name === 'grid') {
                const modules = allModules.filter(path => path.includes('/dist/'));
                assert.ok(modules.length > 0 && modules.every(path => path.includes('/dist/grid/')), 'Grid imported a backend or unrelated entry');
            }
            if (name === 'gridDynamic') {
                assert.ok(result.files.size > result.initial.size, 'Grid import was not deferred');
                assert.equal(initialModules.some(path => path.includes('/dist/grid/')), false);
                assert.ok(allModules.some(path => path.includes('/dist/grid/')));
            }
            if (name === 'tree') {
                const modules = allModules.filter(path => path.includes('/dist/'));
                assert.ok(modules.length > 0 && modules.every(path => path.includes('/dist/tree/')), 'Tree imported a backend or unrelated entry');
            }
            if (name === 'treeDynamic') {
                assert.ok(result.files.size > result.initial.size, 'Tree import was not deferred');
                assert.ok(allModules.some(path => path.includes('/dist/tree/')));
            }
            if (!['graphCanvas', 'graphCanvasDynamic'].includes(name)) assert.equal(allModules.some(path => /\/canvas\/graph(?:-geometry)?\.js$/.test(path)), false, 'Unexpected Canvas graph dependency');
            if (name === 'graphCanvas') {
                assert.ok(allModules.some(path => path.endsWith('/canvas/graph.js')));
                assert.equal(allModules.some(path => path.endsWith('/canvas/index.js') || path.endsWith('/graph/trace.js')), false, 'Graph drawing pulled array renderer/trace builder');
            }
            if (name === 'graphCanvasDynamic') {
                assert.ok(result.files.size > result.initial.size, 'Canvas graph not deferred');
                assert.equal(initialModules.some(path => /\/canvas\/graph(?:-geometry)?\.js$/.test(path)), false);
                assert.ok(allModules.some(path => path.endsWith('/canvas/graph.js')));
            }
            if (name === 'graph') {
                const modules = Object.values(result.outputs).flatMap(output => Object.keys(output.inputs)).filter(path => path.includes('/dist/'));
                assert.ok(modules.length > 0 && modules.every(path => path.includes('/dist/graph/')), 'Headless graph imported a backend or unrelated module');
            }
            if (name === 'graphDynamic') {
                assert.ok(result.files.size > result.initial.size, 'Graph import did not produce deferred outputs');
                assert.ok(Object.values(result.outputs).some(output => Object.keys(output.inputs).some(path => path.includes('/dist/graph/'))));
            }
            if (!['worker', 'workerRuntime'].includes(name)) assert.equal(initialModules.some(path => path.includes('/dist/worker/')), false, `${name}: worker code in initial graph`);
            const workerModules = Object.values(result.outputs).flatMap(output => Object.keys(output.inputs));
            if (name === 'worker') assert.equal(workerModules.some(path => path.endsWith('/worker/runtime.js')), false);
            if (name === 'workerRuntime') assert.equal(workerModules.some(path => path.endsWith('/worker/index.js')), false);
            if (name === 'workerDynamic') assert.ok(result.files.size > result.initial.size, 'Worker import did not produce deferred outputs');
            if (name === 'workerPlayerDynamic') {
                assert.ok(result.files.size > result.initial.size, 'Worker/player imports did not produce deferred outputs');
                assert.ok(workerModules.some(path => path.endsWith('/worker/index.js')));
                assert.ok(workerModules.some(path => path.endsWith('/player/player.js')));
                assert.equal(workerModules.some(path => path.endsWith('/worker/runtime.js')), false);
            }
            if (name !== 'viewport') assert.equal(initialModules.some(path => path.endsWith('/dist/canvas/viewport.js')), false, `${name}: viewport in initial graph`);
            if (name !== 'static') {
                assert.equal(initialModules.some(path => path.includes('/dist/player/')), false, `${name}: UI in initial graph`);
                for (const key of result.initial)
                    assert.equal(result.files.get(key).includes(Buffer.from('algiviz-player')), false, `${name}: UI styles in initial output`);
            }
            if (name === 'existing') {
                assert.equal(result.files.size, 1);
                assert.deepEqual(result.files.get(result.entry), prior.files.get(prior.entry), 'Existing bundle changed with optional files present');
            } else if (name === 'static' || name === 'dynamic') {
                assert.ok([...result.files.values()].some(bytes => bytes.includes(Buffer.from('algiviz-player'))), 'Missing UI styles');
            }
            if (name === 'static' || name === 'dynamic') {
                const oldUi = await bundle(withoutViewport, name, minify, code);
                assert.deepEqual(result.files, oldUi.files, 'Existing UI bundle changed with viewport files present');
            }
            if (name === 'viewport') {
                const modules = Object.values(result.outputs).flatMap(output => Object.keys(output.inputs)).filter(path => path.includes('/dist/'));
                assert.deepEqual(modules, ['node_modules/@grundyjs/algiviz/dist/canvas/viewport.js']);
            }
            if (name === 'viewportDynamic') {
                assert.ok(result.files.size > result.initial.size, 'Viewport import did not produce deferred outputs');
                assert.ok(Object.values(result.outputs).some(output => Object.keys(output.inputs).some(path => path.endsWith('/dist/canvas/viewport.js'))));
            }
            if (name === 'dynamic') {
                assert.ok(result.files.size > result.initial.size, 'Dynamic import did not produce deferred outputs');
                assert.ok(Object.values(result.outputs).some(output => Object.keys(output.inputs).some(path => path.includes('/dist/player/mount.js'))));
            }
            report.variants[`${name}-${minify ? 'minified' : 'raw'}`] = result.stats;
            if (minify) {
                // Execute actual browser-target ESM outputs in Node: imports and lazy
                // loading must work without DOM globals. Mounting still needs a DOM.
                const entryUrl = pathToFileURL(join(current, result.entry)).href;
                const check = `const m = await import(${JSON.stringify(entryUrl)});
                    if (typeof document !== 'undefined') throw Error('Unexpected DOM');
                    if (${JSON.stringify(name)} === 'gridCanvas' || ${JSON.stringify(name)} === 'gridCanvasDynamic') {
                        const drawing = ${JSON.stringify(name)} === 'gridCanvas' ? m : await m.loadGridCanvas();
                        const renderer = drawing.createGridRenderer({theme:'light',presentCell:({value})=>({label:String(value)})});
                        if (typeof renderer.render !== 'function' || Object.keys(renderer).join() !== 'render') throw Error('Bundled Grid Canvas API failed');
                    }
                    if (${JSON.stringify(name)} === 'grid' || ${JSON.stringify(name)} === 'gridDynamic') {
                        const grid = ${JSON.stringify(name)} === 'grid' ? m : await m.loadGrid();
                        const trace = grid.createGridTrace({rows:1,columns:1,values:[1]});
                        trace.start();trace.edit({writes:[{row:0,column:0,value:2}]});
                        const state = trace.done({result:{path:[{row:0,column:0},{row:0,column:0}]}}).state;
                        const scene = grid.gridScene(state,{namespace:'bundle'});
                        if (scene.objects[0].data.value !== 2 || !scene.objects[0].data.result || scene.objects[1].data.cellIds.length !== 2) throw Error('Bundled grid result/path missing');
                    }
                    if (${JSON.stringify(name)} === 'treeCanvas' || ${JSON.stringify(name)} === 'treeCanvasDynamic') {
                        const drawing = ${JSON.stringify(name)} === 'treeCanvas' ? m : await m.loadTreeCanvas();
                        const renderer = drawing.createTreeRenderer({theme:'light',emptySlots:'visible'});
                        const positions = renderer.layout({kind:'binary',rootId:'A',nodes:[{id:'A'},{id:'B'}],links:[{id:'l',parentId:'A',childId:'B',slot:'right'}]});
                        if (positions[1].x !== 2 || positions[1].y !== 2 || typeof renderer.render !== 'function') throw Error('Bundled tree Canvas failed');
                    }
                    if (${JSON.stringify(name)} === 'tree' || ${JSON.stringify(name)} === 'treeDynamic') {
                        const tree = ${JSON.stringify(name)} === 'tree' ? m : await m.loadTree();
                        const trace = tree.createTreeTrace({kind:'binary',rootId:'A',nodes:[{id:'A'}],links:[]},{layout:[{nodeId:'A',x:0,y:0}]});
                        trace.start(); trace.edit({}); const state = trace.done({result:{nodeIds:['A']}}).state;
                        if (!tree.treeScene(state,{namespace:'bundle'}).objects[0].data.result) throw Error('Bundled tree result missing');
                    }
                    if (${JSON.stringify(name)} === 'graphCanvas' || ${JSON.stringify(name)} === 'graphCanvasDynamic') {
                        const drawing = ${JSON.stringify(name)} === 'graphCanvas' ? m : await m.loadGraphCanvas();
                        if (typeof drawing.createGraphRenderer({ theme: 'light' }).render !== 'function') throw Error('Graph Canvas lazy/import failed');
                    }
                    if (${JSON.stringify(name)} === 'graph' || ${JSON.stringify(name)} === 'graphDynamic') {
                        const graph = ${JSON.stringify(name)} === 'graph' ? m : await m.loadGraph();
                        const trace = graph.createGraphTrace({ nodes: [{ id: 'A' }], edges: [] });
                        trace.start(); const state = trace.done({ result: { nodeIds: ['A'] } }).state;
                        if (!graph.graphScene(state, { namespace: 'bundle' }).objects[0].data.result) throw Error('Bundled graph result missing');
                    }
                    if (${JSON.stringify(name)} === 'dynamic') {
                        if ('Player' in m) throw Error('UI was re-exported eagerly');
                        if (typeof (await m.loadPlayer()).Player !== 'function') throw Error('Lazy export missing');
                    } else if (${JSON.stringify(name)} === 'static' && typeof m.Player !== 'function') throw Error('Static export missing');
                    if (${JSON.stringify(name)} === 'viewportDynamic') {
                        if ('createCanvasViewport' in m) throw Error('Viewport re-exported eagerly');
                        if (typeof (await m.loadCanvasViewport()).createCanvasViewport !== 'function') throw Error('Lazy viewport missing');
                    } else if (${JSON.stringify(name)} === 'viewport' && typeof m.createCanvasViewport !== 'function') throw Error('Viewport export missing');`;
                execFileSync(process.execPath, ['--input-type=module', '-e', check], { cwd: current, stdio: 'inherit' });
            }
        }
    }
    if (values.report) await writeFile(resolve(root, values.report), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    console.log('Bundle isolation passed: unchanged existing/UI imports; independent viewport; optional modules deferred by import().');
} finally {
    const parent = await realpath(tmpdir()), target = await realpath(workspace), child = relative(parent, target);
    if (!child || child.startsWith('..') || isAbsolute(child) || dirname(target) !== parent)
        throw new Error(`Refusing cleanup outside temporary parent: ${target}`);
    await rm(target, { recursive: true, force: true });
}
