# List API: /list

[English](../list-api.md) · [Архитектурный эскиз](linked-list-contract.md) · [Текущий API](current-api.md) · [Совместимость](api-compatibility.md) · [Проверка контракта](../checks/list-public-api-2026-11-20.json)

**Доступно с 1.4.0.** Независимая точка входа ESM `/list` экспортирует
`createListTrace`, `listScene` и 25 типов ниже. Для отрисовки Canvas используйте
[/canvas/list](list-canvas-api.md). [Проверки реализации](../checks/list-implementation-2026-11-20.json).

## Объём и модель

Первая модель — одна конечная ациклическая односвязная цепь, включая пустую и
одноэлементную. Единственный источник топологии — ListInput.headId и nextId
каждого узла. Проход от головы посещает каждый узел ровно раз и заканчивается
null. У головы нет входящих next, у остальных ровно один. Неизвестные цели,
циклы/петли, общий successor и недостижимые узлы недопустимы. Пустота означает
headId:null и nodes:[]; непустая цепь требует существующей головы. Порядок
хранения nodes сохраняется, но не определяет цепь. Хвост и длина вычисляются;
второй изменяемой таблицы связей/порядка нет.

У узла обязательное собственное value, включая явно присутствующий undefined,
если его допускает Value. Payload непрозрачен: null, false, пустая строка, NaN,
объекты и typed arrays не означают sentinel. Неизменяемость и возможность
structured clone принадлежат приложению. Модуль не приводит типы, не делает
глубокий clone/freeze, не сравнивает значения и не выполняет алгоритм.

Предел числа узлов — 1 000 000, проверяется до копирования элементов. Layout,
node-role/caption patches и node selections ограничены числом соответствующих
узлов; pointer collections — числом узлов + 1. Это пределы валидации, не гарантия
памяти, времени кадра или удобного размера рисунка. Захват, валидация и сцена
обходят текущие коллекции; обработка retirement может дополнительно зависеть от
всей истории ID. O(1) для edit/snapshot не обещается. Бюджет Player не прерывает
отдельный дорогой вызов. Хранилище выбывших ID растёт с числом различных
когда-либо зафиксированных ID.

Циклические/двусвязные списки, sentinels, общие арены, аллокаторы, локальные
курсоры, автоконвертация графа/дерева и произвольные присваивания указателей
вне API. Они не обещаны как будущие варианты закрытых unions. Прикладные
State/Scene остаются доступной границей расширения.

## Публичные декларации

Ниже приведены декларации @grundyjs/algiviz/list.
Они проверяются и на установленном локальном архиве.

