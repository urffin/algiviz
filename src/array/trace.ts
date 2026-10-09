import { createSortTrace } from "./snapshot-builder.js";
import type { Item, SortStep } from "./types.js";

export interface SortedRegions {
    readonly sortedPrefixLength?: number;
    readonly sortedSuffixLength?: number;
}
export interface ArrayTrace {
    readonly length: number;
    readonly held: Item | null;
    at(index: number): Item | null;
    start(regions?: SortedRegions): SortStep;
    compare(left: number | "held", right: number | "held"): SortStep;
    highlight(positions: readonly (number | "held")[]): SortStep;
    swap(left: number, right: number, regions?: SortedRegions): SortStep;
    select(from: number, regions?: SortedRegions): SortStep;
    shift(from: number, to: number, regions?: SortedRegions): SortStep;
    insert(to: number, regions?: SortedRegions): SortStep;
    pass(end: number, regions?: SortedRegions): SortStep;
    done(regions?: SortedRegions): SortStep;
}

/** Operations own mutations, counters and immutable snapshots, but no algorithm. */
export function createArrayTrace(values: readonly number[]): ArrayTrace {
    const { state, emit } = createSortTrace(values);
    const { slots } = state;
    let phase: "new" | "running" | "done" = "new";
    function index(value: number) {
        if (!Number.isInteger(value) || value < 0 || value >= slots.length) throw new RangeError(`Invalid array index: ${value}`);
    }
    function active() {
        if (phase !== "running") throw new Error("Call start before operations; no operations are allowed after done");
    }
    function item(position: number | "held"): Item {
        if (position !== "held") index(position);
        const value = position === "held" ? state.held : slots[position];
        if (!value) throw new Error(`No item at ${position}`);
        return value;
    }
    function regions(update: SortedRegions = {}) {
        for (const value of [update.sortedPrefixLength, update.sortedSuffixLength]) {
            if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > slots.length)) {
                throw new RangeError("Sorted region length must be between zero and array length");
            }
        }
        if (update.sortedPrefixLength !== undefined) state.sortedPrefixLength = update.sortedPrefixLength;
        if (update.sortedSuffixLength !== undefined) state.sortedSuffixLength = update.sortedSuffixLength;
    }
    return Object.freeze({
        get length() { return slots.length; },
        get held() { return state.held; },
        at(position: number) { index(position); return slots[position]!; },
        start(update?: SortedRegions) {
            if (phase !== "new") throw new Error("Trace has already started");
            regions(update); phase = "running";
            return emit({ type: "start" });
        },
        compare(left: number | "held", right: number | "held") {
            active(); const a = item(left), b = item(right);
            return emit({ type: "compare", leftId: a.id, rightId: b.id });
        },
        highlight(positions: readonly (number | "held")[]) {
            active();
            const itemIds = Object.freeze(positions.map(position => item(position).id));
            return emit({ type: "highlight", itemIds });
        },
        swap(left: number, right: number, update?: SortedRegions) {
            active(); const a = item(left), b = item(right);
            if (left === right) throw new RangeError("Swap requires distinct positions");
            regions(update); slots[left] = b; slots[right] = a;
            return emit({ type: "swap", leftId: a.id, rightId: b.id, left, right });
        },
        select(from: number, update?: SortedRegions) {
            active();
            if (state.held) throw new Error("An item is already held");
            const selected = item(from);
            regions(update); state.held = selected; slots[from] = null;
            return emit({ type: "select", itemId: selected.id, from });
        },
        shift(from: number, to: number, update?: SortedRegions) {
            active(); const moved = item(from); index(to);
            if (slots[to] !== null) throw new Error("Shift destination must be empty");
            regions(update); slots[to] = moved; slots[from] = null;
            return emit({ type: "shift", itemId: moved.id, from, to });
        },
        insert(to: number, update?: SortedRegions) {
            active(); const inserted = item("held"); index(to);
            if (slots[to] !== null) throw new Error("Insert destination must be empty");
            regions(update); slots[to] = inserted; state.held = null;
            return emit({ type: "insert", itemId: inserted.id, to });
        },
        pass(end: number, update?: SortedRegions) {
            active(); index(end); regions(update);
            return emit({ type: "pass", end });
        },
        done(update?: SortedRegions) {
            active();
            if (state.held) throw new Error("Insert the held item before completing the trace");
            regions(update); phase = "done";
            return emit({ type: "done" });
        }
    });
}

export interface ArrayAlgorithm {
    iterate(values: readonly number[]): Generator<SortStep, void, unknown>;
    steps(values: readonly number[]): readonly SortStep[];
}
/** Each iterator owns its workspace; input is read on its first next(). */
export function defineArrayAlgorithm(algorithm: (array: ArrayTrace) => Generator<SortStep, void, unknown>): ArrayAlgorithm {
    function* iterate(values: readonly number[]): Generator<SortStep, void, unknown> {
        yield* algorithm(createArrayTrace(values));
    }
    return Object.freeze({ iterate, steps: (values: readonly number[]) => Object.freeze([...iterate(values)]) });
}

