// Private shared types, publicly re-exported by /worker and /worker/runtime.
import type { AsyncSourceSignal } from "../playback/async-source.js";

export type WorkerSourcePhase =
    | "create" | "input" | "init" | "acquire" | "next"
    | "transfer" | "serialize" | "post" | "protocol" | "worker"
    | "messageerror" | "abort-listener" | "return" | "terminate" | "teardown";

export type WorkerSourceRemotePhase =
    | "init" | "acquire" | "next" | "transfer" | "serialize"
    | "post" | "protocol" | "abort-listener" | "return" | "teardown";

export type WorkerSourceErrorCode =
    | "startup" | "protocol" | "serialization"
    | "transport" | "remote" | "cleanup";

export type WorkerSourceThrownKind =
    | "undefined" | "null" | "boolean" | "number" | "bigint"
    | "string" | "symbol" | "object" | "function";

export interface WorkerSourceRemoteError {
    readonly phase: WorkerSourceRemotePhase;
    readonly thrownKind: WorkerSourceThrownKind;
    readonly name: string;
    readonly message: string;
    readonly stack: string | null;
}

export interface WorkerSourceIssue {
    readonly origin: "host" | "worker";
    readonly phase: WorkerSourcePhase;
    readonly error: unknown;
}

export interface WorkerSourceCleanupSummary {
    readonly count: number;
    readonly first: WorkerSourceIssue | null;
}

export type WorkerSourceTermination =
    | { readonly kind: "not-created" }
    | {
        readonly kind: "acknowledged" | "forced";
        readonly terminate: "requested" | "failed";
    };

export type WorkerSourceCloseResult = (
    | { readonly kind: "completed" }
    | { readonly kind: "disposed"; readonly reason: unknown }
    | {
        readonly kind: "failed";
        readonly error: unknown;
        readonly origin: "host" | "worker";
        readonly phase: WorkerSourcePhase;
    }
) & {
    readonly termination: WorkerSourceTermination;
    readonly cleanup: WorkerSourceCleanupSummary;
    readonly lateReadError: WorkerSourceIssue | null;
};

export interface WorkerSourceShutdownOptions {
    readonly gracePeriodMs?: number | undefined;
}

export interface WorkerSourceCancellation {
    readonly kind: "restart" | "dispose" | "return" | "cancel";
    readonly message: string | null;
}

export interface WorkerSourceSignal extends AsyncSourceSignal {
    readonly reason: WorkerSourceCancellation | undefined;
    subscribe(listener: (reason: WorkerSourceCancellation) => void): () => void;
}
