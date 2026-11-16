import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const context = process.env.ALGIVIZ_F2_CONTEXT;
if (!context) {
    // Public module graphs must be cold when the optional globals disappear.
    // Child processes isolate intrinsic captures from other tests and each other.
    for (const mode of ['visible', 'hidden', 'hidden-no-wasm']) test(`F2 public package in a fresh ${mode} context`, t => {
        const environment = { ...process.env, ALGIVIZ_F2_CONTEXT: mode };
        delete environment.NODE_TEST_CONTEXT;
        const output = execFileSync(process.execPath,
            ['--unhandled-rejections=strict', '--test', '--test-reporter=tap', fileURLToPath(import.meta.url)], {
                cwd: dirname(fileURLToPath(import.meta.url)), encoding: 'utf8',
                env: environment,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        const counts = output.match(/# tests (\d+)\r?\n# suites \d+\r?\n# pass (\d+)\r?\n# fail 0/);
        assert.ok(counts, output); assert.equal(counts[1], counts[2]);
        t.diagnostic(`${mode}: ${counts[1]} isolated public cases passed`);
    });
} else {
    assert.ok(['visible', 'hidden', 'hidden-no-wasm'].includes(context));
    const NativeShared = globalThis.SharedArrayBuffer, NativeMemory = WebAssembly.Memory;
    if (context !== 'visible') Object.defineProperty(globalThis, 'SharedArrayBuffer', { configurable: true, value: undefined });
    if (context === 'hidden-no-wasm') Object.defineProperty(globalThis, 'WebAssembly', { configurable: true, value: undefined });
    const { createAsyncSource } = await import('@grundyjs/algiviz/playback');
    const { createWorkerSourceFactory, WorkerSourceError } = await import('@grundyjs/algiviz/worker');
    const { transport, turn } = await import('./worker-test-transport.mjs');

    const shared = () => new NativeShared(4);
    const memory = () => new NativeMemory({ initial: 1, maximum: 1, shared: true });
    const shapes = [
        ['buffer', shared], ['empty buffer', () => new NativeShared(0)],
        ['Uint8Array', () => new Uint8Array(shared())], ['DataView', () => new DataView(shared())],
        ['nested Map', () => new Map([['payload', { view: new Uint8Array(shared()) }]])],
        ['cyclic Map/Set/Error', () => { const graph = new Map(); graph.set(graph, new Set([new Error('shared', { cause: [shared()] })])); return graph; }],
        ['Error cause', () => new Error('shared', { cause: { buffer: shared() } })],
        ['foreign buffer', () => runInNewContext('new SharedArrayBuffer(4)')],
        ['foreign view', () => runInNewContext('new DataView(new SharedArrayBuffer(4))')],
        ['Memory buffer', () => memory().buffer], ['Memory view', () => new Uint8Array(memory().buffer)],
    ];
    if (context !== 'hidden-no-wasm') shapes.push(['Memory object (F1)', memory]);

    function setup(source, input = null, options = {}) {
        const f = { acquisitions: 0, reads: 0, returns: 0 };
        const factory = createWorkerSourceFactory({ worker() {
            const link = f.link = transport((value, signal) => {
                f.acquisitions++; return source(value, signal, f);
            }, { transfer: options.transfer });
            options.patch?.(link); return link.worker;
        }, input: () => input, shutdown: { gracePeriodMs: 10 } });
        f.adapter = createAsyncSource(signal => (f.session = factory(signal)));
        f.close = async () => { f.adapter.dispose(); await f.adapter.closed; await f.session?.closed; };
        return f;
    }
    async function serialization(f, origin) {
        let primary;
        await assert.rejects(f.adapter.next(), error => {
            primary = error;
            return error instanceof WorkerSourceError && error.code === 'serialization' && error.phase === 'serialize' && error.origin === origin;
        });
        const outer = await f.adapter.closed, report = await f.session.closed;
        assert.equal(outer.kind, 'failed'); assert.equal(outer.error, primary); assert.deepEqual(outer.cleanupErrors, []);
        assert.equal(report.kind, 'failed'); assert.equal(report.error, primary); assert.equal(report.origin, origin);
        assert.equal(report.phase, 'serialize'); assert.equal(report.cleanup.count, 0);
        await assert.rejects(f.adapter.next(), error => error === primary);
        assert.equal(f.link.terminations, 1); assert.equal(f.link.hostListeners, 0); assert.equal(f.link.workerListeners, 0);
    }

    for (const [shape, make] of shapes) for (const direction of ['input', 'state']) {
        test(`F2 ${context}: reject ${shape} in ${direction} before data posting`, async () => {
            const payload = make();
            const f = setup(function* (input) { f.reads++; try { yield direction === 'input' ? input : payload; } finally { f.returns++; } }, direction === 'input' ? payload : null);
            try {
                await serialization(f, direction === 'input' ? 'host' : 'worker');
                if (direction === 'input') { assert.equal(f.acquisitions, 0); assert.equal(f.link.sent.some(packet => packet.type === 'init'), false); }
                else { assert.equal(f.reads, 1); assert.equal(f.returns, 1); assert.equal(f.link.replies.some(packet => packet.type === 'value'), false); }
            } finally { await f.close(); }
        });
    }

    for (const [shape, make] of shapes.slice(0, 6)) for (const direction of ['input', 'state']) {
        test(`F2 ${context}: receiver rejects injected ${shape} ${direction} even if sender validation is bypassed`, async () => {
            const payload = make();
            const f = setup(function* (input) { try { yield input; } finally { f.returns++; } }, { ordinary: true }, { patch(link) {
                const target = direction === 'input' ? link.worker : link.scope;
                const original = target.postMessage;
                target.postMessage = (packet, list) => original(direction === 'input' && packet.type === 'init'
                    ? { ...packet, input: payload } : direction === 'state' && packet.type === 'value' ? { ...packet, value: payload } : packet, list);
            } });
            try {
                await serialization(f, direction === 'input' ? 'worker' : 'host');
                assert.equal(f.link.terminations, 1);
            } finally { await f.close(); }
        });
    }

    test(`F2 ${context}: a rejected later state preserves an earlier transferred snapshot and closes once`, async () => {
        const buffer = new Uint8Array([7, 8]).buffer;
        const f = setup(function* () {
            try { f.reads++; yield { buffer }; f.reads++; yield new Map([['shared', new DataView(shared())]]); }
            finally { f.returns++; }
        }, null, { transfer: state => state.buffer ? [state.buffer] : [] });
        try {
            const first = await f.adapter.next(); assert.equal(first.kind, 'value'); assert.equal(buffer.byteLength, 0);
            await serialization(f, 'worker'); assert.deepEqual([...new Uint8Array(first.value.buffer)], [7, 8]);
            assert.equal(f.reads, 2); assert.equal(f.returns, 1);
        } finally { await f.close(); }
    });

    for (const transfer of [false, true]) test(`F2 ${context}: ordinary input/state graphs still ${transfer ? 'transfer' : 'copy'} buffers`, async () => {
        const original = new Uint8Array([2, 4, 6]).buffer, empty = new ArrayBuffer(0);
        const input = { original, view: new Uint8Array(original), empty, nested: new Map([['error', new Error('ordinary', { cause: original })]]),
            fake: { [Symbol.toStringTag]: 'SharedArrayBuffer', byteLength: 4 } };
        const f = setup(function* (value) { yield value; }, input, { transfer: value => transfer ? [value.original, value.empty] : [] });
        try {
            const first = await f.adapter.next(); assert.equal(first.kind, 'value');
            assert.deepEqual([...new Uint8Array(first.value.original)], [2, 4, 6]);
            assert.equal(first.value.view.buffer, first.value.original); assert.equal(first.value.nested.get('error').cause, first.value.original);
            assert.equal(first.value.empty.byteLength, 0); assert.equal(first.value.fake.byteLength, 4);
            assert.deepEqual([...new Uint8Array(original)], [2, 4, 6]); // Initialization is copy-only.
            assert.deepEqual(await f.adapter.next(), { kind: 'done' });
            assert.equal((await f.session.closed).kind, 'completed'); assert.equal(f.link.terminations, 1);
        } finally { await f.close(); }
    });

    test(`F2 ${context}: shared transfer-list entries remain invalid without detaching ordinary source buffers`, async () => {
        const ordinary = new Uint8Array([11]).buffer;
        const f = setup(function* () { yield { ordinary, shared: shared() }; }, null, { transfer: value => [value.ordinary, value.shared] });
        try { await serialization(f, 'worker'); assert.equal(ordinary.byteLength, 1); assert.equal(new Uint8Array(ordinary)[0], 11); }
        finally { await f.close(); }
    });

    test(`F2 ${context}: importing/factory creation stays lazy and disposal before a read allocates no Worker`, async () => {
        let workers = 0;
        const factory = createWorkerSourceFactory({ worker() { workers++; throw new Error('Unexpected Worker'); }, input: () => null });
        const adapter = createAsyncSource(factory); assert.equal(workers, 0);
        adapter.dispose(); assert.equal((await adapter.closed).kind, 'disposed'); assert.equal(workers, 0); await turn();
    });
}
