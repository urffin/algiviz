# API дерева: /tree

[English](../tree-api.md) · [Архитектурный эскиз](tree-contract.md) · [Выпущенный Graph API](graph-api.md) · [Совместимость](api-compatibility.md) · [Проверка контракта](../checks/tree-public-api-2026-11-17.json)

**Реализовано локально, 2026-11-18; не опубликовано.** База — выпущенная 1.1.0 /
629defe. Рабочая копия добавляет независимый headless ESM /tree с createTreeTrace,
treeScene и 29 типами ниже. В npm 1.1.0 этого entry нет. Нужна локальная сборка/
архив неопубликованного [кандидата 1.2.0](candidate-1.2.md). У headless entry нет
зависимости от Canvas; рисует отдельный локальный /canvas/tree.
[Проверки реализации](../checks/tree-implementation-2026-11-18.json).
[Проверка контракта](../checks/tree-public-api-2026-11-17.json) и архитектурная
ревизия сохраняют исторический объём type/core-fit.
[Ревизия к 1.2.0](tree-readiness-1.2.md) принимает headless API; замечание безопасных
границ renderer T1 исправлено. Документ кандидата фиксирует оставшиеся CI точного
SHA и отдельно разрешаемый выпуск.

## Объём и выбранные границы

Два runtime-имени: createTreeTrace и treeScene. Первый объём — одно конечное
корневое упорядоченное или бинарное дерево, включая пустое. Kind явный и не
меняется за жизнь trace. Лес составляется разными namespaces; DAG, несколько
родителей, циклы и отсоединённые рабочие узлы вне корректного TreeSnapshot.
Свойства BST/кучи/балансировки, компараторы, обходы и повороты принадлежат
алгоритму приложения. Приложение выбирает, когда вычислять/записывать layout;
отдельный /canvas/tree helper может вычислить позиции.

Trace владеет неизменяемыми снимками модели/вида и выдаёт нынешние Step. Один edit
атомарно фиксирует целиком корректный кандидат топологии/вида. В первом API нет
алгоритмов insert/remove/move/rotate и callbacks мутации. Нынешние Step/Frame/Scene,
Player, ArrayEvent и GraphEvent не меняются. Первый graph trace сохраняет
фиксированную топологию и не принимает изменяющееся дерево.

**Раскладка явная.** При создании нужна полная раскладка, в том числе [] для пустого
дерева. Координаты — конечные логические единицы, без ограничения [0,1]. Headless-
контракт не обещает автоматическую раскладку дерева, Canvas-размер, отсутствие
пересечений или геометрию бинарных слотов. Будущим layout helper/Canvas renderer
нужен отдельный контракт; принятие left/right данных само его не подразумевает.

## Полные декларации

Все имена блока относятся только к локальному /tree. Перегрузки factory/scene для
ordered/binary сохраняют вывод типов payload узлов/связей и kind. Union-вход
возвращает trace с union-kind; фактический kind во время выполнения всё равно
фиксирован. Третий generic TreeFrame — Kind, четвёртый — Event; undefined events
поддержаны для state-only async/Worker playback.

