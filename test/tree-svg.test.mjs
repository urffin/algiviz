import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTreeSvgRenderer } from '../examples/tree-svg.mjs';
import { treeSteps } from '../examples/tree-scene.mjs';
import { createTimeline } from '@grundyjs/algiviz/playback';
class Element {
    constructor(tag, doc) { this.tagName = tag; this.ownerDocument = doc; this.children = []; this.attrs = {}; }
    setAttribute(key, value) { this.attrs[key] = value; }
    get firstChild() { return this.children[0]; }
    appendChild(child) { child.remove(); child.parent = this; this.children.push(child); return child; }
    remove() { if (this.parent) { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; } }
}
test('SVG retains identities, layers correctly and removes stale objects on skipped exits', () => {
    const doc = { createElementNS: (_, tag) => new Element(tag, doc) };
    const svg = new Element('svg', doc);
    const renderer = createTreeSvgRenderer(svg);
    const timeline = createTimeline([...treeSteps()], { stepDurationMs: 100, finalHoldMs: 0 });
    const layer = svg.firstChild;
    renderer.render(timeline.sample(100));
    const a = layer.children.find(el => el.attrs['data-object-id'] === 'a');
    renderer.render(timeline.sample(500));
    assert.equal(layer.children.find(el => el.attrs['data-object-id'] === 'a'), a);
    assert.deepEqual(layer.children.map(el => el.tagName), ['line', 'line', 'line', 'line', 'g', 'g', 'g', 'g', 'g', 'path']);
    renderer.render(timeline.sample(550));
    assert.equal(layer.children.at(-1).attrs.opacity, '0.5');
    renderer.render(timeline.sample(600));
    assert.equal(layer.children.length, 9);
    renderer.render(timeline.sample(0)); // No exit frames for most nodes are visited.
    assert.equal(layer.children.length, 0);
    renderer.render(timeline.sample(350));
    assert.ok(layer.children.length > 0);
    assert.ok(layer.children.every(el => !JSON.stringify(el.attrs).match(/NaN|Infinity/)));
    renderer.dispose(); assert.equal(svg.children.length, 0);
});
