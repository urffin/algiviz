import type { SortStep } from "./types.js";
import { createSortTrace } from "./sort-trace.js";

/** Creates a stable ascending insertion-sort trace without modifying the input. */
export function insertionSortSteps(values: readonly number[]): readonly SortStep[] {
    return Object.freeze([...iterateInsertionSortSteps(values)]);
}

/**
 * Yields immutable snapshots without retaining history.
 * Input is copied and validated on the first next(), not when creating the iterator.
 */
export function* iterateInsertionSortSteps(values: readonly number[]): Generator<SortStep, void, unknown> {
    const { state, emit } = createSortTrace(values);
    const { slots } = state;
    state.sortedPrefixLength = Math.min(1, slots.length);

    yield emit({ type: "start" });
    for (let i = 1; i < slots.length; i++) {
        const key = slots[i]!;
        state.held = key;
        slots[i] = null;
        state.sortedPrefixLength = i;
        yield emit({ type: "select", itemId: key.id, from: i });

        let hole = i;
        while (hole > 0) {
            const left = slots[hole - 1]!;
            yield emit({ type: "compare", leftId: left.id, rightId: key.id });
            if (left.value <= key.value) break;

            slots[hole] = left;
            slots[hole - 1] = null;
            state.sortedPrefixLength = hole - 1;
            yield emit({ type: "shift", itemId: left.id, from: hole - 1, to: hole });
            hole--;
        }

        slots[hole] = key;
        state.held = null;
        state.sortedPrefixLength = i + 1;
        yield emit({ type: "insert", itemId: key.id, to: hole });
    }
    state.sortedPrefixLength = slots.length;
    yield emit({ type: "done" });
}
