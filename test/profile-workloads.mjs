import { createSceneFrame, createSceneProjector, createSceneRenderer } from '@grundyjs/algiviz/scene';
import { arrayScene, createArrayRenderer } from '@grundyjs/algiviz/canvas';
import { insertion } from '../examples/algorithms.mjs';
import { mergeSort } from '../examples/merge-algorithm.mjs';
import { mergeScene, createMergeRenderer } from '../examples/merge-scene.mjs';
import { graphSteps, graphExamples } from '../examples/graph-algorithm.mjs';
import { graphScene, createGraphRenderer } from '../examples/graph-scene.mjs';
import { boidsSteps } from '../examples/boids-algorithm.mjs';
import { boidsScene, createBoidsRenderer } from '../examples/boids-scene.mjs';
import { sandSteps } from '../examples/sand-algorithm.mjs';
import { sandScene, createSandRenderer } from '../examples/sand-scene.mjs';

export const profileSize = Object.freeze({ width: 960, height: 540 });
export const profilePolicy = Object.freeze({ samples: 7, warmupMs: 30, targetSampleMs: 12, maxIterations: 65536,
    prefixSteps: 16, retainedPairs: 16, interpolationFramesPerPair: 8 });
let checksum = 0;
const values = count => Array.from({ length: count }, (_, i) => count - i);
const sorting = (name, count, algorithm, mapper, factory) => ({
    name: name + '-' + count, input: { count, order: 'reverse' }, scanSteps: count > 64 ? 1000 : 128,
    source: () => algorithm.iterate(values(count)), project: mapper,
    renderer(first) { return factory(first); },
});
export const profileWorkloads = [
    ...[24, 2000].map(n => sorting('insertion', n, insertion, arrayScene, () => createArrayRenderer({ theme: 'dark' }))),
    ...[24, 2000].map(n => sorting('merge', n, mergeSort, mergeScene, first => createMergeRenderer(true, first.main))),
    { name: 'BFS-layers', input: { preset: 'layers', vertices: 8, edges: 9 }, scanSteps: 128,
        source: () => graphSteps(graphExamples[0].graph, 'A', 'G'), project: graphScene,
        renderer: () => createGraphRenderer({ layout: 'layers' }) },
    ...[64, 192].map(count => ({ name: 'boids-' + count, input: { count, seed: 93717, obstacle: 'circle' }, scanSteps: 48,
        source: () => boidsSteps({ count, seed: 93717, ticks: 60, obstacle: 'circle' }, 'generator'), project: boidsScene,
        renderer: () => createBoidsRenderer() })),
    { name: 'boids-192-inspect', input: { count: 192, seed: 93717, inspect: true, selectedId: 0 }, scanSteps: 48,
        source: () => boidsSteps({ count: 192, seed: 93717, ticks: 60, obstacle: 'circle' }, 'generator'),
        project: state => boidsScene(state, { inspect: true, selectedId: 0 }), exact: true,
        renderer() { const renderer = createBoidsRenderer(); return { render(ctx, frame) { renderer.render(ctx, frame, { inspect: true, selectedId: 0 }); } }; } },
    ...[320, 1800].map(count => ({ name: 'sand-' + count, input: { count, seed: 42, preset: 'funnel', columns: 64, rows: 54 }, scanSteps: 48,
        source: () => sandSteps({ count, seed: 42, ticks: 60, preset: 'funnel' }, 'generator'), project: sandScene,
        renderer: () => createSandRenderer() })),
];
export function createProfileMock() {
    const counts = { calls: 0, writes: 0 }, functions = new Map();
    const target = { canvas: { ...profileSize }, globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none',
        shadowColor: 'rgba(0, 0, 0, 0)', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0 };
    const context = new Proxy(target, {
        get(object, key) {
            if (key in object) return object[key];
            if (!functions.has(key)) functions.set(key, () => { counts.calls++; });
            return functions.get(key);
        },
        set(object, key, value) { counts.writes++; object[key] = value; return true; },
    });
    return { context, counts };
}

export function prepareProfile(workload) {
    const source = workload.source(), pairs = [];
    const stride = Math.max(1, Math.floor(workload.scanSteps / profilePolicy.retainedPairs));
    let previous, first, emitted = 0;
    try {
        const initial = source.next(); if (initial.done) throw Error('Empty profile source');
        previous = initial.value; first = initial.value.state;
        for (let i = 1; i <= workload.scanSteps; i++) {
            const step = source.next(); if (step.done) break; emitted++;
            if (pairs.length < profilePolicy.retainedPairs && (i % stride === 0 || pairs.length === 0))
                pairs.push({ previous: previous.state, current: step.value.state, stepIndex: step.value.index, event: step.value.event });
            previous = step.value;
        }
    } finally { source.return?.(); }
    if (!pairs.length) throw Error('No adjacent state pairs');
    const frames = pairs.flatMap(pair => Array.from({ length: profilePolicy.interpolationFramesPerPair }, (_, i) =>
        Object.freeze({ ...pair, ...(workload.exact ? { previous: pair.current } : {}), progress: workload.exact ? 1 : i / (profilePolicy.interpolationFramesPerPair - 1) })));
    const hot = frames.slice(0, profilePolicy.interpolationFramesPerPair);
    const prepareProject = createSceneProjector(workload.project);
    const projected = frames.map(frame => prepareProject(frame));
    const types = new Set(projected.flatMap(frame => [...frame.previous.objects, ...frame.current.objects].map(o => o.type)));
    const dispatcher = createSceneRenderer(Object.fromEntries([...types].map(type => [type, () => { checksum++; }])));
    return { first, frames, hot, projected, dispatcher, emitted, pairs: pairs.length,
        objects: [Math.min(...projected.map(f => f.current.objects.length)), Math.max(...projected.map(f => f.current.objects.length))],
        sampledStepRange: [pairs[0].stepIndex, pairs.at(-1).stepIndex] };
}

