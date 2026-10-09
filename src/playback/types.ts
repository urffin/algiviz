/** State and event must remain immutable while playback uses them. */
export interface Step<S, E> {
    readonly index: number;
    readonly state: S;
    readonly event: E;
}
export interface Frame<S, E> {
    readonly previous: S;
    readonly current: S;
    readonly progress: number;
    readonly stepIndex: number;
    readonly event: E;
}
export interface Timeline<S, E> {
    readonly durationMs: number;
    sample(timeMs: number): Frame<S, E>;
}