```ts
import type { Step, Frame } from "@grundyjs/algiviz/playback";
import type { Scene } from "@grundyjs/algiviz/scene";

export interface ListNode<Value = unknown> {
    readonly id: string;
    readonly value: Value;
    readonly nextId: string | null;
}
export interface ListInput<Value = unknown> {
    readonly headId: string | null;
    readonly nodes: readonly ListNode<Value>[];
}
export interface ListPosition {
    readonly nodeId: string;
    readonly x: number;
    readonly y: number;
}
export type ListPointerId = Readonly<
    | { kind: "head" }
    | { kind: "next"; nodeId: string }
>;
export interface ListAnnotation {
    readonly id: string;
    readonly role: string;
}
export interface ListMark {
    readonly id: string;
    readonly role: string | null;
}
export interface ListPointerAnnotation {
    readonly id: ListPointerId;
    readonly role: string;
}
export interface ListPointerMark {
    readonly id: ListPointerId;
    readonly role: string | null;
}
export interface ListNodeCaption {
    readonly id: string;
    readonly text: string;
}
export interface ListNodeCaptionPatch {
    readonly id: string;
    readonly text: string | null;
}
export interface ListMarkUpdate {
    readonly nodes?: readonly ListMark[] | undefined;
    readonly pointers?: readonly ListPointerMark[] | undefined;
    readonly nodeCaptions?: readonly ListNodeCaptionPatch[] | undefined;
}
export interface ListResultInput {
    readonly nodeIds?: readonly string[] | undefined;
    readonly pointerIds?: readonly ListPointerId[] | undefined;
}
export interface ListResult {
    readonly nodeIds: readonly string[];
    readonly pointerIds: readonly ListPointerId[];
}
export interface ListDoneOptions {
    readonly result?: ListResultInput | undefined;
}
export interface ListTraceOptions {
    readonly layout: readonly ListPosition[];
    readonly nodeCaptions?: readonly ListNodeCaption[] | undefined;
}
export interface ListEdit<Value = unknown> {
    readonly headId?: string | null | undefined;
    readonly nodes?: readonly ListNode<Value>[] | undefined;
    readonly layout?: readonly ListPosition[] | undefined;
    readonly marks?: ListMarkUpdate | undefined;
}
export interface ListSnapshot<Value = unknown> {
    readonly list: ListInput<Value>;
    readonly layout: readonly ListPosition[];
    readonly nodeMarks: readonly ListAnnotation[];
    readonly pointerMarks: readonly ListPointerAnnotation[];
    readonly nodeCaptions: readonly ListNodeCaption[];
    readonly result: ListResult | null;
}
export type ListEvent = Readonly<
    | { type: "start" }
    | { type: "edit" }
    | { type: "mark"; nodes: readonly ListMark[];
        pointers: readonly ListPointerMark[];
        nodeCaptions: readonly ListNodeCaptionPatch[] }
    | { type: "layout" }
    | { type: "done" }
>;
export type ListStep<Value = unknown> = Step<ListSnapshot<Value>, ListEvent>;
export type ListFrame<Value = unknown, Event = ListEvent> = Frame<ListSnapshot<Value>, Event>;
export interface ListTrace<Value = unknown> {
    readonly state: ListSnapshot<Value>;
    start(): ListStep<Value>;
    edit(update: ListEdit<Value>): ListStep<Value>;
    mark(update: ListMarkUpdate): ListStep<Value>;
    setLayout(layout: readonly ListPosition[]): ListStep<Value>;
    done(options?: ListDoneOptions): ListStep<Value>;
}
export interface ListSceneOptions {
    readonly namespace: string;
}
export interface ListNodeView<Value = unknown> {
    readonly node: ListNode<Value>;
    readonly position: ListPosition;
    readonly caption: string | null;
    readonly role: string | null;
    readonly result: boolean;
    readonly head: boolean;
    readonly tail: boolean;
}
export interface ListPointerView {
    readonly pointer: ListPointerId;
    readonly from: string | null;
    readonly to: string | null;
    readonly role: string | null;
    readonly result: boolean;
}
export type ListObjects<Value = unknown> = {
    listNode: ListNodeView<Value>;
    listPointer: ListPointerView;
};
export declare function createListTrace<Value = unknown>(
    list: ListInput<Value>, options: ListTraceOptions
): ListTrace<Value>;
export declare function listScene<Value = unknown>(
    state: ListSnapshot<Value>, options: ListSceneOptions
): Scene<ListObjects<Value>>;
```

Entry требует только ES2022 declarations, не обращается к DOM/Worker
globals и ресурсам при импорте; Canvas остаётся отдельной необязательной границей.

## Идентичности узлов и указателей

ID узлов и namespace — непустые примитивные строки без trim, приведения и
генерации. Пробелы, разделители и __proto__ не имеют особого смысла. ID узла
сохраняется при изменении value, next, позиции, статуса головы/хвоста и порядка
цепи. Удалённый ID выбывает на весь trace, даже после вытеснения из окна
перемотки. Повторное добавление позднее — RangeError. Узел с одним ID до и
после атомарного edit сохранён, а не пересоздан. Ошибки не резервируют и не
выводят ID из обращения. Свежий trace при Restart может использовать исходные
ID снова; старые снимки остаются корректными.

ID указателя — структурные данные, сравниваются по kind и владельцу nodeId:

- { kind:"head" } — постоянный слот головы, включая пустой список.
- { kind:"next", nodeId:"A" } — слот next узла A, включая null-цель.

При A.next=B → A.next=X ID указателя прежний. Цель, номер в цепи и ссылочная
идентичность объекта не определяют ID. Удаление A удаляет его слот next;
запрет повторного использования ID узла не позволяет спутать его с новой
сущностью. Отдельного аллокатора ID указателей, изменяемой таблицы связей и
retirement-набора для head нет. ID узлов и указателей — разные домены.
ListPointerId не хранит targetId; цель выводится из headId/nextId.

## Атомарные операции и жизненный цикл

