import { mountControls } from "./mount.js";
import type { PlayerControls, PlayerOptions, PlayerStatus } from "./types.js";
import type { Frame } from "../playback/types.js";

/** Optional browser widget. Construction creates idle controls; start reads the first state. */
export class Player<State> {
    readonly #controls: PlayerControls<State>;

    constructor(container: HTMLElement, options: PlayerOptions<State>) {
        this.#controls = mountControls(container, options);
    }

    get status(): PlayerStatus { return this.#controls.status; }
    get frame(): Frame<State, undefined> | null { return this.#controls.frame; }
    get closed() { return this.#controls.closed; }
    start(): PlayerStatus { return this.#controls.start(); }
    play(): PlayerStatus { return this.#controls.play(); }
    pause(): PlayerStatus { return this.#controls.pause(); }
    next(): PlayerStatus { return this.#controls.next(); }
    previous(): PlayerStatus { return this.#controls.previous(); }
    seek(positionMs: number): PlayerStatus { return this.#controls.seek(positionMs); }
    restart(): PlayerStatus { return this.#controls.restart(); }
    setSpeed(value: number): PlayerStatus { return this.#controls.setSpeed(value); }
    dispose(): void { this.#controls.dispose(); }
}
