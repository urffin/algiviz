# List Canvas API: /canvas/list

[English](../list-canvas-api.md) · [Headless-список](list-api.md) · [Tree Canvas](tree-canvas-api.md) · [Viewport](canvas-viewport.md) · [Проверка контракта](../checks/list-canvas-contract-2026-11-20.json)

**Доступно с 1.4.0.** Необязательная точка входа `/canvas/list` экспортирует
`createListRenderer` и пять типов.

## Публичный API и владение

```ts
import type { ListInput, ListPosition, ListSnapshot, ListNodeView, ListFrame } from "@grundyjs/algiviz/list";

export interface ListPalette {
    readonly background: string;
    readonly node: string;
    readonly border: string;
    readonly text: string;
    readonly caption: string;
    readonly pointer: string;
    readonly nullMarker: string;
    readonly active: string;
    readonly visited: string;
    readonly queued: string;
    readonly result: string;
    readonly resultText: string;
}
export interface ListNodePresentation {
    readonly label?: string | undefined;
    readonly color?: string | undefined;
}
export interface ListRendererOptions<Value = unknown> {
    readonly theme: "light" | "dark";
    readonly colors?: { readonly [K in keyof ListPalette]?: string | undefined } | undefined;
    readonly roleColors?: Readonly<Record<string, string>> | undefined;
    readonly nodeGap?: number | undefined;
    readonly pointerGap?: number | undefined;
    readonly presentNode?: ((this: void, node: ListNodeView<Value>, snapshot: ListSnapshot<Value>) => ListNodePresentation | undefined) | undefined;
    readonly nullPointers?: "visible" | "hidden" | undefined;
    readonly nodeCaptions?: "auto" | "hidden" | undefined;
}
export interface ListRenderSize {
    readonly width: number;
    readonly height: number;
}
export interface ListRenderer<Value = unknown> {
    layout(list: ListInput<Value>): readonly ListPosition[];
    render<Event>(context: CanvasRenderingContext2D, frame: ListFrame<Value, Event>, size: ListRenderSize): void;
}
export declare function createListRenderer<Value = unknown>(options: ListRendererOptions<Value>): ListRenderer<Value>;
```

Фабрика захватывает plain Object/null-prototype options и возвращает замороженный
объект только с layout и render. Theme обязателен. Defaults: nodeGap=4,
pointerGap=1, nullPointers="visible", nodeCaptions="auto", presenter отсутствует.
Оба gap — положительные конечные логические единицы. nodeGap влияет только на
layout, pointerGap — на head/null anchors и routing. Неизвестные поля игнорируются,
известные accessors отклоняются без вызова. Optional undefined означает отсутствие.
Цвета и собственные непустые role-name/string-color записи копируются один раз.
Разбор/поддержка CSS принадлежат Canvas. Последующая мутация исходных options
не влияет на renderer. ListPointerId и ListObjects не меняются.

Контекст, bitmap/CSS-размер, DPR, viewport, источник, RAF и dispose принадлежат
вызывающему. У renderer нет dispose, автоматического resize и управления источником.
layout не удерживает вход; render не удерживает context, snapshot, frame, вывод
presenter или историю после возврата. Повторный layout/render того же renderer
отклоняется с Error до чтения аргументов; другой свободный экземпляр независим.
Busy охватывает захват, callbacks, измерения, рисование и restore, снимается в finally.

Entry требует DOM declarations из-за CanvasRenderingContext2D в render. Импорт,
фабрика и layout не обращаются к DOM/Worker globals и не создают внешние ресурсы.
/list остаётся независимым ES2022-only. Первая среда — HTML Canvas 2D, не
OffscreenCanvas/SVG/retained DOM. Renderer может загружать валидацию/проекцию
списка и generic scene matching, но не list trace builder, Player, Worker или
другие штатные backend. Прежние entry не загружают его неявно.

## Раскладка явно записывается в снимок