Конструктор захватывает список, полный логический layout и необязательные
начальные подписи; отметки пусты, result:null. Шага нет; state сразу читаем.
start() обязателен ровно один раз: index 0 и тот же исходный state. Каждый
последующий успешный вызов, включая no-op, выдаёт следующий index и новый
внешний снимок. Trace, собственные записи/массивы, pointer IDs, шаги и события
заморожены; неизменные структуры могут разделяться. Value хранится по ссылке.
Начальные nodeCaptions по умолчанию пусты; они требуют уникальных существующих
ID и строкового text. Повтор ID даёт RangeError. Роли изначально пусты.

| Команда | Контракт |
| --- | --- |
| edit(update) | Переданный nodes заменяет всю коллекцию. Отсутствующие/undefined headId, nodes и layout сохраняются с описанной ниже очисткой. marks патчит конечного кандидата атомарно вместе с топологией/layout. Это не upsert и не последовательность присваиваний. |
| mark(update) | Атомарно применяет роли узлов, роли указателей и подписи узлов. Отсутствующие/undefined коллекции — пустые патчи. Пустое обновление тоже выдаёт шаг. |
| setLayout(layout) | Заменяет все позиции нынешних узлов, сохраняя топологию и отметки. |
| done(options?) | Сохраняет список/layout/отметки, записывает результат или null и выдаёт единственный terminal done. Дальнейшие команды запрещены. |

Корректным должен быть полный кандидат. Вставка X между A и B одновременно
задаёт A.next=X и X.next=B, добавляет X и позицию. Удаление одновременно меняет
ссылку предшественника либо голову и исключает узел. Нет угаданного cascade,
исправления predecessor, разворота или сортировки. Очистка требует headId:null
и nodes:[] вместе. Разворот передаёт все новые nextId и голову одним edit.
Само перенаправление допустимо только при корректной конечной цепи.

Полный layout содержит каждый узел кандидата ровно раз, конечные числовые x/y
и ни одного лишнего ID. Отсутствующий edit.layout удаляет позиции выбывших и
сохраняет остальные; новый узел поэтому требует полного layout в том же edit.
Позиции принадлежат снимку и не меняются неявно от размера Canvas или DPR.
Сохранённые layout, node marks и captions следуют порядку хранения nodes.
Pointer marks следуют сначала head, затем next в порядке nodes. Edit удаляет
отметки/подписи выбывших узлов и отметки их next-слотов. Сохранённые ID узла/слота
сохраняют отметки, даже при смене цели указателя. edit.marks применяется после
очистки и проверяется по конечному кандидату. Патч удалённой/неизвестной
сущности — ошибка, а не молчаливое удаление.

Роль — открытая непустая строка; null снимает её. Подпись — любая строка,
включая пустую; null снимает подпись. Повторы в каждой коллекции патчей —
RangeError; роль и подпись одного узла допустимы в одном вызове. События хранят
порядок патчей, атрибуты снимка — канонический порядок сущностей.

### Пример: одна вставка, один корректный снимок

Для примера требуется @grundyjs/algiviz 1.4.0 или новее. В nodes узел B специально
стоит раньше X: цепь A→X→B определяется nextId, а не порядком массива.

```ts
import { createListTrace } from "@grundyjs/algiviz/list";

function* insertExample() {
    const list = createListTrace({
        headId: "A",
        nodes: [
            { id: "A", value: 7, nextId: "B" },
            { id: "B", value: 3, nextId: null },
        ],
    }, { layout: [{ nodeId: "A", x: 0, y: 0 }, { nodeId: "B", x: 2, y: 0 }] });
    yield list.start();
    yield list.edit({
        nodes: [
            { id: "A", value: 7, nextId: "X" },
            { id: "B", value: 3, nextId: null },
            { id: "X", value: 5, nextId: "B" },
        ],
        layout: [
            { nodeId: "A", x: 0, y: 0 },
            { nodeId: "B", x: 2, y: 0 },
            { nodeId: "X", x: 1, y: 0 },
        ],
        marks: { pointers: [{ id: { kind: "next", nodeId: "A" }, role: "changed" }] },
    });
    yield list.done({ result: {
        nodeIds: ["X"], pointerIds: [{ kind: "next", nodeId: "A" }],
    } });
}
```

## Отметки результата

До done result равен null. done(), отсутствие result и result:undefined
сохраняют null. done({ result:{} }) сохраняет { nodeIds:[], pointerIds:[] };
вход result:null некорректен. Обе выборки содержат уникальные существующие ID
в порядке вызывающего и могут быть пустыми/опущенными независимо. Повторы
указателей определяются структурным равенством слота, не ссылкой на объект.
Выбирать head и null next допустимо.

