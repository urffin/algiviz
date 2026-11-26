# API Canvas дерева: /canvas/tree

[English](../tree-canvas-api.md) · [Tree API](tree-api.md) · [Graph Canvas](graph-api.md) · [Viewport](canvas-viewport.md) · [Проверка контракта](../checks/tree-canvas-contract-2026-11-18.json)

**Выпущено в 1.2.0, 2026-11-19**, коммит 8e1f50b. Независимый /canvas/tree
в этом выпуске экспортировал createTreeRenderer и четыре типа. Нужны DOM-типы и Canvas 2D host;
headless /tree остаётся отдельным. В npm 1.1.0 обоих entry нет.
[Выпуск и проверки](release-1.2.md) · [Исходная реализация](../checks/tree-canvas-implementation-2026-11-19.json) ·
[Исправление T1](../checks/tree-t1-fix-2026-11-19.json) · [Native-приёмка](../checks/tree-t1-native-2026-11-19.json).
Ранние отчёты сохраняют свой исторический объём.

## API и владение

Factory возвращает методы layout и render. Layout вычисляет данные для явного
создания/edit trace; render всегда использует позиции из State, не пересчитывая
иерархию скрыто. Render рисует полный bitmap вместе с фоном; лес/смешанные виды
используют treeScene с собственными handlers. Позиции входят в запись, перемотку,
Worker-состояние и Restart.

```ts
import type { Frame } from "@grundyjs/algiviz/playback";
import type { TreeInput, TreePosition, TreeKind, TreeSnapshot } from "@grundyjs/algiviz/tree";

export interface TreePalette {
    readonly background: string;
    readonly text: string;
    readonly node: string;
    readonly link: string;
    readonly emptySlot: string;
    readonly active: string;
    readonly visited: string;
    readonly queued: string;
    readonly result: string;
}
export interface TreeRendererOptions<N = unknown> {
    readonly theme: "light" | "dark";
    readonly colors?: { readonly [K in keyof TreePalette]?: string | undefined } | undefined;
    readonly roleColors?: Readonly<Record<string, string>> | undefined;
    readonly horizontalGap?: number | undefined;
    readonly levelGap?: number | undefined;
    readonly emptySlots?: "hidden" | "visible" | undefined;
    readonly nodeCaptions?: "auto" | "hidden" | undefined;
    readonly nodeRadius?: number | undefined;
    readonly drawNode?: TreeNodeDrawer<N> | undefined;
}
export interface TreeRenderSize {
    readonly width: number;
    readonly height: number;
}
export interface TreeRenderOptions {
    readonly doubleOutlineNodeIds?: readonly string[] | undefined;
}
export interface TreeRenderer {
    layout<N, L>(tree: TreeInput<N, L>): readonly TreePosition[];
    render<N, L, Kind extends TreeKind, Event>(
        context: CanvasRenderingContext2D,
        frame: Frame<TreeSnapshot<N, L, Kind>, Event>,
        size: TreeRenderSize,
        options?: TreeRenderOptions
    ): void;
}
export declare function createTreeRenderer(
    options: TreeRendererOptions & { readonly drawNode?: undefined }
): TreeRenderer;
export declare function createTreeRenderer<N>(options: TreeRendererOptions<N>): TreeRendererWithNodeData<N>;
export declare function createTreeRenderer(options: TreeRendererOptions): TreeRenderer;
```

Theme обязателен. Defaults: horizontalGap = 1, levelGap = 2, emptySlots = hidden,
nodeCaptions = auto. Gap — логические единицы раскладки, не CSS px или диаметр узла.
Options и собственные color/role overrides захватываются один раз. Неизвестные
поля игнорируются, распознаваемые accessors отклоняются без вызова, как в plain
Object/null-prototype записях /tree. Undefined означает пропуск. RoleColors содержит
только собственные непустые строковые ключи и значения; palette overrides — только
объявленные ключи. Поддержка CSS-цвета принадлежит Canvas. После создания options
не читаются снова.

