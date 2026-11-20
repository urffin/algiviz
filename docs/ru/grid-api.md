# Grid API: /grid

[English](../grid-api.md) · [Архитектурный эскиз](grid-contract.md) · [Текущий API](current-api.md) · [Совместимость](api-compatibility.md)

**Версия 1.3.0.** Независимый headless ESM entry /grid экспортирует
createGridTrace, gridScene и 22 типа ниже. /canvas/grid — отдельный backend.
Общая поверхность пакета: 14 entry, 30 runtime-имён, 155 type-only экспортов
(143 различных). Прежние двенадцать entry не меняются; grid-импортам нужна 1.3.0.
[Изменения и миграция](candidate-1.3.md) · [Ревизия](grid-readiness-1.3.md).

## Объём и координаты

Первая модель — конечная плотная прямоугольная матрица generic-значений. Размеры
фиксированы на trace. Координаты `(row, column)` начинаются с нуля; в штатном
представлении строки растут вниз, столбцы вправо. Хранилище плоское, по строкам:
`row * columns + column`. Это смещение, а не ID.

Строки и столбцы — safe integers в **0…1 000 000** включительно; произведение
не больше **1 000 000 ячеек**. В values ровно столько собственных data-элементов.
Это пределы валидации, не гарантия памяти, времени кадра или практически удобного
размера изображения. Размеры проверяются до копирования элементов и выделения
endpoint-сцены. Длина пути отдельно ограничена 1 000 000; остальные списки ячеек
не длиннее числа ячеек. Настраиваемого лимита в первом API нет.

`0×0`, `0×N` и `N×0` сохраняют разные размеры с пустыми values и без допустимых
адресов. Координаты — safe integers в границах модели; `-0` нормализуется в `0`.
Горизонтальный переход не может перескочить строку увеличением плоского индекса.

Идентичность ячейки — namespace сетки и координата. Запись или обмен значений
не перемещают ячейки. Подвижные частицы/фишки требуют прикладных ID сущностей и
дополнительных видов сцены. Generic-значения непрозрачны: `0`, `false`, `""`,
`null`, присутствующий `undefined`, `NaN` и бесконечности допустимы, если разрешены
типом/политикой приложения. Модуль их не преобразует и не резервирует значения
стены, пустоты или препятствия. Hole не равен присутствующему undefined.

В первый объём не входят resize, рваное/разреженное/typed-array хранилище,
ID строк/столбцов, синтаксис областей, соседство, матричная арифметика и встроенные
алгоритмы. Приложение может явно развернуть прямоугольник в список координат.
Сами payload-значения могут быть typed arrays, но остаются непрозрачными и во
владении приложения; исключений для общей памяти или transfer это не создаёт.

## Публичные декларации

Публичные декларации @grundyjs/algiviz/grid в 1.3.0.