Выбор узла устанавливает только его ListNodeView.result, указателя — только
ListPointerView.result. Он не выбирает концы, не утверждает путь, обход,
сортировку, успешный поиск или ненулевую цель. Отметки/подписи сохраняются.
Роль result остаётся обычной ролью. Числовой ответ, порядок обхода с повторами и
прикладной исход хранятся в State-обёртке. Отдельное поле path в первом объёме
не требуется. Флаги результата сохраняются в снимках при hold/rewind/seek;
свежий trace начинает без результата. Зелёный цвет задаст отдельный renderer.

## Захват, валидация и ошибки

Собственные входы модуля — записи Object/null-prototype и плотные массивы из
собственных data elements. Обязательные поля — собственные data properties.
Известные accessors отклоняются без вызова getter; унаследованные необязательные
поля игнорируются. Optional undefined означает отсутствие; обязательные
nextId/headId не могут быть undefined. Неизвестные поля игнорируются и не задают
топологию. Длина массива — примитивное целое 0..2^32-1; неверная длина даёт
TypeError. Превышение предела коллекции — RangeError до чтения элементов.
Записи захватывают дескрипторы известных полей в порядке декларации; массивы —
длину и все собственные data elements до проверки записей элементов. Opaque
value захватывается один раз по ссылке, без обхода содержимого.

| Ошибка входа | Исключение |
| --- | --- |
| Неверный тип записи/массива/скаляра, отсутствующее обязательное собственное поле, accessor/дырка/унаследованный элемент массива, пустой/нестроковый ID/role/namespace, нестроковая подпись, нечисловая координата, неверный тип pointer kind | TypeError |
| Неизвестный непустой kind указателя; повторный/выбывший ID узла; неизвестная голова/цель/владелец слота; петля/цикл/общий successor/недостижимый узел; неверная пустота/голова; повторная/недостающая/лишняя позиция; неконечная числовая координата; повтор выборки/патча; неканонический порядок снимка; превышение лимита | RangeError |
| Повтор start, команда до start/после done, изменение того же trace при захвате | Error |

Для pointer ID пустой/нестроковый/отсутствующий kind даёт TypeError, неизвестная
непустая строка — RangeError. next требует корректного собственного nodeId.
Лишние поля head не меняют идентичность. Исходные Proxy trap-исключения, включая
falsy/non-Error, сохраняются. ListError/коды не вводятся; тексты/stack не являются
стабильными идентификаторами. Внешние эффекты Proxy не откатываются.

Приоритет проверок:

1. Команда проверяет busy, затем lifecycle до аргументов. state во время захвата
   возвращает прежний committed-снимок; другой свободный trace независим.
2. Конструктор: envelope списка; скаляр head; длина/плотность nodes; записи в
   переданном порядке (id, opaque value, nextId, повтор ID). Затем пустота/голова,
   существование next и петли в порядке nodes, входящие количества в порядке
   nodes, итеративный обход/циклы от головы. Потом options, layout и подписи.
3. edit: envelope; optional head; эффективные nodes и полная топология как выше;
   выбывшие ID в порядке кандидата; полный/эффективный layout; очистка атрибутов;
   envelope marks, node patches, pointer patches, caption patches.
4. Layout: скаляры nodeId/x/y, существование, повтор для каждой записи; затем
   отсутствующие узлы в порядке nodes. Патчи: ID/значение, существование, повтор.
   Pointer ID проверяет kind, затем владельца next. done проверяет options/result,
   node selections, затем pointer selections. Плотность/лимит коллекции проверяется
   до её элементов. Отсутствующие списки — пустые входы, не замена коллекции.
5. listScene: options/namespace, envelope снимка, полный список/топология, layout,
   nodeMarks, pointerMarks, nodeCaptions, result. Порядок layout/атрибутов обязан
   быть каноническим; result сохраняет порядок вызывающего. Проверяется отдельный
   снимок, а не история выбывших ID и не породившие снимок event/lifecycle.

Весь захват, валидация, freeze и необходимые выделения выполняются до commit.
Ошибка сохраняет идентичность state, следующий index, lifecycle и retired IDs;
busy снимается в finally. Исправленный повтор использует тот же следующий index.
Пустой список поддерживает start, edit({}), пустые marks/layout и done. Отметка/
результат head-слота допустимы и тогда; любая ссылка на узел или next-слот — нет.

## Сцена и воспроизведение

