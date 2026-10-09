import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoPlayer } from '../examples/demo-player.mjs';

test('shared demo controller preserves rejected sessions and closes replaced generators', () => {
    const ids = ['speed', 'mode', 'play', 'seek', 'restart', 'mode-note', 'previous', 'next', 'size'];
    const elements = Object.fromEntries(ids.map(id => [id, { value: id === 'speed' ? '1' : '', textContent: '' }]));
    const listeners = {};
    let callback, closed = 0, output, reject = false, error;
    const originals = Object.fromEntries(['document', 'window', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    Object.assign(globalThis, {
        document: { getElementById: id => elements[id], querySelector: selector => elements[selector.slice(1)], addEventListener: (name, fn) => { listeners[name] = fn; } },
        window: { addEventListener: (name, fn) => { listeners[name] = fn; } },
        matchMedia: () => ({ matches: false, addEventListener() {} }),
        requestAnimationFrame: fn => { callback = fn; return 1; }, cancelAnimationFrame: () => { callback = null; }
    });
    try {
        function* steps() { try { yield { index: 0, state: 0, event: 'start' }; yield { index: 1, state: 1, event: 'done' }; } finally { closed++; } }
        const demo = createDemoPlayer({ source: mode => { if (reject && mode === 'history') throw Error('limit'); return steps(); }, isTerminal: step => step.event === 'done', render: frame => { output = frame; }, onError: e => { error = e; } });
        demo.load(); elements.mode.value = 'generator'; elements.mode.onchange();
        assert.equal(elements.previous.disabled, true);
        const priorClosed = closed;
        reject = true; elements.mode.value = 'history'; elements.mode.onchange();
        assert.equal(error.message, 'limit'); assert.equal(demo.mode, 'generator'); assert.equal(closed, priorClosed);
        elements.next.onclick(); assert.equal(output.current, 1);
        elements.restart.onclick(); assert.equal(output.current, 0);
        elements.play.onclick(); callback(0); callback(100); assert.ok(output.progress > 0 && output.progress < 1);
        globalThis.document.hidden = true; listeners.visibilitychange(); assert.equal(callback, null); assert.equal(elements.play.textContent, 'Play');
        const beforeHide = closed; listeners.pagehide(); assert.equal(closed, beforeHide + 1);
        listeners.pageshow({ persisted: true }); assert.equal(output.current, 0);
        reject = false; elements.mode.value = 'history'; elements.mode.onchange();
        assert.equal(elements.previous.disabled, false);
        elements.next.onclick(); assert.equal(output.stepIndex, 1);
        elements.previous.onclick(); assert.equal(output.stepIndex, 0);
    } finally {
        for (const [key, descriptor] of Object.entries(originals)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    }
});
