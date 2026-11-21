# Две панели в одном Player

[English](../player-multiple-panels.md) · [Справочник Player](player.md)

Используйте один источник, один Player и один снимок на логический шаг. В
снимке храните состояния обеих панелей, а также текст и счётчики, которые
должны меняться при перемотке. Обе панели получают один номер шага, прогресс
и общие кнопки управления. См. [пример Краскала](../../examples/kruskal.html) и
[BFS с графом и очередью](../../examples/graph-queue.html).

## Соберите общий снимок шага

**Краскал** отмечает рассматриваемое ребро на исходном графе. Если ребро
принято, генератор также добавляет его в лес с тем же ID. Сначала генератор
обновляет структуры, затем объединяет снимок исходного графа и текущий
снимок леса в одном шаге. Если ребро замкнуло бы цикл, снимок леса
переиспользуется. [Код примера](../../examples/kruskal.mjs).

```js
function describe(step, forest, totalWeight, message) {
    return Object.freeze({
        ...step, state: Object.freeze({ graph: step.state, forest, totalWeight, message }),
    });
}
```

**BFS** начинает с шага обхода, где `state.visual` содержит снимок графа.
Адаптер создаёт trace связного списка с начальной очередью FIFO, обновляет его
при обнаружении или извлечении вершины и завершает на `finished`.
Между этими операциями используется текущий снимок списка.
Адаптер добавляет `queueVisual` в состояние
и сохраняет исходные индекс и событие шага.
[Код адаптера](../../examples/graph-queue-session.mjs).

```js
yield Object.freeze({
    ...step,
    state: Object.freeze({ ...step.state, queueVisual: trace.state }),
});
```

Фиксируйте неизменяемые снимки перед выдачей каждого шага. Если панель
не изменилась, передайте тот же снимок по ссылке. Trace этой структуры может
записать меньше шагов. Порядок воспроизведения задаёт последовательность общих
шагов, переданных в Player.

## Спроецируйте Frame для каждого рендерера

Вызывайте оба рендерера из одного `render(frame)`. Для каждой панели
извлеките её снимок **из обоих** полей `previous` и `current` и сохраните
`progress`, `stepIndex` и `event`. Ниже вспомогательная функция приложения
показывает проекцию, которую выполняют оба примера. Каждый рендерер получает
контекст и логический размер своего Canvas.
[Отрисовка Краскала](../../examples/kruskal-demo.mjs) ·
[Граф BFS](../../examples/graph-player-view.mjs) ·
[Очередь BFS](../../examples/graph-queue-demo.mjs).

```js
function projectFrame(frame, select) {
    return {
        ...frame,
        previous: select(frame.previous),
        current: select(frame.current),
    };
}

function renderKruskal(frame) {
    graphRenderer.render(graphContext, projectFrame(frame, state => state.graph), graphSize);
    forestRenderer.render(forestContext, projectFrame(frame, state => state.forest), forestSize);
}

function renderBfs(frame) {
    graphRenderer.render(graphContext, projectFrame(frame, state => state.visual), graphSize);
    queueRenderer.render(queueContext, projectFrame(frame, state => state.queueVisual), queueSize);
}
```

## Подключите воспроизведение и resize

Поместите оба Canvas в обёртку, которая является непосредственным дочерним
элементом контейнера Player. Передайте её как `viewport`. Здесь используются
`kruskalSteps` из примера и функция отрисовки выше. Для BFS передайте фабрику,
которая вызывает `graphQueueSteps` с выбранными параметрами, и определите
терминальный шаг по `step.event.kind === 'finished'`.
[Источник явных шагов](player-step-source.md).

```js
import { Player } from '@grundyjs/algiviz/player';

const sourceOptions = mode === 'history'
    ? { history: () => Array.from(kruskalSteps(), step => step.state) }
    : { stepSource: kruskalSteps, isTerminal: step => step.event.type === 'done', rewindCapacity: 8 };

const player = new Player(host, {
    ...sourceOptions,
    viewport: panes,
    stepDurationMs: 650,
    render: renderKruskal,
});
player.start();
```

В режиме `stepSource` кнопка Previous восстанавливает обе панели в пределах
сохранённого окна. В режиме `history` перемотка показывает и промежуточные
кадры. В историю входят состояния, а `frame.event` равен `undefined`. Храните
сообщения, порядок очереди и счётчики в общем снимке. Restart снова показывает
начальный снимок. Фабрика генератора создаёт новые trace для каждого запуска.

При изменении размера Canvas измерьте его и перерисуйте текущий `player.frame`,
если он уже есть. Позиция воспроизведения останется общей для обеих панелей.
При удалении виджета освободите Player и каждый Canvas viewport.
[Canvas viewport](canvas-viewport.md).
