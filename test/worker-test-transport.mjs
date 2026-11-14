import { exposeWorkerSource } from '@grundyjs/algiviz/worker/runtime';

export const turn = () => new Promise(resolve => setImmediate(resolve));
export function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
export function controller() {
    let aborted = false, reason;
    const listeners = new Set();
    return {
        signal: { get aborted() { return aborted; }, get reason() { return reason; }, subscribe(listener) {
            if (aborted) { listener(reason); return () => {}; }
            listeners.add(listener); return () => listeners.delete(listener);
        } },
        abort(value) { if (aborted) return; aborted = true; reason = value; for (const listener of [...listeners]) listener(value); listeners.clear(); },
        get listeners() { return listeners.size; },
    };
}

export function transport(source, options = {}) {
    const hostListeners = new Map(), workerListeners = new Map(), sent = [], replies = [];
    let dead = false, terminations = 0;
    const add = (map, type, fn) => { if (!map.has(type)) map.set(type, new Set()); map.get(type).add(fn); };
    const emit = (map, type, event) => { for (const listener of [...(map.get(type) ?? [])]) listener(event); };
    const send = (map, type, event) => queueMicrotask(() => { if (!dead) emit(map, type, event); });
    const worker = {
        addEventListener(type, fn) { add(hostListeners, type, fn); },
        removeEventListener(type, fn) {
            if (options.removeHostThrows) throw options.removeHostThrows;
            hostListeners.get(type)?.delete(fn);
        },
        postMessage(value, transfer = []) {
            if (options.postThrows) throw options.postThrows;
            const cloned = structuredClone(value, { transfer }); sent.push(cloned);
            if (options.hostMessages !== false) send(workerListeners, 'message', { data: cloned });
        },
        terminate() {
            terminations++;
            if (options.terminateThrows) throw options.terminateThrows;
            dead = true; workerListeners.clear();
        },
    };
    const scope = {
        addEventListener(type, fn) { add(workerListeners, type, fn); },
        removeEventListener(type, fn) {
            if (options.removeWorkerThrows) throw options.removeWorkerThrows;
            workerListeners.get(type)?.delete(fn);
        },
        postMessage(value, transfer = []) {
            const cloned = structuredClone(value, { transfer }); replies.push(cloned);
            if (options.workerMessages !== false) send(hostListeners, 'message', { data: cloned });
        },
    };
    if (options.endpoint !== false) exposeWorkerSource({ scope, source, transfer: options.transfer });
    return {
        worker, scope, sent, replies, get terminations() { return terminations; }, get dead() { return dead; },
        get hostListeners() { return [...hostListeners.values()].reduce((n, set) => n + set.size, 0); },
        get workerListeners() { return [...workerListeners.values()].reduce((n, set) => n + set.size, 0); },
        host(value) { send(workerListeners, 'message', { data: structuredClone(value) }); },
        reply(value) { send(hostListeners, 'message', { data: structuredClone(value) }); },
        error(message = 'Worker crashed') { send(hostListeners, 'error', { message }); },
        messageError() { send(hostListeners, 'messageerror', {}); },
    };
}

export function fakeClock() {
    const original = Object.fromEntries(['setTimeout', 'clearTimeout', 'performance'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const tasks = new Map(); let time = 0, sequence = 0;
    Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => time } });
    globalThis.setTimeout = (fn, delay) => { const id = ++sequence; tasks.set(id, { at: time + delay, fn, delay }); return id; };
    globalThis.clearTimeout = id => tasks.delete(id);
    return {
        get count() { return tasks.size; }, get delays() { return [...tasks.values()].map(t => t.delay); },
        advance(amount) {
            const target = time + amount;
            while (true) {
                const first = [...tasks].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
                if (!first) break;
                tasks.delete(first[0]); time = first[1].at; first[1].fn();
            }
            time = target;
        },
        restore() { for (const [key, descriptor] of Object.entries(original)) Object.defineProperty(globalThis, key, descriptor); },
    };
}