```ts
import type { Step, Frame } from "@grundyjs/algiviz/playback";
import type { Scene } from "@grundyjs/algiviz/scene";

export type TreeKind = "ordered" | "binary";
export type TreeBinarySlot = "left" | "right";
export interface TreeNode<Data = unknown> {
    readonly id: string;
    readonly label?: string | undefined;
    readonly data?: Data | undefined;
}
export interface TreeOrderedLink<Data = unknown> {
    readonly id: string;
    readonly parentId: string;
    readonly childId: string;
    readonly label?: string | undefined;
    readonly data?: Data | undefined;
    readonly slot?: undefined;
}
export interface TreeBinaryLink<Data = unknown> {
    readonly id: string;
    readonly parentId: string;
    readonly childId: string;
    readonly slot: TreeBinarySlot;
    readonly label?: string | undefined;
    readonly data?: Data | undefined;
}
export type TreeLink<Data = unknown, Kind extends TreeKind = TreeKind> =
    Kind extends "binary" ? TreeBinaryLink<Data> : TreeOrderedLink<Data>;
export interface TreeOrderedInput<NodeData = unknown, LinkData = unknown> {
    readonly kind: "ordered";
    readonly rootId: string | null;
    readonly nodes: readonly TreeNode<NodeData>[];
    readonly links: readonly TreeOrderedLink<LinkData>[];
}
export interface TreeBinaryInput<NodeData = unknown, LinkData = unknown> {
    readonly kind: "binary";
    readonly rootId: string | null;
    readonly nodes: readonly TreeNode<NodeData>[];
    readonly links: readonly TreeBinaryLink<LinkData>[];
}
export type TreeInput<N = unknown, L = unknown, Kind extends TreeKind = TreeKind> =
    Kind extends "binary" ? TreeBinaryInput<N, L> : TreeOrderedInput<N, L>;
export interface TreePosition {
    readonly nodeId: string;
    readonly x: number;
    readonly y: number;
}
export interface TreeAnnotation {
    readonly id: string;
    readonly role: string;
}
export interface TreeMark {
    readonly id: string;
    readonly role: string | null;
}
export interface TreeNodeCaption {
    readonly id: string;
    readonly text: string;
}
export interface TreeNodeCaptionPatch {
    readonly id: string;
    readonly text: string | null;
}
export interface TreeMarkUpdate {
    readonly nodes?: readonly TreeMark[] | undefined;
    readonly links?: readonly TreeMark[] | undefined;
    readonly nodeCaptions?: readonly TreeNodeCaptionPatch[] | undefined;
}
export interface TreeResultInput {
    readonly nodeIds?: readonly string[] | undefined;
    readonly linkIds?: readonly string[] | undefined;
}
export interface TreeResult {
    readonly nodeIds: readonly string[];
    readonly linkIds: readonly string[];
}
export interface TreeDoneOptions {
    readonly result?: TreeResultInput | undefined;
}
export interface TreeTraceOptions {
    readonly layout: readonly TreePosition[];
    readonly nodeCaptions?: readonly TreeNodeCaption[] | undefined;
}
export interface TreeEdit<N = unknown, L = unknown, Kind extends TreeKind = TreeKind> {
    readonly rootId?: string | null | undefined;
    readonly nodes?: readonly TreeNode<N>[] | undefined;
    readonly links?: readonly TreeLink<L, Kind>[] | undefined;
    readonly layout?: readonly TreePosition[] | undefined;
    readonly kind?: undefined;
}
export interface TreeSnapshot<N = unknown, L = unknown, Kind extends TreeKind = TreeKind> {
    readonly tree: TreeInput<N, L, Kind>;
    readonly layout: readonly TreePosition[];
    readonly nodeMarks: readonly TreeAnnotation[];
    readonly linkMarks: readonly TreeAnnotation[];
    readonly nodeCaptions: readonly TreeNodeCaption[];
    readonly result: TreeResult | null;
}
export type TreeEvent = Readonly<
    | { type: "start" }
    | { type: "edit" }
    | { type: "mark"; nodes: readonly TreeMark[]; links: readonly TreeMark[];
        nodeCaptions: readonly TreeNodeCaptionPatch[] }
    | { type: "layout" }
    | { type: "done" }
>;
export type TreeStep<N = unknown, L = unknown, Kind extends TreeKind = TreeKind> =
    Step<TreeSnapshot<N, L, Kind>, TreeEvent>;
export type TreeFrame<N = unknown, L = unknown, Kind extends TreeKind = TreeKind, Event = TreeEvent> =
    Frame<TreeSnapshot<N, L, Kind>, Event>;
export interface TreeTrace<N = unknown, L = unknown, Kind extends TreeKind = TreeKind> {
    readonly state: TreeSnapshot<N, L, Kind>;
    start(): TreeStep<N, L, Kind>;
    edit(update: TreeEdit<N, L, Kind>): TreeStep<N, L, Kind>;
    mark(update: TreeMarkUpdate): TreeStep<N, L, Kind>;
    setLayout(layout: readonly TreePosition[]): TreeStep<N, L, Kind>;
    done(options?: TreeDoneOptions): TreeStep<N, L, Kind>;
}
export interface TreeSceneOptions {
    readonly namespace: string;
}
export interface TreeNodeView<Data = unknown> {
    readonly node: TreeNode<Data>;
    readonly position: TreePosition;
    readonly caption: string | null;
    readonly role: string | null;
    readonly result: boolean;
    readonly root: boolean;
}
export interface TreeLinkView<Data = unknown, Kind extends TreeKind = TreeKind> {
    readonly link: TreeLink<Data, Kind>;
    readonly from: string;
    readonly to: string;
    readonly role: string | null;
    readonly result: boolean;
}
export type TreeObjects<N = unknown, L = unknown, Kind extends TreeKind = TreeKind> = {
    treeNode: TreeNodeView<N>;
    treeLink: TreeLinkView<L, Kind>;
};
export declare function createTreeTrace<N = unknown, L = unknown>(
    tree: TreeOrderedInput<N, L>, options: TreeTraceOptions
): TreeTrace<N, L, "ordered">;
export declare function createTreeTrace<N = unknown, L = unknown>(
    tree: TreeBinaryInput<N, L>, options: TreeTraceOptions
): TreeTrace<N, L, "binary">;
export declare function createTreeTrace<N = unknown, L = unknown>(
    tree: TreeInput<N, L>, options: TreeTraceOptions
): TreeTrace<N, L>;
export declare function treeScene<N = unknown, L = unknown>(
    state: TreeSnapshot<N, L, "ordered">, options: TreeSceneOptions
): Scene<TreeObjects<N, L, "ordered">>;
export declare function treeScene<N = unknown, L = unknown>(
    state: TreeSnapshot<N, L, "binary">, options: TreeSceneOptions
): Scene<TreeObjects<N, L, "binary">>;
export declare function treeScene<N = unknown, L = unknown>(
    state: TreeSnapshot<N, L>, options: TreeSceneOptions
): Scene<TreeObjects<N, L>>;
```

