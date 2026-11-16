import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { createArrayTrace, createArrayPlayer } from '@grundyjs/algiviz/array';
import { createArrayRenderer } from '@grundyjs/algiviz/canvas';
import { Player } from '@grundyjs/algiviz/player';
import { dom, control } from './player-test-dom.mjs';

const scripts = {};
for (const mode of ['player', 'manual']) {
    const html = await readFile(new URL(`../examples/minimum-${mode}.html`, import.meta.url), 'utf8');
    scripts[mode] = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import[^\n]*\n/gm, '');
}
scripts.main = (await readFile(new URL('../examples/getting-started.mjs', import.meta.url), 'utf8')).replace(/^import[^\n]*\n/gm, '');
for (const language of ['en', 'ru']) {
    const doc = await readFile(new URL(`../docs/${language === 'ru' ? 'ru/' : ''}getting-started.md`, import.meta.url), 'utf8');
    scripts[language] = doc.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import[^\n]*\n/gm, '');
}

function mount(mode, values) {
    const env = dom(), container = env.container(), canvas = env.doc.createElement('canvas');
    canvas.width = 720; canvas.height = 300;
    const rectangles = [], output = env.doc.createElement('p'), next = env.doc.createElement('button');
    const ctx = { canvas, save() {}, restore() {}, setTransform() {}, clearRect() {},
        fillRect() { rectangles.push(this.fillStyle); }, fillText() {} };
    canvas.getContext = () => ctx; container.append(canvas); output.textContent = 'Press Start';
    container.querySelector = selector => { assert.equal(selector, 'canvas'); return canvas; };
    env.doc.querySelector = selector => ({ '#player': container, '#result': output, '#next': next })[selector];
    let player;
    class ObservedPlayer extends Player { constructor(...args) { super(...args); player = this; } }
    const source = runInNewContext(scripts[mode] + '\ntypeof minimum === "function" ? minimum : undefined', {
        document: env.doc, window: env.view, Player: ObservedPlayer,
        createArrayTrace: supplied => createArrayTrace(values ?? supplied),
        createArrayPlayer(...args) { return player = createArrayPlayer(...args); }, createArrayRenderer,
    });
    return { env, container, canvas, output, next, rectangles, get player() { return player; }, source,
        advance() {
            if (mode !== 'manual') control(container, 'next').emit('click'); else next.onclick();
        },
        async dispose() { player.dispose(); await player.closed; },
    };
}

test('main minimum quickstart: standard controls, result reset and BFcache remount', async () => {
    const f = mount('main');
    try {
        assert.equal(f.output.textContent, 'Press Start'); assert.equal(f.player.status.phase, 'idle');
        control(f.container, 'start').emit('click');
        let count = 0;
        while (f.player.status.phase !== 'finished') { assert.ok(count++ < 20); f.advance(); }
        assert.equal(f.output.textContent, 'Minimum: 2');
        assert.ok(f.rectangles.includes('#047857'));
        f.rectangles.length = 0;
        control(f.container, 'restart').emit('click'); assert.equal(f.output.textContent, 'Searching…');
        assert.ok(!f.rectangles.includes('#047857'), 'Restart clears the final highlight');
        f.advance(); assert.equal(f.output.textContent, 'Searching…');
        const old = f.player; f.env.view.emit('pagehide'); await old.closed;
        assert.equal(old.status.phase, 'disposed');
        f.env.view.emit('pageshow', { persisted: true });
        assert.notEqual(f.player, old); assert.equal(f.player.status.phase, 'idle');
        assert.equal(f.output.textContent, 'Press Start'); assert.equal(f.player.frame, null);
    } finally { await f.dispose(); }
});

