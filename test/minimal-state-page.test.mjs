import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createStatePlayer } from '@grundyjs/algiviz/playback';
import { createSceneRenderer } from '@grundyjs/algiviz/scene';

test('actual minimal page highlights each call and completes on the extra click', () => {
    const html = readFileSync(new URL('../examples/visualization-pipeline.html', import.meta.url), 'utf8');
    const module = html.match(/<script type="module" id="example">([\s\S]*?)<\/script>/)[1];
    const ui = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    const timers = [], spans = [];
    function element() { return { hidden: false, disabled: false, textContent: '', className: '',
        classList: { add() {} }, append(node) { spans.push(node); },
        addEventListener(_, listener) { this.listener = listener; } }; }
    function context() { return { x: null, clearRect() { this.x = null; }, beginPath() {},
        arc(x) { this.x = x; }, fill() {}, getImageData() { return { x: this.x }; },
        putImageData(image) { this.x = image.x; } }; }
    const visible = context(), hidden = context();
    const ids = Object.fromEntries(['code', 'example', 'next', 'start', 'restart', 'position',
        'generator-status', 'trace-status'].map(id => ['#' + id, element()]));
    ids['#example'].textContent = module;
    ids['#next'].hidden = ids['#restart'].hidden = true;
    const scope = vm.createContext({ createStatePlayer, createSceneRenderer,
        document: { querySelector: s => s === 'canvas' ? { getContext: () => visible } : ids[s],
            createElement: tag => tag === 'canvas' ? { getContext: () => hidden } : element() },
        location: { reload() {} }, setTimeout: fn => { timers.push(fn); return fn; },
        clearTimeout() {}, queueMicrotask: fn => timers.push(fn),
    });
    scope.window = scope;
    scope.addEventListener = () => {};
    vm.runInContext(ui, scope);
    vm.runInContext(module.replace(/^import .*;\r?\n/gm, ''), scope);
    function replay(expectedKinds) {
        const kinds = [];
        while (timers.length) {
            timers.shift()();
            kinds.push(ids['#trace-status'].textContent);
            assert.ok(kinds.length < 10);
        }
        assert.equal(kinds.length, expectedKinds.length);
        expectedKinds.forEach((text, i) => assert.ok(kinds[i].includes(text), kinds[i]));
    }
    assert.equal(visible.x, null);
    ids['#start'].onclick();
    assert.equal(visible.x, null);
    replay(['createStatePlayer', 'цикл', 'yield', 'render', 'dot']);
    assert.equal(visible.x, 40);
    for (const x of [200, 360, 560]) {
        const old = visible.x;
        assert.equal(ids['#next'].hidden, false);
        ids['#next'].listener({ stopImmediatePropagation() { throw Error('unexpected busy'); } });
        ids['#next'].onclick();
        assert.equal(visible.x, old);
        assert.equal(ids['#next'].disabled, true);
        replay(['nextStep', 'цикл', 'yield', 'render', 'dot']);
        assert.equal(visible.x, x);
    }
    assert.equal(ids['#next'].disabled, false);
    ids['#next'].listener({}); ids['#next'].onclick();
    replay(['nextStep', 'done: true', 'render', 'dot']);
    assert.equal(visible.x, 560);
    assert.equal(ids['#next'].hidden, true);
    assert.equal(ids['#restart'].hidden, false);
    assert.match(ids['#generator-status'].textContent, /новых состояний нет/);
    const ranges = vm.runInContext('ranges', scope);
    assert.match(spans[ranges.advance[0] - 1].textContent, /nextStep/);
    assert.match(spans[ranges.render[0] - 1].textContent, /render\(frame\)/);
    assert.match(spans[ranges.create[0] - 1].textContent, /createStatePlayer\(states/);
    assert.equal(spans[ranges.exhausted[1] - 1].textContent.trim(), '}');
});
