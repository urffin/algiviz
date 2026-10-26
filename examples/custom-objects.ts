import { createPlayer, createStepEmitter, type Step } from '@grundyjs/algiviz/playback';
import { createSceneRenderer, type Scene } from '@grundyjs/algiviz/scene';

// Both object types and the algorithm are application-owned.
interface Objects {
    token: Readonly<{ x: number }>;
    label: Readonly<{ text: string }>;
}
type Event = 'start' | 'move' | 'done';

export function* steps(): Generator<Step<Scene<Objects>, Event>> {
    let x = 0;
    const emit = createStepEmitter((): Scene<Objects> => Object.freeze({
        objects: Object.freeze([
            Object.freeze({ id: 'token', type: 'token' as const, data: Object.freeze({ x }) }),
            Object.freeze({ id: 'label', type: 'label' as const, data: Object.freeze({ text: `Position ${x}` }) }),
        ]),
    }));
    yield emit('start');
    for (x = 1; x <= 3; x++) yield emit(x === 3 ? 'done' : 'move');
}

const renderer = createSceneRenderer<Objects, CanvasRenderingContext2D, Event>({
    token(ctx, object) {
        const from = object.previous ?? object.current;
        const to = object.current ?? object.previous;
        if (!from || !to) return;
        const x = from.data.x + (to.data.x - from.data.x) * object.progress;
        ctx.save();
        try {
            ctx.globalAlpha = object.presence;
            ctx.fillStyle = '#7c3aed';
            ctx.beginPath();
            ctx.arc(24 + x / 3 * (ctx.canvas.width - 48), 50, 16, 0, Math.PI * 2);
            ctx.fill();
        } finally { ctx.restore(); }
    },
    label(ctx, object) {
        const value = object.current ?? object.previous;
        if (!value) return;
        ctx.save();
        try {
            ctx.globalAlpha = object.presence;
            ctx.fillStyle = '#182230';
            ctx.font = '18px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(value.data.text, ctx.canvas.width / 2, 100);
        } finally { ctx.restore(); }
    },
});

// The host owns the controls and calls the returned cleanup when unmounting.
export function mountCustomObjects(canvas: HTMLCanvasElement, play: HTMLButtonElement,
    pause: HTMLButtonElement, restart: HTMLButtonElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const create = () => createPlayer(steps(), {
        stepDurationMs: 600, finalHoldMs: 0,
        isTerminal: step => step.event === 'done',
        render(frame) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            renderer.render(ctx, reduced.matches ? { ...frame, progress: 1 } : frame);
        },
    });
    let player = create();
    let request = 0;
    let last: number | undefined;
    let running = false;
    let disposed = false;
    function update() {
        play.disabled = disposed || running || player.finished;
        pause.disabled = disposed || !running;
        restart.disabled = disposed;
    }
    function stop() {
        running = false;
        cancelAnimationFrame(request);
        last = undefined;
        update();
    }
    function tick(now: number) {
        if (!running) return;
        const delta = last === undefined ? 0 : Math.min(100, now - last);
        last = now;
        try { player.advance(delta); }
        catch (error) { stop(); throw error; }
        if (player.finished) stop();
        else request = requestAnimationFrame(tick);
    }
    function start() {
        if (disposed || running || player.finished || document.hidden) return;
        running = true;
        update();
        request = requestAnimationFrame(tick);
    }
    function reset() {
        if (disposed) return;
        stop();
        player.dispose();
        player = create();
        update();
    }
    function visibility() { if (document.hidden) stop(); }
    function redraw() { player.advance(0); }
    play.addEventListener('click', start);
    pause.addEventListener('click', stop);
    restart.addEventListener('click', reset);
    document.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', redraw);
    update();
    return () => {
        if (disposed) return;
        disposed = true;
        stop();
        play.removeEventListener('click', start);
        pause.removeEventListener('click', stop);
        restart.removeEventListener('click', reset);
        document.removeEventListener('visibilitychange', visibility);
        reduced.removeEventListener('change', redraw);
        player.dispose();
    };
}