Один экземпляр отклоняет вложенные layout/render с Error до чтения аргументов;
другой свободный экземпляр независим. Busy снимается в finally, включая opaque
throws. Методы не владеют source, trace, RAF, Worker, DOM listeners, временем жизни
context, CSS или resize bitmap. Dispose нет. Render может удерживать не больше
двух immutable endpoint-снимков и одной пары сопоставления, без растущей истории
или таблицы slot IDs. Layout не удерживает вход после возврата и не обещает
идентичность ссылок/кэш.

Entry требует DOM-декларации из-за CanvasRenderingContext2D в render. Импорт и
вызов layout не обращаются к DOM globals и не выделяют внешние ресурсы. Это не
делает декларации entry ES2022-only. /tree остаётся независимым и DOM-free.
OffscreenCanvas, SVG и retained DOM rendering здесь не выбраны; собственные
backend используют treeScene. Обратной зависимости /tree от Canvas и изменений
/canvas, /canvas/graph, Player или прежних unions нет. Optional entry может загружать
проверку/проекцию tree и generic scene matching, но не Player, Worker, array/graph
backend или tree trace builder. Другие entry не загружают его без явного
static/dynamic import.

## Радиус узлов

С версии 1.10.0 `nodeRadius` задаёт желаемый радиус всех узлов дерева в
логических пикселях Canvas. Допустимо конечное положительное число. Значение по
умолчанию — 16. Рендерер берёт минимум из заданного радиуса, ширины / 8
и высоты / 8. Итоговый радиус учитывается при рисовании связей, двойного
контура и подписей и передаётся в `drawNode`. Координаты, которые возвращает
`layout()`, от этой опции не зависят.

## Чистая раскладка ordered и binary

Layout принимает полный TreeInput, не частичный edit и не TreeSnapshot. Сначала
проверяет kind, корень, ID, связи, ограничения ordered/binary и достижимость в
порядке /tree, не обходя payload. Lifecycle trace и история выбывших ID не входят
в эту stateless-проверку. Результат — скопированный и замороженный полный массив
TreePosition **в порядке хранения tree.nodes**, по одной записи на ID. Отметок,
виртуальных узлов, captions, DOM-измерений и events в нём нет. Пустое дерево даёт
[]. Координаты не зависят от label/data, темы, viewport, шрифта, видимости подписей/
слотов, порядка посещения кадров или прошлой отрисовки.

Выбранные алгоритмы логических координат входят в контракт layout, а не являются
необъявленными пиксельными defaults:

- Ordered: порядок детей определяется фильтрацией links по parent. Листьям
  последовательно назначаются единичные ранги 0,1,... в depth-first порядке детей.
  Лист сохраняет ранг; внутренний узел получает середину рангов первого и последнего
  ребёнка (с одним ребёнком x совпадает). Для ранга r и ранга корня rRoot:
  x = (r - rRoot) * horizontalGap, y = depth * levelGap.
- Binary: рассматривается конечное расширенное дерево с одним терминальным
  виртуальным листом для каждого отсутствующего left/right у реального узла.
  Виртуальные листья не имеют детей: полного дерева 2^depth не создаётся. Узлы
  этого расширения нумеруются in-order с нуля: левый слот, реальный узел, правый
  слот. Для ordinal i реального узла и iRoot корня:
  x = (i - iRoot) * horizontalGap, y = depth * levelGap. Возвращаются только
  реальные узлы. Для непустого binary из N узлов концептуальное расширение имеет
  2*N+1 записей.
- В обоих режимах корень находится в (0,0). Глубина следует от проверенного корня,
  не от индекса nodes. Округление floating-point и визуальное слияние близких
  координат после fit не меняют логический порядок или смысл слотов.
- Некорректная топология отклоняется до результата. Неконечные координаты или
  непредставимая арифметика дают RangeError. Ограничение глубины рекурсивным стеком,
  измерение текста, force layout и экспоненциальные пустые уровни в API не входят.
  Реализация использует итеративный обход, безопасный по глубине.

При штатных gaps независимо заданные позиции ниже проверяются против
реализованной раскладки:

