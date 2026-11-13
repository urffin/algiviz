import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { createRewindBuffer } from '@grundyjs/algiviz/playback';

const { values } = parseArgs({ options: { output: { type: 'string' } } });
if (!global.gc) throw Error('Run with --expose-gc');
const collect = async () => {
    for (let i = 0; i < 3; i++) { await new Promise(resolve => setImmediate(resolve)); global.gc(); }
};
function* source(counter) {
    try { for (let i = 0; ; i++) yield Object.freeze({ index: i, payload: Object.freeze(Array(16).fill(i)) }); }
    finally { counter.closed++; }
}
function feed(buffer, capacity) {
    const old = [], active = [];
    for (let i = 0; i < 2500; i++) {
        const value = buffer.next();
        if (i < 8) old.push(new WeakRef(value));
        if (i >= 2500 - capacity) active.push(new WeakRef(value));
    }
    return { old, active };
}
const report = { environment: { date: new Date().toISOString(), node: process.version, platform: process.platform,
    cpu: os.cpus()[0]?.model,
    sourceSha256: createHash('sha256').update(await fs.readFile('src/playback/rewind-buffer.ts')).digest('hex'),
    harnessSha256: createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex') },
    policy: { batches: 4, valuesPerBatch: 2500, forcedGcPasses: 3, oldWeakRefsPerBatch: 8,
        note: 'Diagnostic whole-process heap and sampled WeakRefs, not portable heap thresholds.' }, cases: [] };
for (const capacity of [3, 64]) {
    const counter = { closed: 0 };
    let iterator = source(counter);
    const sourceRef = new WeakRef(iterator);
    let buffer = createRewindBuffer(iterator, { capacity }), refs;
    iterator = null;
    const samples = [];
    for (let batch = 1; batch <= 4; batch++) {
        refs = feed(buffer, capacity); await collect();
        const oldAlive = refs.old.filter(ref => ref.deref() !== undefined).length;
        const activeAlive = refs.active.filter(ref => ref.deref() !== undefined).length;
        assert.equal(oldAlive, 0); assert.equal(activeAlive, capacity);
        samples.push({ sourcePosition: buffer.endPosition, heapBytes: process.memoryUsage().heapUsed, oldAlive, activeAlive });
    }
    // Disposal while rewound must release both older and newer buffered values.
    buffer.previous(); buffer.dispose(); await collect();
    const afterDisposeAlive = refs.active.filter(ref => ref.deref() !== undefined).length;
    const sourceAlive = sourceRef.deref() !== undefined;
    assert.equal(afterDisposeAlive, 1); assert.equal(sourceAlive, false); assert.equal(counter.closed, 1);
    buffer = null; await collect();
    const afterDropAlive = refs.active.filter(ref => ref.deref() !== undefined).length;
    assert.equal(afterDropAlive, 0);
    report.cases.push({ capacity, samples, afterDisposeAlive, sourceAlive, sourceCloseCalls: counter.closed, afterDropAlive });
}
if (values.output) await fs.writeFile(values.output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