```ts
import type { Step, Frame } from "@grundyjs/algiviz/playback";
import type { Scene } from "@grundyjs/algiviz/scene";

export interface GridCoordinate {
    readonly row: number;
    readonly column: number;
}
export interface GridInput<Value = unknown> {
    readonly rows: number;
    readonly columns: number;
    readonly values: readonly Value[];
}
export interface GridWrite<Value = unknown> extends GridCoordinate {
    readonly value: Value;
}
export interface GridAnnotation extends GridCoordinate {
    readonly role: string;
}
export interface GridMark extends GridCoordinate {
    readonly role: string | null;
}
export interface GridCellCaption extends GridCoordinate {
    readonly text: string;
}
export interface GridCellCaptionPatch extends GridCoordinate {
    readonly text: string | null;
}
export interface GridMarkUpdate {
    readonly cells?: readonly GridMark[] | undefined;
    readonly cellCaptions?: readonly GridCellCaptionPatch[] | undefined;
}
export interface GridResultInput {
    readonly cells?: readonly GridCoordinate[] | undefined;
    readonly path?: readonly GridCoordinate[] | undefined;
}
export interface GridResult {
    readonly cells: readonly GridCoordinate[];
    readonly path: readonly GridCoordinate[];
}
export interface GridDoneOptions {
    readonly result?: GridResultInput | undefined;
}
export interface GridTraceOptions {
    readonly cellCaptions?: readonly GridCellCaption[] | undefined;
}
export type GridEdit<Value = unknown> = Readonly<{
    readonly rows?: undefined;
    readonly columns?: undefined;
    readonly marks?: GridMarkUpdate | undefined;
} & (
    | { readonly values: readonly Value[]; readonly writes?: undefined }
    | { readonly values?: undefined; readonly writes?: readonly GridWrite<Value>[] | undefined }
)>;
export interface GridSnapshot<Value = unknown> {
    readonly grid: GridInput<Value>;
    readonly cellMarks: readonly GridAnnotation[];
    readonly cellCaptions: readonly GridCellCaption[];
    readonly result: GridResult | null;
}
export type GridEvent = Readonly<
    | { type: "start" }
    | { type: "edit" }
    | { type: "mark"; cells: readonly GridMark[]; cellCaptions: readonly GridCellCaptionPatch[] }
    | { type: "done" }
>;
export type GridStep<Value = unknown> = Step<GridSnapshot<Value>, GridEvent>;
export type GridFrame<Value = unknown, Event = GridEvent> = Frame<GridSnapshot<Value>, Event>;
export interface GridTrace<Value = unknown> {
    readonly state: GridSnapshot<Value>;
    start(): GridStep<Value>;
    edit(update: GridEdit<Value>): GridStep<Value>;
    mark(update: GridMarkUpdate): GridStep<Value>;
    done(options?: GridDoneOptions): GridStep<Value>;
}
export interface GridSceneOptions {
    readonly namespace: string;
}
export interface GridCellView<Value = unknown> extends GridCoordinate {
    readonly value: Value;
    readonly caption: string | null;
    readonly role: string | null;
    readonly result: boolean;
}
export interface GridPathView {
    readonly cellIds: readonly string[];
}
export type GridObjects<Value = unknown> = {
    gridCell: GridCellView<Value>;
    gridPath: GridPathView;
};
export declare function createGridTrace<Value = unknown>(
    grid: GridInput<Value>, options?: GridTraceOptions
): GridTrace<Value>;
export declare function gridScene<Value = unknown>(
    state: GridSnapshot<Value>, options: GridSceneOptions
): Scene<GridObjects<Value>>;
```

## Атомарные операции и жизненный цикл

Конструктор захватывает значения и необязательные начальные подписи, с пустыми
отметками и `result: null`; шага нет. `start()` обязателен ровно один раз и выдаёт
index 0 с тем же начальным state. Каждая последующая успешная команда выдаёт
следующий index и новый внешний снимок, включая no-op. Все собственные записи,
массивы, events, steps и оболочки снимка копируются/замораживаются до фиксации.
Неизменные собственные структуры можно разделять. Payload `Value` сохраняется
по ссылке; приложение обязано держать его неизменяемым, пока им пользуются снимки,
playback или проекция.

| Команда | Контракт |
| --- | --- |
| `edit({ writes, marks })` | Разные записи ячеек и необязательные патчи ролей/подписей фиксируются одним шагом. У каждой записи обязателен собственный value, даже undefined. Частичного снимка нет. |
| `edit({ values, marks })` | Полная замена values с сохранением размеров и необязательным атомарным патчем отметок/подписей. Одновременно определённые values и writes запрещены. |
| `edit({})` | Выдаёт edit без изменения содержимого; пропущенные/undefined поля сохраняют состояние. Определённые rows или columns запрещены, даже равные прежним. |
| `mark(update)` | Атомарно применяет роли, затем подписи, не меняя значения; отсутствующие/undefined списки — пустые патчи. Пустой update выдаёт mark. |
| `done(options?)` | Сохраняет сетку/отметки/подписи и выдаёт один терминальный done с результатом либо null. Последующих мутаций нет. |

Записи проверяются в переданном порядке; повтор координаты запрещён вместо
last-write-wins. Для обмена приложение читает прежний state и передаёт обе записи
одним batch. Отметки и подписи сохраняются при смене значений. `role: null` и
`text: null` очищают атрибут; роли — непустые примитивные строки, открытые для
прикладных названий. Пустой текст подписи допустим и отличается от отсутствия.
Дубликаты запрещены независимо внутри каждого списка: запись значения, роль и
подпись могут адресовать одну ячейку в одном edit. Сохранённые отметки/подписи
канонически упорядочены по строкам; events сохраняют порядок патчей.

Фиксируется только целый кандидат. Ошибка сохраняет идентичность state, index и
жизненный цикл. Захват, валидация и все нужные выделения заканчиваются до commit;
busy снимается в finally. Внешние побочные эффекты Proxy не откатываются.
Повторная мутация той же trace во время захвата бросает до чтения вложенных
аргументов; чтение state видит прежний снимок, другая свободная trace независима.
Ошибки busy/lifecycle — обычный Error, без расширения поведения Player.

## Результат: ячейки и упорядоченный путь

