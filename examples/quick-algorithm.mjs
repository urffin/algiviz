// Application-owned Quick sort example, adapted from grundyjs.ru (MIT).
/** Last-element Lomuto partition; input is copied and snapshots are immutable. */
export function* iterateQuickSort(values) {
    const input = Array.from(values);
    if (input.some((value) => !Number.isFinite(value))) throw new TypeError('Expected finite numbers');
    const main = input.map((value, index) => Object.freeze({ id: 'item-' + index, value }));
    const fixed = [];
    let range = null;
    let pivot = null,
        boundary = null,
        scan = null;
    let comparisons = 0,
        swaps = 0,
        index = 0;
    function snapshot(event) {
        return Object.freeze({
            index: index++,
            event: Object.freeze(event),
            state: Object.freeze({
                main: Object.freeze([...main]),
                range,
                pivot,
                boundary,
                scan,
                fixed: Object.freeze([...fixed]),
                comparisons,
                swaps,
            }),
        });
    }
    function* exchange(left, right) {
        if (left === right) return;
        [main[left], main[right]] = [main[right], main[left]];
        swaps++;
        yield snapshot({ type: 'swap', left, right });
    }
    function* sort(start, end, depth) {
        if (start >= end) return;
        range = Object.freeze({ start, end, depth });
        pivot = boundary = scan = null;
        if (end - start === 1) {
            fixed.push(start);
            yield snapshot({ type: 'single' });
            return;
        }
        pivot = end - 1;
        boundary = start;
        scan = start;
        const pivotValue = main[pivot].value;
        yield snapshot({ type: 'partition' });
        for (let j = start; j < end - 1; j++) {
            scan = j;
            comparisons++;
            yield snapshot({ type: 'compare', index: j, pivot: end - 1 });
            if (main[j].value < pivotValue) {
                yield* exchange(boundary, j);
                boundary = boundary + 1;
            }
        }
        scan = null;
        const position = boundary;
        pivot = position;
        yield* exchange(position, end - 1);
        fixed.push(position);
        yield snapshot({ type: 'fixed', index: position });
        yield* sort(start, position, depth + 1);
        yield* sort(position + 1, end, depth + 1);
    }
    yield snapshot({ type: 'start' });
    yield* sort(0, main.length, 0);
    range = null;
    pivot = boundary = scan = null;
    yield snapshot({ type: 'done' });
}
export const quickSort = {
    iterate: iterateQuickSort,
    steps: (values) => [...iterateQuickSort(values)],
};
