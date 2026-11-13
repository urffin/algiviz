/** Cooperative cancellation without platform-specific ambient types. */
export interface AsyncSourceSignal {
    readonly aborted: boolean;
    readonly reason: unknown;
    subscribe(listener: (reason: unknown) => void): () => void;
}

export type AsyncSourceFactory<State> =
    (signal: AsyncSourceSignal) => AsyncIterable<State>;

export type AsyncSourceReadResult<State> =
    | { readonly kind: "value"; readonly value: State }
    | { readonly kind: "done" }
    | { readonly kind: "cancelled"; readonly reason: unknown };

export type AsyncSourceCloseResult = (
    | { readonly kind: "completed" }
    | { readonly kind: "disposed"; readonly reason: unknown }
    | { readonly kind: "failed"; readonly error: unknown }
) & {
    readonly cleanupErrors: readonly {
        readonly phase: "abort-listener" | "return";
        readonly error: unknown;
    }[];
    readonly lateReadError: { readonly error: unknown } | null;
};

export interface AsyncSource<State> {
    readonly signal: AsyncSourceSignal;
    readonly waiting: boolean;
    readonly closed: Promise<AsyncSourceCloseResult>;
    next(): Promise<AsyncSourceReadResult<State>>;
    dispose(reason?: unknown): void;
}

type Outcome =
    | { readonly kind: "completed" }
    | { readonly kind: "disposed"; readonly reason: unknown }
    | { readonly kind: "failed"; readonly error: unknown };

function isObject(value: unknown): value is { done?: unknown } {
    return value !== null && (typeof value === "object" || typeof value === "function");
}

/** Own one lazy async iterator. Coalesce reads; observe physical cleanup separately. */
export function createAsyncSource<State>(factory: AsyncSourceFactory<State>): AsyncSource<State> {
    if (typeof factory !== "function") throw new TypeError("Expected an asynchronous source factory");

    let make: AsyncSourceFactory<State> | undefined = factory;
    let iterator: AsyncIterator<State> | undefined;
    let outcome: Outcome | undefined;
    let hasValue = false, ended = false, busy = false, closing = false;
    let aborted = false, reason: unknown;
    const listeners = new Set<{ listener: (reason: unknown) => void }>();
    const cleanupErrors: { readonly phase: "abort-listener" | "return"; readonly error: unknown }[] = [];
    let lateReadError: { readonly error: unknown } | null = null;
    let completeClose!: (result: AsyncSourceCloseResult) => void;
    const closed = new Promise<AsyncSourceCloseResult>(resolve => { completeClose = resolve; });
    let pending: {
        promise: Promise<AsyncSourceReadResult<State>>;
        resolve: (result: AsyncSourceReadResult<State>) => void;
        reject: (error: unknown) => void;
    } | undefined;

    const signal: AsyncSourceSignal = Object.freeze({
        get aborted() { return aborted; },
        get reason() { return reason; },
        subscribe(listener: (reason: unknown) => void) {
            if (typeof listener !== "function") throw new TypeError("Expected a cancellation listener");
            if (aborted) { listener(reason); return () => {}; }
            if (outcome) return () => {};
            const entry = { listener };
            listeners.add(entry);
            return () => { listeners.delete(entry); };
        },
    });

    function abort(cause: unknown) {
        aborted = true; reason = cause;
        for (const entry of listeners) {
            listeners.delete(entry);
            try { entry.listener(reason); }
            catch (error) { cleanupErrors.push(Object.freeze({ phase: "abort-listener", error })); }
        }
        listeners.clear();
    }

    function resolveRead(result: AsyncSourceReadResult<State>) {
        const request = pending;
        pending = undefined;
        request?.resolve(Object.freeze(result));
    }

    function fail(error: unknown) {
        outcome = { kind: "failed", error };
        const request = pending;
        pending = undefined;
        request?.reject(error);
        abort(error);
    }

    async function close(owned: AsyncIterator<State> | undefined) {
        if (owned && !ended) {
            try {
                const finish = owned.return;
                if (finish != null) {
                    if (typeof finish !== "function") throw new TypeError("Iterator return must be callable");
                    const result: unknown = await finish.call(owned);
                    if (!isObject(result) || result.done !== true)
                        throw new TypeError("Iterator return must complete with done: true");
                }
            } catch (error) { cleanupErrors.push(Object.freeze({ phase: "return", error })); }
        }
        completeClose(Object.freeze({ ...outcome!, cleanupErrors: Object.freeze(cleanupErrors), lateReadError }));
    }

    function maybeClose() {
        if (!outcome || busy || closing) return;
        closing = true;
        make = undefined;
        const owned = iterator;
        iterator = undefined;
        // All calls/getters/promises supplied by the source are caught inside close.
        void close(owned);
    }

    async function read() {
        try {
            if (!iterator) {
                const acquire = make!;
                make = undefined;
                const source = acquire(signal);
                const owned = source[Symbol.asyncIterator]();
                if (!isObject(owned)) throw new TypeError("Expected an async iterator object");
                iterator = owned as AsyncIterator<State>;
            }
            // Acquisition/getters may dispose reentrantly. Still own/close their iterator.
            if (outcome) return;
            const pull = iterator.next;
            if (outcome) return;
            if (typeof pull !== "function") throw new TypeError("Iterator next must be callable");
            const result: unknown = await pull.call(iterator);
            if (!isObject(result)) throw new TypeError("Expected an iterator result object");
            const done = Boolean(result.done);
            if (done) {
                ended = true;
                if (outcome) return;
                if (!hasValue) throw new RangeError("Async source requires at least one value");
                outcome = { kind: "completed" };
                listeners.clear();
                resolveRead({ kind: "done" });
            } else if (!outcome) {
                const value = (result as IteratorYieldResult<State>).value;
                if (outcome) return;
                hasValue = true;
                resolveRead({ kind: "value", value });
            }
        } catch (error) {
            if (outcome) lateReadError = Object.freeze({ error });
            else fail(error);
        } finally {
            busy = false;
            maybeClose();
        }
    }

    return Object.freeze({
        signal,
        get waiting() { return pending !== undefined; },
        closed,
        next(): Promise<AsyncSourceReadResult<State>> {
            if (outcome?.kind === "completed") return Promise.resolve(Object.freeze({ kind: "done" }));
            if (outcome?.kind === "disposed")
                return Promise.resolve(Object.freeze({ kind: "cancelled", reason: outcome.reason }));
            if (outcome?.kind === "failed") return Promise.reject(outcome.error);
            if (pending) return pending.promise;
            let resolve!: (result: AsyncSourceReadResult<State>) => void;
            let reject!: (error: unknown) => void;
            const promise = new Promise<AsyncSourceReadResult<State>>((yes, no) => { resolve = yes; reject = no; });
            pending = { promise, resolve, reject };
            busy = true;
            // Install pending/busy before entering any user code, including the factory.
            void read();
            return promise;
        },
        dispose(cause?: unknown) {
            if (outcome) return;
            outcome = { kind: "disposed", reason: cause };
            resolveRead({ kind: "cancelled", reason: cause });
            abort(cause);
            maybeClose();
        },
    });
}
