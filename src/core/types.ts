export type Item = Readonly<{ id: string; value: number }>;

export type SortEvent = Readonly<
    | { type: "start" }
    | { type: "select"; itemId: string; from: number }
    | { type: "compare"; leftId: string; rightId: string }
    | { type: "shift"; itemId: string; from: number; to: number }
    | { type: "insert"; itemId: string; to: number }
    | { type: "done" }
>;

export interface SortSnapshot {
    readonly slots: readonly (Item | null)[];
    readonly held: Item | null;
    /** Sorted leading occupied slots; during insertion it ends at the hole. */
    readonly sortedPrefixLength: number;
    readonly comparisons: number;
    /** Writes into array slots; selecting a key does not count as a write. */
    readonly writes: number;
}

export interface SortStep {
    readonly index: number;
    readonly event: SortEvent;
    /** Complete immutable state immediately after the event. */
    readonly state: SortSnapshot;
}
