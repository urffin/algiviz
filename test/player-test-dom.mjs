/** Minimal public-widget host; native browser checks cover actual DOM interaction. */
export function clock() {
    let next = 0; const callbacks = new Map();
    return { request(fn) { callbacks.set(++next, fn); return next; }, cancel(id) { callbacks.delete(id); },
        tick(now) { const pending = [...callbacks.values()]; callbacks.clear(); for (const fn of pending) fn(now); },
        get size() { return callbacks.size; } };
}
class Hub {
    listeners = new Map();
    addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn); }
    removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
    emit(name, event = {}) { for (const fn of [...(this.listeners.get(name) ?? [])]) fn(event); }
    get listenerCount() { return [...this.listeners.values()].reduce((n, set) => n + set.size, 0); }
}
class Element extends Hub {
    children = []; dataset = {}; attributes = new Map(); style = { setProperty(name, value) { this[name] = value; } };
    constructor(ownerDocument, tag) { super(); this.ownerDocument = ownerDocument; this.tag = tag; }
    get parentNode() { return this.parent ?? null; }
    contains(child) { return child === this || this.children.some(value => typeof value === 'object' && value.contains(child)); }
    matches(selector) { return selector === ':focus-visible' && !!this.focusVisible; }
    append(...children) { for (const child of children) { if (typeof child === 'object') { child.remove(); child.parent = this; } this.children.push(child); } }
    insertBefore(child, before) {
        if (before !== null && !this.children.includes(before)) throw new Error('Missing reference child');
        child.remove(); child.parent = this;
        this.children.splice(before === null ? this.children.length : this.children.indexOf(before), 0, child);
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
}
export function dom() {
    const scheduler = clock(), doc = new Hub(), view = new Hub(), media = new Hub(), timers = new Map();
    let timerId = 0;
    doc.hidden = false; media.matches = false; doc.defaultView = view;
    doc.createElement = tag => new Element(doc, tag); doc.createElementNS = (_, tag) => new Element(doc, tag); view.matchMedia = () => media;
    view.requestAnimationFrame = fn => scheduler.request(fn); view.cancelAnimationFrame = id => scheduler.cancel(id);
    view.setTimeout = (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; };
    view.clearTimeout = id => timers.delete(id);
    return { doc, view, media, scheduler, timers,
        expireTimers() { const pending = [...timers.values()]; timers.clear(); for (const timer of pending) timer.fn(); },
        container: () => doc.createElement('section') };
}
export const shell = container => container.children.find(child => child.className === 'algiviz-player');
export const panel = container => shell(container).children.find(child => child.dataset?.role === 'controls');
export const control = (container, action) => panel(container).children.find(child => child.dataset?.action === action);
export const waitingLabel = container => panel(container).children.find(child => child.dataset?.role === 'waiting');
