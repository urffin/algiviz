import { createPlayer, type Player } from "../playback/index.js";
import type { ArrayStep, ArraySnapshot, ArrayEvent } from "./types.js";
import type { ArrayFrame } from "./timeline.js";
export type ArrayPlayer = Player<ArraySnapshot, ArrayEvent>;
/** Array playback adapter for array steps ending in done. */
export function createArrayPlayer(steps: Iterable<ArrayStep>, options: { stepDurationMs?: number | undefined; finalHoldMs?: number | undefined; render?: (frame: ArrayFrame) => void } = {}): ArrayPlayer {
    return createPlayer(steps, { ...options, isTerminal: step => step.event.type === "done" });
}
