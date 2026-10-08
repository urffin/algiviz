import type { Item, SortEvent, SortStep } from "./types.js";

/** Creates a stable ascending bubble-sort trace without modifying the input. */
export function bubbleSortSteps(values: readonly number[]): readonly SortStep[] {
    return Object.freeze([...iterateBubbleSortSteps(values)]);
}

/** Yields immutable snapshots lazily, retaining no history. */
export function* iterateBubbleSortSteps(values: readonly number[]): Generator<SortStep, void, unknown> {
    const input = Array.from(values);
    for (let i = 0; i < input.length; i++) {
        if (typeof input[i] !== "number" || !Number.isFinite(input[i])) {
            throw new TypeError(`Expected a finite number at index ${i}`);
        }
    }
    const slots: Item[] = input.map((value, index) => Object.freeze({ id: `item-${index}`, value }));
    let index = 0;
    let comparisons = 0;
    let writes = 0;
    let sortedSuffixLength = slots.length < 2 ? slots.length : 0;
    const emit = (event: SortEvent): SortStep => Object.freeze({
        index: index++,
        event: Object.freeze(event),
        state: Object.freeze({
            slots: Object.freeze(slots.slice()),
            held: null,
            sortedPrefixLength: 0,
            sortedSuffixLength,
            comparisons,
            writes
        })
    });

    yield emit({ type: "start" });
    for (let end = slots.length - 1; end > 0; end--) {
        let swapped = false;
        for (let left = 0; left < end; left++) {
            const right = left + 1;
            const a = slots[left]!;
            const b = slots[right]!;
            comparisons++;
            yield emit({ type: "compare", leftId: a.id, rightId: b.id });
            if (a.value <= b.value) continue;
            slots[left] = b;
            slots[right] = a;
            writes += 2;
            swapped = true;
            yield emit({ type: "swap", leftId: a.id, rightId: b.id, left, right });
        }
        sortedSuffixLength = swapped ? slots.length - end : slots.length;
        yield emit({ type: "pass", end });
        if (!swapped) break;
    }
    sortedSuffixLength = slots.length;
    yield emit({ type: "done" });
}
