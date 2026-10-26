import { createPlayer, createStepEmitter } from '@grundyjs/algiviz/playback';
import { createSceneProjector, createSceneRenderer } from '@grundyjs/algiviz/scene';

// [1] Алгоритм выдаёт состояния, а не команды рисования.
function* steps() {
    let x = 0;
    const emit = createStepEmitter(() => Object.freeze({ x }));
    yield emit('start');
    x = 100;
    yield emit('done');
}

// [3] Каждому состоянию соответствует сцена с тем же объектом token-1.
const projectFrame = createSceneProjector(state => Object.freeze({
    objects: Object.freeze([
        Object.freeze({ id: 'token-1', type: 'token', data: state }),
    ]),
}));

// [4] Renderer связывает объекты по id и выбирает обработчик по type.
const renderer = createSceneRenderer({
    // [5] Наш обработчик получает оба объекта и долю перехода.
    token(ctx, object) {
        const from = object.previous ?? object.current;
        const to = object.current ?? object.previous;
        const x = from.data.x + (to.data.x - from.data.x) * object.progress;
        ctx.fillStyle = '#b39bff';
        ctx.beginPath();
        ctx.arc(40 + x / 100 * 520, 80, 18, 0, Math.PI * 2);
        ctx.fill();
    },
});

// [2] Точка входа: передайте контекст Canvas размером 600 × 160.
export function drawHalfway(ctx) {
    const player = createPlayer(steps(), {
        stepDurationMs: 1000,
        finalHoldMs: 0,
        isTerminal: step => step.event === 'done',
    });
    try {
        const frame = player.advance(500); // x: 0 → 100, progress: 0.5
        // [3] frame → sceneFrame: координаты становятся данными объектов.
        const sceneFrame = projectFrame(frame);
        ctx.clearRect(0, 0, 600, 160);
        // [4,5] Один вызов запускает сопоставление и наш обработчик token.
        renderer.render(ctx, sceneFrame); // круг в точке x = 50
    } finally {
        player.dispose();
    }
}

// В браузере: drawHalfway(document.querySelector('canvas').getContext('2d'));
