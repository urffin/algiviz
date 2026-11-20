# Grid Canvas API: /canvas/grid

[English](../grid-canvas-api.md) · [Grid API](grid-api.md) · [Tree Canvas](tree-canvas-api.md) · [Viewport](canvas-viewport.md) · [Совместимость](api-compatibility.md)

**Версия 1.3.0.** Независимый /canvas/grid экспортирует createGridRenderer
и пять типов ниже. Headless /grid остаётся отдельным DOM-free entry.
Пакет содержит 14 entry, 30 runtime-имён и 155 type-only экспортов (143 различных).
Прежние двенадцать entry сохраняются. [Изменения и миграция](candidate-1.3.md) ·
[Ревизия](grid-readiness-1.3.md) · [Нативная приёмка](../checks/grid-canvas-browser-2026-11-20.json).

## Публичные декларации

Публичные декларации @grundyjs/algiviz/canvas/grid в 1.3.0.

```ts
import type { GridCellView, GridSnapshot, GridFrame } from "@grundyjs/algiviz/grid";

export interface GridPalette {
    readonly background: string;
    readonly cell: string;
    readonly border: string;
    readonly text: string;
    readonly caption: string;
    readonly active: string;
    readonly visited: string;
    readonly queued: string;
    readonly result: string;
    readonly resultText: string;
    readonly path: string;
}
export interface GridCellPresentation {
    readonly label?: string | undefined;
    readonly color?: string | undefined;
}
export interface GridRendererOptions<Value = unknown> {
    readonly theme: "light" | "dark";
    readonly colors?: { readonly [K in keyof GridPalette]?: string | undefined } | undefined;
    readonly roleColors?: Readonly<Record<string, string>> | undefined;
    readonly cellGap?: number | undefined;
    readonly presentCell?: ((this: void, cell: GridCellView<Value>, snapshot: GridSnapshot<Value>) => GridCellPresentation | undefined) | undefined;
    readonly cellCaptions?: "auto" | "hidden" | undefined;
    readonly path?: "visible" | "hidden" | undefined;
}
export interface GridRenderSize {
    readonly width: number;
    readonly height: number;
}
export interface GridRenderer<Value = unknown> {
    render<Event>(context: CanvasRenderingContext2D, frame: GridFrame<Value, Event>, size: GridRenderSize): void;
}
export declare function createGridRenderer<Value = unknown>(
    options: GridRendererOptions<Value>
): GridRenderer<Value>;
```

Фабрика один раз захватывает опции и возвращает замороженный renderer с
**единственным render**. Регулярная раскладка автоматическая; методов layout/
setLayout, source, viewport, hit-test и dispose нет. Заголовки координат и легенда
автоматически не рисуются. Canvas, размеры и вызовы перерисовки принадлежат
приложению. Renderer хранит неизменяемые опции/ссылки на callbacks, но после вызова
не удерживает context, frame, snapshot, presentation output или историю.

Defaults: `cellGap: 0.1` в логических единицах стороны клетки,
`cellCaptions: "auto"`, `path: "visible"`, без presenter. Theme обязателен.
Цветовые overrides и таблица ролей копируются; поздняя мутация не меняет renderer.
Неизвестная роль использует presentation/base fill. Роли — открытые строки.

| Поле палитры | light | dark |
| --- | --- | --- |
| background | #f8fafc | #101827 |
| cell | #e2e8f0 | #334155 |
| border | #94a3b8 | #64748b |
| text | #0f172a | #f1f5f9 |
| caption | #475569 | #cbd5e1 |
| active | #fbbf24 | #fbbf24 |
| visited | #94a3b8 | #64748b |
| queued | #c4b5fd | #a78bfa |
| result | #047857 | #34d399 |
| resultText | #ffffff | #052e16 |
| path | #1d4ed8 | #fbbf24 |

Цвета должны быть корректными CSS color strings. Библиотека проверяет непустые
примитивные строки; parsing/color space остаются у Canvas. Автоматической проверки
контраста нет. Собственный result color сохраняет приоритет принадлежности.

## Регулярная раскладка и владение bitmap

