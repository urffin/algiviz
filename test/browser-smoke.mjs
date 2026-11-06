import { createPlayer, createStatePlayer, createTimeline, createStepEmitter } from '@grundyjs/algiviz/playback';
import { createSceneRenderer, createSceneProjector } from '@grundyjs/algiviz/scene';
import { createArrayTrace, createArrayPlayer, createArrayTimeline } from '@grundyjs/algiviz/array';
import { arrayScene, createArrayRenderer, createSortRenderer } from '@grundyjs/algiviz/canvas';

const canvas = document.querySelector('#canvas'), ctx = canvas.getContext('2d');
const report = { date: new Date().toISOString(), userAgent: navigator.userAgent,
    canvasFilter: ctx !== null && 'filter' in ctx, checks: [] };
const check = (value, message) => { if (!value) throw new Error(message); };
const equalPixels = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);
function run(name, body) {
    let result;
    try { body(); result = { name, passed: true }; }
    catch (error) { result = { name, passed: false, error: String(error) }; }
    report.checks.push(result);
    const row = document.createElement('li'); row.textContent = `${result.passed ? 'PASS' : 'FAIL'} — ${name}${result.error ? ': ' + result.error : ''}`;
    document.querySelector('#checks').append(row);
}

run('Plain states: mixed controls, exhaustion and early disposal', () => {
    let closed = 0;
    function* source() { try { yield { x: 0 }; yield { x: 100 }; yield { x: 200 }; } finally { closed++; } }
    const player = createStatePlayer(source(), { stepDurationMs: 100 });
    check(player.frame.current.x === 0, 'Initial state');
    check(player.advance(25).progress === 0.25, 'Partial advancement');
    check(player.nextStep().current.x === 100, 'Finish partial transition');
    check(player.advance(100).current.x === 200 && !player.finished, 'No lookahead');
    player.nextStep(); check(player.finished && closed === 1, 'Exhaustion closes once');
    player.dispose(); check(closed === 1, 'No duplicate close');
    const early = createStatePlayer(source()), before = early.frame;
    early.dispose(); check(early.frame.current === before.current && early.frame.progress === before.progress &&
        early.frame.stepIndex === before.stepIndex && closed === 2, 'Preserve disposed frame');
    let rejected = false; try { early.nextStep(); } catch { rejected = true; }
    check(rejected, 'Disposed advancement must fail');
});

run('Explicit steps: indices, terminal playback and timeline', () => {
    const emit = createStepEmitter(() => 1);
    check(emit('start').index === 0 && emit('done').index === 1, 'Emitter indices');
    const steps = [{ index: 10, state: 0, event: 'start' }, { index: 25, state: 10, event: 'done' }];
    const timing = { stepDurationMs: 100, finalHoldMs: 0 };
    const player = createPlayer(steps, { ...timing, isTerminal: step => step.event === 'done' });
    const middle = createTimeline(steps, timing).sample(50);
    check(middle.stepIndex === 25 && middle.progress === 0.5, 'Timeline metadata');
    check(player.advance(50).progress === middle.progress, 'Timed parity');
    player.nextStep(); check(player.finished && player.frame.current === 10, 'Terminal completion');
    player.dispose();
});

run('Custom objects: projection, enter/exit and retained SVG cleanup', () => {
    const svg = document.querySelector('#scene'), nodes = new Map();
    const project = createSceneProjector(items => ({ objects: items.map(id => ({ id, type: 'card', data: { x: id === 'a' ? 20 : 80 } })) }));
    const renderer = createSceneRenderer({ card(root, object) {
        if (object.presence === 0) { nodes.get(object.id)?.remove(); nodes.delete(object.id); return; }
        let node = nodes.get(object.id);
        if (!node) { node = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); nodes.set(object.id, node); root.append(node); }
        const data = (object.current ?? object.previous).data;
        node.setAttribute('x', String(data.x)); node.setAttribute('y', '4'); node.setAttribute('width', '30'); node.setAttribute('height', '30');
    } });
    const player = createStatePlayer([[], ['a'], ['a', 'b'], ['b'], []], { render: frame => renderer.render(svg, project(frame)) });
    player.nextStep(); const a = nodes.get('a'); check(a && svg.children.length === 1, 'Entry');
    player.nextStep(); check(nodes.get('a') === a && svg.children.length === 2, 'Retain identity');
    player.nextStep(); check(!nodes.has('a') && nodes.has('b'), 'Exit');
    player.nextStep(); check(svg.children.length === 0, 'Empty scene cleanup');
    player.nextStep(); check(player.finished, 'Scene source completion'); player.dispose();
});

