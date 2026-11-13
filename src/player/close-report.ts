import type { AsyncSourceCloseResult } from "../playback/async-source.js";
import type { PlayerCloseResult } from "./types.js";

/** Constant-size lifetime diagnostics; at most two source reports at disposal. */
export function createCloseReport() {
    let errorCount = 0;
    let firstError: PlayerCloseResult["firstError"] = null;
    let resolve!: (result: PlayerCloseResult) => void;
    const closed = new Promise<PlayerCloseResult>(yes => { resolve = yes; });
    let finished = false;
    return {
        closed,
        record(phase: NonNullable<PlayerCloseResult["firstError"]>["phase"], error: unknown) {
            errorCount++;
            firstError ??= Object.freeze({ phase, error });
        },
        finish(sources: readonly AsyncSourceCloseResult[] = []) {
            if (finished) return;
            finished = true;
            resolve(Object.freeze({ sources: Object.freeze([...sources]), errorCount, firstError }));
        },
    };
}
