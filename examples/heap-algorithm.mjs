import { createStepEmitter } from "@grundyjs/algiviz/playback";
/** Bottom-up max-heap construction and iterative sift-down; equal children choose left. */
export function* iterateHeapSort(values) {
    const input = Array.from(values);
    if (input.some(value => !Number.isFinite(value)))
        throw new TypeError("Expected finite numbers");
    const main = input.map((value, index) => Object.freeze({ id: "item-" + index, value }));
    let heapSize = main.length;
    let phase = "build";
    let buildRoot = null;
    let parent = null;
    let left = null;
    let right = null;
    let candidate = null;
    let comparisons = 0;
    let swaps = 0;
    const emit = createStepEmitter(() => Object.freeze({
        main: Object.freeze([...main]),
        heapSize,
        phase,
        buildRoot,
        parent,
        left,
        right,
        candidate,
        comparisons,
        swaps
    }));
    const snapshot = (event) => emit(Object.freeze(event));
    function clearPointers() {
        parent = left = right = candidate = null;
    }
    function exchange(a, b) {
        [main[a], main[b]] = [main[b], main[a]];
        swaps++;
    }
    function* sift(root) {
        clearPointers();
        let cursor = root;
        parent = cursor;
        yield snapshot({ type: "sift-start", root });
        while (cursor * 2 + 1 < heapSize) {
            left = cursor * 2 + 1;
            right = left + 1 < heapSize ? left + 1 : null;
            candidate = left;
            if (right !== null) {
                comparisons++;
                if (main[right].value > main[left].value)
                    candidate = right;
                yield snapshot({ type: "compare-children", left, right });
            }
            comparisons++;
            yield snapshot({ type: "compare-parent", parent: cursor, child: candidate });
            if (main[candidate].value <= main[cursor].value)
                break;
            const from = cursor;
            const to = candidate;
            exchange(from, to);
            yield snapshot({ type: "swap", left: from, right: to });
            cursor = to;
            parent = cursor;
            left = right = candidate = null;
        }
        clearPointers();
        yield snapshot({ type: "sift-done", root });
    }
    yield snapshot({ type: "start" });
    for (let root = Math.floor(main.length / 2) - 1; root >= 0; root--) {
        buildRoot = root;
        yield* sift(root);
    }
    buildRoot = null;
    yield snapshot({ type: "heap-built" });
    for (let end = main.length - 1; end > 0; end--) {
        phase = "extract";
        exchange(0, end);
        yield snapshot({ type: "extract-swap", left: 0, right: end });
        heapSize = end;
        yield snapshot({ type: "shrink-heap", index: end });
        phase = "restore";
        yield* sift(0);
    }
    // The final singleton needs no exchange; retire it explicitly for the scene.
    if (heapSize === 1) {
        phase = "extract";
        heapSize = 0;
        yield snapshot({ type: "shrink-heap", index: 0 });
    }
    phase = "done";
    clearPointers();
    yield snapshot({ type: "done" });
}
export const heapSort = {
    iterate: iterateHeapSort,
    steps: (values) => [...iterateHeapSort(values)]
};
