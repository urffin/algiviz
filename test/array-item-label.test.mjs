import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createArrayTrace } from '@grundyjs/algiviz/array';
import { createArrayRenderer, createSortRenderer } from '@grundyjs/algiviz/canvas';
import { Player } from '@grundyjs/algiviz/player';
import { recording } from './graph-canvas-context.mjs';
import { dom } from './player-test-dom.mjs';

const startFrame = values => {
    const { state, event, index } = createArrayTrace(values).start();
    return { previous: state, current: state, event, stepIndex: index, progress: 1 };
};
const text = target => target.calls('fillText').map(call => call.args[0]);
const labels = target => Object.fromEntries(target.calls('fillText')
    .filter(call => call.args[0] === '2a' || call.args[0] === '2b')
    .map(call => [call.args[0], call.args[1]]));
function draw(renderer, frame, width = 400) {
    const target = recording(width, 220);
    renderer.render(target.ctx, frame);
    return target;
}

test('itemLabel preserves the default draw commands and can hide just the value', () => {
    const frame = startFrame([2, -2, 1]);
    const standard = draw(createArrayRenderer({ theme: 'dark' }), frame);
    assert.deepEqual(text(standard).slice(1, -1), ['2', '0', '-2', '1', '1', '2']);
    for (const itemLabel of [undefined, () => undefined]) {
        assert.deepEqual(draw(createArrayRenderer({ theme: 'dark', itemLabel }), frame).commands, standard.commands);
    }

    const item = frame.current.slots[0], longLabel = 'first occurrence of two';
    const custom = draw(createSortRenderer({
        theme: 'dark',
        itemLabel: slot => slot === item ? longLabel : slot.value === -2 ? '' : undefined,
    }), frame);
    assert.equal(createSortRenderer, createArrayRenderer);
    assert.deepEqual(text(custom).slice(1, -1), [longLabel, '0', '1', '1', '2']);
    assert.deepEqual(custom.calls('fillRect'), standard.calls('fillRect'));
    assert.deepEqual(custom.calls('fillText')[1].args.slice(1), standard.calls('fillText')[1].args.slice(1));
});

test('itemLabel is captured once and skipped for narrow cells and empty bitmaps', () => {
    const frame = startFrame([2, 2, 1]);
    const seen = [];
    let reads = 0;
    const renderer = createArrayRenderer({
        theme: 'dark',
        get itemLabel() {
            reads++;
            return function (item) { assert.equal(this, undefined); seen.push(item); return 'item'; };
        },
    });
    const narrow = draw(renderer, frame, 79);
    assert.deepEqual(narrow.commands, draw(createArrayRenderer({ theme: 'dark' }), frame, 79).commands);
    assert.deepEqual(seen, []);
    assert.deepEqual(draw(renderer, { ...frame, progress: NaN }, 0).commands, []);
    assert.throws(() => draw(renderer, { ...frame, progress: NaN }, 80), RangeError);
    assert.deepEqual(seen, []);

    const threshold = draw(renderer, frame, 80);
    assert.deepEqual(text(threshold).slice(1, -1), ['item', '0', 'item', '1', 'item', '2']);
    assert.equal(seen.length, 3);
    seen.forEach((item, index) => {
        assert.equal(item, frame.current.slots[index]);
        assert.ok(Object.isFrozen(item));
    });
    assert.equal(reads, 1);
});

test('itemLabel rejects invalid options and restores Canvas state on errors', () => {
    const frame = startFrame([2, 2, 1]);
    for (const invalid of [null, 1, 'label', {}]) {
        assert.throws(() => createArrayRenderer({ theme: 'dark', itemLabel: invalid }), TypeError);
    }
    const failure = Object.freeze({ message: 'label callback failed' });
    const target = recording(), before = structuredClone(target.state);
    for (const badResult of [null, 1, new String('boxed')]) {
        const renderer = createArrayRenderer({ theme: 'dark', itemLabel: () => badResult });
        assert.throws(() => renderer.render(target.ctx, frame), TypeError);
        assert.deepEqual(target.state, before);
        assert.equal(target.stack.length, 0);
    }
    const renderer = createArrayRenderer({ theme: 'dark', itemLabel() { throw failure; } });
    assert.throws(() => renderer.render(target.ctx, frame), error => error === failure);
    assert.deepEqual(target.state, before);
    assert.equal(target.stack.length, 0);
});

function* exampleSteps() {
    const trace = createArrayTrace([2, 2, 1]);
    const start = trace.start(), [a, b] = start.state.slots;
    const itemLabels = Object.freeze({ [a.id]: '2a', [b.id]: '2b' });
    const wrap = step => ({
        ...step, state: Object.freeze({ array: step.state, arrayEvent: step.event, itemLabels }),
    });
    yield wrap(start);
    yield wrap(trace.swap(0, 2));
    yield wrap(trace.pass(2, { sortedSuffixLength: 1 }));
    yield wrap(trace.done({ sortedSuffixLength: 3 }));
}

for (const mode of ['generator', 'history']) {
    test(`itemLabel follows item IDs during ${mode} exchange, rewind and Restart`, async () => {
        const env = dom();
        let target, currentLabels;
        const renderer = createArrayRenderer({ theme: 'dark', itemLabel: item => currentLabels[item.id] });
        const options = mode === 'history'
            ? { history: () => Array.from(exampleSteps(), step => step.state) }
            : { stepSource: exampleSteps, isTerminal: step => step.event.type === 'done', rewindCapacity: 4 };
        const player = new Player(env.container(), {
            ...options, stepDurationMs: 200,
            render(frame) {
                currentLabels = frame.current.itemLabels;
                target = draw(renderer, { ...frame, previous: frame.previous.array,
                    current: frame.current.array, event: frame.current.arrayEvent });
            },
        });
        try {
            player.start();
            const first = target, initial = labels(first);
            assert.ok(initial['2a'] < initial['2b']);
            player.next();
            const swapped = target, afterSwap = labels(swapped);
            assert.ok(afterSwap['2a'] > afterSwap['2b']);
            assert.equal(afterSwap['2b'], initial['2b']);
            player.next();
            const extracted = target;
            assert.deepEqual(labels(extracted), afterSwap);
            assert.equal(extracted.calls('fillRect').filter(call => call.state.fillStyle === '#34d399').length, 1);
            player.previous();
            assert.deepEqual(target.commands, swapped.commands);
            player.next();
            assert.deepEqual(target.commands, extracted.commands);

            if (mode === 'history') {
                player.seek(50);
                assert.equal(player.frame.event, undefined);
                assert.equal(player.frame.progress, .25);
                const inBetween = labels(target), midCommands = target.commands;
                assert.ok(initial['2a'] < inBetween['2a'] && inBetween['2a'] < afterSwap['2a']);
                assert.equal(inBetween['2b'], initial['2b']);
                player.seek(400);
                player.seek(50);
                assert.deepEqual(target.commands, midCommands);
            }

            player.restart();
            assert.deepEqual(target.commands, first.commands);
        } finally {
            player.dispose();
            assert.equal((await player.closed).errorCount, 0);
        }
    });
}
