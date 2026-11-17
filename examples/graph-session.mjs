import { graphSteps } from './graph-algorithm.mjs';
import { graphPositions } from './graph-layout.mjs';
import { timing, limits } from './player-settings.mjs';

export const graphRewindCapacity = 32;
// Prepare/validate before replacing a visible session. The algorithm has no external effects.
export function prepareGraphSession(graph, start, target, preset, mode) {
    if (mode !== 'history' && mode !== 'generator') throw new RangeError('Choose a playback mode');
    if (graph.nodes.length > limits[mode]) throw new RangeError('Graph exceeds the shared demo size limit');
    const layout = graphPositions(graph, preset);
    const source = () => graphSteps(graph, start, target, { layout });
    if (mode === 'history') {
        const states = Object.freeze([...source()].map(step => step.state));
        return { ...timing, history: () => states };
    }
    const probe = source();
    try { probe.next(); } finally { probe.return(); }
    return { ...timing, stepSource: source, isTerminal: step => step.event.kind === 'finished',
        rewindCapacity: graphRewindCapacity, maxStepsPerFrame: 16 };
}
