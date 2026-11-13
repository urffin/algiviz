import { createStateController, type StateController } from "./controller.js";
import type { PlayerControls, PlayerOptions, PlayerLabels, PlayerStatus } from "./types.js";

const defaults: PlayerLabels = Object.freeze({ start: 'Start', play: 'Play', pause: 'Pause', next: 'Next state', previous: 'Previous state', replay: 'Replay',
    restart: 'Restart', speed: 'Speed', group: 'Visualization player', controls: 'Playback controls', idle: 'Press Start to read the first state.',
    paused: 'Paused', playing: 'Playing', finished: 'Finished', disposed: 'Disposed', step: 'State', error: 'Error',
    ready: 'Ready', seek: 'Playback position', time: 'Playback time', stream: 'STREAM', streamHint: 'Sequential source · no time seeking' });
const speeds = [0.25, 0.5, 1, 2, 4, 8, 16];
type IconName = "play" | "pause" | "next" | "previous" | "restart";
const icons: Record<IconName, readonly [string, boolean]> = {
    play: ['M8 5v14l11-7z', true], pause: ['M6 5h4v14H6zm8 0h4v14h-4z', true],
    next: ['M5 5v14l10-7zM17 5h2v14h-2z', true], previous: ['M19 5v14L9 12zM5 5h2v14H5z', true],
    restart: ['M4 11a8 8 0 1 1 2 7M4 4v7h7', false],
};
function timeLabel(value: number | null): string {
    if (value === null) return '—:—';
    const seconds = Math.floor(value / 1000), minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
function errorMessage(error: unknown): string {
    try { return error instanceof Error ? error.message : String(error); }
    catch { return 'Unknown error'; }
}
const styles = `.algiviz-player{position:relative;overflow:hidden;border:1px solid var(--player-border,#3b4b64);border-radius:12px;background:var(--player-stage,#0c1423);font:inherit;color:var(--player-text,#fff)}
.algiviz-player__viewport>canvas,.algiviz-player__viewport>svg{display:block;width:100%;height:auto;margin:0;border:0;border-radius:0}
.algiviz-player__controls{display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:6px 8px;background:var(--player-panel,#11151c)}
.algiviz-player__viewport+.algiviz-player__controls{border-top:1px solid var(--player-border,#3b4b64)}
.algiviz-player[data-overlay=true]>.algiviz-player__viewport{min-height:160px;display:flex;align-items:center}
.algiviz-player[data-overlay=true]>.algiviz-player__controls{position:absolute;inset:auto 0 0;z-index:1;border:0;padding-top:20px;background:linear-gradient(transparent,#080c13df 35%,#080c13f5);transition:opacity .16s ease}
.algiviz-player[data-overlay=true][data-controls=hidden]>.algiviz-player__controls{opacity:0;pointer-events:none}
@media(prefers-reduced-motion:reduce){.algiviz-player[data-overlay=true]>.algiviz-player__controls{transition:none}}
.algiviz-player [hidden]{display:none!important}.algiviz-player button{display:inline-flex;align-items:center;justify-content:center;flex:none;width:40px;height:40px;padding:8px;border:0;border-radius:6px;background:transparent;color:inherit;cursor:pointer}
.algiviz-player button:hover:not(:disabled){background:#ffffff18}.algiviz-player button:disabled{opacity:.28;cursor:not-allowed}.algiviz-player :focus-visible{outline:2px solid var(--player-accent,#83e6cf);outline-offset:2px}
.algiviz-player button>svg{width:24px;height:24px;display:block;margin:0;background:none;border:0;border-radius:0;flex:none}
.algiviz-player__sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
.algiviz-player label{margin-left:auto;display:flex;align-items:center;min-height:40px}.algiviz-player select{font:600 13px system-ui;min-height:36px;padding:4px;border:0;border-radius:6px;background:var(--player-panel,#11151c);color:inherit;cursor:pointer}
.algiviz-player output{font:13px system-ui;color:#cbd5e1;white-space:nowrap}.algiviz-player [data-role=time]{font:12px ui-monospace,monospace;white-space:nowrap;color:#cbd5e1;margin:0 4px;font-variant-numeric:tabular-nums}
.algiviz-player [data-role=stream]{display:inline-flex;align-items:center;gap:5px;color:#cbd5e1;font:600 10px system-ui;letter-spacing:.06em;margin:0 4px}.algiviz-player [data-role=stream]::before{content:'';width:6px;height:6px;border-radius:50%;background:#718096}.algiviz-player[data-phase=playing] [data-role=stream]::before{background:var(--player-accent,#83e6cf)}
.algiviz-player [data-action=seek]{width:100%;flex-basis:100%;height:14px;margin:0 2px 2px;cursor:pointer;background:transparent;accent-color:var(--player-accent,#83e6cf);appearance:none}
.algiviz-player [data-action=seek]::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:linear-gradient(to right,var(--player-accent,#83e6cf) var(--position,0%),#ffffff40 var(--position,0%))}.algiviz-player [data-action=seek]::-webkit-slider-thumb{appearance:none;width:11px;height:11px;margin-top:-4px;border:0;border-radius:50%;background:var(--player-accent,#83e6cf)}
.algiviz-player [data-action=seek]::-moz-range-track{height:3px;background:#ffffff40}.algiviz-player [data-action=seek]::-moz-range-progress{height:3px;background:var(--player-accent,#83e6cf)}.algiviz-player [data-action=seek]::-moz-range-thumb{width:11px;height:11px;border:0;background:var(--player-accent,#83e6cf)}
.algiviz-player [data-action=seek]:disabled{opacity:.3;cursor:not-allowed}.algiviz-player [data-role=error]{color:var(--player-error,#ffb4b4);flex-basis:100%;margin:0;font-size:13px}`;

/** Mount a lazy playback widget; temporarily host and restore the caller's viewport. */
export function mountControls<State>(container: HTMLElement, options: PlayerOptions<State>): PlayerControls<State> {
    const doc = container?.ownerDocument, view = doc?.defaultView;
    if (!doc || !view || typeof container.append !== 'function') throw new TypeError('Expected a DOM container');
    if (!options || typeof options !== 'object') throw new TypeError('Expected player options');
    const { source, history, render, viewport, seekBar = true, autoHide = true, stepDurationMs, finalHoldMs, rewindCapacity, maxStepsPerFrame, onError, onStatus, labels: overrides } = options;
    if (viewport !== undefined && (!viewport || viewport.ownerDocument !== doc || viewport.parentNode !== container))
        throw new TypeError('Viewport must be a direct child of the player container');
    if ((onStatus !== undefined && typeof onStatus !== 'function') || (onError !== undefined && typeof onError !== 'function'))
        throw new TypeError('onStatus and onError must be functions');
    if (typeof seekBar !== 'boolean' || typeof autoHide !== 'boolean') throw new TypeError('seekBar and autoHide must be booleans');
    const labels = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof PlayerLabels)[]) {
        const value = overrides?.[key];
        if (value !== undefined) {
            if (typeof value !== 'string' || !value.trim()) throw new TypeError('Player labels must be non-empty strings');
            labels[key] = value;
        }
    }
    const root = doc.createElement('div'); root.className = 'algiviz-player';
    root.setAttribute('role', 'group'); root.setAttribute('aria-label', labels.group);
    const overlay = !!viewport && autoHide;
    root.dataset.overlay = String(overlay); root.dataset.controls = 'visible';
    if (overlay) root.tabIndex = 0;
    const style = doc.createElement('style'); style.textContent = styles; root.append(style);
    let stage: HTMLDivElement | undefined;
    if (viewport) {
        stage = doc.createElement('div'); stage.className = 'algiviz-player__viewport'; stage.dataset.role = 'viewport'; root.append(stage);
    }
    const panel = doc.createElement('div'); panel.className = 'algiviz-player__controls'; panel.dataset.role = 'controls';
    panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', labels.controls); root.append(panel);
    const seek = doc.createElement('input'); seek.type = 'range'; seek.min = '0'; seek.max = '1'; seek.step = '1'; seek.value = '0';
    seek.dataset.action = 'seek'; seek.setAttribute('aria-label', labels.seek); panel.append(seek);
    type Action = 'previous' | 'start' | 'play' | 'next' | 'restart';
    const buttons = {} as Record<Action, HTMLButtonElement>;
    const symbols = new Map<HTMLButtonElement, { path: SVGPathElement; caption: HTMLSpanElement; text?: string }>();
    function buttonLabel(button: HTMLButtonElement, text: string, icon: IconName) {
        const symbol = symbols.get(button)!;
        if (symbol.text !== text) {
            symbol.text = text; symbol.caption.textContent = text; button.title = text; button.setAttribute('aria-label', text);
        }
        if (button.dataset.icon !== icon) {
            button.dataset.icon = icon;
            const [path, filled] = icons[icon]; symbol.path.setAttribute('d', path);
            symbol.path.setAttribute('fill', filled ? 'currentColor' : 'none');
            symbol.path.setAttribute('stroke', filled ? 'none' : 'currentColor');
        }
    }
    for (const action of ['previous', 'start', 'play', 'next', 'restart'] as const) {
        const button = doc.createElement('button'); button.type = 'button';
        const icon = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('aria-hidden', 'true'); icon.setAttribute('focusable', 'false');
        const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('stroke-width', '2'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round'); icon.append(path);
        const caption = doc.createElement('span'); caption.className = 'algiviz-player__sr';
        button.append(icon, caption); symbols.set(button, { path, caption });
        button.dataset.action = action; buttonLabel(button, labels[action], action === 'start' ? 'play' : action); panel.append(button); buttons[action] = button;
    }
    const output = doc.createElement('output'); output.setAttribute('role', 'status'); panel.append(output);
    const time = doc.createElement('span'); time.dataset.role = 'time'; time.setAttribute('aria-label', labels.time); panel.append(time);
    const stream = doc.createElement('span'); stream.dataset.role = 'stream'; stream.textContent = labels.stream; stream.title = labels.streamHint; panel.append(stream);
    const speedLabel = doc.createElement('label');
    const speedCaption = doc.createElement('span'); speedCaption.className = 'algiviz-player__sr'; speedCaption.textContent = labels.speed; speedLabel.append(speedCaption);
    const speed = doc.createElement('select'); speed.dataset.action = 'speed';
    for (const value of speeds) {
        const option = doc.createElement('option'); option.value = String(value); option.textContent = `${value}×`; speed.append(option);
    }
    speed.value = '1'; speedLabel.append(speed); panel.append(speedLabel);
    const alert = doc.createElement('p'); alert.dataset.role = 'error'; alert.setAttribute('role', 'alert'); panel.append(alert);
    const removers: (() => void)[] = [];
    type Events = HTMLElementEventMap & DocumentEventMap & WindowEventMap & MediaQueryListEventMap;
    function listen<Key extends keyof Events>(target: EventTarget, event: Key, callback: (event: Events[Key]) => void) {
        const listener = callback as EventListener;
        target.addEventListener(event, listener); removers.push(() => target.removeEventListener(event, listener));
    }
    let controller: StateController<State>;
    let customSpeed: HTMLOptionElement | undefined;
    let disposed = false, hideTimer: number | null = null;
    let lastPhase: PlayerStatus["phase"] | undefined, lastError: boolean | undefined;
    let keyboardFocus = false, panelHover = false, speedFocused = false;
    const pointers = new Set<number>();
    function cancelHide() {
        if (hideTimer !== null) view!.clearTimeout(hideTimer);
        hideTimer = null;
    }
    function pinned() {
        const state = controller?.status;
        return !state?.started || state.hasError || keyboardFocus || panelHover || pointers.size > 0 || speedFocused;
    }
    function scheduleHide() {
        cancelHide();
        if (!overlay || disposed || pinned()) return;
        hideTimer = view!.setTimeout(() => {
            hideTimer = null;
            if (!disposed && !pinned()) root.dataset.controls = 'hidden';
        }, 2000);
    }
    function reveal() {
        if (disposed) return;
        root.dataset.controls = 'visible'; scheduleHide();
    }
    function update(state: PlayerStatus) {
        root.dataset.phase = state.phase;
        buttons.start.hidden = state.started;
        buttons.start.disabled = !state.canStart;
        buttons.next.hidden = !state.started; buttons.next.disabled = !state.canNext;
        buttons.restart.hidden = !state.started; buttons.restart.disabled = !state.canRestart;
        buttons.previous.hidden = (state.mode !== 'recording' && rewindCapacity === undefined) || !state.started;
        buttons.previous.disabled = !state.canPrevious;
        buttons.play.hidden = !state.timed || !state.started;
        buttons.play.disabled = !state.canPlay && state.phase !== 'finished';
        buttonLabel(buttons.play, state.phase === 'finished' ? labels.replay : state.phase === 'playing' ? labels.pause : labels.play,
            state.phase === 'finished' ? 'restart' : state.phase === 'playing' ? 'pause' : 'play');
        buttons.play.setAttribute('aria-pressed', String(state.phase === 'playing'));
        if (!speeds.includes(state.speed)) {
            if (!customSpeed) { customSpeed = doc.createElement('option'); speed.append(customSpeed); }
            customSpeed.value = String(state.speed); customSpeed.textContent = `${state.speed}×`;
        } else if (customSpeed) { customSpeed.remove(); customSpeed = undefined; }
        speedLabel.hidden = !state.timed; speed.disabled = state.phase === 'disposed'; speed.value = String(state.speed);
        output.setAttribute('aria-live', state.phase === 'playing' ? 'off' : 'polite');
        const summary = state.phase === 'finished' ? labels.finished : state.started ? `${labels.step} ${state.stepIndex ?? '—'}` : labels.ready;
        if (output.textContent !== summary) output.textContent = summary;
        output.title = state.started ? state.phase === "idle" ? labels.idle : labels[state.phase] : labels.idle;
        output.setAttribute('aria-label', state.started ? `${labels.step} ${state.stepIndex ?? '—'} · ${output.title}` : labels.idle);
        seek.hidden = !seekBar || state.mode !== 'recording'; seek.disabled = !state.canSeek;
        seek.max = String(state.durationMs || 1); seek.value = String(state.positionMs ?? 0);
        seek.style.setProperty('--position', `${state.durationMs ? ((state.positionMs ?? 0) / state.durationMs) * 100 : 0}%`);
        seek.setAttribute('aria-valuetext', `${timeLabel(state.positionMs)} / ${timeLabel(state.durationMs)}`);
        time.hidden = state.mode !== 'recording'; time.textContent = `${timeLabel(state.positionMs)} / ${timeLabel(state.durationMs)}`;
        stream.hidden = state.mode !== 'stream';
        stream.textContent = state.rewindStartIndex === null ? labels.stream
            : `${labels.stream} · ${labels.step} ${state.rewindStartIndex}–${state.rewindEndIndex}`;
        alert.textContent = !state.hasError ? '' : `${labels.error}: ${errorMessage(state.error)}`;
        alert.hidden = !state.hasError;
        if (state.phase !== lastPhase || state.hasError !== lastError) reveal();
        lastPhase = state.phase; lastError = state.hasError;
    }
    controller = createStateController({ source, history, render, stepDurationMs, finalHoldMs, rewindCapacity, maxStepsPerFrame, onError, onStatus, onChange: update,
        scheduler: { request: fn => view.requestAnimationFrame(fn), cancel: id => view.cancelAnimationFrame(id) } });
    const handle: PlayerControls<State> = Object.freeze({
        get status() { return controller.status; },
        get frame() { return controller.frame; },
        start: () => controller.start(), play: () => controller.play(), pause: () => controller.pause(),
        next: () => controller.next(), restart: () => controller.restart(), setSpeed: (value: number) => controller.setSpeed(value),
        previous: () => controller.previous(), seek: (value: number) => controller.seek(value),
        dispose() {
            if (disposed) return;
            try { controller.dispose(); }
            finally {
                if (controller.status.phase === "disposed") {
                    disposed = true;
                    cancelHide();
                    for (const remove of removers.splice(0)) remove();
                    if (viewport && viewport.parentNode === stage) container.insertBefore(viewport, root.parentNode === container ? root : null);
                    root.remove();
                }
            }
        },
    });
    try {
        if (overlay) {
            listen(root, 'pointerenter', reveal);
            listen(root, 'pointermove', reveal);
            listen(root, 'pointerleave', () => { panelHover = false; scheduleHide(); });
            listen(root, 'pointerdown', event => { keyboardFocus = false; pointers.add(event.pointerId); reveal(); });
            listen(panel, 'pointerenter', () => { panelHover = true; reveal(); });
            listen(panel, 'pointerleave', () => { panelHover = false; scheduleHide(); });
            listen(root, 'keydown', () => { keyboardFocus = true; reveal(); });
            listen(root, 'focusin', event => {
                keyboardFocus = (event.target as Element).matches(':focus-visible'); speedFocused = event.target === speed; reveal();
            });
            listen(root, 'focusout', event => {
                if (event.target === speed) speedFocused = false;
                if (!root.contains(event.relatedTarget as Node | null)) keyboardFocus = false;
                scheduleHide();
            });
            listen(doc, 'pointerdown', event => {
                if (!root.contains(event.target as Node | null)) { keyboardFocus = false; speedFocused = false; scheduleHide(); }
            });
            const release = (event: PointerEvent) => { pointers.delete(event.pointerId); scheduleHide(); };
            listen(doc, 'pointerup', release); listen(doc, 'pointercancel', release);
            listen(view, 'blur', () => { pointers.clear(); panelHover = false; keyboardFocus = false; scheduleHide(); });
        }
        listen(buttons.start, 'click', () => controller.start());
        listen(buttons.play, 'click', () => {
            if (controller.status.phase === 'finished') {
                if (controller.restart().phase === 'paused') controller.play();
            } else if (controller.status.phase === 'playing') controller.pause();
            else controller.play();
        });
        listen(buttons.next, 'click', () => controller.next());
        listen(buttons.previous, 'click', () => controller.previous());
        listen(buttons.restart, 'click', () => controller.restart());
        listen(speed, 'change', () => controller.setSpeed(Number(speed.value)));
        listen(seek, 'input', () => controller.seek(Number(seek.value)));
        listen(doc, 'visibilitychange', () => { if (doc.hidden) controller.pause(); });
        listen(view, 'pagehide', () => handle.dispose());
        const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
        listen(reduced, 'change', () => controller.setReducedMotion(reduced.matches));
        if (viewport) { container.insertBefore(root, viewport); stage!.append(viewport); }
        else container.append(root);
        controller.setReducedMotion(reduced.matches);
    } catch (error) { try { handle.dispose(); } catch {} throw error; }
    return handle;
}
