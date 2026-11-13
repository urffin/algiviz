import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createArrayRenderer } from '@grundyjs/algiviz/canvas';
import { loadBaseline } from '../scripts/array-dispatch-baseline.mjs';
import { arrayDispatchChecks, arrayDispatchWorkloads } from './array-dispatch-workloads.mjs';
import { prepareProfile } from './profile-workloads.mjs';

const baseline = await loadBaseline();
function recording() {
    const commands = [], stack = [];
    const target = { canvas: { width: 800, height: 450 } };
    const ctx = new Proxy(target, {
        get(t, key) {
            if (key in t) return t[key];
            return (...args) => {
                commands.push(['call', key, ...args]);
                if (key === 'save') stack.push({ ...t });
                if (key === 'restore') {
                    const saved = stack.pop();
                    for (const k of Object.keys(t)) if (!(k in saved)) delete t[k];
                    Object.assign(t, saved);
                }
            };
        },
        set(t, key, value) { commands.push(['set', key, value]); t[key] = value; return true; }
    });
    return { ctx, commands, stack };
}

test('reused dispatcher matches pre-change commands across full real windows and synthetic edge cases', () => {
    const checks = [...arrayDispatchChecks(), ...arrayDispatchWorkloads.flatMap(w => prepareProfile(w).frames.map(frame =>
        ({ frame, width: 960, height: 540 })))];
    const saved = JSON.stringify(checks);
    for (const options of [{ theme: 'dark' }, { theme: 'light' }, { theme: 'dark', colors: {
        background: '#123456', bar: '#345678', text: '#abcdef', active: '#aabbcc', held: '#112233', sorted: '#778899' } }]) {
        const old = baseline.createArrayRenderer(options), current = createArrayRenderer(options);
        const contexts = [recording(), recording()], expected = [recording(), recording()];
        for (let i = 0; i < checks.length; i++) {
            const { frame, width, height } = checks[i], a = contexts[i % 2], b = expected[i % 2];
            a.ctx.canvas.width = b.ctx.canvas.width = width; a.ctx.canvas.height = b.ctx.canvas.height = height;
            a.commands.length = b.commands.length = 0;
            old.render(b.ctx, frame); current.render(a.ctx, frame);
            assert.deepEqual(a.commands, b.commands, `frame ${i}, ${options.theme}`);
            assert.equal(a.stack.length, 0);
        }
    }
    assert.equal(JSON.stringify(checks), saved);
});

test('nested render on another context cannot replace outer frame inputs', () => {
    const checks = arrayDispatchChecks(), outer = checks[2].frame, inner = checks[30].frame;
    const renderer = createArrayRenderer({ theme: 'dark' }), actual = recording(), expected = recording(), nested = recording();
    const wrapped = new Proxy(actual.ctx, { get(target, key) {
        if (key !== 'fillRect') return target[key];
        return (...args) => {
            target.fillRect(...args);
            if (args[0] !== 0) renderer.render(nested.ctx, inner);
        };
    } });
    renderer.render(wrapped, outer);
    baseline.createArrayRenderer({ theme: 'dark' }).render(expected.ctx, outer);
    assert.deepEqual(actual.commands, expected.commands);
    actual.commands.length = expected.commands.length = 0;
    renderer.render(actual.ctx, outer);
    baseline.createArrayRenderer({ theme: 'dark' }).render(expected.ctx, outer);
    assert.deepEqual(actual.commands, expected.commands);
});

test('cached pair remains correct after a bar draw fails and another renderer runs', () => {
    const frame = arrayDispatchChecks()[2].frame;
    const renderer = createArrayRenderer({ theme: 'dark' }), failed = recording();
    const error = new Error('bar failed'); let rects = 0;
    const wrapped = new Proxy(failed.ctx, { get(target, key) {
        return key === 'fillRect' ? (...args) => { target.fillRect(...args); if (++rects === 2) throw error; } : target[key];
    } });
    assert.throws(() => renderer.render(wrapped, frame), e => e === error);
    assert.equal(failed.stack.length, 0);
    createArrayRenderer({ theme: 'light' }).render(recording().ctx, frame);
    const actual = recording(), expected = recording();
    renderer.render(actual.ctx, frame); baseline.createArrayRenderer({ theme: 'dark' }).render(expected.ctx, frame);
    assert.deepEqual(actual.commands, expected.commands);
});
