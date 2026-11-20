import { createGridBfsSource } from './grid-player-algorithm.mjs';
import { timing } from './player-settings.mjs';

export const gridRewindCapacity = 32;
export function prepareGridSession(mode, input) {
    if (mode !== 'history' && mode !== 'generator') throw new RangeError('Choose a playback mode');
    const source = createGridBfsSource(input, mode);
    // Reuse shared timing/limits and Player controls; no second playback loop.
    return mode === 'history' ? { ...timing, history: () => Object.freeze([...source(mode)].map(step => step.state)) }
        : { ...timing, stepSource: () => source(mode), isTerminal: step => step.event.type === 'done',
            rewindCapacity: gridRewindCapacity, maxStepsPerFrame: 16 };
}