| Дерево | Ожидаемые реальные позиции |
| --- | --- |
| Пустое, любой kind | [] |
| Один корень R, любой kind | R=(0,0) |
| Ordered: дети R — A,B; у A ребёнок X | R=(0,0), A=(-0.5,2), B=(0.5,2), X=(-0.5,4) |
| Binary R только с правым B | R=(0,0), B=(2,2) |
| Binary R только с левым B | R=(0,0), B=(-2,2) |
| Binary R с левым A и правым B | R=(0,0), A=(-2,2), B=(2,2) |

Binary in-order сохраняет left/right и пустые слоты, но не обещает, что родитель
лежит посередине корней реальных детей. Ordered не подразумевает бинарных слотов.
Смена gaps/топологии меняет позиции лишь при явном вызове layout приложением и
записи результата.

## Атомарная запись раскладки

Пример требует npm 1.2.0 или соответствующей локальной сборки. Нельзя
передавать candidate.kind в edit: headless trace запрещает это поле.

```ts
import { createTreeTrace } from "@grundyjs/algiviz/tree";
import { createTreeRenderer } from "@grundyjs/algiviz/canvas/tree";

const renderer = createTreeRenderer({ theme: "light", emptySlots: "visible" });
const input = {
    kind: "binary", rootId: "A",
    nodes: [{ id: "A", label: "2" }, { id: "B", label: "3" }],
    links: [{ id: "relation", parentId: "A", childId: "B", slot: "right" }],
} as const;
function* rotate() {
    const tree = createTreeTrace(input, { layout: renderer.layout(input) });
    yield tree.start();
    const update = {
        rootId: "B",
        links: [{ id: "relation", parentId: "B", childId: "A", slot: "left" }],
    } as const;
    const candidate = { ...tree.state.tree, ...update };
    yield tree.edit({ ...update, layout: renderer.layout(candidate) });
    yield tree.done({ result: { nodeIds: ["B"], linkIds: ["relation"] } });
}
```

Подходят прежние Player.stepSource/isTerminal. Render callback может вызвать
renderer.render(context, frame, logicalSize). Context и размер принадлежат
приложению, например через /canvas/viewport. Layout — синхронная работа source
до yield; maxStepsPerFrame не прерывает один дорогой layout/edit/render. Helper не
запускается внутри render или при resize. Смена политики renderer не переписывает
снимки, уже удерживаемые воспроизведением. Для общего TreeEdit нужно разрешить
пропущенные/undefined rootId/nodes/links через нынешнее дерево до вызова layout:
обычный spread не реализует правило edit «undefined означает пропуск». В примере
update содержит только явно заданные поля.

## Двойной контур конца слова в префиксном дереве

Доступно с 1.10.0.

Передайте `doubleOutlineNodeIds` в четвёртом аргументе `render`, чтобы
добавить внутренний контур и внешнее кольцо вокруг выбранных узлов. Оба
контура учитывают роль, признак результата и прозрачность узла. Внешний
радиус учитывается при размещении подписей узлов и связей, а также маркеров
пустых слотов. Позиции узлов и точки крепления связей сохраняются. Без
опции действует штатная отрисовка.

Храните признак конца слова в данных узла каждого снимка. Собирайте ID в
функции отрисовки Player, чтобы при перемотке через `stepHistory` контуры
восстанавливались по текущему кадру.

```ts
render: frame => {
    const doubleOutlineNodeIds = frame.current.tree.nodes
        .filter(node => node.data?.terminal)
        .map(node => node.id);
    renderer.render(context, frame, logicalSize, { doubleOutlineNodeIds });
}
```

Опция принимает плотный массив непустых ID. Повторяющийся ID учитывается
один раз. ID, отсутствующие в обоих снимках, игнорируются. Чтобы кольцо
исчезало вместе с узлом, передавайте его ID, пока узел виден в переходе.

## Пользовательская отрисовка узла

С версии 1.10.0 `drawNode` вызывается для
каждого видимого узла и получает доступные только для чтения `view`, `center`,
`radius` и `outerRadius`, а также контекст Canvas `ctx` и функцию
`drawDefault()`. Геометрия использует те же логические пиксели, что и
`TreeRenderSize`. В `outerRadius` входит запас под двойной контур, если он
включён для узла.

