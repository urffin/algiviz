import { createTimeline, type Frame, type Timeline } from "../playback/index.js";
import type { ArrayEvent, ArraySnapshot, ArrayStep } from "./types.js";
export type ArrayFrame = Frame<ArraySnapshot, ArrayEvent>;
export type ArrayTimeline = Timeline<ArraySnapshot, ArrayEvent>;
export function createArrayTimeline(steps: readonly ArrayStep[], options: { stepDurationMs: number; finalHoldMs: number }): ArrayTimeline {
    return createTimeline(steps, options);
}