До done результат null. `done()` или отсутствующий/undefined result записывает
null; `done({ result: {} })` — `{ cells: [], path: [] }`. Это разные состояния.
Входной null result некорректен. Ячейки результата сохраняют порядок приложения
и запрещают дубликаты. Путь сохраняет порядок **и повторы**, включая соседние
повторы, возврат к началу или путь из одной ячейки. Пустой путь допустим. Оба
списка могут пересекаться и независимы.

Каждая координата должна существовать. Проверок соседства, стен, проходимости,
стоимости и простоты пути нет — это политики приложения. Несоседняя пара станет
прямым отрезком в штатном renderer; промежуточные ячейки не придумываются.
`GridCellView.result` истинен для объединения явно выбранных ячеек и принадлежности
пути, без изменения ролей. Упорядоченные ID объекта gridPath сохраняют повторы;
это не преобразование в граф. Роль с именем "result" остаётся ролью, не выбором
результата. No-path, расстояния, очереди, скалярный ответ и
прикладной статус находятся во внешней обёртке state. Пустой выбор сам по себе
ничего из этого не означает.

```ts
import { createGridTrace } from "@grundyjs/algiviz/grid";

function* example() {
    const grid = createGridTrace({ rows: 2, columns: 3, values: [0, 0, 0, 0, 0, 0] });
    yield grid.start();
    yield grid.edit({
        writes: [{ row: 0, column: 1, value: 1 }],
        marks: {
            cells: [{ row: 0, column: 1, role: "visited" }],
            cellCaptions: [{ row: 0, column: 1, text: "1" }],
        },
    });
    yield grid.done({ result: { path: [
        { row: 0, column: 0 }, { row: 0, column: 1 }, { row: 1, column: 1 },
    ] } });
}
```

Пример требует @grundyjs/algiviz 1.3.0 или новее.

## Валидация, владение и приоритет ошибок

Распознаваемые поля записей — собственные data-свойства plain Object/null-prototype
объектов. Распознаваемые accessors отклоняются без вызова; неизвестные поля
игнорируются без чтения значений. Массивы обычные, плотные, с собственными
data-индексами; typed-array хранилище и holes/унаследованные/accessor элементы
отклоняются. Поля захватываются в порядке деклараций; непрозрачные значения не
перечисляются и не исследуются. Исходные исключения Proxy, включая falsy/non-Error,
сохраняются. Сообщения/стеки диагностические, не стабильные коды.

| Некорректный вход | Ошибка |
| --- | --- |
| Неверный тип записи/массива/скаляра, пропущенное обязательное поле, распознаваемый accessor, sparse array, нестроковая/пустая роль или namespace, нестроковая подпись, определённые размеры в edit, одновременно определённые values и writes | TypeError |
| Неконечный, дробный/отрицательный/unsafe размер или координата, предел размеров/произведения/списка, координата вне границ, неверная длина values, запрещённый повтор координаты, неканонический порядок сохранённых отметок/подписей | RangeError |
| Команда до start/после done, повтор start, повторная мутация той же trace при захвате | Error |
| Исключение Proxy/host/выделения памяти | Исходное исключение без нормализации/обёртки |

Приоритет — часть контракта, включая смешанные ошибки:

1. Команды trace: busy, затем lifecycle, до аргументов. Каждая запись сначала
   захватывает распознаваемые дескрипторы, затем проверяет скаляры. Каждый массив
   проверяет тип, длину/предел и плотность до проверки записей элементов.
2. Конструктор: envelope входа; rows, columns, произведение; точная длина values
   и плотные непрозрачные значения; envelope options и начальные подписи. Optional
   undefined означает пропуск; явный null для options/коллекций/записей запрещён.
3. Edit: envelope; запрет rows, затем columns; взаимоисключение values/writes;
   полные values либо записи по порядку; envelope marks, патчи ролей, затем подписей.
   Запись проверяет row, column, границы и уникальность; присутствие value уже
   проверено при захвате дескрипторов.
4. Запись отметки/подписи: row, column, скаляр role/text, границы, дубликат.
   Начальные подписи используют тот же порядок. Предел длины списка проверяется
   раньше элементов: слишком длинный список выигрывает у ошибки первой записи.
5. Done: envelopes options/result; выбранные ячейки без повторов, затем путь с
   допустимыми повторами, в переданном порядке. Координата: row, column, границы.
6. `gridScene`: options/namespace, envelope снимка, размеры/values, канонические
   cellMarks, канонические cellCaptions, result. Не нужны frozen brand, экземпляр
   trace, история lifecycle или event. Результат сохраняет порядок приложения;
   возрастающий порядок по строкам обязателен только отметкам/подписям.

