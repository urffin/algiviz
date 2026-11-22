# Синхронные панели в одном Player

[English](../player-multiple-panels.md) · [Справочник Player](player.md)

Используйте один источник, один Player и один снимок на логический шаг. В
снимке храните состояния всех панелей, а также текст и счётчики, которые
должны меняться при перемотке. Все панели получают один номер шага, прогресс
и общие кнопки управления. См. [пример Краскала](../../examples/kruskal.html),
[BFS с графом и очередью](../../examples/graph-queue.html),
[пирамидальную сортировку с Player](../../examples/heap-player.html) и
[кратчайшие пути Дейкстры](../../examples/dijkstra.html).

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
`progress`, `stepIndex` и `event`. Для этого есть `mapFrame` из `/playback`
(с версии 1.8.0). Каждый рендерер получает контекст и логический
размер своего Canvas.
[Отрисовка Краскала](../../examples/kruskal-demo.mjs) ·
[Граф BFS](../../examples/graph-player-view.mjs) ·
[Очередь BFS](../../examples/graph-queue-demo.mjs).

```js
import { mapFrame } from '@grundyjs/algiviz/playback';

function renderKruskal(frame) {
    graphRenderer.render(graphContext, mapFrame(frame, state => state.graph), graphSize);
    forestRenderer.render(forestContext, mapFrame(frame, state => state.forest), forestSize);
}

function renderBfs(frame) {
    graphRenderer.render(graphContext, mapFrame(frame, state => state.visual), graphSize);
    queueRenderer.render(queueContext, mapFrame(frame, state => state.queueVisual), queueSize);
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
сохранённого окна. В обоих режимах записи перемотка показывает и промежуточные
кадры. Опция `history` хранит состояния, а `frame.event` равен `undefined`.
Храните сообщения, порядок очереди и счётчики в общем снимке. Restart снова
показывает начальный снимок. Фабрика генератора создаёт новые trace для каждого запуска.

При изменении размера Canvas измерьте его и перерисуйте текущий `player.frame`,
если он уже есть. Позиция воспроизведения останется общей для обеих панелей.
При удалении виджета освободите Player и каждый Canvas viewport.
[Canvas viewport](canvas-viewport.md).

## Сохраните событие массива в полной истории

Пирамидальная сортировка на `[2a, 2b, 1]` хранит снимки массива и бинарного
дерева в одном шаге. При обмене для извлечения максимума событие алгоритма
имеет тип `extract-swap`, а trace массива записывает `swap` с ID двух
перемещённых элементов. Сохраните этот `ArrayEvent` рядом со снимком массива,
чтобы при перемотке внутрь обмена подсвечивались те же элементы. Этот фрагмент
выполняется после обновления обеих структур. [Код сеанса](../../examples/heap-player-session.mjs).

```js
yield Object.freeze({
    ...step,
    state: Object.freeze({
        array: arraySnapshot,
        tree: tree.state,
        arrayEvent,
        labelById,
        message: describe(step.event, arraySnapshot.slots, labelById),
    }),
});
```

`arraySnapshot` и `arrayEvent` берутся из полей `state` и `event` одного
`ArrayStep`. Для полной истории передайте эту фабрику в опцию `stepHistory` Player.

```js
const stepHistory = () => Array.from(heapPanelSteps());
```

Пример использует `stepHistory` (1.7.0), чтобы сохранять
событие алгоритма при перемотке. В переходе для извлечения максимума
`frame.event` содержит `extract-swap`. Trace массива записывает своё
событие `swap`. При проекции для штатного рендерера массива возьмите
его из `frame.current.arrayEvent`. Возьмите снимки массива из обоих
концов перехода, сохранив общий прогресс и индекс шага. Рендерер дерева
использует свои снимки и общие метаданные кадра.
Для панели со штатными столбцами создайте рендерер массива один раз с
`itemLabel` (1.6.0). Перед каждой отрисовкой берите словарь подписей
из того же снимка, что и событие массива. Тогда `2a` и `2b` будут следовать
за элементами с соответствующими ID.

```js
let labelById;
const arrayRenderer = createArrayRenderer({
    theme: 'dark',
    itemLabel: item => labelById[item.id],
});

function renderHeap(frame) {
    labelById = frame.current.labelById;
    const arrayFrame = {
        ...mapFrame(frame, state => state.array),
        event: frame.current.arrayEvent,
    };
    arrayRenderer.render(arrayContext, arrayFrame);
    treeRenderer.render(treeContext, mapFrame(frame, state => state.tree), treeSize);
}
```

В примере пирамидальной сортировки используются те же общие снимки
и событие массива. При обмене панель рисует свои плитки на разной высоте,
чтобы подписи читались в точке пересечения горизонтальных траекторий.
[Код панели массива](../../examples/heap-player-array.mjs).

## Покажите один дискретный шаг на Canvas и в DOM

В [демо Дейкстры](../../examples/dijkstra.html) опция
`stepHistory: () => Array.from(dijkstraSteps())` записывает общий снимок на
каждом шаге. Граф, таблица расстояний и очередь с приоритетом берут данные из
`frame.current`. Когда ребро C → B сокращает расстояние до B с 8 до 5, граф
выделяет это ребро, а B перемещается перед D в очереди. При перемотке назад
все три панели восстанавливают прежнее ребро, расстояние и порядок в очереди.

Координаты вершин фиксированы. Передайте целевой снимок графа в оба конца
кадра рендерера и задайте ему прогресс 1. Тогда выделение ребра меняется в тот
же момент, что и DOM-панели. Исходный прогресс Player доступен панелям с
интерполяцией.

```js
function renderDijkstra(frame) {
    const { current, event } = frame;
    graphRenderer.render(graphContext, {
        ...frame, previous: current.graph, current: current.graph, progress: 1,
    }, graphSize);
    renderDistances(current.distances, event.vertex);
    renderQueue(current.queue);
}
```

[Код отрисовки](../../examples/dijkstra-demo.mjs) · [Проверки в браузере](../../test/dijkstra-browser.html).