layout проверяет полный ListInput в порядке /list, не обходя opaque values и
не читая captions/result. ListSnapshot, частичный edit и рабочая арена не входят
в этот метод. Phase/retired IDs trace не относятся к stateless-проверке. Пройти
headId/nextId итеративно, присвоить ранг i: x=i*nodeGap, y=0. Вернуть скопированный/
замороженный полный ListPosition[] в **порядке хранения nodes**, не порядке
прохода. Пустой вход возвращает []; голова находится в (0,0). Неконечные
вычисленные координаты — RangeError. Конечное округление позиций не меняет
топологию. Нет рекурсивного предела, автоматического переноса строк или layout
по значениям, шрифту, теме, viewport, порядку рисования и прежним кадрам.

| Вход / политика | Позиции в порядке хранения |
| --- | --- |
| Пустой | [] |
| Один A | A=(0,0) |
| A→B→C, хранение [C,A,B], gap по умолчанию | C=(8,0), A=(0,0), B=(4,0) |
| C→B→A, хранение [A,B,C], gap по умолчанию | A=(8,0), B=(4,0), C=(0,0) |
| A→X→B, хранение [A,B,X], nodeGap=2 | A=(0,0), B=(4,0), X=(2,0) |

Записать layout(initial) в createListTrace options, layout(completeCandidate) —
в тот же атомарный edit, что вставка/удаление/разворот. Render использует снимок,
никогда не вызывает layout, в том числе при resize/Restart. Для общего edit
сначала разрешаются опущенные/undefined поля по committed-списку; spread не
реализует правило undefined-as-omitted. Собственные конечные раскладки допустимы;
renderer не исправляет их порядок, наложения и пересечения связей.

### Подключение Player

Пример использует локальный build. Приложение передаёт готовый контекст и текущие логические размеры, например из /canvas/viewport.

В репозитории есть готовая страница с вставкой, удалением и разворотом списка. [Пример с Player](../../examples/list-player.html)

```ts
import { createListTrace } from "@grundyjs/algiviz/list";
import { createListRenderer } from "@grundyjs/algiviz/canvas/list";
import { Player } from "@grundyjs/algiviz/player";
import type { ListRenderSize } from "@grundyjs/algiviz/canvas/list";

const drawing = createListRenderer<number>({
    theme: "light",
    presentNode: ({ node }) => ({ label: String(node.value) }),
});
function* insert() {
    const initial = { headId: "A", nodes: [
        { id: "A", value: 7, nextId: "B" },
        { id: "B", value: 3, nextId: null },
    ] };
    const list = createListTrace(initial, { layout: drawing.layout(initial) });
    yield list.start();
    const candidate = { headId: "A", nodes: [
        { id: "A", value: 7, nextId: "X" },
        { id: "B", value: 3, nextId: null },
        { id: "X", value: 5, nextId: "B" },
    ] };
    yield list.edit({ ...candidate, layout: drawing.layout(candidate),
        marks: { pointers: [{ id: { kind: "next", nodeId: "A" }, role: "active" }] },
    });
    yield list.done({ result: { nodeIds: ["X"], pointerIds: [{ kind: "next", nodeId: "A" }] } });
}
export function mount(container: HTMLElement, context: CanvasRenderingContext2D, size: () => ListRenderSize) {
    return new Player(container, { stepSource: insert, isTerminal: step => step.event.type === "done",
        rewindCapacity: 8, render: frame => drawing.render(context, frame, size()),
    });
}
```

## Узлы снимка, head и null-слоты

Узел — прямоугольный отсек значения и правый отсек next. Для логического центра
(x,y) тело занимает [x-1,x+1] × [y-0.5,y+0.5], разделитель находится на x+0.5.
Это геометрия renderer, не дополнительные данные ListSnapshot. Выбор узла
красит отсек значения; выбор next-слота независимо красит отсек указателя и его
стрелку/null-маркер. Маленькая выходная точка/порт обозначает next даже при
скрытом null-маркере. Null не является фиктивным узлом, sentinel-выделением,
неизвестной целью или новым видом сцены.

