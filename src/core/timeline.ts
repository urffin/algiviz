import { createTimeline, type Frame, type Timeline } from "../playback/index.js";
import type { SortEvent, SortSnapshot, SortStep } from "./types.js";
export type SortFrame = Frame<SortSnapshot, SortEvent>;
export type SortTimeline = Timeline<SortSnapshot, SortEvent>;
export function createSortTimeline(steps: readonly SortStep[], options: { stepDurationMs: number; finalHoldMs: number }): SortTimeline {
    return createTimeline(steps, options);
}
