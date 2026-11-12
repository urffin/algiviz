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
    existing,
    viewport: "export { createCanvasViewport } from '@grundyjs/algiviz/canvas/viewport';",
    viewportDynamic: `${existing}\nexport async function loadCanvasViewport() { return import('@grundyjs/algiviz/canvas/viewport'); }`,
    static: `${existing}\nexport { Player } from '@grundyjs/algiviz/player';`,
    dynamic: `${existing}\nexport async function loadPlayer() { return import('@grundyjs/algiviz/player'); }`,
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
