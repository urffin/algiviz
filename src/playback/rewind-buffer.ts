/** Bounded manual navigation over immutable values from a synchronous source. */
export interface RewindBuffer<T> {
    readonly current: T;
    /** Zero-based sequence position, independent of a value's own index. */
    readonly position: number;
    readonly startPosition: number;
    readonly endPosition: number;
    readonly canPrevious: boolean;
    /** True for buffered values or an unread source; the next request may discover exhaustion. */
    readonly canNext: boolean;
    /** Natural exhaustion has been observed. Buffered values can still be replayed. */
    readonly sourceEnded: boolean;
    /** Read one buffered/source value, or keep the current value at the known end. */
    next(): T;
    /** Move back within the retained window, or keep the current value at its start. */
    previous(): T;
    /** Close the source once and release history; current remains readable. */
    dispose(): void;
}

/** Reads the first value immediately, with no lookahead. Capacity includes current.
 * Values are retained by reference without cloning/freezing; keep them immutable.
 * Owns one source iterator; this handle is not itself an Iterable or timed Player. */
export function createRewindBuffer<T>(source: Iterable<T>, options: { capacity: number }): RewindBuffer<T> {
    const capacity = options?.capacity;
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
        throw new RangeError("Rewind buffer capacity must be a positive safe integer");
    }
    let iterator: Iterator<T> | undefined = source[Symbol.iterator]();
    const close = () => {
        const owned = iterator;
        iterator = undefined;
        owned?.return?.();
    };
    let current: T;
    try {
        const first = iterator.next();
        if (first.done) throw new RangeError("Rewind buffer requires at least one value");
        current = first.value;
    } catch (error) {
        try { close(); } catch { /* Preserve the source/empty-source error. */ }
        throw error;
    }
    // A ring overwrites evicted references without shifting the whole window.
    const values: T[] = [current];
    let head = 0, start = 0, end = 0, position = 0;
    let sourceEnded = false, disposed = false, busy = false;
    const check = () => {
        if (disposed) throw new Error("Rewind buffer has been disposed");
        if (busy) throw new Error("Rewind buffer is busy");
    };
    const releaseHistory = () => {
        values.length = 0;
        head = 0;
        start = end = position;
    };
    const select = (target: number) => {
        current = values[(head + (target - start)) % capacity]!;
        position = target;
        return current;
    };
    return Object.freeze({
        get current() { return current; },
        get position() { return position; },
        get startPosition() { return start; },
        get endPosition() { return end; },
        get canPrevious() { return !disposed && position > start; },
        get canNext() { return !disposed && (position < end || !sourceEnded); },
        get sourceEnded() { return sourceEnded; },
        next(): T {
            check();
            if (position < end) return select(position + 1);
            if (sourceEnded) return current;
            busy = true;
            try {
                if (end === Number.MAX_SAFE_INTEGER) throw new RangeError("Rewind buffer position is too large");
                const item = iterator!.next();
                if (item.done) {
                    sourceEnded = true;
                    iterator = undefined;
                    return current;
                }
                const value = item.value;
                if (values.length === capacity) {
                    values[head] = value;
                    head = (head + 1) % capacity;
                    start++;
                } else values.push(value);
                end++;
                position = end;
                current = value;
                return current;
            } catch (error) {
                disposed = true;
                releaseHistory();
                try { close(); } catch { /* Preserve the read failure. */ }
                throw error;
            } finally {
                busy = false;
            }
        },
        previous(): T {
            check();
            return position > start ? select(position - 1) : current;
        },
        dispose(): void {
            if (disposed) return;
            check();
            disposed = true;
            releaseHistory();
            close();
        }
    });
}