Владение payload и Worker-cloneability остаются обязанностью приложения.
Копирование values не копирует глубоко и не замораживает элементы. Нельзя менять
или transfer-detach значение, которое ещё используется снимками. Ограничения
общей памяти Worker сохраняются. GridError, собственного кода или sanitizer нет.

## Проекция и воспроизведение

`gridScene` — чистая endpoint-проекция ровно с **gridCell и gridPath**. Namespace —
непустая примитивная строка; пробелы значимы, trim/coercion нет. Стабильные scene ID кодируют namespace, вид и
координату с однозначными границами tuple, отдельно от ID массива, графа, дерева
и пути; байтовая запись приватна. Разным сеткам/видам нужны разные namespaces.
Ячейки выдаются по строкам с zIndex 0, с копированными/замороженными view-записями
и сохранёнными ссылками на значения. Единственный gridPath с zIndex 1 появляется
только при непустом пути результата; его cellIds ссылаются на выданные клетки
в порядке пути с повторами. Путь из одной клетки существует без отрезков.
Сетка нулевой площади даёт пустую сцену без фиктивной клетки. `gridScene`
возвращает `Scene` с `objects`. Поиск через `get(id)` предоставляет `SceneFrame`,
созданный `createSceneFrame` или переданный при dispatch; это не метод результата
`gridScene`.

Кадр сохраняет оба endpoint-значения, роли, подписи и результат. Event описывает
команду; edit не дублирует values в событии. Playback/проекция не выводят state
из события или промежуточной картинки. Прежним Step, Frame, Scene, registry,
ограниченной перемотке и Player stepSource/isTerminal изменение API не нужно.
Previous восстанавливает снимки; Restart создаёт свежую trace. Pause, Next и
dispose сохраняют нынешнее поведение. Async/Worker state-only кадры могут иметь
undefined event и завершаются по EOF. Очистка приложения находится в finally.

Захват значений, команда trace и поячеечная сцена могут стоить O(rows×columns);
история может хранить эту стоимость на каждый шаг. Бюджет чтений Player не
прерывает одну дорогую команду/проекцию/render. Лимиты выше не обещают скорость.

## Граница Canvas

`/canvas/grid` остаётся необязательным DOM-typed backend; `/grid` —
ES2022-only, DOM-free, без зависимости от renderer. Renderer читает оба снимка
и прежний progress, вычисляет регулярную раскладку клеток и рисует; пиксельной
геометрии в headless-модели нет. При смене значений идентичность клеток сохраняется.
Generic-значения не получают неявной числовой интерполяции или вызова toString:
представление текста/цвета задаётся явно. Роли/подписи и независимый зелёный
результат берутся из снимков, без кэша финального цвета. Принадлежность результату
приоритетнее цветов ролей. Путь соединяет центры соответствующих клеток в
сохранённом порядке и не проверяет правила перемещения.

Canvas, CSS/bitmap-размеры, DPR и dispose остаются у приложения или прежнего
viewport. Пустая сетка рисуется без деления на ноль. Backend обязан проверить
вход и подготовить представление до изменения пикселей, восстановить context
state и сохранить основное host-исключение, включая falsy. Он не меняет state,
не запрашивает шаги, не запускает алгоритм и не требует events. Hover,
hit-testing, редактор, pan/zoom, подвижные сущности и адаптеры графа/дерева вне
первой границы backend.

Отдельный [контракт Grid Canvas](grid-canvas-api.md) выбирает полные декларации
createGridRenderer, регулярный fitting, callbacks, текст, результат/путь и
интерполяцию. Renderer реализован и проверен отдельно; оба entry получают
общую защиту совместимости 1.x с 1.3.0.

## Проверки и исторические доказательства

[Подготовка 1.3.0](../checks/candidate-1.3.0-2026-11-20.json) фиксирует точный архив,
тесты, installed consumers и identity доказательств; [заметки кандидата](candidate-1.3.md)
отделяют CI/публикацию от локальных проверок. [Grid Canvas](grid-canvas-api.md)
и [пример BFS](examples.md#кратчайший-путь-bfs-на-сетке) проверены отдельно.

[Первый отчёт headless-реализации](../checks/grid-implementation-2026-11-20.json)
сохраняет исторические 30 grid-регрессий, 678 тестов репозитория, consumers четырёх
TypeScript и 38 bundle-вариантов. Его прежняя версия/статус не описывают 1.3.0.
[Публичный контракт](../checks/grid-public-api-2026-11-19.json) и
[архитектурная проверка](../checks/grid-contract-2026-11-16.json) тоже сохраняют
исходный объём и счётчики. Старые JSON не переписываются как новые прогоны.
