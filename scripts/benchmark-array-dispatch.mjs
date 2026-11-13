import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { createArrayRenderer } from '@grundyjs/algiviz/canvas';
import { createProfileMock, profilePolicy, profileSize } from '../test/profile-workloads.mjs';
import { compareArraySpeed } from '../test/array-dispatch-workloads.mjs';
import { loadBaseline, baselineModule, baselineCommit } from './array-dispatch-baseline.mjs';

const { values } = parseArgs({ options: { 'array-dispatch': { type: 'boolean' },
    serve: { type: 'boolean' }, port: { type: 'string', default: '8765' }, output: { type: 'string' } } });
const hash = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const provenance = { baselineCommit, baselineSourceSha256: baselineModule().sha256,
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    canvasSourceSha256: await hash('src/canvas/index.ts'), sceneSourceSha256: await hash('src/scene/index.ts'),
    canvasBuildSha256: await hash('dist/canvas/index.js'),
    workloadSha256: await hash('test/array-dispatch-workloads.mjs'),
    harnessSha256: await hash('scripts/benchmark-array-dispatch.mjs'),
    browserHarnessSha256: await hash('test/array-dispatch-browser.mjs') };

const pause = () => new Promise(resolve => setImmediate(resolve));
async function collect() { for (let i = 0; i < 3; i++) { await pause(); global.gc(); } }
function feed(renderer, count, offset) {
    const make = step => Object.freeze({ slots: Object.freeze(Array.from({ length: 512 }, (_, i) =>
        Object.freeze({ id: 'item-' + i, value: i + step }))), held: null, sortedPrefixLength: 0,
        comparisons: step, writes: 0 });
    let previous = make(offset), lastPrevious;
    const old = [new WeakRef(previous)];
    let ephemeral;
    for (let i = 1; i <= count; i++) {
        const current = make(offset + i), ctx = createProfileMock().context;
        const event = { type: 'start' }, frame = { previous, current, progress: 0.5, stepIndex: offset + i, event };
        renderer.render(ctx, frame);
        if (i === 1) old.push(new WeakRef(current));
        ephemeral = [ctx, event, frame].map(v => new WeakRef(v));
        lastPrevious = previous; previous = current;
    }
    return { old, active: [lastPrevious, previous].map(v => new WeakRef(v)), ephemeral };
}
async function memory(factory) {
    await collect(); const initialHeapBytes = process.memoryUsage().heapUsed;
    let renderer = factory({ theme: 'dark' }), refs;
    const samples = [];
    for (let batch = 0; batch < 4; batch++) {
        refs = feed(renderer, 1000, batch * 1000);
        await collect();
        const oldAlive = refs.old.filter(r => r.deref()).length;
        const ephemeralAlive = refs.ephemeral.filter(r => r.deref()).length;
        assert.equal(oldAlive, 0); assert.equal(ephemeralAlive, 0);
        samples.push({ pairs: (batch + 1) * 1000, heapBytes: process.memoryUsage().heapUsed, oldAlive, ephemeralAlive });
    }
    const activeAlive = refs.active.filter(r => r.deref()).length;
    assert.equal(activeAlive, 2); // Existing projector retains two snapshots in both implementations.
    renderer = null; await collect();
    const afterDropAlive = refs.active.filter(r => r.deref()).length;
    assert.equal(afterDropAlive, 0);
    return { initialHeapBytes, samples, activeAlive, afterDropAlive, afterDropHeapBytes: process.memoryUsage().heapUsed,
        policy: { pairs: 4000, items: 512, forcedGcPasses: 3, ephemeral: ['context', 'event', 'frame'] } };
}

if (values.serve) {
    const root = process.cwd(), baseline = baselineModule('/dist/scene/index.js').javascript;
    const mime = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json' };
    http.createServer(async (req, res) => {
        try {
            const pathname = new URL(req.url, 'http://localhost').pathname;
            res.setHeader('Cache-Control', 'no-store');
            if (req.method === 'GET' && pathname === '/__baseline.mjs') {
                res.setHeader('Content-Type', 'text/javascript'); res.end(baseline); return;
            }
            if (req.method === 'GET' && pathname === '/__provenance') {
                res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(provenance)); return;
            }
            if (req.method === 'POST' && pathname === '/__report' && values.output) {
                let body = '';
                for await (const chunk of req) { body += chunk; if (body.length > 8_000_000) throw Error('Report too large'); }
                const report = JSON.parse(body);
                assert.deepEqual(report.provenance, provenance);
                await fs.writeFile(path.resolve(values.output), JSON.stringify(report, null, 2));
                console.log('Saved native Canvas report: ' + values.output); res.end('saved'); return;
            }
            if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
            if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
            const file = path.resolve(root, '.' + decodeURIComponent(pathname));
            if (!file.startsWith(root + path.sep) || !['/test/', '/dist/', '/examples/'].some(p => pathname.startsWith(p))) {
                res.writeHead(403); res.end(); return;
            }
            res.setHeader('Content-Type', mime[path.extname(file)] ?? 'application/octet-stream');
            res.end(await fs.readFile(file));
        } catch (error) { res.writeHead(500); res.end(error.message); }
    }).listen(Number(values.port), '127.0.0.1', () => console.log('Array comparison: http://127.0.0.1:' + values.port + '/test/array-dispatch-browser.html'));
} else {
    if (!global.gc) throw Error('Run with --expose-gc');
    const baseline = await loadBaseline();
    const report = { provenance, policy: profilePolicy, environment: { date: new Date().toISOString(), runtime: process.version,
        platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model, canvas: profileSize,
        backend: 'counting mock Canvas; paired JS CPU, no GPU/FPS' } };
    report.speed = await compareArraySpeed(baseline.createArrayRenderer, createArrayRenderer, createProfileMock().context,
        { progress: text => console.log(text) });
    report.memory = { before: await memory(baseline.createArrayRenderer), after: await memory(createArrayRenderer) };
    if (values.output) await fs.writeFile(path.resolve(values.output), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ memory: report.memory, completed: report.speed.length }));
}