export async function measureProfile(action, { divideBy = 1, pause = async () => {}, minIterations = 1 } = {}) {
    let calls = 0;
    const invoke = () => action(calls++);
    const warmupStart = performance.now(); let warmupCalls = 0;
    do { invoke(); warmupCalls++; } while (performance.now() - warmupStart < profilePolicy.warmupMs);
    let iterations = 1;
    while (iterations < minIterations) iterations *= 2;
    while (iterations < profilePolicy.maxIterations) {
        const start = performance.now(); for (let i = 0; i < iterations; i++) invoke();
        if (performance.now() - start >= profilePolicy.targetSampleMs) break;
        iterations *= 2;
    }
    const values = [];
    for (let sample = 0; sample < profilePolicy.samples; sample++) {
        await pause();
        const start = performance.now(); for (let i = 0; i < iterations; i++) invoke();
        values.push((performance.now() - start) / iterations / divideBy);
    }
    const sorted = [...values].sort((a, b) => a - b);
    return { medianMs: sorted[Math.floor(sorted.length / 2)], minMs: sorted[0], maxMs: sorted.at(-1), iterations, samplesMs: values,
        timedCalls: iterations * profilePolicy.samples,
        targetReached: sorted[Math.floor(sorted.length / 2)] * iterations * divideBy >= profilePolicy.targetSampleMs, warmupCalls };
}

export async function profileWorkload(workload, { context, pause = async () => {}, progress = () => {}, replay = false } = {}) {
    const prepared = prepareProfile(workload), phases = {};
    const run = async (name, action, divideBy = 1) => {
        progress(name); phases[name] = await measureProfile(action, { divideBy, pause,
            minIterations: name.startsWith('generation') || name === 'canvasCommandReplay' ? 1 : Math.ceil(prepared.frames.length / profilePolicy.samples) });
    };
    await run('generationFirst', () => {
        const source = workload.source(); try { const value = source.next(); checksum += value.value.index + 1; } finally { source.return?.(); }
    });
    await run('generationPrefixPerStep', () => {
        const source = workload.source(); let count = 0;
        try { for (let i = 0; i < profilePolicy.prefixSteps; i++) { const next = source.next(); if (next.done) break; count++; checksum += next.value.index + 1; } }
        finally { source.return?.(); }
        if (count !== profilePolicy.prefixSteps) throw Error('Prefix ended early');
    }, profilePolicy.prefixSteps);
    await run('projectionUncached', i => { checksum += workload.project(prepared.frames[i % prepared.frames.length].current).objects.length; });
    const hotProject = createSceneProjector(workload.project); hotProject(prepared.hot[0]);
    await run('projectionCachedPair', i => { checksum += hotProject(prepared.hot[i % prepared.hot.length]).current.objects.length; });
    const advancingProject = createSceneProjector(workload.project);
    await run('projectionPlaybackPattern', i => { checksum += advancingProject(prepared.frames[i % prepared.frames.length]).current.objects.length; });
    await run('matching', i => { checksum += createSceneFrame(prepared.projected[i % prepared.projected.length]).objects.length; });
    await run('matchingAndDispatch', i => prepared.dispatcher.render(null, prepared.projected[i % prepared.projected.length]));
    const renderer = workload.renderer(prepared.first);
    await run('renderCachedPair', i => renderer.render(context, prepared.hot[i % prepared.hot.length]));
    await run('renderPlaybackPattern', i => renderer.render(context, prepared.frames[i % prepared.frames.length]));
    let replayInfo;
    if (replay) {
        const captured = captureProfileReplay(context, workload.renderer(prepared.first), prepared.hot[3]);
        replayInfo = { commandCount: captured.commandCount, pixelsMatch: captured.pixelsMatch };
        await run('canvasCommandReplay', captured.replay);
    }
    return { name: workload.name, input: workload.input, objects: prepared.objects, replay: replayInfo, emittedForSetup: prepared.emitted,
        retainedPairs: prepared.pairs, sampledStepRange: prepared.sampledStepRange, phases, checksum };
}

// Capture actual renderer calls once; replay timing excludes mapping/matching/geometry,
// but includes buffer dispatch and native Canvas API submission. It is not GPU time.
export function captureProfileReplay(context, renderer, frame) {
    renderer.render(context, frame);
    const before = context.getImageData(0, 0, context.canvas.width, context.canvas.height).data;
    const commands = [];
    const recording = new Proxy(context, {
        get(target, key) {
            const value = Reflect.get(target, key, target);
            if (typeof value !== 'function') return value;
            return (...args) => { commands.push(['call', key, args.map(arg => Array.isArray(arg) ? [...arg] : arg)]); return value.apply(target, args); };
        },
        set(target, key, value) { commands.push(['set', key, value]); return Reflect.set(target, key, value, target); },
    });
    renderer.render(recording, frame);
    const replay = () => { for (const [kind, key, value] of commands) {
        if (kind === 'call') context[key](...value); else context[key] = value;
    } };
    context.clearRect(0, 0, context.canvas.width, context.canvas.height); replay();
    const after = context.getImageData(0, 0, context.canvas.width, context.canvas.height).data;
    const pixelsMatch = before.length === after.length && before.every((value, i) => value === after[i]);
    if (!pixelsMatch) throw Error('Captured Canvas replay changed pixels');
    return { replay, commandCount: commands.length, pixelsMatch };
}