`drawDefault()` рисует тело узла и его двойной контур в момент вызова. Чтобы
добавить деталь поверх заливки, рисуйте её после вызова. Чтобы нарисовать тело
целиком, можно пропустить вызов. Текст узла и дополнительные подписи рисует
рендерер. Автоматическое размещение подписей учитывает область до
`outerRadius`.

```ts
const renderer = createTreeRenderer<{ terminal: boolean }>({
    theme: "light",
    nodeRadius: 21,
    horizontalGap: 2.7,
    drawNode({ ctx, view, center, radius, drawDefault }) {
        drawDefault();
        if (!view.node.data?.terminal) return;
        ctx.fillStyle = "#db2777";
        ctx.beginPath();
        ctx.arc(center.x + radius * .55, center.y - radius * .55,
            radius * .15, 0, 2 * Math.PI);
        ctx.fill();
    },
});
```

Callback выполняется синхронно. Позиция и прозрачность уже рассчитаны для
текущего кадра. Если вы вызываете `ctx.save()`, вызовите парный
`ctx.restore()` внутри callback. Используйте `drawDefault()` только во
время вызова callback. Состояние Canvas восстанавливается перед отрисовкой
текста и следующего узла. Если указан тип данных узла, рендерер принимает
снимки с этим типом данных.
Для явных аннотаций entry экспортирует `TreeNodeDrawContext<N>`,
`TreeNodeDrawer<N>` и `TreeRendererWithNodeData<N>`.

Чтобы повторить типографику сайта, храните символ в данных узла, а в
`label` передайте пустую строку. В `drawNode` можно нарисовать текст
своим шрифтом и выбрать заливку и обводку по роли узла.

## Пустые бинарные слоты

Нет left/right-связи — отсутствует слот **реального родителя**, а не появляется
null-конец, выделенный узел или следующий пустой уровень. В TreeSnapshot,
treeScene и TreeObjects не добавляются объекты или ID. Внутренняя идентичность
декорации — tuple (owner node ID, left/right), не ID занятой связи. Слот нельзя
отметить или выбрать результатом. У ordered и пустого дерева таких маркеров нет.

Raw anchor пустого слота — позиция родителя плюс (-horizontalGap, levelGap) слева
или (+horizontalGap, levelGap) справа. Для binary-результата layout это точно
позиции виртуальных листьев расширенного дерева. Прикладные снимки остаются
допустимыми; gaps нужно выбирать в их единицах. Renderer не исправляет прикладную
раскладку, поместившую правого ребёнка слева.

EmptySlots:visible рисует приглушённый пунктир от нижнего диагонального порта
родителя к маленькому полому квадрату. Можно показать оба отсутствующих ребёнка
листа. Hidden скрывает декорации, не резервирование layout или fit bounds, поэтому
видимость сама не перестраивает реальные узлы. Размеры декораций — presentation
defaults. Маркер/пунктир можно пропустить, если безопасного места нет; State и
резервирование раскладки не меняются. Tooltip/report API не добавляется.

Виртуальные слоты сопоставляются независимо на двух endpoints. Пустой на обоих
концах слот следует за интерполируемым владельцем с alpha 1; новый пустой слот
появляется с p, новый занятый исчезает с 1-p. Для входящего/выходящего владельца
его слоты получают ту же enter/exit alpha. Morph placeholder в реальный узел и
память прежнего null-состояния не используются. Safe omission может переключаться
дискретно.

## Fit, узлы и интерполяция связей

Render проверяет оба полных снимка, затем использует один равномерный contain-
transform для общих bounds endpoints: всех центров узлов и anchors пустых слотов,
включая скрытые слоты и entering/exiting endpoints с нулевой presence. Вырожденные
оси/одна точка центрируются с запасом под glyphs. Transform фиксирован для всех
p одной пары, использует явный logical size, не DOM reads. Между шагами bounds
могут меняться: непрерывность общей камеры не обещается. Крошечный Canvas или
совпадающие прикладные позиции не обязаны оставаться читаемыми.

Сохраняемый узел линейно интерполирует записанные previous/current позиции по
raw progress p; входящий/выходящий использует доступную позицию и alpha p/1-p.
Easing, чтение source или раскладка иерархии, зависящая от progress, не вводятся.

