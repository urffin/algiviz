# Динамическая топология /graph

[English](../graph-dynamic-topology.md) · [API графа](graph-api.md) · [Совместимость](api-compatibility.md) · [Стягивание ребра](examples.md#стягивание-ребра)

Динамическая топология доступна с 1.5.0. Одна команда
`edit` фиксирует полный валидный граф после изменения.

## Граница совместимости

`createDynamicGraphTrace` использует действующие `GraphInput`,
`GraphTraceOptions` и `GraphSnapshot`, а для шагов определяет собственный
тип событий с дополнительным вариантом `{ type: "edit" }`. Выпущенный
`createGraphTrace` сохраняет фиксированную топологию и закрытый `GraphEvent`.
Динамический trace использует существующие `Step`, `Frame` и `graphScene`.
[Ревизия 1.5.0](graph-readiness-1.5.md) фиксирует сравнение деклараций
и поведения с версией 1.4.0.

## Публичный API

`@grundyjs/algiviz/graph` экспортирует фабрику
`createDynamicGraphTrace` и четыре типа. Типы данных вершин и рёбер выводятся
независимо из начального графа. Для пустого графа их можно указать
явно, чтобы типизировать записи будущих edit.

```ts
import type {
    GraphDoneOptions, GraphEdge, GraphEvent, GraphInput, GraphMarkUpdate,
    GraphNode, GraphPosition, GraphSnapshot, GraphTraceOptions,
} from "@grundyjs/algiviz/graph";
import type { Step } from "@grundyjs/algiviz/playback";

export interface DynamicGraphEdit<NodeData = unknown, EdgeData = unknown> {
    readonly nodes?: readonly GraphNode<NodeData>[] | undefined;
    readonly edges?: readonly GraphEdge<EdgeData>[] | undefined;
    readonly layout?: readonly GraphPosition[] | undefined;
    readonly marks?: GraphMarkUpdate | undefined;
}

export type DynamicGraphEvent = GraphEvent | Readonly<{ type: "edit" }>;

export type DynamicGraphStep<NodeData = unknown, EdgeData = unknown> =
    Step<GraphSnapshot<NodeData, EdgeData>, DynamicGraphEvent>;

export interface DynamicGraphTrace<NodeData = unknown, EdgeData = unknown> {
    readonly state: GraphSnapshot<NodeData, EdgeData>;
    start(): DynamicGraphStep<NodeData, EdgeData>;
    edit(update: DynamicGraphEdit<NodeData, EdgeData>): DynamicGraphStep<NodeData, EdgeData>;
    mark(update: GraphMarkUpdate): DynamicGraphStep<NodeData, EdgeData>;
    setLayout(layout: readonly GraphPosition[]): DynamicGraphStep<NodeData, EdgeData>;
    done(options?: GraphDoneOptions): DynamicGraphStep<NodeData, EdgeData>;
}

export declare function createDynamicGraphTrace<N = unknown, E = unknown>(
    graph: GraphInput<N, E>,
    options?: GraphTraceOptions,
): DynamicGraphTrace<N, E>;
```

Аргумент `edit` обязателен. Пустое обновление записывается как `edit({})`.
Методы используют единый тип `DynamicGraphStep`. Событие успешного `edit`
имеет ровно поле `type: "edit"`. События остальных команд имеют прежние
формы, включая patch-массивы `mark`. У `DynamicGraphEvent` закрытый набор
`start | mark | layout | edit | done`.

Обычный `GraphStep` можно читать как `DynamicGraphStep` с теми же типами
данных. TypeScript отклоняет присваивание `DynamicGraphStep` к `GraphStep`.
Обработчик динамических событий обрабатывает `edit` отдельно и может передать
остальные события обработчику `GraphEvent`. Старая исчерпывающая проверка
`GraphEvent` сохраняет четыре варианта.
Для кадра с событиями используется
`GraphFrame<NodeData, EdgeData, DynamicGraphEvent>`. Стандартный параметр
события у `GraphFrame` остаётся `GraphEvent`.

## Подключение к Player и сцене

`graphScene` принимает `GraphSnapshot` из обоих trace. Для анимации можно
пропустить весь кадр через `createSceneProjector` и `createSceneFrame`, а
затем нарисовать сопоставленные объекты. Ни проекция, ни сопоставление
сцен не зависят от вида события.

В потоковом Player `stepSource` выдаёт шаги с событиями. Предикат
`isTerminal` завершает поток только на `done`. В записи `history`
принимает массив снимков, и `frame.event` имеет тип `undefined`. Ниже
оба способа передают снимки в `graphScene`.

```ts
import { createDynamicGraphTrace, graphScene } from "@grundyjs/algiviz/graph";
import { Player } from "@grundyjs/algiviz/player";

function* steps() {
    const trace = createDynamicGraphTrace({
        nodes: [{ id: "A" }, { id: "B" }],
        edges: [{ id: "e", from: "A", to: "B", directed: true }],
    });
    yield trace.start();
    yield trace.edit({
        nodes: [{ id: "A" }, { id: "C" }],
        edges: [{ id: "e", from: "A", to: "C", directed: true }],
        layout: [{ nodeId: "A", x: 0, y: 0 }, { nodeId: "C", x: 1, y: 0 }],
        marks: { edges: [{ id: "e", role: "active" }] },
    });
    yield trace.done({ result: { nodeIds: ["C"], edgeIds: ["e"] } });
}

function mountStream(host: HTMLElement) {
    return new Player(host, {
        stepSource: steps,
        isTerminal: step => step.event.type === "done",
        rewindCapacity: 8,
        render(frame) {
            graphScene(frame.previous, { namespace: "demo" });
            graphScene(frame.current, { namespace: "demo" });
        },
    });
}

function mountRecording(host: HTMLElement) {
    return new Player(host, {
        history: () => Array.from(steps(), step => step.state),
        stepDurationMs: 200,
        render(frame) {
            graphScene(frame.previous, { namespace: "demo" });
            graphScene(frame.current, { namespace: "demo" });
        },
    });
}
```

Блоки деклараций и примера проверены на TypeScript 6.0.3 с `strict` и
`exactOptionalPropertyTypes` в NodeNext и Bundler. Headless-проверка использует
ES2022, проверка Player добавляет DOM. На текущем Player отдельно проверены
составленные вручную шаги `start → edit → done` в обоих режимах, включая
Previous, повтор без чтения источника, Restart и dispose.

## Атомарный edit

Команда принимает необязательные поля `nodes`, `edges`, `layout` и `marks`.
Переданный массив вершин или рёбер заменяет соответствующую коллекцию целиком.
Пропуск и `undefined` сохраняют коллекцию, а `[]` очищает её. Записи в
переданной коллекции полные. Например, чтобы у сохранённого ребра оставить
вес и подпись, их нужно передать вместе с новыми концами. Порядок переданных
коллекций становится порядком в снимке.

| Действие | Требование к итоговому графу |
| --- | --- |
| Добавить вершину | Передать её с новым ID в `nodes` и полную раскладку в том же edit. |
| Добавить ребро | Передать его с новым ID в `edges`. Оба конца должны быть в итоговых `nodes`, в том числе если добавлены этим edit. |
| Удалить вершину | Исключить её из `nodes`. Все рёбра, которые на неё ссылались, явно исключить из `edges` или перенаправить в том же edit. Ссылка на удалённую вершину отклоняет весь вызов. |
| Удалить ребро | Исключить его из `edges`. Вершины остаются. |
| Перенаправить ребро | Оставить ID, передать новые `from` и/или `to`. Направление задаёт `directed`, как в обычной записи ребра. |
| Очистить граф | Передать `nodes: []` и `edges: []` в одном edit. |

Пустые и несвязные графы, циклы, петли, параллельные и встречные рёбра допустимы.
Действующие правила конечных весов, направлений, подписей и прикладных `data`
сохраняются. Проверяется конечный граф, поэтому замена вершины и перенаправление
к ней ребра укладываются в один шаг без промежуточной конфигурации.

При пропуске `layout` сохраняются позиции оставшихся вершин. Для новой вершины
понадобится полный `layout` в том же edit: по одной конечной позиции на каждую
итоговую вершину, без лишних ID. Начальная раскладка по умолчанию по-прежнему
доступна при создании trace. Edit не пересчитывает её автоматически.

Отметки и подписи выбывших сущностей исчезают из нового снимка. Сохранённые ID
сохраняют роли и подписи, в том числе роль перенаправленного ребра.
`marks` использует действующий формат `GraphMarkUpdate` и применяется к
итоговому графу после очистки. В одном edit можно отметить новую вершину,
а патч удалённого или неизвестного ID отклоняется. Раскладка, роли и подписи
хранятся в порядке соответствующей итоговой коллекции.

## ID и жизненный цикл

ID задаёт приложение. Это непустые строки в двух независимых доменах.
Одинаковые строки у вершины и ребра допустимы. ID, присутствующий до и после
edit в одном домене, обозначает ту же сущность, даже при смене подписи, позиции,
порядка или концов ребра. Замена сущности получает новый ID.

Успешное удаление выводит ID из обращения до конца этого trace. Его нельзя
добавить повторно в том же домене, даже если исходный шаг вытеснен из окна
перемотки. Неудачный edit не выводит ID из обращения и не резервирует новые.
Учёт выбывших ID занимает память по истории удалений trace независимо от размера
окна Player.

`start()` вызывается один раз и создаёт шаг 0. Любой успешный `edit`, включая `edit({})`, создаёт
ровно один следующий шаг с полным неизменяемым снимком и событием `edit`.
Событие обозначает вид команды. Восстановление опирается на снимки.
`mark`, `setLayout` и `done` работают с текущей топологией. До `done`
результат равен `null`. `done` выбирает вершины и рёбра независимо по их
текущим ID и закрывает trace. Например, результат может выбрать ребро после
перенаправления, но выбор удалённого ребра отклоняется.

## Валидация и отказ

Порядок проверок для edit:

1. Повторный вход и жизненный цикл. Команда до `start`, после `done` или
   внутри захвата другой команды этого trace завершается `Error`.
2. Форма edit и дескрипторы известных полей, затем итоговые вершины и рёбра
   по порядку валидации `GraphInput`, включая дубликаты и существование концов.
3. Выбывшие ID, сначала вершины, затем рёбра, в порядке итоговых коллекций.
4. Полная или сохранённая раскладка, затем `marks.nodes`, `marks.edges` и
   `marks.nodeCaptions` по правилам `GraphMarkUpdate`.

Неверные формы и типы дают `TypeError`. Повтор ID, ссылка на отсутствующую
вершину, выбывший ID, неверное покрытие раскладки или неизвестный ID отметки
дают `RangeError`. Сохраняются известные правила захвата записей и массивов,
непрозрачных `data` и исходных исключений приложения из Proxy. Позиции,
отметки и топология фиксируются вместе с шагом. При отказе `state` остаётся
тем же объектом, индекс, жизненный цикл и учёт выбывших ID сохраняются.
Чтение `state` во время захвата возвращает предыдущий зафиксированный снимок.

## Кадры и перемотка

`graphScene` проецирует каждый снимок независимо. При постоянном `namespace`
новая сущность получает `enter`, удалённая — `exit`, сохранённая —
`update`. Перенаправленное ребро сохраняет один scene ID и фазу `update`.
Старый маршрут разрешает концы в `previous`, новый — в `current`, даже при
нулевом `presence` добавленного или удалённого узла. Группы параллельных рёбер,
`routeIndex` и `routeCount` вычисляются отдельно для каждого снимка. Индекс
полосы может измениться при добавлении, удалении или смене порядка рёбер.

Например, из графа с вершинами A и B и рёбрами `e: A → B`, `p: B—A`
один edit может получить вершины A и C и рёбра `e: A → C`, `q: C—A`.
Кадр содержит `B/p` в `exit`, `C/q` в `enter` и `e` в `update`
со старым концом B и новым C. Один снимок всегда описывает только свою
топологию. Перекрёстное затухание привязанных маршрутов описано в
[контракте Canvas](graph-dynamic-canvas.md).

Seek в полной истории и Previous в пределах окна источника читают сохранённые
снимки. При возврате до удаления вершина или ребро снова видны вместе со
старыми отметками и концами. При движении вперёд сохранённый результат
восстанавливается из соответствующего снимка. Перемотка не откатывает trace
и не выполняет edit повторно. Restart потокового источника создаёт новый
trace, где исходные ID снова доступны. В режиме записи Restart возвращается
к началу истории.

Этот переход проверен на двух снимках, подготовленных отдельно действующим
API. `graphScene` и `createSceneFrame` сохранили ID ребра, оба поколения
концов и номера полос. `createTimeline` и `createRewindBuffer` восстановили
записанные снимки и итог без повторного чтения уже сохранённых шагов.

## Регрессионные проверки

- Добавление вершины и ребра одним edit, удаление вершины с явным удалением
  инцидентных рёбер, перенаправление сохранённого ребра и очистку графа.
- Одноимённые ID в разных доменах, выбывание ID в обоих доменах, сохранение
  отметок при перенаправлении и отказ при попытке отметить удалённую сущность.
- Атомарность поздней ошибки раскладки или отметки, сохранение индекса и
  истории ID, исправленный повтор, приоритет lifecycle и исключения Proxy.
- Фазы `enter/update/exit`, концы каждого снимка, пересчёт параллельных полос,
  восстановление результата, Seek, ограниченную перемотку и Restart.