Для каждого endpoint minX/minY — минимумы записанных центров узлов; для пустого
входа (0,0). Центр head-бейджа:
H=(minX-1-pointerGap,minY-0.5-pointerGap); логический размер 1.2×0.5, текст "head".
Этот внешний anchor не следует за ID цели головы. Между endpoints H интерполируется.
У next центр null-маркера: owner+(1+pointerGap,0). У null head:
H+(0,1+pointerGap). Null-маркер — прямоугольник 1×0.5 с текстом "null". Head/null
принадлежат существующему слоту указателя, не получают публичный ID узла.

nullPointers:"hidden" скрывает null-ветку, маркер и его текст, сохраняя next/head
отсеки, роли и выбор результата. Head-бейдж виден и при пустом списке. Для каждого
слота в обоих endpoints резервируется потенциальный null-прямоугольник, даже
при ненулевой цели или скрытом маркере: null/visibility сами не меняют fitting
при прочей неизменной геометрии. Ненулевые связи не скрываются. Текст head/null
может безопасно опускаться, если не помещается; фигуры и ID сохраняются.

## Fitting и интерполяция

Используется raw p в [0,1] без easing/clamping. Сохранённый узел линейно меняет
записанные центры; enter/exit используют доступную позицию с alpha p/1-p.
Отсек next следует позиции/presence владельца. Числа/values и цвета не
интерполируются. Для сохранённых/входящих объектов уже при p=0 действуют текущие
value/caption/role/result; выходящие используют прежние данные. Head-слот постоянен.

Fitting совместно учитывает оба endpoint: узлы с нулевым presence, head-бейджи
и все потенциальные null-прямоугольники, включая ненулевые/скрытые слоты.
Учитываются полные логические фигуры; общий raw rectangle расширяется на
pointerGap со всех сторон под routing gutters. Это консервативная граница всех
интерполированных центров/веток. Равномерный contain и центрирование:
s=min(48,(width-24)/spanX,(height-24)/spanY). Отступ 12 CSS px с каждой стороны
резервирует **4 px внешнего поля и 8 px под stroke/arrow extents**. Учитываются
полные обводки/маркеры, не только центры. Round joins и ограниченные размеры
стрелок остаются внутри резерва 8 px. Fitting пары не зависит от p, текста,
ролей и результата. На новой паре камера может меняться; глобальная непрерывность
не обещается.

Width/height и bitmap dimensions — конечные неотрицательные числа. Нулевой
логический или bitmap-размер — no-op после проверки обоих снимков и размеров.
Если положительная логическая сторона <=24, очищается/рисуется только фон:
без node presenter, геометрии и измерений текста. Иначе все зарезервированные
координаты, положительные размеры фигур, span, transform и routes обязаны быть
представимыми/конечными до пикселей, включая скрытые/нулевые ветки; отказ —
RangeError. Минимальная читаемость, отсутствие пересечений custom layout и
автоматическое разведение движущихся узлов не обещаются. Финальный clip примитивов
внутри поля 4 px служит страховкой, а не заменой fitting полных обводок.

### Стрелки и смена цели

Next-ветка начинается в правом порту владельца (x+1,y), заканчивается в левом
порту цели (x-1,y). При end.x>=start.x — ортогональный путь через средний x:
[start,(midX,start.y),(midX,end.y),end]. Иначе нижний gutter:
[start,(start.x+g,start.y),(start.x+g,Y),(end.x-g,Y),(end.x-g,end.y),end],
где g=pointerGap, Y=max(owner.y+0.5,target.y+0.5)+g. Для null next конец — левый
порт маркера; его нижняя граница center.y+0.25 используется в той же формуле Y.
Head-ветка начинается в нижнем порту бейджа, заканчивается в верхнем порту узла
головы/null-маркера, через средний y. Повторные нулевые сегменты опускаются;
стрелка следует последнему ненулевому сегменту. Равенство значений не создаёт
стрелку; дополнительных рёбер-сущностей нет. Custom routes могут пересекаться.