Внутри кадра **rows и columns обоих endpoints должны совпадать**, включая сетки
нулевой площади. Несовпадение — RangeError до callbacks и Canvas methods. Между
вызовами форма может меняться, например после Restart. Ячейки сохраняют
идентичность координаты; замена/обмен значений их не перемещает.

Для положительной площади при logical width/height больше 8 CSS px:

```text
LW = columns + (columns - 1) * cellGap
LH = rows    + (rows    - 1) * cellGap
side = min((width - 8) / LW, (height - 8) / LH)
left = (width  - LW * side) / 2
top  = (height - LH * side) / 2
cell(row, column) = [left + column * (1 + cellGap) * side,
                     top + row    * (1 + cellGap) * side, side, side]
```

Клетки квадратные в logical coordinates; строки направлены вниз, столбцы вправо.
Вся сетка центрируется с painted margin не меньше **4 CSS px**. Подписи, роли,
результат, путь и progress не меняют fitting. Для 3 столбцов × 2 строк, gap 0.1
и размера 328×218 сторона равна 100, начало — (4,4), клетка (1,2) начинается в
(224,114). Пиксельные позиции в GridSnapshot не записываются.

Fill остаётся внутри прямоугольника клетки. Border width — min(1, side/4) CSS px,
с отступом внутрь на половину толщины: вся обводка находится внутри клетки.
Вычисленные нулевые strokes пропускаются. Толщина пути/halo ограничена ниже;
закруглённые концы тоже остаются внутри board bounds. Резервируется полная
обводка, не только центральная линия. Неконечный/неположительный обязательный
масштаб, overflow или непредставимая безопасная геометрия дают RangeError до paint.
После арифметики painted bounds проверяются относительно inset viewport.
Допустимы направленные внутрь поправки размера округления, общие для клеток,
текста и якорей пути. Обычное floating-point округление не должно отклонять
безопасно представимую раскладку; формула описывает идеальную вещественную модель.

Нулевая площадь рисует только фон, без деления на ноль, callbacks или измерений.
Положительные размеры с width/height не больше 8 тоже рисуют только фон.
Нулевой logical или bitmap-размер — no-op после проверки входа, формы endpoints
и bitmap: Canvas methods и presenter не вызываются; пропущенный fitting не
проверяет гипотетическую геометрию. Оба снимка всё равно валидируются.

Size — явные logical width/height, конечные и неотрицательные. Canvas.width/height
читаются, но не меняются. CSS, window.devicePixelRatio и DOM layout не читаются.
Bitmap/logical ratios используются независимо, каждый конечный и положительный
для рисования. DPR, resize/redraw и cleanup — у приложения или прежнего viewport.
Первый host — HTML Canvas 2D, не OffscreenCanvas.

## Представление значений и callbacks

Без presenter у клетки нет основной подписи; fill выбирается из палитры/роли/
результата. Не выполняются String(Value), числовая интерполяция, поиск wall sentinel
или чтение свойств payload. Captions — независимые записанные строки. Для чисел
приложение может явно задать:

```ts
const renderer = createGridRenderer<number>({
    theme: "light",
    presentCell: ({ value }) => ({ label: String(value) }),
});
```

Для каждого drawable render **оба полных снимка и общая форма захватываются и
валидируются до callbacks**. presentCell вызывается синхронно **только для current**,
по строкам, ровно один раз на клетку, включая progress zero и одинаковые ссылки
endpoints. Previous values не форматируются: клетки/текст/fill дискретно-current.
Аргументы — замороженный current GridCellView и
захваченный структурно скопированный/замороженный GridSnapshot. Непрозрачные
Value остаются ссылками приложения, без обещания глубокого freeze/clone.
Event/context не передаются; this равен undefined. Результат callback захватывается
сразу, до следующего вызова.

Callbacks — чистые функции аргументов и неизменяемой конфигурации, чтобы redraw/
rewind воспроизводился. Они не читают источник, не рисуют и не меняют retained
payload. Функции остаются на host, не входят в Worker data. Возврат undefined
или пустой записи означает отсутствие label/fill override. Null, Promise и
другой non-plain результат дают TypeError. Поля label/color — собственные data-
свойства: optional undefined означает пропуск, label — примитивная строка
(пустая допустима), color — непустая примитивная строка. Неизвестные поля
игнорируются без чтения; accessors отклоняются без вызова. Исходные исключения
callback/Proxy, включая falsy, сохраняются.

