import type { Frame } from "../playback/types.js";

export interface PlayerLabels {
    readonly start: string;
    readonly play: string;
    readonly pause: string;
    readonly next: string;
    readonly previous: string;
    readonly replay: string;
    readonly restart: string;
    readonly speed: string;
    readonly group: string;
    readonly controls: string;
    readonly idle: string;
    readonly paused: string;
    readonly playing: string;
    readonly finished: string;
    readonly disposed: string;
    readonly step: string;
    readonly error: string;
    readonly ready: string;
    readonly seek: string;
    readonly time: string;
    readonly stream: string;
    readonly streamHint: string;
}

export interface PlayerStatus {
    readonly phase: "idle" | "paused" | "playing" | "finished" | "error" | "disposed";
    readonly mode: "recording" | "stream";
    readonly started: boolean;
    readonly timed: boolean;
    readonly speed: number;
    readonly error: unknown;
    readonly hasError: boolean;
    readonly stepIndex: number | null;
    readonly progress: number | null;
    readonly positionMs: number | null;
    readonly durationMs: number | null;
    readonly canStart: boolean;
    readonly canPlay: boolean;
    readonly canNext: boolean;
    readonly canRestart: boolean;
    readonly canSeek: boolean;
    readonly canPrevious: boolean;
    /** Inclusive retained source positions for bounded streams; otherwise null. */
    readonly rewindStartIndex: number | null;
    readonly rewindEndIndex: number | null;
}

/** Internal control surface shared by the controller and DOM mount. */
export interface PlayerControls<State> {
    readonly status: PlayerStatus;
    readonly frame: Frame<State, undefined> | null;
    start(): PlayerStatus;
    play(): PlayerStatus;
    pause(): PlayerStatus;
    next(): PlayerStatus;
    previous(): PlayerStatus;
    seek(positionMs: number): PlayerStatus;
    restart(): PlayerStatus;
    setSpeed(value: number): PlayerStatus;
    dispose(): void;
}

interface SharedOptions<State> {
    readonly render: (frame: Frame<State, undefined>) => void;
    /** Optional existing direct child of the mount container; restored on dispose. */
    readonly viewport?: Element | undefined;
    readonly stepDurationMs?: number | undefined;
    readonly finalHoldMs?: number | undefined;
    readonly seekBar?: boolean | undefined;
    readonly autoHide?: boolean | undefined;
    readonly labels?: { readonly [Key in keyof PlayerLabels]?: string | undefined } | undefined;
    readonly onStatus?: ((status: PlayerStatus) => void) | undefined;
    readonly onError?: ((error: unknown) => void) | undefined;
}

/** Exactly one factory. Streaming is lazy; history explicitly retains a finite array. */
export type PlayerOptions<State> = SharedOptions<State> & (
    { readonly source: () => Iterable<State>; readonly history?: undefined;
        /** Opt-in retained window, including current. Omit for forward-only playback. */
        readonly rewindCapacity?: number | undefined;
        /** Opt-in maximum next-step requests per RAF; unprocessed playback time carries forward. */
        readonly maxStepsPerFrame?: number | undefined } |
    { readonly history: () => readonly State[]; readonly source?: undefined; readonly stepDurationMs: number;
        readonly rewindCapacity?: undefined; readonly maxStepsPerFrame?: undefined }
);