const trace = createArrayTrace([3, 1, 2]), start = trace.start();
const frame = { previous: start.state, current: start.state, event: start.event, progress: 1, stepIndex: 0 };
run('Array adapter, palette and array playback', () => {
    check(ctx, 'Canvas 2D context'); check(createArrayRenderer === createSortRenderer, 'Compatibility alias');
    const held = trace.select(0); check(arrayScene(held.state).objects.find(object => object.data.held).data.index === 0, 'Held index');
    trace.insert(0); const done = trace.done();
    const steps = [start, done], timing = { stepDurationMs: 100, finalHoldMs: 0 };
    const player = createArrayPlayer(steps, timing); player.nextStep();
    check(player.finished && createArrayTimeline(steps, timing).sample(100).stepIndex === done.index, 'Array adapters'); player.dispose();
    createArrayRenderer({ theme: 'dark', colors: { background: '#112233' } }).render(ctx, frame);
    check(equalPixels([...ctx.getImageData(1, 1, 1, 1).data], [17, 34, 51, 255]), 'Custom background pixels');
});

run('Canvas: inherited paint settings, restoration and invalid progress', () => {
    const make = () => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; return c.getContext('2d'); };
    const clean = make(), dirty = make(), renderer = createArrayRenderer({ theme: 'light', colors: undefined });
    dirty.globalCompositeOperation = 'destination-in'; dirty.globalAlpha = 0.4;
    if ('filter' in dirty) dirty.filter = 'opacity(50%)';
    dirty.shadowColor = 'red'; dirty.shadowBlur = 12; dirty.shadowOffsetX = 7; dirty.shadowOffsetY = -4; dirty.scale(2, 2);
    const settings = c => JSON.stringify([c.globalAlpha, c.globalCompositeOperation, c.filter, c.shadowColor,
        c.shadowBlur, c.shadowOffsetX, c.shadowOffsetY, c.fillStyle, c.font, c.textAlign, c.textBaseline,
        ...['a', 'b', 'c', 'd', 'e', 'f'].map(key => c.getTransform()[key])]);
    const before = settings(dirty); renderer.render(clean, frame); renderer.render(dirty, frame);
    check(settings(dirty) === before, 'Caller state restoration');
    const pixels = c => c.getImageData(0, 0, 400, 300).data;
    check(equalPixels(pixels(clean), pixels(dirty)), 'Inherited settings must not affect pixels');
    const original = pixels(dirty);
    for (const progress of [-1, 2, NaN, Infinity]) {
        let rejected = false; try { renderer.render(dirty, { ...frame, progress }); } catch (error) { rejected = error instanceof RangeError; }
        check(rejected && equalPixels(original, pixels(dirty)) && settings(dirty) === before, 'Invalid progress changes nothing');
    }
});

run('Dense arrays and zero-sized bitmap', () => {
    const step = createArrayTrace(Array.from({ length: 4000 }, (_, i) => i % 10)).start();
    const renderer = createArrayRenderer({ theme: 'dark' });
    renderer.render(ctx, { previous: step.state, current: step.state, event: step.event, progress: 1, stepIndex: 0 });
    const zero = document.createElement('canvas'); zero.width = 0;
    renderer.render(zero.getContext('2d'), { ...frame, progress: NaN });
});

report.passed = report.checks.every(result => result.passed);
document.querySelector('#status').textContent = `${report.passed ? 'PASS' : 'FAIL'} — ${report.checks.filter(result => result.passed).length}/${report.checks.length} checks`;
document.querySelector('#report').textContent = JSON.stringify(report, null, 2);
