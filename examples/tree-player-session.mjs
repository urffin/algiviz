import { treeInsertionSteps } from './tree-player-algorithm.mjs';
import { timing, limits } from './player-settings.mjs';

export const treeRewindCapacity = 8;
// Player owns the controls; share the examples' timing, not a second playback loop.
export function prepareTreeSession(mode, layout) {
    if (mode !== 'history' && mode !== 'generator') throw new RangeError('Choose a playback mode');
    if (3 > limits[mode]) throw new RangeError('Tree exceeds the shared demo size limit');
    const source = () => treeInsertionSteps(layout);
    return mode === 'history' ? { ...timing, history: () => Object.freeze([...source()].map(step => step.state)) }
        : { ...timing, stepSource: source, isTerminal: step => step.event.type === 'done', rewindCapacity: treeRewindCapacity, maxStepsPerFrame: 16 };
}
