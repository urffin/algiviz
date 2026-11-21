# API графа: /graph и /canvas/graph

[English](../graph-api.md) · [Архитектурный эскиз](graph-contract.md) · [Сцены](scene.md) · [Совместимость](api-compatibility.md)

Модули графа появились в [1.1.0](release-1.1.md) с подписями вершин,
атомарными обновлениями и режимами размещения auto/hidden. С 1.5.0 по тем же
путям импорта доступны [`createDynamicGraphTrace`](graph-dynamic-topology.md)
и явно включаемая опция [`topologyTransitions`](graph-dynamic-canvas.md).
[AlgiViz 1.5.0](release-1.5.md) · [Пример стягивания ребра](examples.md#стягивание-ребра).

[Отчёт контракта](../checks/graph-public-api-2026-11-17.json), отчёты [headless](../checks/graph-implementation-2026-11-17.json)
и [Canvas](../checks/graph-canvas-implementation-2026-11-17.json) сохраняют этапы.
[Реализация/native подписей](../checks/graph-node-captions-implementation-2026-11-17.json)
охватывают 31 Canvas-проверку и семь проверок страницы BFS. Прежние 15 native-
проверок сохраняют объём до подписей и не прибавляются к этому счётчику.

## Объём и границы entry

`/graph` экспортирует **createGraphTrace**, **createDynamicGraphTrace**,
**graphScene** и 26 типов. Следующий блок описывает фиксированный trace и
общие типы. Четыре динамических типа описаны в [справочнике](graph-dynamic-topology.md#публичный-api).
Модуль остаётся синхронным и независимым от DOM (декларации ES2022).
`/canvas/graph` отдельно экспортирует **createGraphRenderer**
и четыре своих типа. Он может импортировать `/graph` и `/scene`; обратная
зависимость запрещена. Импорт обоих entry не обращается к DOM globals; вызов
Canvas-рендерера требует Canvas 2D. Экспорты графа остаются на отдельных путях импорта.

Первый trace имеет фиксированную конечную топологию. Поддерживаются пустой и
несвязный граф, смесь направленных/ненаправленных рёбер, петли, параллельные рёбра
и конечные веса любого знака. Алгоритмы, индексы смежности/порядок обхода,
очереди, стеки, расстояния, поиск пути, редактор и физическая раскладка остаются
в приложении. Не добавляются graph-player, timeline, обёртка алгоритма, класс
ошибки или опция Player. Изменение топологии вне первого API.

## Декларации: /graph

```ts
import type { Step, Frame } from "@grundyjs/algiviz/playback";
import type { Scene } from "@grundyjs/algiviz/scene";

export interface GraphNode<Data = unknown> {
    readonly id: string;
    readonly label?: string | undefined;
    readonly data?: Data | undefined;
}
export interface GraphEdge<Data = unknown> {
    readonly id: string;
    readonly from: string;
    readonly to: string;
    readonly directed?: boolean | undefined;
    readonly weight?: number | undefined;
    readonly label?: string | undefined;
    readonly data?: Data | undefined;
}
export interface GraphInput<NodeData = unknown, EdgeData = unknown> {
    readonly nodes: readonly GraphNode<NodeData>[];
    readonly edges: readonly GraphEdge<EdgeData>[];
}
export interface GraphPosition {
    readonly nodeId: string;
    readonly x: number;
    readonly y: number;
}
export interface GraphAnnotation {
    readonly id: string;
    readonly role: string;
}
export interface GraphMark {
    readonly id: string;
    readonly role: string | null;
}
export interface GraphNodeCaption {
    readonly id: string;
    readonly text: string;
}
export interface GraphNodeCaptionPatch {
    readonly id: string;
    readonly text: string | null;
}
export interface GraphMarkUpdate {
    readonly nodes?: readonly GraphMark[] | undefined;
    readonly edges?: readonly GraphMark[] | undefined;
    readonly nodeCaptions?: readonly GraphNodeCaptionPatch[] | undefined;
}
export interface GraphResultInput {
    readonly nodeIds?: readonly string[] | undefined;
    readonly edgeIds?: readonly string[] | undefined;
}
export interface GraphResult {
    readonly nodeIds: readonly string[];
    readonly edgeIds: readonly string[];
}
export interface GraphDoneOptions {
    readonly result?: GraphResultInput | undefined;
}
export interface GraphTraceOptions {
    readonly nodeCaptions?: readonly GraphNodeCaption[] | undefined;
    readonly layout?: readonly GraphPosition[] | undefined;
}
export interface GraphSnapshot<NodeData = unknown, EdgeData = unknown> {
    readonly graph: GraphInput<NodeData, EdgeData>;
    readonly layout: readonly GraphPosition[];
    readonly nodeMarks: readonly GraphAnnotation[];
    readonly edgeMarks: readonly GraphAnnotation[];
    readonly result: GraphResult | null;
    readonly nodeCaptions?: readonly GraphNodeCaption[] | undefined;
}
export type GraphEvent = Readonly<
    | { type: "start" }
    | { type: "mark"; nodes: readonly GraphMark[]; edges: readonly GraphMark[];
        nodeCaptions?: readonly GraphNodeCaptionPatch[] | undefined }
    | { type: "layout" }
    | { type: "done" }
>;
export type GraphStep<N = unknown, E = unknown> = Step<GraphSnapshot<N, E>, GraphEvent>;
export type GraphFrame<N = unknown, E = unknown, Event = GraphEvent> = Frame<GraphSnapshot<N, E>, Event>;

export interface GraphTrace<NodeData = unknown, EdgeData = unknown> {
    readonly state: GraphSnapshot<NodeData, EdgeData>;
    start(): GraphStep<NodeData, EdgeData>;
    mark(update: GraphMarkUpdate): GraphStep<NodeData, EdgeData>;
    setLayout(layout: readonly GraphPosition[]): GraphStep<NodeData, EdgeData>;
    done(options?: GraphDoneOptions): GraphStep<NodeData, EdgeData>;
}
export interface GraphSceneOptions {
    readonly namespace: string;
}
export interface GraphNodeView<Data = unknown> {
    readonly node: GraphNode<Data>;
    readonly caption?: string | undefined;
    readonly position: GraphPosition;
    readonly role: string | null;
    readonly result: boolean;
}
export interface GraphEdgeView<Data = unknown> {
    readonly edge: GraphEdge<Data>;
    readonly from: string;
    readonly to: string;
    readonly role: string | null;
    readonly result: boolean;
    readonly routeIndex: number;
    readonly routeCount: number;
}
export type GraphObjects<N = unknown, E = unknown> = {
    graphNode: GraphNodeView<N>;
    graphEdge: GraphEdgeView<E>;
};
export declare function createGraphTrace<N = unknown, E = unknown>(graph: GraphInput<N, E>, options?: GraphTraceOptions): GraphTrace<N, E>;
export declare function graphScene<N = unknown, E = unknown>(state: GraphSnapshot<N, E>, options: GraphSceneOptions): Scene<GraphObjects<N, E>>;
```

ID — непустые примитивные строки; сравнение точное, без приведения, trim или
нормализации Unicode. ID вершин и рёбер уникальны независимо: вершина и ребро
могут одновременно называться `"A"`. Каждый конец ребра указывает на имеющуюся
вершину. ID задаются явно, не выводятся из подписи, позиции в массиве или пары
концов. Порядок входа сохраняется и задаёт детерминированный порядок при равенстве;
подписи могут повторяться. Используются массивы: `"__proto__"` и строки с
разделителями не создают коллизий ключей объекта. Namespace тоже непустая строка.

Отсутствующий/undefined directed означает ненаправленное ребро; `true` — `from → to`.
Отсутствующий/undefined weight означает отсутствие веса, а не вес 1. Нулевые и
отрицательные конечные веса допустимы. Ограничения алгоритма (например Дейкстры)
отдельны. Текст вершины — `label ?? id`; ребра — `label ?? String(weight)` при
наличии веса, иначе текста нет. Явная пустая подпись скрывает текст. Подпись не
разбирается как разметка. Default-подписи/направление/вес в модель не дописываются.

## Захват входа, раскладка и неизменяемое состояние

Конструктор захватывает вход сразу, а не при будущем `next()`. Известные
структурные записи, массивы, позиции, отметки, результат, события и оболочки
шагов копируются и замораживаются. Скопированная топология общая для снимков
одного trace. Позднейшие изменения записей/массивов приложения на неё не влияют.
Необязательные `data` сохраняются по ссылке, без рекурсивного копирования или
заморозки. Их неизменяемость, типобезопасность и Worker cloneability — обязанность
приложения; это не валидатор общей памяти. Worker transport сохраняет независимые
нынешние ограничения. Неизвестные свойства игнорируются, не копируются и не читаются.

Изначально отметки пустые, `result` равен null. Явная раскладка содержит ровно по
одной конечной позиции `x/y` для каждой вершины, без лишних и повторных ID.
Это координаты графа, независимые от CSS/DPR; отрицательные допустимы. В снимке
позиции идут в порядке входных вершин. Без раскладки получаем пустой массив для
пустого графа, `(0.5, 0.5)` для одной вершины и детерминированную окружность для
n ≥ 2: угол `-π/2 + 2πi/n`, x = `0.5 + 0.4 cos(angle)`,
y = `0.5 + 0.4 sin(angle)`, где i — позиция вершины во входе. Это удобная
начальная расстановка, не решатель раскладки и не обещание побитового совпадения
чисел между JS-движками.

`setLayout` заменяет раскладку целиком, не частично. Неверное обновление сохраняет
старые позиции. Нет скрытого решателя при resize или callback-функции раскладки.
Прикладной алгоритм раскладки передаёт явные позиции; Canvas-рендерер только
вписывает их в прямоугольник рисования.

`state` даёт последний зафиксированный снимок до start, во время работы и после
завершения, не продвигая trace. Собственные данные результата неизменяемы и в
runtime; ссылки payload подчиняются правилу выше. Сохранение шагов удерживает
снимки. Неизменившиеся части можно разделять, но O(1) для snapshot, projection,
validation или draw не обещается.

## Trace-операции и результат

| Операция | Изменение состояния и событие |
| --- | --- |
| `start()` | Ровно один раз до прочих операций; событие `start`, индекс 0 и начальное состояние |
| `mark({ nodes, edges, nodeCaptions })` | Атомарное обновление ролей и подписей по ID; `mark` содержит копии трёх переданных patch-массивов (пропущенные становятся пустыми) |
| `setLayout(positions)` | Замена всех позиций; событие `layout`, отметки/результат не меняются |
| `done({ result })` | Необязательное выделение вершин/рёбер результата, событие `done`, запрет дальнейших операций |

После start каждая успешная операция создаёт ровно один шаг с последовательным
индексом и полным состоянием **после** операции. Пустой patch или неизменившаяся
раскладка тоже создают шаг. Методы не делают yield и не воспроизводят шаги:
их выдаёт генератор приложения. Нет неявного посещения соседей, отметок рёбер,
счётчиков или изменения графа.

У отмеченной сущности одна роль — непустая строка. `role: null` снимает её;
`undefined` здесь недопустим. Пропущенные коллекции/ID сохраняют прежние роли;
пустая коллекция не снимает все отметки. Повтор ID в одной patch-коллекции
отклоняется даже при одинаковой роли. В снимке хранятся только имеющиеся роли,
в порядке топологии; patch-массивы события сохраняют переданный порядок. Роли —
открытые строки, не закрытый union алгоритмов. `active`, `visited`, `queued` —
штатные визуальные соглашения, не обязательные фазы; неизвестная непустая роль
допустима.
Даже роль `"result"` остаётся ролью; выбор ответа задаётся только done.

`done()` и `done({ result: undefined })` оставляют `result: null` — выделенного
ответа нет. `done({ result: {} })` сохраняет два пустых массива — явный пустой
ответ. Каждый ID результата обязан существовать в своём домене; повторы убираются
в порядке первого появления. Выбор вершин и рёбер независим: модуль не выводит
и не проверяет концы, непрерывность пути, направление обхода, достижимость или
оптимальность. Путь может использовать порядок выбора, но остаётся утверждением
приложения. «Пути нет» может иметь пустой выбор и пояснение в прикладном State;
особого ошибочного статуса Player для него нет.

Завершение **сохраняет все роли**, подписи и позиции. Canvas-цвет результата имеет
приоритет над ролью выбранной сущности; остальные сохраняют свои отметки.
Это работает на terminal hold, repaint и перемотке к последнему снимку без
запоминания событий рендерером. До завершения `result` равен null. После done
результат не меняется. Перемотка читает прежние снимки, не отменяет trace-вызовы.
Restart создаёт новый trace/источник, очищая отметки и результат; переиспользует
только выбранный неизменяемый вход/начальную раскладку.

`GraphEvent` — новый **закрытый** union только в `/graph`. Не добавляются случаи
ArrayEvent, поля Frame, фазы Player или глобальный enum ролей. Прикладные события
используют нынешние generic Step/Frame и createStepEmitter; у первого trace нет
callback пользовательского события или произвольного emit-метода. `GraphFrame`
позволяет явно выбрать Event, в том числе `undefined` для async state-only.
После публикации добавление варианта GraphEvent подчиняется major-правилу для
закрытого union; открытые роли не расширяют этот union неявно.

## Валидация, ошибки и атомарность

Собственные входные данные модуля — plain records (прототип Object/null) и плотные
массивы. Обязательные поля — собственные data properties. Accessors известных
полей/элементов массива отклоняются без вызова; унаследованные optional-поля
игнорируются. Optional undefined означает отсутствие. Нет приведения, обхода
Iterable, DOM-доступа или проверки payload приложения. Произвольные Proxy traps
API не обезвреживает: их исходное исключение сохраняется; повторные команды
этого trace во время захвата защищены. Это валидация, не sandbox.

| Неверный вход | Ошибка |
| --- | --- |
| Неверный тип контейнера/записи/скаляра, sparse array, accessor, отсутствие обязательного поля, пустые/нестроковые ID/роль/namespace, нестроковая подпись, неboolean направление | `TypeError` |
| Неконечные координаты/вес, повтор ID вершины/ребра, отсутствующий конец, повторная/пропущенная/лишняя позиция, неизвестный mark/result ID, повтор ID в patch | `RangeError` |
| Повторный start, операция до start/после done, вложенная мутация при захвате другой команды | `Error` |

Тексты сообщений и stack диагностические, не стабильные идентификаторы. Класс
или code GraphError не вводится. Исходный Proxy throw не нормализуется в Error
с cause. Ошибки Worker/Player сохраняют отдельные нынешние контракты.

Порядок ошибок определён:

1. Мутация trace сначала проверяет busy/lifecycle, затем читает аргументы.
   Читать `state` разрешено; при захвате это прежний зафиксированный снимок.
2. Конструктор: оболочка graph; массив/записи nodes в порядке входа (id, label,
   захват data, затем проверка повтора); массив/записи edges (id, from, to,
   directed, weight, label, захват data, повтор, существование концов);
   options; layout; initial captions.
3. Layout: форма массива, затем записи в переданном порядке (nodeId, x, y,
   существование, повтор), затем отсутствующие вершины в порядке топологии.
4. Mark: capture envelope, затем nodes, edges, nodeCaptions. В role-записи:
   id, role, membership, уникальность. В подписи: id/text, типы, принадлежность
   вершинам, уникальность. Done: options/result envelope, node IDs, edge IDs;
   пропущенные необязательные списки пусты. Caption snapshot упорядочен по вершинам.
5. `graphScene`: options/namespace, затем оболочка snapshot, graph, layout,
   nodeMarks, edgeMarks, nodeCaptions, result. Отметки снимка уникальны, не null и упорядочены
   по топологии; layout тоже в порядке топологии, ID результата уникальны.
   Неверный порядок данных снимка даёт RangeError.

Форма массива (длина/плотность/data elements) проверяется до его записей.
У записи форма и дескрипторы известных полей проверяются до значений. Совпадение
ID в разных доменах node/edge не конфликт. Валидация и копирование завершаются
до изменения состояния, индекса и lifecycle. Ошибка сохраняет все три; вызов
можно исправить и повторить. Пустой граф допускает start/пустой mark/пустой layout/
done и отклоняет любой ID сущности. `graphScene` принимает и корректные
неизменяемые снимки приложения, не только результат createGraphTrace. Марка
Object.isFrozen не требуется: записи приложения/Worker clone их владелец обязан
считать неизменяемыми, пока их удерживает playback.

## Проекция и стабильные идентичности сцены

`graphScene(state, { namespace })` — чистая проверяемая проекция endpoint с двумя
типами: `graphNode`, `graphEdge`. Оболочки сцены и view data копируются и
замораживаются; неизменяемые записи снимка/ссылки payload сохраняются. У рёбер
zIndex 0, у вершин 1; внутри слоя — порядок входа. Подписи/стрелки не отдельные
обязательные типы сцены. Приложение добавляет свои типы в составной registry,
не расширяя GraphObjects.

ID сцены инъективно кодирует `(namespace, domain, domain ID)`, включая кавычки,
разделители и одинаковые ID вершины/ребра. Кодировка непрозрачна, не публичный
строковый формат. NodeView.node.id и EdgeView.edge.id сохраняют доменные ID;
EdgeView.from/to — **scene ID вершин** для scene.get, не доменные ID и не позиции.
При композиции нужны разные namespace. Между снимками сохраняем namespace и ID;
смена namespace намеренно создаёт новые идентичности. Замене сущности нужен новый
ID, не сопоставление по подписи.

Обычные рёбра группируются по неупорядоченной паре концов, включая встречные
направленные рёбра; петли — по вершине. `routeIndex` — индекс с нуля во входном
порядке группы, `routeCount` — её размер. Эти стабильные данные не зависят от
отметок, раскладки и истории. Они не задают публичную формулу кривой. Canvas
использует разные детерминированные полосы/радиусы петель, но не обещает раскладку
без наложений или пересечений.

Позиции вершин интерполируются между previous/current по Frame.progress; рёбра
разрешают те же переходы через scene.get, включая оба поколения и enter/exit с
нулевым presence. Generic scene позволяет независимо подготовленные снимки, но
не добавляет методов редактирования топологии в фиксированный trace. Политики
изменения топологии и перенаправления описаны в [контракте динамического trace](graph-dynamic-topology.md).
Проекция не читает
progress, размер viewport, DPR или mutable DOM. Для нынешнего ограниченного кеша
используем `createSceneProjector(state => graphScene(state, { namespace: "main" }))`;
при смене захваченной политики создаём новый projector.

## Декларации: /canvas/graph

Рендерер доступен с 1.1.0 и выделяет результат зелёным в обеих темах.
С 1.5.0 переходы между топологиями включает [опция topologyTransitions](graph-dynamic-canvas.md).

```ts
import type { Frame } from "@grundyjs/algiviz/playback";
import type { GraphSnapshot } from "@grundyjs/algiviz/graph";

export interface GraphPalette {
    readonly background: string;
    readonly text: string;
    readonly node: string;
    readonly edge: string;
    readonly active: string;
    readonly visited: string;
    readonly queued: string;
    readonly result: string;
}
export interface GraphRendererOptions {
    readonly theme: "light" | "dark";
    readonly colors?: { readonly [K in keyof GraphPalette]?: string | undefined } | undefined;
    readonly roleColors?: Readonly<Record<string, string>> | undefined;
    readonly nodeCaptions?: "auto" | "hidden" | undefined;
    readonly topologyTransitions?: boolean | undefined;
}
export interface GraphRenderSize {
    readonly width: number;
    readonly height: number;
}
export interface GraphRenderer {
    render<N, E, Event>(context: CanvasRenderingContext2D, frame: Frame<GraphSnapshot<N, E>, Event>, size: GraphRenderSize): void;
}
export declare function createGraphRenderer(options: GraphRendererOptions): GraphRenderer;
```

Фабрика один раз копирует тему и собственные color overrides. Тема обязательна.
К опциям применяются те же правила plain records/data properties; неизвестные
ключи палитры игнорируются, roleColors читает только собственные ключи без
поиска в прототипе.
Неверные theme/контейнер/нестроковый или пустой цвет дают TypeError. Поддержка
самого CSS-цвета зависит от host. Пропущенные/undefined palette overrides берут
тему; roleColors содержит только явные пары непустая роль → цвет.
Приоритет сущности: **выбранный результат → roleColors[role] → штатная роль →
базовый цвет node/edge**. Результат зелёный в обеих темах (dark `#34d399`, light
`#047857`). Неизвестная роль без override имеет базовый цвет. Текст использует
`text`. Выбор результата не включает автоматически смежные вершины/рёбра.

`render` рисует полный bitmap, это не handler для композиции сцены. SVG,
отдельные области Canvas и смесь структур используют graphScene и свои handlers.
`size` — логические ширина/высота содержимого, например width/height из
createCanvasViewport.resize. Приложение владеет CSS Canvas, размером bitmap,
наблюдением resize и планированием repaint. Рендерер этого не делает и не
удерживает context, Canvas, source, RAF, Worker или DOM listeners. Dispose ему
не нужен; кеши ограничены двумя снимками/одной сопоставленной парой.

До рисования проверяются оболочка size/числа, progress в [0,1], затем previous и
current в указанном выше порядке (с внутренним фиксированным namespace).
Неверные типы скаляров/контейнеров дают TypeError; отрицательные/неконечные
размеры, неверный progress и непредставимая вычисленная геометрия — RangeError.
Нулевые логические размеры или bitmap дают no-op **после** валидации входа.
Ошибка валидации не вызывает Canvas. Повторный render этого рендерера из его
render даёт Error до валидации; разные рендереры независимы.

Для непустого bitmap: save, bitmap/logical transform по переданному size,
нейтрализация alpha/composite/filter/shadow/dash, фон и граф, restore в finally.
Приложение передаёт контекст без clip и владеет существующим path (save/restore
Canvas не восстанавливает path). Host-исключения сохраняются; уже нарисованные
пиксели не откатываются. Если draw и restore оба бросили, побеждает исходная
ошибка draw; самостоятельная ошибка restore сохраняется. Восстановление требует
исправного host-метода restore. Transform и styles не утекают после обычного draw/throw.
Busy-guard всегда снимается в finally; ошибочный вызов не мешает последующему
render и не заменяет корректный endpoint-cache неверными данными.

Общие bounds раскладок previous/current равномерно вписываются с отступами;
вырожденные оси центрируются, transform фиксирован на весь переход. Вершины
используют raw progress; роли/результат — current State на весь переход. Сначала
рисуются рёбра, затем вершины; направленное ребро имеет стрелку к `to`,
ненаправленное — нет. Петли и параллельные полосы различимы при обычных размерах.
Совпавшие вершины/маленький viewport допустимы, но читаемость не гарантируется.
Шрифт, отступы, формулы кривых и anti-aliasing — defaults представления, не
обещание стабильных пикселей. Нет штатной панели очереди, анимации конкретного
события или запомненной подсветки последнего шага.

Подписи хранятся в nodeCaptions, а не в Event или живом callback. Начальные
значения задаются в options, mark меняет их вместе с ролями, setLayout/done
сохраняют. graphScene принимает старый снимок без поля как пустую таблицу.
nodeCaptions: auto/hidden в renderer управляет рисованием; скрытый режим всё равно
проверяет снимки. Измерение текста — host-фаза после проверки входа/базовой
геометрии и до рисования. Неверные числовые метрики дают RangeError до записи пикселей;
отсутствующие/нечисловые границы делают подпись недоступной без приведения типов;
исходная ошибка measureText сохраняется, контекст восстанавливается.
[Размещение и ограничения](graph-node-captions.md) задают свободные области,
восемь кандидатов и пропуск текста при недостатке места без движения графа.

## Пример использования и управление

Headless-плеер проецирует каждый снимок фиксированного графа:

```ts
import { createGraphTrace, graphScene } from "@grundyjs/algiviz/graph";
import { createPlayer } from "@grundyjs/algiviz/playback";

function* walk() {
    const trace = createGraphTrace({
        nodes: [{ id: "A" }, { id: "B" }],
        edges: [{ id: "AB", from: "A", to: "B", directed: true }]
    });
    yield trace.start();
    yield trace.mark({ nodes: [{ id: "A", role: "active" }] });
    yield trace.done({ result: { nodeIds: ["B"], edgeIds: ["AB"] } });
}
const player = createPlayer(walk(), {
    isTerminal: step => step.event.type === "done",
    render(frame) {
        const scene = graphScene(frame.current, { namespace: "main" });
        console.log(frame.event.type, scene.objects);
    }
});
player.nextStep();
player.nextStep();
player.dispose();
```

Для воспроизведения на Canvas приложение задаёт контекст, контейнер и логический размер.

```ts
import { createGraphTrace } from "@grundyjs/algiviz/graph";
import { createGraphRenderer } from "@grundyjs/algiviz/canvas/graph";
import { Player } from "@grundyjs/algiviz/player";

const graph = {
    nodes: [{ id: "A" }, { id: "B" }],
    edges: [{ id: "AB", from: "A", to: "B", directed: true }]
};
function* walk() {
    const trace = createGraphTrace(graph);
    yield trace.start();
    yield trace.mark({ nodes: [{ id: "A", role: "active" }] });
    yield trace.mark({
        nodes: [{ id: "A", role: "visited" }, { id: "B", role: "active" }],
        edges: [{ id: "AB", role: "visited" }]
    });
    yield trace.done({ result: { nodeIds: ["A", "B"], edgeIds: ["AB"] } });
}
const renderer = createGraphRenderer({ theme: "light" });
// mount: HTMLElement; context: CanvasRenderingContext2D; size: GraphRenderSize
const player = new Player(mount, {
    stepSource: walk,
    isTerminal: step => step.event.type === "done",
    rewindCapacity: 32,
    render: frame => renderer.render(context, frame, size)
});
```

Pause, Next, final hold, Previous, ограничение работы/истории, source return,
Restart и dispose сохраняют правила Player. Работа алгоритма — до yield done,
очистка генератора — в finally. Restart снова вызывает walk. Async/Worker
передаёт GraphSnapshot как обычное состояние с EOF и undefined event; новый
async explicit-step контракт или формат transport не вводится. Рендерер event
не читает. Живой панели очереди/расстояний нужен свой неизменяемый wrapper State
и композиция сцен/рендеринга, а не скрытые данные trace.

## Приёмка реализации и доказательства

- Точные runtime/type exports; headless ES2022, DOM и strict compiler matrix;
  изоляция optional graph-renderer в bundle; прежние восемь entry без изменений.
- Захват/неизменяемость и вывод generic payload; сложные строки ID, общий ID
  вершины/ребра, пустой/несвязный граф, петли/параллельные/встречные рёбра и
  конечные веса любого знака; без генерации ID и политики смежности.
- Все группы/порядок валидации и конфликты lifecycle; ошибка сохраняет state/
  index/phase; нет вызова getter и частичной фиксации; исходные trap throws и
  защита повторного управления. Отчёты реализации отделяют фактические проверки от исходных требований.
- Постоянные/открытые роли, снятие, no-op шаги, done null/явный пустой ответ,
  порядок дедупликации и приоритет зелёного результата; rewind/Restart isolation.
- Namespace-коллизии, ссылки/слои/routing metadata; движущиеся вершины, чистая
  проекция/свой registry; render без Event.
- Настоящие Canvas/DPR/resize, петли/направление стрелок/параллельные полосы,
  восстановление контекста, неверный вход до draw; прежние Player controls/
  cleanup и async/Worker copy/transfer с прежними transport-ограничениями.

Этап контракта использовал изолированные no-emit пробы и EN/RU parity/link checks;
его отчёт ниже не подтверждает реализацию. Последующий [отчёт headless-реализации](../checks/graph-implementation-2026-11-17.json)
фиксирует repository/installed runtime tests, типы и optional bundle isolation.
[Отчёт Canvas](../checks/graph-canvas-implementation-2026-11-17.json) фиксирует
command/geometry/DPR/context tests, installed consumers и optional bundle isolation.
[Нативный отчёт](../checks/graph-canvas-native-2026-11-17.json) содержит 15 успешных
проверок во встроенном браузере: пиксели, restore/throw, raw-интерполяция, петли/
полосы/стрелки, resize и Player Previous/Next/Restart/dispose. Bitmap ratios
1/1.25/2 задавались размером backing store; это не три значения browser zoom.
Восемь ранее опубликованных entry и их закрытые unions прежние. Совместимый
релиз 1.1.0 уже выпущен; будущие несовместимые изменения требуют отдельной
ревизии и правил major-релиза. Это обновление справочника ничего не публикует.

[Отчёт проверки контракта](../checks/graph-public-api-2026-11-17.json).
