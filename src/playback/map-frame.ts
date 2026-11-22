import type { Frame } from "./types.js";

/** Project both endpoints while retaining the source frame's playback metadata. */
export function mapFrame<State, MappedState, Event>(
    frame: Frame<State, Event>,
    selectState: (state: State) => MappedState
): Frame<MappedState, Event> {
    return Object.freeze({
        previous: selectState(frame.previous),
        current: selectState(frame.current),
        progress: frame.progress,
        stepIndex: frame.stepIndex,
        event: frame.event,
    });
}
