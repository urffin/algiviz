import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { createStateController } from '../dist/player/controller.js';

const { values } = parseArgs({ options: { output: { type: 'string' } } });
if (!global.gc) throw Error('Run with --expose-gc');
const collect = async () => { for (let i = 0; i < 3; i++) { await new Promise(resolve => setImmediate(resolve)); global.gc(); } };
function* source(counter) {
    try { for (let i = 0; ; i++) yield Object.freeze({ index: i, payload: Object.freeze(Array(16).fill(i)) }); }
    finally { counter.closed++; }
}
function feed(ui, capacity) {
    const old = [], active = [];
    for (let i = 0; i < 2500; i++) {
        ui.next(); const value = ui.frame.current;
        if (i < 8) old.push(new WeakRef(value));
        if (i >= 2500 - capacity) active.push(new WeakRef(value));
        if (i % 31 === 0) { ui.previous(); ui.next(); }
    }
    return { old, active };
}
const sourceHashes = {};
for (const file of ['src/player/rewind-session.ts', 'src/player/controller.ts', 'src/playback/rewind-buffer.ts'])
    sourceHashes[file] = createHash('sha256').update(await fs.readFile(file)).digest('hex');
const report = { environment: { date: new Date().toISOString(), node: process.version, sourceHashes,
    harnessSha256: createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex') },
    policy: { values: 10000, forcedGcPasses: 3, samples: 4, note: 'Sampled WeakRefs and whole-process heap, not portable heap thresholds.' }, cases: [] };
for (const capacity of [3, 64]) {
    const counter = { closed: 0 };
    let sourceRef;
    let ui = createStateController({ rewindCapacity: capacity, render() {}, source() {
        const iterator = source(counter); sourceRef = new WeakRef(iterator); return iterator;
    } });
    ui.start(); let refs;
    const samples = [];
    for (let i = 0; i < 4; i++) {
        refs = feed(ui, capacity); await collect();
        const oldAlive = refs.old.filter(ref => ref.deref() !== undefined).length;
        const activeAlive = refs.active.filter(ref => ref.deref() !== undefined).length;
        assert.equal(oldAlive, 0); assert.equal(activeAlive, capacity);
        samples.push({ position: ui.frame.stepIndex, oldAlive, activeAlive, heapBytes: process.memoryUsage().heapUsed });
    }
    ui.previous(); ui.dispose(); await collect();
    const afterDisposeAlive = refs.active.filter(ref => ref.deref() !== undefined).length;
    assert.equal(afterDisposeAlive, 1); assert.equal(sourceRef.deref(), undefined); assert.equal(counter.closed, 1);
    ui = null; await collect();
    const afterDropAlive = refs.active.filter(ref => ref.deref() !== undefined).length;
    assert.equal(afterDropAlive, 0);
    report.cases.push({ capacity, samples, afterDisposeAlive, sourceReleased: true, closed: counter.closed, afterDropAlive });
}
if (values.output) await fs.writeFile(values.output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