Связь — parent-to-child cubic path: нижний порт ordered-родителя или нижний
диагональный left/right binary-порт к верхнему порту ребёнка. Порты находятся на
окружности узла, controls конечны. Для корректной модели дерева не нужны API
стрелок, петель и параллельных полос. Формулы stroke/radius/font/padding — defaults
представления, не обещание пиксельной идентичности. Своя геометрия может пересекаться.

- Если parentId, childId и binary slot сохраняемой связи не менялись, рисуется
  один маршрут между интерполируемыми узлами с alpha 1.
- При смене конца/slot логический ID сохраняется, но рисуются **два маршрута**:
  прежняя связь с alpha 1-p и новая с alpha p. Каждая ветвь разрешает свои ID/
  поколения концов через scene.get и использует текущие интерполируемые позиции
  этих узлов либо доступные enter/exit позиции. Порт начала берётся из старого/
  нового slot соответствующей ветви.
- Входящая связь рисует current маршрут с p, выходящая previous с 1-p. Старые
  узлы концов разрешаются и при presence 0.
- Нельзя интерполировать ID, использовать новые ссылки для обеих ветвей или
  смешивать центры разных родителей в один оторванный конец. Один scene treeLink
  может рисовать две внутренние ветви; нового публичного scene kind нет. Во время
  crossfade возможны параллельные/пересекающиеся маршруты: это не третье дерево.

Основные подписи, роли, результат и caption text берутся из current для
сохраняемых/входящих объектов на всём кадре, включая p=0; для выходящих — previous.
Пустой/null current-текст не возвращает старую подпись. Ветви rewire используют
стиль/текст current логической связи; текст может появиться на обоих видимых
маршрутах. Opacity — presence ветви, не история source. Геометрия/пропуски
детерминированы для тех же endpoints/options/progress/size и метрик шрифта,
независимо от порядка посещения кадров.

## Label, caption, слот и безопасный пропуск

Основной текст — node.label; fallback на node.id только при undefined label.
Пустой label скрывает его. Node.data/link.data не обходятся и не превращаются в
строку. Текст связи — только явный link.label, без fallback на ID или weight.
Caption берётся из state.nodeCaptions через treeScene, не Event/callback. Null
означает отсутствие, пустые/пробельные строки не рисуются.

Весь текст — plain one-line. Последовательности TAB/CR/LF/U+2028/U+2029 заменяются
пробелом только для рисования, исходные строки сохраняются. Начальный font —
12px sans-serif. Основная подпись ограничена по ширине внутри окружности; полная
измеренная ink-cell резервируется консервативно. Вторичный текст не усекается и
не сжимается: measured ink/advance bounds, высота cell не меньше 16px, horizontal
padding 4px и vertical 2px. Box шире 120 logical CSS px или полезного viewport
пропускается. Весь текст использует palette.text независимо от цвета результата.

До первой записи пикселя резервирование планируется детерминированно:

1. Препятствия — реальные окружности, границы основного текста и каждый реальный
   маршрут с ненулевой presence. Учитываются обе rewire-ветви, не редкая выборка
   точек центральной линии.
2. В порядке links, previous-ветвь перед current, проверяются два кандидата label-
   box по противоположным нормалям к середине кривой с достаточным отступом под box
   и safety gap. Нулевая касательная имеет детерминированный fallback оси. Первый
   безопасный кандидат принимается, иначе подпись ветви пропускается.
3. Для видимых слотов: current-порядок узлов, затем exits, left до right. Пунктир/
   квадрат отклоняется при пересечении узлов/основного текста, реальных маршрутов,
   принятых labels или прошлых slot-декораций, кроме ожидаемого контакта со своим
   родителем. Учитывается весь пунктир, не только конец.
4. Для captions: current-порядок узлов, затем exits. Кандидаты снизу, сверху,
   справа, слева, снизу-справа, снизу-слева, сверху-справа, сверху-слева. Принимается
   первый безопасный полный box, иначе подпись пропускается. Препятствия — узлы,
   маршруты, link labels, slot-декорации и прежние captions. Приоритета role/result
   или закреплённого победителя нет.