## ID, иерархия и бинарные слоты

- ID — непустые примитивные строки; пробелы значимы, trim/coercion/генерации ID нет.
  Домены ID узлов и связей независимы. Подпись, payload, позиция, пара концов,
  порядок и слот не определяют идентичность.
- ID узла сохраняется при смене значения/подписи/родителя/корня/позиции. ID связи
  сохраняется, только если приложение намерено анимировать ту же логическую связь
  при смене концов/слота. Он не принадлежит ребёнку или слоту родителя. Неявного
  сопоставления по концам или выделения ID нет.
- Удалённый ID выбывает в своём домене до конца trace: повторное добавление —
  RangeError. ID, присутствующий до и после одного edit, сохраняется, а не удаляется
  и создаётся заново. Ошибка не резервирует/не выводит ID. Новый trace/Restart имеет
  новую историю и может снова использовать исходные ID. Старые снимки остаются
  корректными в playback; история выбывших ID не входит в снимок.
- Пустое дерево: rootId = null, nodes/links пустые. Иначе один существующий корень
  не имеет входящей связи, каждый другой узел имеет ровно одну. Все концы существуют,
  все узлы достижимы; петли, повторные parent-child пары и циклы недопустимы. Порядок
  хранения узлов не является порядком иерархии.
- Ordered: фильтрация единственного массива links по parent определяет порядок
  детей. Определённый slot — TypeError. Замена массива переставляет соседей; второй
  таблицы parent/children/order, способной противоречить links, нет.
- Binary: у каждой связи обязателен left или right. В каждом слоте родителя не
  больше одной связи. Порядок массива не меняет смысл слотов. Нет left-связи — левый
  слот пуст; единственный правый ребёнок остаётся правым. Фиктивных узлов, null-концов,
  сжатия или автоматического перемещения детей нет. Декорации пустых слотов могут
  иметь прикладные scene kinds с идентичностью parent+slot.

## Атомарные операции trace

Создание захватывает дерево, полную раскладку и необязательные начальные подписи.
Начальный снимок имеет пустые отметки и null result. Шаг не выдаётся; state уже
доступен. start нужен ровно один раз и выдаёт index 0 с тем же начальным state.
Каждая успешная последующая команда увеличивает index на один и создаёт новый
внешний снимок, включая no-op; неизменные собственные записи могут разделяться.
Обёртки Step, events, собственные записи и коллекции заморожены.

