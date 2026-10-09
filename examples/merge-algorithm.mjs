// Application-owned merge sort; adapted from grundyjs.ru (MIT).
/** Input is copied on the iterator's first next(); every yielded snapshot is immutable. */
export function* iterateMergeSort(values) {
    const input = Array.from(values);
    if (input.some(value => !Number.isFinite(value)))
        throw new TypeError("Expected finite numbers");
    const main = input.map((value, index) => Object.freeze({ id: `item-${index}`, value }));
    const buffer = Array(main.length).fill(null);
    let range = null;
    let left = null;
    let right = null;
    let output = null;
    let comparisons = 0;
    let bufferWrites = 0;
    let mainWrites = 0;
    let stepIndex = 0;
    function snapshot(event) {
        return Object.freeze({
            index: stepIndex++,
            event: Object.freeze(event),
            state: Object.freeze({
                main: Object.freeze([...main]),
                buffer: Object.freeze([...buffer]),
                range,
                left,
                right,
                output,
                comparisons,
                bufferWrites,
                mainWrites
            })
        });
    }
    function* sort(start, end, depth) {
        const middle = start + Math.floor((end - start) / 2);
        range = Object.freeze({ start, middle, end, depth });
        left = right = output = null;
        if (end - start === 1) {
            yield snapshot({ type: "single" });
            return;
        }
        yield snapshot({ type: "split" });
        yield* sort(start, middle, depth + 1);
        yield* sort(middle, end, depth + 1);
        range = Object.freeze({ start, middle, end, depth });
        buffer.fill(null, start, end);
        left = start;
        right = middle;
        output = start;
        yield snapshot({ type: "merge" });
        while (left < middle || right < end) {
            let from;
            if (left < middle && right < end) {
                comparisons++;
                yield snapshot({ type: "compare", left, right });
                // Taking the left item on equality preserves original identities' order.
                from = main[left].value <= main[right].value ? left++ : right++;
            }
            else {
                from = left < middle ? left++ : right++;
            }
            const to = output++;
            buffer[to] = main[from];
            bufferWrites++;
            yield snapshot({ type: "buffer-write", from, to, itemId: main[from].id });
        }
        left = right = null;
        for (let index = start; index < end; index++) {
            output = index;
            main[index] = buffer[index];
            mainWrites++;
            yield snapshot({ type: "main-write", index, itemId: main[index].id });
        }
        output = null;
        yield snapshot({ type: "merged" });
    }
    yield snapshot({ type: "start" });
    if (main.length > 0)
        yield* sort(0, main.length, 0);
    buffer.fill(null);
    range = null;
    left = right = output = null;
    yield snapshot({ type: "done" });
}
export const mergeSort = Object.freeze({
    iterate: iterateMergeSort,
    steps: (values) => Object.freeze([...iterateMergeSort(values)])
});
