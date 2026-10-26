import { createPlayer, createStepEmitter } from '@grundyjs/algiviz/playback';
import { createSceneProjector, createSceneFrame, createSceneRenderer } from '@grundyjs/algiviz/scene';

export const stages = [
    ['Генератор', 'steps() → состояния { x }', 'steps() создаёт emit и выдаёт состояния x = 0 и x = 100. Этот генератор передаётся в createPlayer.'],
    ['Плеер', 'steps() → player → frame', 'В drawHalfway(ctx) вызов player.advance(500) возвращает frame: previous.x = 0, current.x = 100, progress = 0.5.'],
    ['Проекция', 'frame → projectFrame(frame) → sceneFrame', 'Функция projectFrame превращает оба состояния frame в сцены. В обеих сценах один id token-1 и тип token; координаты различаются.'],
    ['Сопоставление', 'sceneFrame → renderer.render(ctx, sceneFrame)', 'Внутри render библиотека связывает объекты по id token-1 и выбирает обработчик token по type. Ниже показан результат этого внутреннего этапа.'],
    ['Отрисовка', 'object → token(ctx, object) → Canvas', 'Обработчик получает пару объектов и progress, вычисляет x = 50 и вызывает ctx.arc. Следующие шаги показывают тот же расчёт при других значениях progress.'],
];
export function* tokenSteps() {
    let x = 0;
    const emit = createStepEmitter(() => Object.freeze({ x }));
    yield emit('start');
    x = 100;
    yield emit('done');
}
export const projectToken = state => Object.freeze({ objects: Object.freeze([
    Object.freeze({id:'token-1',type:'token',data:state}),
]) });
// A real handler, usable both for collecting coordinates and for drawing Canvas.
export const tokenRenderer = createSceneRenderer({
    token(draw, object) {
        const from = object.previous ?? object.current;
        const to = object.current ?? object.previous;
        if (from && to) draw(from.data.x + (to.data.x - from.data.x) * object.progress);
    },
});
export function* pipelineSteps() {
    const player = createPlayer(tokenSteps(), {
        stepDurationMs:1000, finalHoldMs:0, isTerminal:step=>step.event==='done',
    });
    const project = createSceneProjector(projectToken);
    const emit = createStepEmitter(() => state);
    let state;
    try {
        // These are explanatory checkpoints, not hooks into library internals.
        const frame = player.advance(500);
        const projected = project(frame);
        const transition = createSceneFrame(projected).get('token-1');
        let x;
        tokenRenderer.render(value=>{ x=value; },projected);
        for (let stage=0;stage<5;stage++) {
            state=Object.freeze({stage,frame,projected,transition,x,progress:.5});
            yield emit('explain');
        }
        for (const progress of [.6,.7,.8,.9,1]) {
            const sample=Object.freeze({...frame,progress});
            const scene=project(sample);
            tokenRenderer.render(value=>{ x=value; },scene);
            state=Object.freeze({stage:4,frame:sample,projected:scene,
                transition:createSceneFrame(scene).get('token-1'),x,progress});
            yield emit(progress===1?'done':'sample');
        }
    } finally { player.dispose(); }
}
