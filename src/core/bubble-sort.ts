import type { SortStep } from "./types.js";
import { createSortTrace } from "./sort-trace.js";

/** Creates a stable ascending bubble-sort trace without modifying the input. */
export function bubbleSortSteps(values: readonly number[]): readonly SortStep[] {
    return Object.freeze([...iterateBubbleSortSteps(values)]);
}

/** Yields immutable snapshots lazily, retaining no history. */
export function* iterateBubbleSortSteps(values: readonly number[]): Generator<SortStep, void, unknown> {
    const { state, emit } = createSortTrace(values);
    const { slots } = state;
    state.sortedSuffixLength = slots.length < 2 ? slots.length : 0;

    yield emit({ type: "start" });
    for (let end = slots.length - 1; end > 0; end--) {
        let swapped = false;
        for (let left = 0; left < end; left++) {
            const right = left + 1;
            const a = slots[left]!;
            const b = slots[right]!;
            yield emit({ type: "compare", leftId: a.id, rightId: b.id });
            if (a.value <= b.value) continue;
            slots[left] = b;
            slots[right] = a;
            swapped = true;
            yield emit({ type: "swap", leftId: a.id, rightId: b.id, left, right });
        }
        state.sortedSuffixLength = swapped ? slots.length - end : slots.length;
        yield emit({ type: "pass", end });
        if (!swapped) break;
    }
    state.sortedSuffixLength = slots.length;
    yield emit({ type: "done" });
}