| Команда | Выбранное поведение |
| --- | --- |
| edit(update) | Пропущенные/undefined rootId, nodes, links и layout сохраняются с описанным ниже удалением отсутствующих сущностей. Переданные nodes/links полностью заменяют коллекции: это не upsert и не последовательные патчи. Определённый kind передавать нельзя. Кандидат проверяется как одно целое. |
| mark(update) | Атомарно применяет роли узлов, связей, затем патчи подписей. Пропущенные списки пусты; повтор ID в одном списке — RangeError. Пустой update тоже выдаёт mark. |
| setLayout(layout) | Атомарно заменяет полные позиции текущих узлов, не меняя топологию. No-op тоже выдаёт шаг. |
| done(options?) | Сохраняет топологию/раскладку/отметки/подписи, записывает результат или null, один раз выдаёт терминальный done. Позднейших мутаций нет. |

Вставка передаёт полные новые nodes/links и раскладку одним edit. Удаление поддерева
передаёт оставшиеся узлы/связи и при необходимости rootId. Структурный каскад не
угадывается: удаление узла с оставшейся висячей связью некорректно. Полная очистка
требует одновременно rootId:null, nodes:[], links:[]. Смена родителя/порядка/поворот
может заменить links/rootId, не заменяя nodes. Корректным деревом должен быть только
итоговый кандидат; некорректные промежуточные снимки наружу не выходят.

У удалённых сущностей удаляются отметки/подписи и позиции узлов. Сохранившиеся ID
сохраняют отметки/подписи/позиции; смена концов связи сохраняет её отметку. До done
result равен null: edit не переносит терминальный результат. При пропуске layout
у каждого узла кандидата должна остаться позиция, поэтому добавление узла требует
передачи полной раскладки тем же edit. В ней каждый узел кандидата указан ровно
один раз, без старых/лишних ID. Раскладка хранится в порядке nodes, отметки/подписи —
в порядке соответствующих сущностей.

Роли — открытые непустые строки; null снимает роль. Они не утверждают обход,
сортировку или балансировку. Caption — любая строка, включая пустую; null-патч
удаляет её. NodeView.caption равен null при отсутствии и сохраняет явный пустой
текст. Label и caption независимы. Выборки результата — уникальные существующие ID
в порядке приложения; списки могут быть пусты/пропущены. Выборки независимы: связь
не выбирает свои концы и не доказывает путь. done() или result:undefined сохраняют
null; result:{} сохраняет два пустых массива. Роль result остаётся ролью. Постоянное
визуальное состояние находится в State, не в прошлых events. Edit/layout events
не дублируют данные для восстановления по журналу.

## Пример: неполное бинарное дерево и один атомарный поворот

Пример работает с локальной сборкой/архивом, не с опубликованной npm 1.1.0. Сохранены оба ID узлов
и явно выбранный ID связи; отсутствие left не превращает right-ребёнка в левого.
Новую иерархию и позиции задаёт приложение.

```ts
import { createTreeTrace } from "@grundyjs/algiviz/tree";

function* rotateExample() {
    const tree = createTreeTrace({
        kind: "binary", rootId: "A",
        nodes: [{ id: "A", data: 2 }, { id: "B", data: 3 }],
        links: [{ id: "relation", parentId: "A", childId: "B", slot: "right" }],
    }, { layout: [{ nodeId: "A", x: 0, y: 0 }, { nodeId: "B", x: 1, y: 1 }] });
    yield tree.start();
    yield tree.edit({
        rootId: "B",
        links: [{ id: "relation", parentId: "B", childId: "A", slot: "left" }],
        layout: [{ nodeId: "A", x: 0, y: 1 }, { nodeId: "B", x: 1, y: 0 }],
    });
    yield tree.done({ result: { nodeIds: ["B"], linkIds: ["relation"] } });
}
```

## Захват, валидация и ошибки

Собственные данные модуля — plain Object/null-prototype записи и плотные массивы
с собственными data-элементами. Обязательные поля — собственные data properties.
Распознаваемые accessors отклоняются без вызова; унаследованные optional-поля
игнорируются. Undefined означает пропуск. Неизвестные поля игнорируются, кроме явно
запрещённых определённых edit.kind и slot ordered-связи. Length массива — примитивное
целое в 0..2^32-1; неверная сообщённая длина даёт TypeError до чтения элементов. Data payload захватывается
по ссылке, не обходится/не клонируется/не замораживается глубоко. Неизменяемость
payload и его structured-clone совместимость обеспечивает приложение.

