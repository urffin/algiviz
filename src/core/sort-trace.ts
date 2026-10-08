import type { Item, SortEvent, SortStep } from "./types.js";

/** Internal mutable workspace; only emit() exposes immutable snapshots. */
export function createSortTrace(values: readonly number[]) {
    // Array.from exposes sparse holes as undefined so they fail validation too.
    const input = Array.from(values);
    const slots: (Item | null)[] = input.map((value, index) => {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new TypeError(`Expected a finite number at index ${index}`);
        }
        return Object.freeze({ id: `item-${index}`, value });
    });
    const state: {
        slots: (Item | null)[];
        held: Item | null;
        sortedPrefixLength: number;
        sortedSuffixLength?: number;
    } = { slots, held: null, sortedPrefixLength: 0 };
    let index = 0;
    let comparisons = 0;
    let writes = 0;

    function emit(event: SortEvent): SortStep {
        if (event.type === "compare") comparisons++;
        if (event.type === "shift" || event.type === "insert") writes++;
        if (event.type === "swap") writes += 2;
        return Object.freeze({
            index: index++,
            event: Object.freeze(event),
            state: Object.freeze({
                ...state,
                slots: Object.freeze(state.slots.slice()),
                comparisons,
                writes
            })
        });
    }

    return { state, emit };
}