Порты определяются по текущим интерполированным позициям узлов/head. Каждая
ветка разрешает **собственные прежние/новые ссылки** через scene.get, включая
входящие/исчезающие цели с нулевым presence. Нельзя использовать новую цель для
обеих веток или интерполировать строки ID. Сохранённый слот с прежней целью
рисует один прикреплённый путь с alpha 1. При смене цели, включая null, прежний
рисуется с 1-p, новый с p, прежний первым. Enter/exit слота используют доступную
ветку с p/1-p. Одна и та же прозрачность слота/владельца не умножается дважды.
Null-маркер следует своей ветке; при неизменном null он один. Head-бейдж/отсек
next рисуется один раз с presence слота и текущим стилем, даже при двух ветках.
Промежуточного фиктивного ListSnapshot нет.

| Сохранённый слот B→X или null→X | Прежняя ветка/маркер | Новая ветка/маркер |
| --- | --- | --- |
| p=0 | 1 | 0 |
| p=0.5 | 0.5 | 0.5 |
| p=1 | 0 | 1 |

## Представление, текст и независимые цвета результата

Без presenter нет основной подписи value; отсутствуют автоматические String(Value),
подстановка ID и обход свойств payload. Captions — независимые данные снимка.
Для drawable render сначала захватываются/копируются/замораживаются оба полных
endpoint-контейнера; opaque Value остаётся прикладной ссылкой. presentNode
вызывается один раз на узел объединения: порядок нынешних nodes, затем прежние
исчезающие. Сохранённые/входящие получают текущие view/snapshot, исчезающие —
прежние. Это включает нулевой presence и одинаковые ссылки endpoints. this
передаётся undefined; event/context не передаются. Возврат захватывается до
следующего callback; presentation cache между вызовами отсутствует. Для пустого
объединения/непригодного размера, определённого выше, presenter не вызывается.

Callbacks чисты по переданным неизменяемым данным/захваченным настройкам.
Undefined/{} означает отсутствие overrides; null, Promise и non-plain return —
TypeError. Label — optional примитивная строка (пустая подавляет текст), color —
непустая строка. Известные accessors отклоняются без вызова; неизвестные поля
игнорируются. Все результаты валидируются, даже если role/result/нулевой presence
скрывает их эффект. Исходные исключения, включая falsy, сохраняются.

| Палитра | light | dark |
| --- | --- | --- |
| background | #f8fafc | #101827 |
| node | #e2e8f0 | #334155 |
| border | #94a3b8 | #64748b |
| text | #0f172a | #f1f5f9 |
| caption | #475569 | #cbd5e1 |
| pointer | #475569 | #94a3b8 |
| nullMarker | #64748b | #94a3b8 |
| active | #fbbf24 | #fbbf24 |
| visited | #94a3b8 | #64748b |
| queued | #c4b5fd | #a78bfa |
| result | #047857 | #34d399 |
| resultText | #ffffff | #052e16 |

Приоритет заливки value: node result → custom role → active/visited/queued →
presenter color → palette.node. Для next/head: pointer result → custom role →
встроенная роль → palette.node. Для route/null outline тот же приоритет с базой
palette.pointer/nullMarker. Текст выбранного отсека значения и бейджа head
использует resultText. Подпись null использует palette.text поверх фона Canvas,
в том числе при зелёной обводке. Выбор узла не выбирает его next/head и наоборот. Роль result
ничего не выбирает. Сохранённые ветки смены цели используют нынешний стиль слота,
включая result flag. Штатный зелёный остаётся на done/hold и снимается при
перемотке к снимку без этого выбора; память о событии не нужна.

Для рисования TAB/CR/LF/U+2028/U+2029 сводятся в один пробел. Измеряется plain
sans-serif text; нет ellipsis, String(payload) и сжатия fillText. Размеры label
14..8 CSS px, caption 11..8; сначала оба с зазором 2 px, затем label, затем caption
по отдельности внутри value compartment с inset 2 px. Приоритет крупнейшего
label, затем крупнейшего помещающегося caption. Скрытые captions не измеряются,
но валидируются. Head: 12..8, null: 11..8. Скрытый null-текст не измеряется,
но его геометрия по-прежнему проверяется и резервируется. Границы — объединение advance/actual ink
и консервативных font bounds [-0.8s,0.2s]; отсутствующие ink metrics используют
fallback, переданные обязаны быть конечными, advance width неотрицателен.
Неверные/непредставимые метрики — RangeError до пикселей.