История выбывания требует памяти по числу всех когда-либо зафиксированных ID,
не только живых узлов/связей; ограниченная перемотка её не ограничивает. Захват/
валидация полных коллекций и раскладка — синхронная работа. Бюджет кадра Player
ограничивает чтения источника, не стоимость одного edit/проекции.

| Некорректный случай | Ошибка |
| --- | --- |
| Неверные типы record/array/scalar, отсутствующее обязательное поле, accessor/дырявый массив, пустой/нестроковый ID/role/namespace, нестроковый label/caption, определённый ordered slot или edit.kind | TypeError |
| Неподдерживаемая непустая строка kind/slot, повторный/выбывший ID, неизвестная ссылка, неверные корень/иерархия/цикл/занятость слота, повторная/недостающая/лишняя позиция, неконечное числовое x/y | RangeError |
| Повторный start, команда до start/после done, мутация этого trace во время захвата | Error |

Пустой/нестроковый kind или binary slot — TypeError; отсутствие обязательного binary
slot — TypeError отсутствующего поля. Coercion или проверки payload нет. TreeError/
error code/обёртка не вводятся. Исходные Proxy trap throws, включая не-Error/falsy,
передаются без изменений. Proxy не становится безопасной песочницей. Сообщения и
stack — диагностический текст, не стабильный идентификатор.

Порядок проверок входит в контракт:

1. Команда проверяет busy, затем lifecycle, до чтения аргументов. Чтение state при
   захвате видит прежний зафиксированный снимок. Вложенная команда падает до чтения
   своих аргументов. Чтения и другая свободная trace допустимы; правила повторного
   управления Player этим не расширяются.
2. Для записи сначала захватываются/проверяются дескрипторы распознаваемых полей,
   затем scalar values. Для массива сначала length/density/data-элементы, затем
   записи. Конструктор: tree envelope; kind/root scalar; nodes в переданном порядке
   (id, label, непрозрачный data, повтор ID); links в переданном порядке (id,
   parentId, childId, slot, label, data, повтор ID, принадлежность концов).
3. Root/empty membership; петли/повтор пары и занятость binary slot в порядке links;
   число входящих родителей в порядке nodes; достижимость/циклы от корня по порядку
   детей (binary: left до right). Отсоединённые компоненты некорректны. Затем options
   envelope, layout и начальные captions.
4. edit: envelope, запрет kind, optional root scalar, эффективные nodes/links,
   полная иерархия как выше, выбывшие node IDs, затем link IDs в порядке кандидата;
   потом полная/сохранённая раскладка. Аннотации/подписи удаляются и нормализуются
   после проверки. ID выбывают только при фиксации, не при захвате. Ни один callback
   не видит предлагаемый state.
5. Layout: записи в переданном порядке, scalar nodeId/x/y, membership, повтор;
   затем отсутствующие узлы в порядке nodes. Mark: envelope; nodes, links,
   nodeCaptions с проверками id/value, membership, повтора. Done: options/result
   envelope, node IDs, затем link IDs, с сохранением порядка выбора.
6. treeScene: options/namespace, snapshot envelope, полное дерево/иерархия, layout,
   nodeMarks, linkMarks, nodeCaptions, result. Нужен канонический порядок раскладки/
   отметок/подписей; result сохраняет порядок приложения. Нарушение порядка —
   RangeError. Проверяется сам снимок, не история выбывших ID trace.

Весь захват, валидация и обязательные выделения памяти завершаются до изменения
state, index, lifecycle и наборов выбывших ID. Ошибка сохраняет идентичность state
и историю, поэтому исправленный повтор получает тот же следующий index. Busy
снимается в finally. Внешние побочные эффекты Proxy не откатываются. Пустое дерево
допускает start/edit({})/пустые mark/layout/done и отклоняет ID сущностей.

## Scene, playback и граница модуля