Вторичные boxes/декорации остаются не ближе 4 CSS px к краю viewport и с
консервативным gap 2px от чужих painted/reserved bounds. Исключение кривой покрывает
весь путь; непроверенные интервалы между редкими samples недопустимы. Резервирование
не двигает узлы, не увеличивает bitmap и не меняет реальные маршруты. Порядок
рисования: очистка всего bitmap, фон, реальные ветви, принятые slots, реальные узлы/основной текст,
затем link labels и captions с фоном palette.background под box.

Без надёжных primary ink bounds пропускаются optional-текст/декорации, безопасность
которых нельзя установить. Непригодные secondary bounds скрывают этот элемент.
Обязательные metric fields — width и actualBoundingBoxLeft/Right/Ascent/Descent.
После проверки сообщённых numeric values этих полей отсутствие/нечисловые границы
означают пропуск без coercion. Неконечные numeric metrics, отрицательная
width или непредставимая вычисленная геометрия — RangeError до пикселей. Исходный
measureText throw сохраняется. Hidden captions не требуют измерений только ради
captions; измерения для primary/link-label/slot safety могут оставаться нужными.

Гарантия относится к резервированию при данных метриках, не к каждому antialiased
пикселю, шрифту, размеру или промежуточной раскладке. Штатные fixtures должны
оставаться читаемыми: пропуск не разрешает скрыть все captions/slots вообще.
Runtime и native Canvas зафиксированы в отчёте реализации.

## Зелёный результат и стили

Штатный result зелёный: dark #34d399, light #047857. Палитра независима от
GraphPalette: у дерева link и emptySlot. Defaults background/text/node/link/active/
visited/queued соответствуют graph-темам; emptySlot — dark #64748b, light #94a3b8.
Overrides — непустые примитивные строки.

Приоритет реальной сущности: выбранный result > roleColors[role] > штатный цвет
active/visited/queued > базовый node/link. Текст сохраняет text-цвет. Неизвестная
роль использует base; роль result сама не является выбором ответа. Выбранные узлы
заливаются зелёным, связи обводятся зелёным независимо, без выбора соседних
сущностей. Пустые слоты всегда emptySlot и не наследуют зелёный цвет родителя.

Память финальной подсветки не хранится. Done сохраняет result в State, поэтому
final hold/repaint/resize остаются зелёными. Previous восстанавливает свои флаги,
Restart — исходное состояние нового запуска. Pause сохраняет кадр. Dispose/source
cleanup и event-free history/async/Worker сохраняют нынешний контракт Player.

## Валидация, состояние context и ошибки

Factory проверяет envelope options, theme, palette overrides, собственные role
colors, horizontalGap, levelGap, emptySlots, nodeCaptions, drawNode и nodeRadius в этом порядке. Неверные/
отсутствующие theme, enums, containers, accessors, пустые/нестроковые colors дают
TypeError. Неверный тип gap — TypeError, неположительный/неконечный gap — RangeError.
Layout проверяет TreeInput как /tree, затем полные вычисленные позиции. Исходные
Proxy throws, включая opaque/falsy, сохраняются.

Порядок render: busy; envelope size и width/height; envelope frame и progress;
previous; current; совпадение kind;
затем ctx.canvas bitmap dimensions и числовой drawing plan. От Frame используются
только previous/current/progress; event и stepIndex не читаются/не проверяются.
Frame/size — plain records с распознаваемыми собственными data properties. Поля
frame захватываются в порядке progress/previous/current; accessors отклоняются до
scalar validation. Kind endpoints совпадает даже у пустых деревьев, иначе
RangeError. В разных вызовах renderer может рисовать любой kind.
Snapshot/canonical-order проверяются точно как в /tree, включая hidden text/slots.
Неверные scalar types — TypeError; отрицательные/неконечные размеры, progress вне
[0,1] или непредставимая геометрия — RangeError. Новый error class/code не вводится.

