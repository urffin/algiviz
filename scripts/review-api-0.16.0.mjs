// Diagnostic review of the unchanged 0.16.0 API; does not implement fixes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { createAsyncSource, createStatePlayer } from '@grundyjs/algiviz/playback';
import { createWorkerSourceFactory, WorkerSourceError } from '@grundyjs/algiviz/worker';
import { Player } from '@grundyjs/algiviz/player';
import { transport } from '../test/worker-test-transport.mjs';
import { dom } from '../test/player-test-dom.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
assert.equal(pkg.version, '0.16.0', 'This diagnostic describes the 0.16.0 baseline');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
assert.equal(git('diff', '--name-only', 'v0.16.0', '--', 'src', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.worker.json'), '', 'Production baseline changed');

// Symbol enumeration only. skipLibCheck and combined libraries here do not
// constitute a DOM/WebWorker consumer compatibility check.
const program = ts.createProgram(Object.values(pkg.exports).map(entry => resolve(root, entry.types)), {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.webworker.d.ts'], types: [], skipLibCheck: true, noEmit: true,
});
const checker = program.getTypeChecker(), entries = [];
for (const [entry, mapping] of Object.entries(pkg.exports)) {
    const source = program.getSourceFile(resolve(root, mapping.types));
    const names = checker.getExportsOfModule(checker.getSymbolAtLocation(source));
    const runtime = [], types = [];
    for (let symbol of names) {
        const name = symbol.name;
        if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
        (symbol.flags & ts.SymbolFlags.Value ? runtime : types).push(name);
    }
    const namespace = await import(pkg.name + entry.slice(1));
    assert.deepEqual(Object.keys(namespace).sort(), runtime.sort(), entry);
    entries.push({ entry, runtime, types: types.sort() });
}
assert.equal(entries.length, 8);
for (const suffix of ['', '/core', '/playback/async-source.js', '/scene/index.js', '/array/types.js',
    '/canvas/index.js', '/canvas/viewport.js', '/player/player.js', '/worker/index.js', '/worker/runtime.js', '/worker/data.js']) {
    await assert.rejects(import(pkg.name + suffix), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
}
const canvas = await import('@grundyjs/algiviz/canvas');
assert.equal(canvas.createArrayRenderer, canvas.createSortRenderer);

async function sharedMemory(mode) {
    const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
    Atomics.store(new Uint8Array(memory.buffer), 0, 7);
    let link, session;
    const factory = createWorkerSourceFactory({
        worker: () => (link = transport(function* (input) {
            if (mode === 'input') {
                yield Atomics.load(new Uint8Array(input.memory.buffer), 0);
                yield Atomics.load(new Uint8Array(input.memory.buffer), 0);
            } else yield { memory };
        })).worker,
        input: () => mode === 'input' ? { memory } : undefined,
    });
    const source = createAsyncSource(signal => (session = factory(signal)));
    try {
        const first = await source.next();
        const before = mode === 'input' ? first.value : Atomics.load(new Uint8Array(first.value.memory.buffer), 0);
        Atomics.store(new Uint8Array(memory.buffer), 0, 42);
        const after = mode === 'input' ? (await source.next()).value : Atomics.load(new Uint8Array(first.value.memory.buffer), 0);
        return { mode, accepted: true, before, after, violatesIsolation: before === 7 && after === 42 };
    } finally {
        source.dispose('api-review'); await source.closed; await session.closed;
        assert.equal(link.terminations, 1);
        assert.equal(link.hostListeners, 0);
    }
}
async function directSharedControl() {
    let link;
    const source = createAsyncSource(createWorkerSourceFactory({
        worker: () => (link = transport(function* () { yield { buffer: new SharedArrayBuffer(1) }; })).worker,
        input: () => undefined,
    }));
    try {
        await assert.rejects(source.next(), error => error instanceof WorkerSourceError && error.code === 'serialization');
        return { directSharedArrayBufferRejected: true };
    } finally { source.dispose(); await source.closed; assert.equal(link.terminations, 1); }
}
async function postFailure(packetType) {
    let link, session;
    const original = new DOMException('Injected channel failure', 'InvalidStateError');
    const source = createAsyncSource(signal => (session = createWorkerSourceFactory({
        worker() {
            link = transport(function* () { yield 1; });
            const send = link.worker.postMessage.bind(link.worker);
            link.worker.postMessage = (packet, transfer) => {
                if (packet.type === packetType) throw original;
                send(packet, transfer);
            };
            return link.worker;
        }, input: () => undefined, shutdown: { gracePeriodMs: 0 },
    })(signal)));
    let observed;
    try { await source.next(); throw new Error('Expected injected post failure'); }
    catch (error) {
        assert.equal(error, original);
        observed = { packetType, name: error.name, code: error.code, isWorkerSourceError: error instanceof WorkerSourceError,
            originalValuePreserved: true, contractQuestion: 'Does the local-throw identity guarantee include host postMessage, or must the channel failure be normalized?',
            normalizedInterpretation: { class: 'WorkerSourceError', code: 'transport', origin: 'host', phase: 'post' } };
    } finally { source.dispose(); await source.closed; }
    const report = await session.closed;
    assert.equal(link.terminations, 1);
    return { ...observed, closeKind: report.kind, closeOrigin: report.origin, closePhase: report.phase };
}
async function factoryThrowControl() {
    const original = new Error('Application factory failure');
    const source = createAsyncSource(createWorkerSourceFactory({ worker() { throw original; }, input() {} }));
    try { await assert.rejects(source.next(), error => error === original); }
    finally { source.dispose(); await source.closed; }
    return { applicationFactoryFailurePreserved: true };
}
function headlessReentrancy() {
    let player, nested = false, reads = 0;
    const renders = [];
    player = createStatePlayer((function* () { for (const value of [0, 1, 2, 3]) { reads++; yield value; } })(), {
        render(frame) {
            renders.push(frame.current);
            if (player && frame.current === 1 && !nested) { nested = true; player.nextStep(); }
        },
    });
    try { const returned = player.nextStep(); return { returned: returned.current, current: player.frame.current, reads, renders,
        note: 'A contract clarification, not an assertion that reentrancy must be supported or forbidden' }; }
    finally { player.dispose(); }
}
async function speedErrors() {
    const results = [];
    for (const mode of ['source', 'history', 'asyncSource']) {
        const env = dom(); let acquisitions = 0;
        const factory = mode === 'asyncSource' ? async function* () { acquisitions++; yield 0; }
            : () => { acquisitions++; return [0]; };
        const ui = new Player(env.container(), { [mode]: factory, stepDurationMs: 100, render() {} });
        try {
            for (const value of [0, -1, NaN, Infinity]) {
                let name;
                try { ui.setSpeed(value); } catch (error) { name = error.name; }
                assert.ok(name, 'Invalid speed must be rejected');
                results.push({ mode, value: String(value), error: name, speed: ui.status.speed, phase: ui.status.phase });
            }
        } finally { ui.dispose(); await ui.closed; }
        assert.equal(acquisitions, 0);
    }
    return results;
}

const provenanceFiles = ['package.json', 'src/worker/data.ts', 'src/worker/index.ts', 'src/worker/runtime.ts',
    'src/playback/player.ts', 'src/playback/async-source.ts', 'src/array/player.ts',
    'dist/worker/data.js', 'dist/worker/index.js', 'dist/worker/runtime.js', 'dist/playback/player.js',
    'src/player/controller.ts', 'src/player/async-controller.ts', 'test/player-test-dom.mjs',
    'test/worker-test-transport.mjs', 'scripts/review-api-0.16.0.mjs'];
const provenance = Object.fromEntries(await Promise.all(provenanceFiles.map(async file =>
    [file, createHash('sha256').update(await readFile(resolve(root, file))).digest('hex')])));
const result = {
    date: new Date().toISOString(), version: pkg.version, baselineCommit: git('rev-parse', 'v0.16.0'), reviewCommit: git('rev-parse', 'HEAD'),
    environment: { node: process.version, platform: process.platform, typescript: ts.version, document: typeof globalThis.document, Worker: typeof globalThis.Worker },
    inventory: { entries, runtimeNames: entries.reduce((n, e) => n + e.runtime.length, 0), typeOnlyNames: entries.reduce((n, e) => n + e.types.length, 0),
        uniqueTypeOnlyNames: new Set(entries.flatMap(e => e.types)).size, runtimeNamespacesMatch: true, privatePathsRejected: true, rendererAliasIdentity: true,
        method: 'TypeScript symbol enumeration and actual runtime import; not a compiler compatibility test' },
    probes: { sharedMemory: [await sharedMemory('input'), await sharedMemory('state')], directSharedControl: await directSharedControl(),
        postFailures: [await postFailure('init'), await postFailure('pull')], factoryThrowControl: await factoryThrowControl(),
        headlessReentrancy: headlessReentrancy(), speedErrors: await speedErrors() },
    provenance,
};
// Success means the audit completed, not that the API is ready for 1.0.
console.log(JSON.stringify(result, null, 2));