Чистая endpoint-проекция treeScene принимает корректные прикладные или Worker-
клонированные снимки без frozen-brand/Event. Владелец сохраняет неизменяемость
удерживаемых снимков/payload. Есть ровно treeNode и treeLink: связи zIndex 0, затем
узлы 1, в порядке хранения. Scene-обёртки/view data копируются и замораживаются,
неизменяемые записи снимков и payload сохраняются по ссылке. Root — производный
флаг узла; второй самостоятельный parent/depth cache в State не хранится.

Scene IDs различают узлы дерева, связи дерева и объекты графа даже при совпадении
namespace/domain ID; кодировка непрозрачна. Для разных деревьев/видов используйте
разные namespaces. From/to — scene IDs узлов, не domain IDs. Сохраняемая связь может
менять концы/slot с тем же ID/type; handler разрешает старое и новое поколения
концов через scene.get. Пустой binary slot не выдаёт объект. Обязательных scene
kinds стрелок/подписей/placeholder нет. Корректный снимок не гарантирует анимацию
без пересечений.

Подходит прежний Player.stepSource с isTerminal:step=>step.event.type==='done'.
Перемотка/seek восстанавливают снимки, не обратные edit; Restart создаёт свежий
trace с исходной историей ID. Dispose/очистка источника сохраняют нынешние правила.
State-only asyncSource/Worker передают TreeSnapshot с undefined events и EOF-
завершением; рисование дерева не требует TreeEvent. Прежние запреты общей памяти
и правила clone/transfer Worker сохраняются, исключений для дерева нет. Очистка приложения находится
в finally, а не после yield done.

/tree остаётся DOM-free с ES2022-декларациями без зависимости от рисования.
[Отдельный /canvas/tree](tree-canvas-api.md) реализует createTreeRenderer локально,
без публикации, с явными layout/render. Результат layout передаётся в прежние
constructor/edit options без изменения headless API; /canvas/graph не объявляется принимающим
TreeSnapshot. Статическая конвертация в graph требует явных направленных рёбер
и отдельного сохранения tree metadata; createGraphTrace от этого не становится
изменяемым по топологии. Не выбраны новые root/deep imports, Player option,
экспорт алгоритма, неявная headless-раскладка или расширение прежних закрытых unions.

## Проверка реализации и граница выпуска

[Отчёт реализации](../checks/tree-implementation-2026-11-18.json) фиксирует
постоянные проверки модели/управления, installed compiler consumers и optional
bundle isolation. Прежний [отчёт контракта](../checks/tree-public-api-2026-11-17.json)
сохраняет type-probe объём и не переписывается как runtime-доказательство.
Области регрессий ниже покрыты этим headless-этапом. Более поздний
[отчёт Canvas](../checks/tree-canvas-implementation-2026-11-19.json) отдельно
фиксирует layout/render/native-проверки. CI/публикация точного кандидата ещё впереди.

| Область | Обязательные сценарии |
| --- | --- |
| Модель/слоты | Пустое/один узел, только right-ребёнок, ordered reorder, неверный/пропущенный/занятый slot, несколько корней/родителей, цикл/отсоединённый граф, произвольные стабильные ID |
| Atomic edit | Вставка/удаление/поддерево, reparent, root change, поворот, очистка; поздняя ошибка не меняет state/index/lifecycle/выбывшие ID |
| Идентичность | Смена концов/слота с тем же ID, запрет повторного использования в обоих доменах, одинаковый ID в разных доменах, новая trace при Restart |
| Вид | Сохранение/удаление отметок/подписей/позиций по ID, полная раскладка для нового узла, постоянный независимый результат, no-op шаги |
| Ошибки | Дескрипторы/accessors/proxy throws, приоритет смешанных ошибок, повторная мутация, отсутствие обхода payload/частичной фиксации |
| Scene/control | Старые/новые концы, enter/update/exit, композиция namespaces, event-free клонированные снимки, history/ограниченная перемотка, Restart/dispose |
| Пакет | Реальные installed exports, поддерживаемые strict-компиляторы, ES2022-only headless, независимая ленивая загрузка, неизменность десяти прежних entry |

[Ревизия готовности](tree-readiness-1.2.md) выбирает 1.2.0 как совместимый minor;
package и lockfile теперь соответствуют неопубликованному кандидату 1.2.0. Закрытые наборы slot/kind/event
и выбранные ошибки/владение получают ту же ревизию совместимости при первой публикации.
