import type { Item, SortEvent, SortStep } from "./types.js";

/** Creates a stable ascending insertion-sort trace without modifying the input. */
export function insertionSortSteps(values: readonly number[]): readonly SortStep[] {
    return Object.freeze([...iterateInsertionSortSteps(values)]);
}

/**
 * Yields immutable snapshots without retaining history.
 * Input is copied and validated on the first next(), not when creating the iterator.
 */
export function* iterateInsertionSortSteps(values: readonly number[]): Generator<SortStep, void, unknown> {
    // Array.from also exposes sparse holes as undefined for validation.
    const input = Array.from(values);
    for (let i = 0; i < input.length; i++) {
        if (typeof input[i] !== "number" || !Number.isFinite(input[i])) {
            throw new TypeError(`Expected a finite number at index ${i}`);
        }
    }

    const slots: (Item | null)[] = input.map((value, index) =>
        Object.freeze({ id: `item-${index}`, value })
    );
    let index = 0;
    let held: Item | null = null;
    let sortedPrefixLength = Math.min(1, slots.length);
    let comparisons = 0;
    let writes = 0;

    const emit = (event: SortEvent): SortStep => {
        return Object.freeze({
            index: index++,
            event: Object.freeze(event),
            state: Object.freeze({
                slots: Object.freeze(slots.slice()),
                held,
                sortedPrefixLength,
                comparisons,
                writes
            })
        });
    };

    yield emit({ type: "start" });
    for (let i = 1; i < slots.length; i++) {
        const key = slots[i]!;
        held = key;
        slots[i] = null;
        sortedPrefixLength = i;
        yield emit({ type: "select", itemId: key.id, from: i });

        let hole = i;
        while (hole > 0) {
            const left = slots[hole - 1]!;
            comparisons++;
            yield emit({ type: "compare", leftId: left.id, rightId: key.id });
            if (left.value <= key.value) break;

            slots[hole] = left;
            slots[hole - 1] = null;
            writes++;
            sortedPrefixLength = hole - 1;
            yield emit({ type: "shift", itemId: left.id, from: hole - 1, to: hole });
            hole--;
        }

        slots[hole] = key;
        held = null;
        writes++;
        sortedPrefixLength = i + 1;
        yield emit({ type: "insert", itemId: key.id, to: hole });
    }
    sortedPrefixLength = slots.length;
    yield emit({ type: "done" });
}