Все результаты callbacks проверяются, даже если роль/result перекрывают fill,
path/captions скрыты или current path имеет нулевую opacity. Для nondrawable/
empty сетки callbacks нет по правилам выше. Между вызовами их результат не
кэшируется. Повторный render того же renderer бросает Error до чтения аргументов.
Busy охватывает validation, callbacks, measurement, paint и restore и снимается
в finally. Чтение снимков и gridScene разрешены.

## Основные и дополнительные подписи

Для сохраняющихся клеток label, caption и роль всегда берутся из **current**,
включая progress zero. Последовательности CR/LF и Unicode line separators
превращаются в один пробел только для однострочного отображения; state не меняется.
Нет ID/value fallback, неявного многоточия или сжатия через fillText(maxWidth).
Пустая/отсутствующая label не рисуется; пустая caption остаётся записанной пустой
строкой, отличной от null.

Текст помещается внутри клетки с inset **2 CSS px** со всех сторон. Измеряются
advance/ink bounds центрированного sans-serif с alphabetic baseline. Основной
шрифт — от 14 до 8 CSS px целыми шагами, caption — от 11 до 8. Сначала пробуются
обе строки: label сверху, caption снизу, минимум 2 CSS px между измеренными
коробками, вместе по центру. Выбираются сначала наибольший размер label, затем
caption, при котором всё помещается. Иначе — наибольшая помещающаяся label по
центру; если label не помещается, пробуется caption отдельно по центру. Не
поместилось ничего — текст пропускается. Скрытые captions не измеряются, но данные
проверяются. Ячейка/выбор результата не исчезают из-за нехватки места для текста.

Используется объединение advance [-width/2,width/2] и фактического ink
[-actualBoundingBoxLeft,actualBoundingBoxRight]. По вертикали ink объединяется
с [-0.8*fontSize,0.2*fontSize]. Отсутствующие actual metrics используют fallback
font/advance; присутствующие должны быть конечны, advance width неотрицателен.
Некорректные метрики/непредставимые boxes — RangeError до clear/paint. Исключения
native metric getters сохраняются. Растровая идентичность всех шрифтов не обещается.

## Зелёный результат и пути

Приоритет fill: **принадлежность результату → custom role color → active/visited/
queued → presenter color → palette.cell**. Принадлежность — объединение
result.cells и координат result.path. Роль "result" сама по себе ничего не
выбирает. Текст выбранной клетки использует resultText, иначе text/caption.
Штатный result fill зелёный. Значения, label, caption и fill дискретно переходят
к current, без result/event cache и числовой интерполяции значений/цветов.
Перемотка к state без результата сразу снимает зелёный выбор.

Путь соединяет центры клеток в записанном порядке. Повторы и обратные проходы
сохраняются; несоседние пары соединяются напрямую, без промежуточных клеток,
проверки соседства или стен. Нулевые по длине пары визуально пропускаются; путь
из одной клетки/одних повторов не имеет stroke. Стрелки, номера посещений и
выведенные graph edges не добавляются. path:"hidden" скрывает только линию,
сохраняя зелёную принадлежность ячеек.

Сначала рисуются fill/inset borders, затем пути, затем текст. У маршрута halo
цвета background толщиной min(5, side/3) CSS px и core цвета path толщиной
min(3, side/5), round caps/joins. Strokes пути исключаются из всех text/caption
boxes, расширенных на 1 CSS px; эти непересекающиеся резервы лежат внутри клеток
и могут касаться границами. Путь не пересекает текст, без закрашивания фоном.
Допустим native even-odd clip или эквивалентное исключение объединения boxes.

Сравниваются целые последовательности координат с повторами. Одинаковый путь
рисуется один раз с полной opacity. При изменении previous рисуется с
**1-progress**, current — с **progress**, previous первым, каждый со своими
halo/core. Пустой путь не рисуется. Вершины не морфятся, общие отрезки двух
маршрутов не дедуплицируются. Progress сырой, без clamp/easing. Клетки неподвижны:
интерполяция меняет presence/замену пути, не двигает значения и не смешивает
произвольные label/color. Поэтому current green cells видны при progress zero,
когда новый маршрут имеет нулевую opacity.