Нулевой logical/bitmap size — no-op после проверок frame/snapshot/kind/bitmap, без
save, измерений или paint; пропущенный fit ничего не обещает о геометрии. Неверные
данные не вызывают Canvas methods. Bitmap property getters и последующие Canvas
throws сохраняют исходную идентичность. Bitmap/CSS resize не выполняется. Для
рисуемого bitmap: save, bitmap/logical transform, сброс alpha/composite/filter/
shadow/dash/text-state, планирование текста, clearRect всего logical rectangle,
paint и restore. Очистка идёт лишь после успешного планирования: прозрачный
background override тоже не зависит от прежних пикселей. Входной context должен
быть unclipped; текущим path владеет приложение, save/restore его не восстанавливает.
Context/canvas после возврата не удерживаются.

Если save бросил, restore незахваченного save не вызывается. После успешного save
restore всегда предпринимается. Ошибка рисования/измерения/setup первична к
последующей ошибке restore, включая falsy throws; самостоятельная ошибка restore
передаётся. Предполагается рабочий restore; уже нарисованные пиксели не откатываются.
Ошибки input/geometry не сохраняют частичный drawing plan. Текущая реализация
не удерживает endpoint/history-кэш; host failure не мутирует снимки вызывающего.
После обычного восстановления host последующий вызов работает, busy снимается
в finally.

## Проверки и граница выпуска

[Отчёт реализации](../checks/tree-canvas-implementation-2026-11-19.json) фиксирует
постоянные регрессии layout/render/управления, packed consumers, bundle isolation
и настоящий Canvas. Старый отчёт контракта остаётся историческим свидетельством.
Текущая реализация не удерживает endpoint/history-кэш после вызова.
Области регрессий:

| Область | Обязательные сценарии |
| --- | --- |
| Layout | Пустое/один узел, ordered reorder/цепь, неполные left/right binary, повороты/корень, custom gaps, произвольный порядок хранения, глубокие/вырожденные деревья, overflow, frozen copies, отсутствие payload/DOM reads |
| Слоты | N+1 терминальных слотов непустого binary, нет ordered/empty markers, hidden-layout parity, owner-slot identity, empty/occupied переходы, collision omission без лишних объектов модели |
| Связи | Сохранение/reparent/reverse/смена slot, оба поколения концов, enter/exit, p=0/0.5/1, прикреплённые crossfade-маршруты без гибридного конца |
| Текст/result | Очистка label/caption, current/exiting text, safe metrics placement, отсутствующие/неверные метрики, независимый зелёный результат в двух темах, rewind/Restart/resize без старой подсветки, repaint с прозрачным фоном |
| Host | Неверные данные до Canvas, нулевые размеры, DPR/backing-store, setup/restore и первичные opaque errors, рекурсивные layout/render, recovery и bounded cache |
| Package/control | Отдельный optional entry, нет обратной headless-зависимости, installed types/private paths, compiler matrix, прежние модули неизменны, Pause/Next/history/rewind/Restart/dispose |

На настоящем Canvas проверены ordered и неполное binary на семь узлов при
960x480 и 390x280, в обеих темах, с backing-store ratios 1/1.25/2. Рисуются все
три короткие подписи и label связи; у binary — все восемь пустых маркеров.
Независимый oracle на растровой маске проверяет boxes текста относительно узлов,
primary text, маршрутов и декораций. На маленьких/совпадающих раскладках допустим
безопасный пропуск; повороты p=0.5 отдельно проверяют прикреплённые crossfade-ветви.
Player проверен в stream/history: Pause, Next, перемотка, Restart, viewport/DPR
resize и dispose. Recovery включает исключения host и сброс bitmap/context,
без имитации потери GPU-контекста и без сертификации других браузеров.

Для повтора после npm run build:

```sh
node scripts/test-tree-canvas-browser.mjs --report ./tree-canvas-native.json
```

Откройте напечатанный localhost URL. Проверки выполнятся автоматически и сохранят
локальный отчёт. Стенд и независимый oracle — в test/tree-canvas-browser.mjs.

Изменения следуют политике documented-default/behavior [U3](api-compatibility.md).
Отсутствие пиксельной идентичности не разрешает менять координаты layout, приоритет
результата, safe omission или классы ошибок без ревизии совместимости.

[Пример вставки/поворота](../../examples/tree-player.html) использует эти API и Player;
Подробный собственный обход сохранён отдельно. В [заметках к 1.2.0](release-1.2.md)
зафиксированы исправление T1 и результаты приёмки.