Текст планируется детерминированно: нынешние узлы, исчезающие, head, null labels
в порядке слотов (прежняя ветка до новой). Текст отклоняется при пересечении
другого видимого тела узла/бейджа с ненулевым presence или уже принятого текста, с зазором
2 CSS px. Небезопасный текст опускается без сдвига фигур/fitting. Нулевая геометрия
остаётся в fitting, но не резервирует препятствие нарисованному тексту. Routes
исключаются из всех принятых text boxes с расширением 1 px, даже при прозрачных
заливках. Порядок: routes, node/head/null shapes, текст; поздняя заливка не
перекрывает принятую подпись. При наложениях узлов подписи могут исчезать.

## Валидация, context и граница завершения

Фабрика захватывает descriptors theme/colors/roleColors/nodeGap/pointerGap/
presentNode/nullPointers/nodeCaptions в порядке декларации, затем проверяет
значения в том же порядке. Неверные options/types/enums/accessors — TypeError;
неположительные/неконечные числовые gap — RangeError. При создании callback нет.

Render: busy; size width/height; descriptors frame в порядке progress/previous/
current; p в [0,1]; полные previous, затем current /list snapshot и собственный
захват; canvas/bitmap dimensions; zero/tiny-size ветка; конечная geometry/fit;
presentation results; save/reset context и все metric/clipping планы; clear/
background/paint; restore. Event/stepIndex не читаются даже как accessors.
Ошибки скрытых снимков/слотов/captions сохраняются. Retirement-история и lifecycle
trace между endpoints не проверяются. Layout: busy, полная /list validation,
конечная арифметика рангов. Proxy/callback/native ошибки сохраняются; нового
класса ошибок нет.

После успешного save задаётся bitmap/logical transform canvas.width/size.width,
canvas.height/size.height; нейтрализуются alpha/composite/filter/shadow/dash/text.
Полный план готов до первого пикселя. Весь logical bitmap очищается, затем
рисуется фон, включая прозрачный, поэтому redraw/rewind не накапливают старые
стрелки. Вызывающий передаёт unclipped context и владеет current path: save/restore
не сохраняют его содержимое. Не восстанавливать неуспешный save. Все полученные
вложенные save раскручиваются в обратном порядке. Первая setup/measurement/paint
ошибка важнее restore, включая undefined/null/false; самостоятельная restore
ошибка пробрасывается. Busy всегда снимается. Уже изменённые пиксели и внешние
эффекты callback/Proxy не откатываются. После штатного bitmap/context reset
новый redraw не требует пересоздавать renderer. Forced GPU recovery, новые
браузеры, dirty regions и гарантии времени кадра не обещаются.

Player.stepSource/isTerminal, history, bounded Previous/Next, Pause, Restart,
async/Worker state-only frames и dispose сохраняют нынешний API. Работа синхронна;
бюджет чтений Player не прерывает один layout/presenter/render. Промежуточные
присваивания/отсоединённые узлы — прикладная арена/custom scene, здесь это
некорректный список. Staging-режим не добавляется.

## Проверка

Постоянные проверки охватывают раскладку, смену целей, подписи, выбор результата, размеры, восстановление Canvas и интеграцию с Player. Пакетные проверки охватывают установленный архив, границу DOM-типов и независимую статическую и ленивую загрузку.

Результаты тестов, проверки пакета и браузерного прогона собраны в [отчёте реализации](../checks/list-canvas-implementation-2026-11-20.json).

Для проверки на реальном Canvas после сборки запустите `node scripts/test-grid-canvas-browser.mjs --report <local-report.json>` и откройте `/test/list-canvas-browser.html` на показанном адресе. Стенд проверяет пиксели обеих тем, масштаб bitmap, перемотку и Restart, управление Player и восстановление контекста.
