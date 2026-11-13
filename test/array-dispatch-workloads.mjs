import { createArrayTrace } from '@grundyjs/algiviz/array';
import { bubble } from '../examples/algorithms.mjs';
import { profileWorkloads, prepareProfile, measureProfile } from './profile-workloads.mjs';

export const arrayDispatchWorkloads = profileWorkloads.filter(w => w.name.startsWith('insertion-')).flatMap(w => [w, {
    ...w, name: w.name.replace('insertion', 'bubble'), source: () => bubble.iterate(
        Array.from({ length: w.input.count }, (_, i) => w.input.count - i))
}]);

// Same immutable endpoints, changing event/progress/index; plus seeks, enters/exits and layout changes.
export function arrayDispatchChecks() {
    const trace = createArrayTrace([0, -7, 7, 2]);
    const start = trace.start(), select = trace.select(1, { sortedPrefixLength: 4 });
    const highlight = trace.highlight(['held', 2]);
    const shifted = trace.shift(2, 1), inserted = trace.insert(2);
    const swapped = trace.swap(0, 3, { sortedPrefixLength: 1, sortedSuffixLength: 1 });
    const done = trace.done();
    const frames = [];
    for (const [previous, current] of [[start, select], [select, highlight], [highlight, shifted],
        [shifted, inserted], [inserted, swapped], [swapped, done], [done, start], [select, start]]) {
        for (const progress of [0, 0.25, 0.5, 1]) frames.push({ previous: previous.state,
            current: current.state, event: current.event, stepIndex: current.index, progress });
    }
    for (const event of [{ type: 'start' }, { type: 'compare', leftId: 'item-0', rightId: 'item-2' },
        { type: 'highlight', itemIds: ['item-0', 'item-3'] }, { type: 'pass', end: 2 }]) {
        frames.push({ previous: start.state, current: start.state, event: Object.freeze(event), progress: 0.5, stepIndex: frames.length });
    }
    const empty = createArrayTrace([]).start();
    const other = createArrayTrace([100, -50]).start();
    frames.push(...[[start, empty], [empty, empty], [empty, other], [other, start]].map(([a, b]) =>
        ({ previous: a.state, current: b.state, event: b.event, progress: 0.5, stepIndex: b.index })));
    return frames.map((frame, i) => ({ frame: Object.freeze(frame),
        width: [800, 50, 960, 800][i % 4], height: [450, 200, 540][i % 3] }));
}

export async function compareArraySpeed(before, after, context, { pause, progress = () => {} } = {}) {
    const rows = [];
    for (const workload of arrayDispatchWorkloads) {
        const prepared = prepareProfile(workload);
        const exact = prepared.frames.filter((_, i) => i % 8 === 7).map(f => ({ ...f, previous: f.current, progress: 1 }));
        const cases = { samePair: prepared.hot, playback: prepared.frames,
            changingPair: prepared.frames.filter((_, i) => i % 8 === 0), manual: exact,
            seeking: [...prepared.frames.filter((_, i) => i % 8 === 3)].reverse() };
        const row = { name: workload.name, input: workload.input, objects: prepared.objects,
            retainedPairs: prepared.pairs, sampledStepRange: prepared.sampledStepRange, cases: {} };
        for (const [name, frames] of Object.entries(cases)) {
            progress(workload.name + ' · ' + name);
            const rounds = [];
            for (const order of [['before', 'after'], ['after', 'before']]) {
                const round = {};
                for (const version of order) {
                    const renderer = (version === 'before' ? before : after)({ theme: 'dark' });
                    round[version] = await measureProfile(i => renderer.render(context, frames[i % frames.length]),
                        { pause, minIterations: Math.ceil(frames.length / 7) });
                }
                rounds.push(round);
            }
            row.cases[name] = rounds;
        }
        rows.push(row);
    }
    return rows;
}
