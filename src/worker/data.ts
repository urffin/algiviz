const bufferLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!;
const sharedLength = typeof SharedArrayBuffer === 'undefined' ? undefined : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, 'byteLength')!.get!;
const typedBuffer = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), 'buffer')!.get!;
const dataBuffer = Object.getOwnPropertyDescriptor(DataView.prototype, 'buffer')!.get!;

function isShared(value: object): boolean {
    try { sharedLength?.call(value); return sharedLength !== undefined; } catch { return false; }
}
export function isBuffer(value: unknown): value is ArrayBuffer {
    try { bufferLength.call(value); return true; } catch { return false; }
}
function attached(value: ArrayBuffer) { new Uint8Array(value); }

/** Inspect the actual cloned wire graph, not getters on the original source. */
export function inspectData(value: unknown): Set<ArrayBuffer> {
    const seen = new Set<object>(), buffers = new Set<ArrayBuffer>(), pending = [value];
    while (pending.length) {
        const item = pending.pop();
        if (typeof item === 'function' || typeof item === 'symbol') throw new TypeError('Expected cloneable state data');
        if (item === null || typeof item !== 'object' || seen.has(item)) continue;
        seen.add(item);
        if (isShared(item)) throw new TypeError('Shared memory is not supported');
        if (isBuffer(item)) { attached(item); buffers.add(item); continue; }
        if (ArrayBuffer.isView(item)) {
            let buffer: unknown;
            try { buffer = dataBuffer.call(item); } catch { buffer = typedBuffer.call(item); }
            pending.push(buffer); continue;
        }
        if (item instanceof Map) { Map.prototype.forEach.call(item, (v: unknown, k: unknown) => { pending.push(k, v); }); continue; }
        if (item instanceof Set) { Set.prototype.forEach.call(item, (v: unknown) => { pending.push(v); }); continue; }
        for (const key of Reflect.ownKeys(item)) {
            const property = Object.getOwnPropertyDescriptor(item, key)!;
            if ('value' in property) pending.push(property.value);
            // V8 represents a cloned Error's lazy stack with an intrinsic
            // accessor. It cannot contain data references; cause still can.
            else if (!(item instanceof Error && key === 'stack')) throw new TypeError('Expected a cloned data graph');
        }
    }
    return buffers;
}

/** Snapshot accessors once. A preflight transfer may detach before a later failure. */
export function prepareData(value: unknown, transfer: readonly ArrayBuffer[] = []): { value: unknown; transfer: ArrayBuffer[] } {
    if (!Array.isArray(transfer)) throw new TypeError('Expected an ArrayBuffer transfer list');
    const list: ArrayBuffer[] = [], seen = new Set<ArrayBuffer>();
    for (const buffer of transfer) {
        if (!isBuffer(buffer) || seen.has(buffer)) throw new TypeError('Expected unique ArrayBuffers');
        attached(buffer); seen.add(buffer); list.push(buffer);
    }
    const cloned: { value: unknown; transfer: ArrayBuffer[] } = structuredClone({ value, transfer: list }, { transfer: list });
    const reachable = inspectData(cloned.value);
    for (const buffer of cloned.transfer) if (!reachable.has(buffer)) throw new TypeError('Transfer buffer is not reachable from the state');
    return cloned;
}