listScene принимает корректные прикладные/structured-cloned снимки без frozen
brand и без Event. Выдаёт ровно закрытые виды listNode/listPointer. Для N узлов
2N+1 объектов: head, каждый next (включая null), затем узлы. У указателей zIndex 0,
у узлов 1. Порядок указателей — head, затем порядок nodes; узлы следуют nodes.
NodeView.head/tail выводятся из headId/nextId. ListPointerView.from/to — scene ID
узлов: head.from равен null, head.to соответствует голове или null; next.from
соответствует владельцу, next.to — цели или null. Null-цель не является фиктивным
узлом. Backend задаёт внешнюю точку head своей политикой рисования.

Scene ID — JSON.stringify кортежей: [namespace,"list","node",nodeId],
[namespace,"list","pointer","head"] и
[namespace,"list","pointer","next",ownerId]. Домены отличаются от graph/tree/grid;
независимым спискам/представлениям нужны разные namespace. Проекция копирует/
замораживает собственные view wrappers; node/position — ссылки на переданные
неизменяемые записи снимка, не deep clone. Нет мутации state, выбора routing,
head-anchor/null-marker, crossfade стрелок, layout или Canvas pixels. Отдельный [/canvas/list](list-canvas-api.md) реализует эти правила отрисовки с учётом обеих целей и отметок результата.

Нынешних Step/Frame, createSceneProjector/createSceneRenderer и Player
stepSource/isTerminal достаточно. Терминальность может проверять step.event.type
=== "done"; asyncSource/Worker остаются state-only/EOF с возможным undefined event.
Постоянные отметки/ответ не зависят от истории событий. Previous/seek восстанавливают
снимки, а не обратные присваивания и не retirement-историю trace. Pause/Next/Restart/
dispose и владение источником сохраняют контракты. Restart создаёт новый trace,
dispose закрывает итератор/сеанс, а не освобождает машинные узлы памяти. Новые
ошибки/фазы/registry-поля/unions прежних entry не нужны. ListEvent.type,
ListPointerId.kind и ListObjects закрыты после публикации; роли и прикладной State
остаются границами расширения.

## Промежуточные присваивания: явная прикладная граница

Trace владеет только полными корректными списками. Нет setNext/allocate/free/stage,
фазы некорректного ListSnapshot и автоматического исправления. X.next=B при
отсоединённом X и прежнем A.next=B корректно показывает работу алгоритма, но
ListInput со всеми тремя узлами некорректен. A.next=C при оставшемся выделенном,
но недостижимом B также некорректен. Временные циклы, dangling/freed pointers и
локальные aliases курсоров требуют явных прикладных данных.

Для микрошагов используется State-обёртка с корректным ListSnapshot и рабочей
ареной либо полностью прикладная арена. Generic Step/Frame и собственные Scene
objects отображают арену; передавать её listScene или штатному renderer
как корректный список нельзя. Новый ListSnapshot выдаётся после получения
корректного полного кандидата. Step не создаёт транзакцию между несколькими yield;
перемотка восстанавливает каждый записанный рабочий вид. Для арены и committed-
списка нужны разные namespace, кроме случая, когда приложение осознанно владеет
совместимыми identity/kind правилами обоих видов. SceneFrame.get не разрешает freed-цель,
отсутствующую в обоих endpoints; для такого урока нужны явные tombstones или
собственные данные неразрешённой ссылки.

Граница сохраняет проверку полной цепи и позволяет подробный урок указателей
через нынешний generic API. Будущему staging helper потребуется отдельный
контракт/ревизия совместимости; такой режим закрытой модели здесь не обещается.

## Проверки реализации и оставшаяся граница Canvas

[Отчёт реализации](../checks/list-implementation-2026-11-20.json) фиксирует постоянные
регрессии модели/сцены, Player history/stepSource, rewind/Restart/очистку,
установленные consumers поддерживаемых TypeScript и static/lazy bundle boundaries.
Это headless и модельный DOM-стенд, не native-проверка браузера.

[Выбор контракта](../checks/list-public-api-2026-11-20.json) и прежняя
[архитектурная проверка из 37 случаев](../checks/linked-list-contract-2026-11-16.json)
сохраняют исходный объём. Opaque values остаются прикладными; worker/transfer
правила не расширены. Headless-модуль работает с полными снимками. Промежуточные присваивания остаются в состоянии приложения.

Штатный [/canvas/list](list-canvas-api.md) реализует явную раскладку, отсеки значения и next, head и null, интерполяцию стрелок, подписи и независимую подсветку результата.
