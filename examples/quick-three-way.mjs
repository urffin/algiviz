import { createStepEmitter } from '@grundyjs/algiviz/playback';
// Application-owned Quick sort example, adapted from grundyjs.ru (MIT).
/** Dijkstra partition; pivot value is copied before any swaps. */
export function* iterateThreeWayQuickSort(values) {
    const input = Array.from(values);
    if (input.some((value) => !Number.isFinite(value))) throw new TypeError('Expected finite numbers');
    const main = input.map((value, index) => Object.freeze({ id: 'item-' + index, value }));
    const fixed = [];
    let range = null,
        bands = null;
    let pivotId = null,
        comparisons = 0,
        swaps = 0;
    const capture = createStepEmitter(() => Object.freeze({
        main: Object.freeze([...main]),
        fixed: Object.freeze([...fixed]),
        range,
        bands,
        pivot: pivotId === null ? null : main.findIndex((item) => item.id === pivotId),
        boundary: bands?.less ?? null,
        scan: bands?.scan ?? null,
        comparisons,
        swaps,
    }));
    const snapshot = event => capture(Object.freeze(event));
    function exchange(left, right) {
        if (left === right) return false;
        [main[left], main[right]] = [main[right], main[left]];
        swaps++;
        return true;
    }
    function* sort(start, end, depth) {
        if (start >= end) return;
        range = Object.freeze({ start, end, depth });
        bands = null;
        pivotId = null;
        if (end - start === 1) {
            fixed.push(start);
            yield snapshot({ type: 'single' });
            return;
        }
        const value = main[end - 1].value;
        pivotId = main[end - 1].id;
        let less = start,
            scan = start,
            greater = end;
        const update = () => {
            bands = Object.freeze({ less, scan, greater, value });
        };
        update();
        yield snapshot({ type: 'partition' });
        while (scan < greater) {
            comparisons++;
            yield snapshot({ type: 'classify', index: scan, value, relation: 'less' });
            if (main[scan].value < value) {
                const left = less,
                    right = scan,
                    changed = exchange(left, right);
                less++;
                scan++;
                update();
                yield snapshot(changed ? { type: 'swap', left, right } : { type: 'advance' });
            } else {
                comparisons++;
                yield snapshot({ type: 'classify', index: scan, value, relation: 'greater' });
                if (main[scan].value > value) {
                    greater--;
                    const left = scan,
                        right = greater,
                        changed = exchange(left, right);
                    update();
                    yield snapshot(changed ? { type: 'swap', left, right } : { type: 'advance' });
                } else {
                    scan++;
                    update();
                    yield snapshot({ type: 'advance' });
                }
            }
        }
        for (let i = less; i < greater; i++) fixed.push(i);
        yield snapshot({ type: 'band-fixed', start: less, end: greater });
        yield* sort(start, less, depth + 1);
        yield* sort(greater, end, depth + 1);
    }
    yield snapshot({ type: 'start' });
    yield* sort(0, main.length, 0);
    range = null;
    bands = null;
    pivotId = null;
    yield snapshot({ type: 'done' });
}
export const threeWayQuickSort = {
    iterate: iterateThreeWayQuickSort,
    steps: (values) => [...iterateThreeWayQuickSort(values)],
};
