import { createStepEmitter } from '@grundyjs/algiviz/playback';

// Validate before returning a lazy source so a rejected load preserves the session.
export function iterateBinarySearch(input, target) {
    const copy = Array.from(input);
    if (!Number.isFinite(target) || copy.some(value => !Number.isFinite(value)))
        throw new TypeError('Expected finite numbers.');
    if (copy.some((value, index) => index > 0 && value < copy[index - 1]))
        throw new RangeError('Values must be sorted in ascending order.');
    const values = Object.freeze(copy);
    return (function* () {
        let low = 0, high = values.length - 1, mid = null, candidate = null, result = null, probes = 0;
        const capture = createStepEmitter(() => Object.freeze({ values, target, low, high, mid, candidate, result, probes }));
        const emit = type => capture(Object.freeze({ type }));
        yield emit('start');
        while (low <= high) {
            mid = low + Math.floor((high - low) / 2);
            probes++;
            yield emit('probe');
            if (values[mid] < target) {
                low = mid + 1; mid = null;
                yield emit('right');
            } else {
                if (values[mid] === target) candidate = mid;
                high = mid - 1; mid = null;
                yield emit('left');
            }
        }
        result = candidate ?? -1;
        yield emit('done');
    })();
}
export const binarySearch = Object.freeze({
    iterate: iterateBinarySearch,
    steps: (values, target) => Object.freeze([...iterateBinarySearch(values, target)])
});
