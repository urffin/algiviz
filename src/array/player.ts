import { createPlayer, type Player } from "../playback/index.js";
import type { SortStep, SortSnapshot, SortEvent } from "./types.js";
import type { ArrayFrame } from "./timeline.js";
export type ArrayPlayer = Player<SortSnapshot, SortEvent>;
/** Array playback adapter for array steps ending in done. */
export function createArrayPlayer(steps: Iterable<SortStep>, options: { stepDurationMs: number; finalHoldMs: number; render?: (frame: ArrayFrame) => void }): ArrayPlayer {
    return createPlayer(steps, { ...options, isTerminal: step => step.event.type === "done" });
}