for (const mode of ['player', 'manual']) {
    test(`minimum ${mode}: one-pass comparisons, first equal minimum, immutable unchanged array`, async () => {
        const f = mount(mode);
        try {
            for (const values of [[5], [7, 3, 5, 2, 6], [3, 1, 1], [0, -3, 2], [1, 2, 3]]) {
                const original = [...values], steps = [...f.source(values)], final = steps.at(-1);
                assert.equal(f.output.textContent, values.length ? 'Minimum: ' + Math.min(...values) : 'No minimum: empty array');
                assert.equal(steps[0].event.type, 'start'); assert.equal(final.event.type, 'done');
                assert.equal(final.state.comparisons, Math.max(0, values.length - 1));
                assert.equal(final.state.writes, 0); assert.deepEqual(values, original);
                assert.deepEqual(final.state.slots.map(item => item.value), values);
                const highlighted = steps.filter(step => step.event.type === 'highlight').at(-1)?.event.itemIds[0];
                const index = final.state.slots.findIndex(item => item.id === highlighted);
                assert.equal(index, values.length ? values.indexOf(Math.min(...values)) : -1);
                assert.deepEqual(final.state.resultItemIds, [final.state.slots[index].id]);
                assert.ok(Object.isFrozen(final.state.resultItemIds));
                for (const step of steps) {
                    assert.ok(Object.isFrozen(step) && Object.isFrozen(step.state) && Object.isFrozen(step.state.slots));
                    assert.deepEqual(step.state.slots.map(item => item.id), final.state.slots.map(item => item.id));
                    assert.deepEqual(step.state.slots.map(item => item.value), values);
                    assert.equal(step.state.sortedPrefixLength, 0); assert.equal(step.state.sortedSuffixLength ?? 0, 0);
                }
            }
        } finally { await f.dispose(); }
    });

    test(`minimum ${mode}: explicit result survives done and normal completion`, async () => {
        const f = mount(mode);
        try {
            if (mode === 'player') {
                assert.equal(f.player.status.phase, 'idle'); assert.equal(f.player.frame, null);
                control(f.container, 'start').emit('click');
            }
            assert.equal(f.output.textContent, 'Searching…');
            let reads = 0;
            while (mode === 'player' ? f.player.status.phase !== 'finished' : !f.player.finished) {
                assert.ok(reads++ < 20);
                f.rectangles.length = 0; f.advance();
                const frame = f.player.frame;
                const event = frame.event;
                if (event.type === 'done') {
                    assert.equal(f.output.textContent, 'Minimum: 2');
                    assert.deepEqual(f.rectangles.filter(color => ['#475569', '#047857', '#b45309'].includes(color)),
                        ['#475569', '#475569', '#475569', '#047857', '#475569'], 'Only the minimum bar is green');
                } else {
                    assert.equal(f.output.textContent, 'Searching…');
                    assert.ok(!f.rectangles.includes('#047857'), 'Green is reserved for the final minimum');
                }
            }
            assert.equal(f.output.textContent, 'Minimum: 2');
            if (mode === 'manual') assert.equal(f.next.disabled, true);
            else {
                assert.equal(reads, 10, 'Widget finishes on done without an EOF click');
                f.rectangles.length = 0;
                control(f.container, 'restart').emit('click');
                assert.equal(f.output.textContent, 'Searching…');
                assert.ok(!f.rectangles.includes('#047857'));
                f.advance(); assert.equal(f.output.textContent, 'Searching…');
            }
        } finally { await f.dispose(); }
    });

    for (const values of [[5]]) test(`minimum ${mode}: visible result for one item`, async () => {
        const f = mount(mode, values);
        try {
            if (mode === 'player') f.player.start();
            let count = 0;
            while (mode === 'player' ? f.player.status.phase !== 'finished' : !f.player.finished) {
                assert.ok(count++ < 5); f.rectangles.length = 0; f.advance();
            }
            assert.equal(f.output.textContent, values.length ? 'Minimum: 5' : 'No minimum: empty array');
            assert.equal(f.rectangles.filter(color => color === '#047857').length, values.length ? 1 : 0);
        } finally { await f.dispose(); }
    });

    test(`minimum ${mode}: pagehide disposes early and preserves the visible answer`, async () => {
        const f = mount(mode);
        if (mode === 'player') f.player.start();
        f.advance(); const before = f.output.textContent;
        f.env.view.emit('pagehide'); await f.player.closed;
        assert.equal(f.output.textContent, before); f.player.dispose();
        if (mode === 'player') assert.equal(f.player.status.phase, 'disposed');
        else assert.throws(() => f.player.nextStep(), /disposed/);
    });
}

for (const language of ['en', 'ru']) test(`copied ${language} quickstart: direct frames, terminal completion, Restart and dispose`, async () => {
    const f = mount(language);
    try {
        f.player.start(); let commands = 0;
        while (f.player.status.phase !== 'finished') { assert.ok(commands++ < 20); f.rectangles.length = 0; f.advance(); }
        assert.equal(commands, 10); assert.equal(f.output.textContent, 'Minimum: 2');
        assert.equal(f.player.frame.event.type, 'done'); assert.equal(f.player.frame.current.comparisons, 4);
        assert.equal(f.rectangles.filter(color => color === '#047857').length, 1);
        f.rectangles.length = 0; f.player.restart(); assert.equal(f.output.textContent, 'Searching…');
        assert.ok(!f.rectangles.includes('#047857'));
    } finally { await f.dispose(); }
});
