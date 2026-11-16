import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { inspectData } from '../dist/worker/data.js';

test('wire graph inspection rejects foreign-realm shared Memory without relying on instanceof', () => {
    const memory = runInNewContext('new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true })');
    assert.equal(memory instanceof WebAssembly.Memory, false);
    assert.throws(() => inspectData(new Map([[memory, new Set([memory])]])), TypeError);
});

test('Memory brand inspection does not invoke a fake buffer getter or reject a spoofed plain object', () => {
    let reads = 0;
    const fake = { [Symbol.toStringTag]: 'WebAssembly.Memory', get buffer() { reads++; throw new Error('Unexpected accessor'); } };
    // Real wire graphs are already cloned. Symbol tags and source accessors
    // are not a trustworthy brand test; a plain cloned object remains valid.
    const ordinary = { [Symbol.toStringTag]: 'WebAssembly.Memory', buffer: new ArrayBuffer(2) };
    assert.equal(inspectData(ordinary).size, 1);
    assert.throws(() => inspectData(fake), TypeError);
    assert.equal(reads, 0);
});

test('Memory inspection works without a SharedArrayBuffer constructor and imports without WebAssembly', async () => {
    const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
    const shared = Object.getOwnPropertyDescriptor(globalThis, 'SharedArrayBuffer');
    const wasm = Object.getOwnPropertyDescriptor(globalThis, 'WebAssembly');
    try {
        Object.defineProperty(globalThis, 'SharedArrayBuffer', { configurable: true, value: undefined });
        const withoutShared = await import('../dist/worker/data.js?without-shared-constructor');
        assert.throws(() => withoutShared.inspectData(memory), TypeError);
        Object.defineProperty(globalThis, 'WebAssembly', { configurable: true, value: undefined });
        const withoutWasm = await import('../dist/worker/data.js?without-webassembly');
        assert.equal(withoutWasm.inspectData({ buffer: new ArrayBuffer(2) }).size, 1);
    } finally {
        Object.defineProperty(globalThis, 'SharedArrayBuffer', shared);
        Object.defineProperty(globalThis, 'WebAssembly', wasm);
    }
});

test('F2 intrinsic buffer branding rejects shared storage without SharedArrayBuffer or WebAssembly constructors', async () => {
    const shared = Object.getOwnPropertyDescriptor(globalThis, 'SharedArrayBuffer');
    const wasm = Object.getOwnPropertyDescriptor(globalThis, 'WebAssembly');
    const NativeShared = SharedArrayBuffer;
    const values = [new NativeShared(0), new NativeShared(4), new Uint8Array(new NativeShared(4)), new DataView(new NativeShared(4)),
        runInNewContext('new SharedArrayBuffer(4)'), runInNewContext('new DataView(new SharedArrayBuffer(4))')];
    try {
        Object.defineProperty(globalThis, 'SharedArrayBuffer', { configurable: true, value: undefined });
        Object.defineProperty(globalThis, 'WebAssembly', { configurable: true, value: undefined });
        const module = await import('../dist/worker/data.js?f2-no-shared-or-wasm');
        for (const value of values) assert.throws(() => module.inspectData(value), TypeError);
        const graph = new Map(); graph.set(graph, new Set([new Error('shared', { cause: { value: values[1] } })]));
        assert.throws(() => module.inspectData(graph), TypeError);
        const ordinary = new ArrayBuffer(0);
        assert.equal(module.inspectData({ ordinary, view: new DataView(ordinary) }).size, 1);
    } finally {
        Object.defineProperty(globalThis, 'SharedArrayBuffer', shared);
        Object.defineProperty(globalThis, 'WebAssembly', wasm);
    }
});

test('F2 fallback neither trusts tags/prototypes nor invokes fake buffer accessors or conversion hooks', async () => {
    const shared = Object.getOwnPropertyDescriptor(globalThis, 'SharedArrayBuffer');
    const prototype = SharedArrayBuffer.prototype;
    try {
        Object.defineProperty(globalThis, 'SharedArrayBuffer', { configurable: true, value: undefined });
        const module = await import('../dist/worker/data.js?f2-branding');
        let reads = 0;
        const trap = () => { reads++; throw new Error('Unexpected application code'); };
        const fake = Object.assign(Object.create({ [Symbol.toPrimitive]: trap, valueOf: trap, toString: trap }),
            { [Symbol.toStringTag]: 'SharedArrayBuffer', buffer: new ArrayBuffer(2), byteLength: 2 });
        assert.equal(module.inspectData(fake).size, 1);
        assert.equal(module.inspectData(Object.create(prototype)).size, 0);
        const getter = { get buffer() { return trap(); } };
        assert.throws(() => module.inspectData(getter), TypeError);
        assert.equal(reads, 0);
    } finally { Object.defineProperty(globalThis, 'SharedArrayBuffer', shared); }
});

test('F2 fallback captures native DataView and does not allocate a Memory during import or validation', async () => {
    const shared = Object.getOwnPropertyDescriptor(globalThis, 'SharedArrayBuffer');
    const nativeView = Object.getOwnPropertyDescriptor(globalThis, 'DataView');
    const nativeMemory = Object.getOwnPropertyDescriptor(WebAssembly, 'Memory');
    const buffer = new SharedArrayBuffer(4); let allocations = 0;
    try {
        Object.defineProperty(globalThis, 'SharedArrayBuffer', { configurable: true, value: undefined });
        Object.defineProperty(WebAssembly, 'Memory', { configurable: true, value: new Proxy(nativeMemory.value, {
            construct() { allocations++; throw new Error('Must not allocate a shared Memory'); },
        }) });
        const module = await import('../dist/worker/data.js?f2-no-memory-allocation');
        assert.equal(allocations, 0);
        Object.defineProperty(globalThis, 'DataView', { configurable: true, value: function () { throw new Error('Use captured intrinsic'); } });
        assert.throws(() => module.inspectData(buffer), TypeError);
        assert.equal(module.inspectData(new ArrayBuffer(4)).size, 1); assert.equal(allocations, 0);
    } finally {
        Object.defineProperty(globalThis, 'SharedArrayBuffer', shared);
        Object.defineProperty(globalThis, 'DataView', nativeView);
        Object.defineProperty(WebAssembly, 'Memory', nativeMemory);
    }
});
