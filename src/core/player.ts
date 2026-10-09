import { createPlayer, type Player } from "../playback/index.js";
import type { SortStep, SortSnapshot, SortEvent } from "./types.js";
import type { SortFrame } from "./timeline.js";
export type SortPlayer = Player<SortSnapshot, SortEvent>;
/** Compatibility adapter for array steps ending in done. */
export function createSortPlayer(steps: Iterable<SortStep>, options: { stepDurationMs: number; finalHoldMs: number; render?: (frame: SortFrame) => void }): SortPlayer {
    return createPlayer(steps, { ...options, isTerminal: step => step.event.type === "done" });
}