| Progress изменившегося пути | Fill/label/caption клетки | Прежний маршрут | Новый маршрут |
| --- | --- | --- | --- |
| 0 | current | 1 | 0 |
| 0.5 | current | 0.5 | 0.5 |
| 1 | current | 0 | 1 |

## Валидация, host errors и восстановление context

Поля конструктора захватываются в порядке декларации до скалярных проверок:
theme, colors, roleColors, cellGap, presentCell, cellCaptions, path. Plain records,
own-data и неизвестные поля — по /grid. Таблица ролей захватывает собственные
строковые имена в JS property order; пустые имена, accessors и нестроковые/пустые
значения отклоняются, symbols игнорируются. Неверные типы/options/enums — TypeError;
отрицательный/неконечный gap — RangeError. При конструировании callbacks нет.

Приоритет render: busy; дескрипторы size и width/height; дескрипторы frame в
порядке progress/previous/current; progress в [0,1]; previous, затем current grid;
совпадение формы; canvas/bitmap dimensions; drawable layout/безопасная арифметика;
presentations в порядке выше; context setup/text planning; paint. Скрытые данные
проверяются. Frame.event и stepIndex не читаются и не проверяются, даже accessors;
state-only async/Worker кадры поддерживаются.

До пикселей сохраняется context, задаётся bitmap/logical transform, сбрасываются
alpha/composite/filter/shadow/dash/text state, включая доступные spacing/kerning
поля. Сначала готовится весь измеренный/clipped план, затем clearRect полного
logical rectangle, фон и рисование. Прозрачный background не накапливает старые
пиксели. Приложение передаёт unclipped context и владеет current path:
save/restore не сохраняют его содержимое.

Не восстанавливать save, который не удался. Каждый приобретённый nested save
восстанавливается в обратном порядке, включая path clipping. Первое исключение
setup/measurement/drawing приоритетнее restore errors, включая undefined/null/
false; самостоятельный restore error выходит наружу. Busy всегда снимается.
Нарисованные до host failure пиксели не откатываются; предполагается работающий
native restore. Внешние побочные эффекты callback/Proxy не откатываются.
После вызова нет context/history cache: обычный bitmap/context
reset и следующий redraw не требуют пересоздания renderer. Forced GPU recovery
или расширение поддержки браузеров/версий этим контрактом не обещаются.

Render и планирование текста/путей синхронно обрабатывают клетки и маршрут.
Предел размера grid не обещает время кадра; бюджет чтений Player не прерывает
один callback/render. Sparse/dirty regions или benchmark не обещаются.

## Проверки реализации и граница выпуска

[Отчёт реализации](../checks/grid-canvas-implementation-2026-11-20.json) фиксирует
постоянные регрессии renderer/Player, полный набор тестов, installed consumers
поддерживаемых компиляторов и независимые static/lazy bundles.
[Нативная приёмка](../checks/grid-canvas-browser-2026-11-20.json) прошла 18 проверок:
12 theme/size/backing-ratio сочетаний × 4 progress, реальные text/path pixels,
presenter, результат, context/bitmap reset, прозрачная перемотка и оба режима
Player с настоящими controls, resize/DPR и cleanup. Это встроенный Chromium host,
не расширение поддержки браузеров или гарантия forced GPU context loss.

[Контрактный отчёт](../checks/grid-canvas-contract-2026-11-20.json) сохраняет
историческую declaration-only стадию. Нынешняя приёмка проверяет реализацию.
Точный архив 1.3.0 и identity прежней native-приёмки фиксирует
[подготовка кандидата](../checks/candidate-1.3.0-2026-11-20.json). CI и публикация
проверяются отдельными шагами; см. [заметки кандидата](candidate-1.3.md).

## Пример поиска пути

[Grid BFS](../../examples/grid-player.html) использует createGridTrace, этот renderer
и Player: расстояния, кратчайший путь, зелёный итог, ограниченная перемотка и Restart.
Подробный [лабиринт](../../examples/maze.html) остаётся отдельным примером.
[Описание и проверка](examples.md#кратчайший-путь-bfs-на-сетке).
