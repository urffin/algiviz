import { createTimeline, type Frame, type Timeline } from "../playback/index.js";
import type { SortEvent, SortSnapshot, SortStep } from "./types.js";
export type ArrayFrame = Frame<SortSnapshot, SortEvent>;
export type ArrayTimeline = Timeline<SortSnapshot, SortEvent>;
export function createArrayTimeline(steps: readonly SortStep[], options: { stepDurationMs: number; finalHoldMs: number }): ArrayTimeline {
    return createTimeline(steps, options);
}
