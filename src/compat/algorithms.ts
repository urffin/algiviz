import { defineArrayAlgorithm } from "../array/trace.js";

// Legacy core exports only. New consumers provide algorithms like examples/algorithms.mjs.
export const insertion = defineArrayAlgorithm(function* (array) {
    yield array.start({ sortedPrefixLength: Math.min(1, array.length) });
    for (let i = 1; i < array.length; i++) {
        const key = array.at(i)!;
        yield array.select(i, { sortedPrefixLength: i });
        let hole = i;
        while (hole > 0) {
            yield array.compare(hole - 1, 'held');
            if (array.at(hole - 1)!.value <= key.value) break;
            yield array.shift(hole - 1, hole, { sortedPrefixLength: hole - 1 });
            hole--;
        }
        yield array.insert(hole, { sortedPrefixLength: i + 1 });
    }
    yield array.done({ sortedPrefixLength: array.length });
});

export const bubble = defineArrayAlgorithm(function* (array) {
    yield array.start({ sortedSuffixLength: array.length < 2 ? array.length : 0 });
    for (let end = array.length - 1; end > 0; end--) {
        let swapped = false;
        for (let left = 0; left < end; left++) {
            yield array.compare(left, left + 1);
            if (array.at(left)!.value <= array.at(left + 1)!.value) continue;
            yield array.swap(left, left + 1);
            swapped = true;
        }
        yield array.pass(end, { sortedSuffixLength: swapped ? array.length - end : array.length });
        if (!swapped) break;
    }
    yield array.done({ sortedSuffixLength: array.length });
});

