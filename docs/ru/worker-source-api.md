# Worker-адаптер источника: проект публичного API

[English](../worker-source-api.md) · [Поведение](worker-source.md) · [Async-адаптер](async-source-api.md) · [Плеер](player-async-api.md) · [План](../optional-player-proposal.md)

## Проектирование API, 2026-11-14

Декларации ниже **реализованы для 0.16.0**. В версии
0.15.0 Worker-точек входа нет. Основа —
[Worker-контракт](worker-source.md), включая 1000 мс ожидания кооперативной
остановки по умолчанию. Транспорт/обработчик и [подключение к Player](player-worker.md)
проверены локально. Player использует прежний asyncSource без изменения
реализации и типов плеера.

Выбраны две необязательные точки входа:

| Точка входа | Runtime-экспорты | Среда деклараций |
| --- | --- | --- |
| `@grundyjs/algiviz/worker` | `createWorkerSourceFactory`, `WorkerSourceError` | ES2022 + DOM; также доступна браузерному Worker-хосту с типами WebWorker |
| `@grundyjs/algiviz/worker/runtime` | `exposeWorkerSource` | ES2022 + WebWorker; библиотеки DOM и WebWorker не объединяются |

Прежние шесть точек входа не импортируют и не реэкспортируют новые. Старым
headless-потребителям по-прежнему нужен только ES2022. Вычисление модуля не
создаёт Worker, не читает document/self и не подключает обработчики.
Импорт стороны приложения остаётся безопасным без браузерных глобальных
объектов; применение требует браузерного Worker-хоста.

Общие декларации ниже хранятся в приватном модуле без DOM и реэкспортируются
как типы обеими новыми точками входа. Это не третья публичная точка входа.
Декларации приложения и Worker импортируют его напрямую, не друг через друга.

## Общие декларации

```ts
// Private shared types, publicly re-exported by /worker and /worker/runtime.
import type { AsyncSourceSignal } from "@grundyjs/algiviz/playback";

export type WorkerSourcePhase =
    | "create" | "input" | "init" | "acquire" | "next"
    | "transfer" | "serialize" | "post" | "protocol" | "worker"
    | "messageerror" | "abort-listener" | "return" | "terminate" | "teardown";

export type WorkerSourceRemotePhase =
    | "init" | "acquire" | "next" | "transfer" | "serialize"
    | "post" | "protocol" | "abort-listener" | "return" | "teardown";

export type WorkerSourceErrorCode =
    | "startup" | "protocol" | "serialization"
    | "transport" | "remote" | "cleanup";

export type WorkerSourceThrownKind =
    | "undefined" | "null" | "boolean" | "number" | "bigint"
    | "string" | "symbol" | "object" | "function";

export interface WorkerSourceRemoteError {
    readonly phase: WorkerSourceRemotePhase;
    readonly thrownKind: WorkerSourceThrownKind;
    readonly name: string;
    readonly message: string;
    readonly stack: string | null;
}

export interface WorkerSourceIssue {
    readonly origin: "host" | "worker";
    readonly phase: WorkerSourcePhase;
    readonly error: unknown;
}

export interface WorkerSourceCleanupSummary {
    readonly count: number;
    readonly first: WorkerSourceIssue | null;
}

export type WorkerSourceTermination =
    | { readonly kind: "not-created" }
    | {
        readonly kind: "acknowledged" | "forced";
        readonly terminate: "requested" | "failed";
    };

export type WorkerSourceCloseResult = (
    | { readonly kind: "completed" }
    | { readonly kind: "disposed"; readonly reason: unknown }
    | {
        readonly kind: "failed";
        readonly error: unknown;
        readonly origin: "host" | "worker";
        readonly phase: WorkerSourcePhase;
    }
) & {
    readonly termination: WorkerSourceTermination;
    readonly cleanup: WorkerSourceCleanupSummary;
    readonly lateReadError: WorkerSourceIssue | null;
};

export interface WorkerSourceShutdownOptions {
    readonly gracePeriodMs?: number | undefined;
}

export interface WorkerSourceCancellation {
    readonly kind: "restart" | "dispose" | "return" | "cancel";
    readonly message: string | null;
}

export interface WorkerSourceSignal extends AsyncSourceSignal {
    readonly reason: WorkerSourceCancellation | undefined;
    subscribe(listener: (reason: WorkerSourceCancellation) => void): () => void;
}
```

## Декларации приложения: /worker

```ts
import type { AsyncSourceSignal } from "@grundyjs/algiviz/playback";
import type {
    WorkerSourceCloseResult, WorkerSourceShutdownOptions,
    WorkerSourceErrorCode, WorkerSourcePhase,
    WorkerSourceRemoteError, WorkerSourceCleanupSummary,
} from "./types.js";
export type * from "./types.js";

export interface WorkerSourceIterator<State> {
    next(): Promise<IteratorResult<State, void>>;
    return(): Promise<IteratorResult<State, void>>;
}

export interface WorkerSourceSession<State> extends AsyncIterable<State> {
    readonly closed: Promise<WorkerSourceCloseResult>;
    [Symbol.asyncIterator](): WorkerSourceIterator<State>;
}

export type WorkerSourceFactory<State> =
    (signal: AsyncSourceSignal) => WorkerSourceSession<State>;

export interface WorkerSourceOptions<Init> {
    readonly worker: () => Worker;
    readonly input: () => Init;
    readonly shutdown?: WorkerSourceShutdownOptions | undefined;
}

export declare function createWorkerSourceFactory<State, Init = void>(
    options: WorkerSourceOptions<Init>,
): WorkerSourceFactory<State>;

export interface WorkerSourceErrorOptions {
    readonly code: WorkerSourceErrorCode;
    readonly origin: "host" | "worker";
    readonly phase: WorkerSourcePhase;
    readonly remote?: WorkerSourceRemoteError | null | undefined;
    readonly cleanup?: WorkerSourceCleanupSummary | null | undefined;
}

export declare class WorkerSourceError extends Error {
    readonly name: "WorkerSourceError";
    readonly code: WorkerSourceErrorCode;
    readonly origin: "host" | "worker";
    readonly phase: WorkerSourcePhase;
    readonly remote: WorkerSourceRemoteError | null;
    readonly cleanup: WorkerSourceCleanupSummary | null;
    constructor(message: string, options: WorkerSourceErrorOptions);
}
```

`createWorkerSourceFactory` синхронно проверяет вызываемость worker/input,
опции и конечный неотрицательный gracePeriodMs, не вызывая фабрики. Отсутствующий
или undefined shutdown/gracePeriodMs означает 1000 мс. Ноль допустим;
отрицательное число, NaN и Infinity вызывают RangeError, нечисловое значение —
TypeError. Конфигурация сохраняется снимком: последующая мутация объекта опций
не меняет существующие или будущие сеансы этой фабрики.
Дробные неотрицательные миллисекунды допустимы. Большое принятое значение не
должно превращаться в немедленный срок из-за переполнения таймера: планирование
сохраняет тот же номинальный срок с учётом ограничений таймеров/цикла событий.

State приходит из внешнего Worker-модуля: TypeScript не выводит его по объекту
Worker и не доказывает совпадение двух независимо собранных модулей. Следует
явно передавать `<State, Init>`. Без информации о State результат — unknown,
не any. При void-входе по умолчанию используется `input: () => undefined`.
Параметр типа не доказывает клонируемость, безопасность передачи или прикладную
схему State/Init во время исполнения.

Каждый `factory(signal)` синхронно создаёт новый сеанс для одного потребителя
со стабильным closed и одним стабильным итератором, не вызывая worker/input.
Получение итератора ресурсов не создаёт. Первый next один раз вызывает worker,
принимает владение новым выделенным модульным Worker, затем один раз вызывает
input и отправляет инициализацию после подключения обработчиков. При таком
порядке ошибка input наблюдается через очистку уже принадлежащего Worker.
Ошибки создания/input отклоняют запрос исходным локальным значением, включая
undefined. Уже отменённый сигнал не создаёт Worker и не вызывает input;
отчёт — disposed/not-created с исходной причиной приложения.

Фабрика совместима с `AsyncSourceFactory<State>`:
`createAsyncSource(factory)` и `new Player(..., { asyncSource: factory, ... })`
не требуют новой опции. Транспортный iterable сам не является AsyncSource или
Player: у объекта сеанса нет собственных next/read-result/dispose-команд.
Прямой потребитель итератора обязан последовательно вызывать next/return;
конкурентный next транспорта отклоняется, а не ставится в очередь. Публичное
объединение в тот же promise выполняет createAsyncSource. Return запускает
общую остановку и завершается с done либо отклоняется общей ошибкой очистки.
Next и return не принимают аргументов; нет канала throw или входных данных
через next. Узкий интерфейс объявляет return обязательным вместо наследования
необязательных return/throw из AsyncIterator.
После EOF next возвращает done без ввода-вывода. После операционной ошибки он
отклоняется с той же сохранённой первичной ошибкой. После отмены/return владельца
он ждёт остановку и возвращает done либо отклоняется настоящей ошибкой очистки
без нового запроса. Return до первого next не создаёт Worker/input и закрывает
сеанс как not-created; повторы наблюдают ту же остановку без новых эффектов.

У фабрики нет getter текущего сеанса, массива отчётов или одного closed на все
будущие Restart. Для наблюдения всех результатов нужно обернуть вызов фабрики,
подключить обработанное продолжение к closed этого сеанса и вернуть тот же
сеанс. Ошибка наблюдателя принадлежит вызывающему это продолжение, а не
источнику или плееру. Библиотечные callbacks onSession/onClose не вводятся.

## Декларации Worker: /worker/runtime

```ts
import type { WorkerSourceSignal } from "./types.js";
export type * from "./types.js";

export type WorkerStateFactory<Init, State> = (
    input: Init, signal: WorkerSourceSignal,
) => Iterable<State> | AsyncIterable<State>;

export type WorkerTransferSelector<State> =
    (state: Readonly<State>) => readonly ArrayBuffer[];

export interface WorkerSourceEndpointOptions<Init, State> {
    readonly scope: DedicatedWorkerGlobalScope;
    readonly source: WorkerStateFactory<Init, State>;
    readonly transfer?: WorkerTransferSelector<State> | undefined;
}

export declare function exposeWorkerSource<Init, State>(
    options: WorkerSourceEndpointOptions<Init, State>,
): void;
```

Установка выполняется один раз, явно в модуле выделенного Worker. Она синхронно
проверяет scope/source/transfer и подключает обработчик, не вызывая source/next
до допустимой инициализации. Повторная распознанная установка для того же scope
вызывает исключение до добавления обработчиков. Возвращаемого контроллера,
локального dispose и владения всем глобальным окружением нет: отменой и
terminate владеет приложение. При закрытии обработчик удаляет свои слушатели,
отправляет итоговое подтверждение и ожидает завершения со стороны приложения.

Source сразу возвращает sync/async iterable, не promise такого объекта. Если
async-протокол присутствует, выбирается он; неверный присутствующий async-метод
вызывает ошибку без перехода к sync. Прикладная инициализация/вычисления
выполняются внутри Worker. Приложение всё равно проверяет входные Init.
Отсутствующий/несовместимый обработчик или молчаливый self.close сохраняют
ограничения ожидания/отмены поведенческого контракта.

WorkerSourceSignal сохраняет прежнюю синхронную подписку с уточнённым
клонируемым типом причины. Изначально reason — undefined; после отмены — один
замороженный WorkerSourceCancellation. Строки приложения `"player:restart"` и
`"player:dispose"` отображаются в restart/dispose; прямой return итератора —
в return; остальные причины владельца — в cancel. Message содержит только
строковую причину приложения с ограничением 4096 кодовых единиц UTF-16, иначе
null. Произвольный объект причины и его строковое преобразование не пересекают
канал. Исходная unknown-причина остаётся в приложении. Ошибки слушателей
учитываются без пропуска остальных слушателей и последовательного return.

## Передача буферов

Отсутствующий или undefined transfer означает копирование состояний. Синхронный
селектор вызывается ровно один раз на каждое выданное состояние, включая первое;
пустой список означает копирование этой выдачи. Для EOF/return-значений он не
вызывается. Readonly поверхностный: селектор не меняет состояние или связанные
хранилища. Асинхронный селектор не поддерживается. Исключение селектора
превращается в удалённую операционную ошибку с phase transfer.

В списке только достижимые, присоединённые, неразделяемые ArrayBuffer, каждый
один раз. Представления typed array вместо буферов, другие передаваемые ресурсы,
повторы, недостижимые или отсоединённые буферы вызывают ошибку сериализации/
передачи без повторной попытки копирования. SharedArrayBuffer/представления
отклоняются во всём поддерживаемом графе данных. Структурные типы TypeScript,
особенно старые декларации ArrayBuffer, не обеспечивают эти проверки подлинного
типа/достижимости; проверки во время исполнения обязательны. В TypeScript 5.0.4
даже Uint8Array структурно подходит под ArrayBuffer; это не делает представление
допустимым элементом списка передачи.
Результат селектора копируется до отправки, поэтому последующее изменение списка
не меняет передачу. Для инициализации селектора нет: только копирование.
Приложение никогда не отправляет полученный/сохранённый снимок назад автоматически.

## Ошибки и ограниченная диагностика

Обычные локальные исключения прикладных фабрик сохраняются как unknown;
instanceof WorkerSourceError не охватывает все возможные ошибки. Ошибки,
созданные транспортом, и нормализованные удалённые ошибки используют этот класс.
Его коды:

| code | Значение |
| --- | --- |
| startup | Наблюдаемая ошибка запуска/загрузки Worker до готовности. |
| protocol | Ошибка версии, оболочки, сеанса/запроса/этапа или протокола итератора. |
| serialization | Ошибка проверки данных, structured clone или передачи. |
| transport | Наблюдаемая ошибка исполнения Worker/messageerror или отправки по каналу. |
| remote | Исключение/отклонение фабрики/получения/next источника или селектора внутри Worker. |
| cleanup | Одна сводная ошибка настоящих удалённых/локальных ошибок очистки. |

Origin и phase указывают место/действие; init — выполнение фабрики в Worker,
input — фабрика начальных данных приложения, create — фабрика Worker приложения.
Нативные Worker error/messageerror могут не иметь удалённого описания; сам
объект события не сохраняется как неограниченное значение отчёта. Ошибки
удалённого источника содержат описание. Известная ошибка протокола/сериализации
использует соответствующий код вместо remote. Эти метки не перезапускают работу.

Удалённое описание сохраняет thrownKind, в том числе undefined/null, без
произвольного выброшенного объекта. Name/message/stack — доступные строки
с пределами 128/4096/16384 кодовых единиц UTF-16 соответственно; недоступный stack —
null, имя по умолчанию Error или ThrownValue, для message есть фиксированное
безопасное значение. Чтение свойств защищено, пользовательское строковое
преобразование не вызывается. Описания и метаданные конструктора проверяются/
копируются в readonly-оболочки; Error.message/stack сохраняют обычное поведение
Error. Конструирование WorkerSourceError не создаёт транспорт и не отправляет
сообщения. Неверные метки, форма описания и несогласованные метаданные вызывают
TypeError; неверный числовой счётчик очистки — RangeError. Удалённое описание
требует origin worker и того же phase, что у ошибки; код remote требует описание.
Код cleanup требует положительный счётчик и origin/phase первой ошибки сводки.
У остальных ошибок cleanup — null. Переданные строки описания ограничиваются,
как указано выше.

Count сводки очистки — неотрицательное безопасное целое с насыщением на
MAX_SAFE_INTEGER; ноль означает first null, положительное число — одну первую
ошибку. Локальные значения ошибок сохраняются по ссылке, удалённые представлены
нормализованными локальными ошибками. Первая ошибка определяется порядком
наблюдения, не сравнением часов потоков. Нет массива всех ошибок, исходных
событий, данных или исторических сеансов. Одна WorkerSourceError очистки несёт
сводку в cleanup с кодом cleanup и origin/phase первой ошибки; первичную ошибку
она не заменяет.

## closed: исход источника и способ остановки различаются

Closed сеанса существует до чтения, никогда не отклоняется и сам не запускает
работу. Он завершается только после терминального исхода, завершения локальных
вызовов, удаления таймеров/слушателей/подписок и запроса terminate либо регистрации
его ошибки. Пока EOF/ошибка/отмена/return не начали закрытие, он ожидает.
Подтверждение физического выхода браузерного Worker не заявляется.

| Поле | Выбранный смысл |
| --- | --- |
| kind completed | Транспорт увидел естественный EOF, включая пустой, и освободился. Внешний createAsyncSource всё равно отклоняет пустой источник с RangeError. |
| kind disposed, reason | Выиграла отмена/return владельца. Причина приложения сохранена по ссылке; прямой return без отмены владельца использует undefined. |
| kind failed, error, origin, phase | Выиграла операционная ошибка; то же первичное локальное значение/нормализованная ошибка, что у отклонённого чтения, включая undefined. Origin/phase сохраняют контекст даже для локального значения не-Error. |
| termination.kind not-created | Объект Worker не был передан во владение; поля terminate нет. |
| termination.kind acknowledged | Допустимое подтверждение закрытия обработано до принудительного завершения; оно может содержать настоящие ошибки очистки. |
| termination.kind forced | К непродлеваемому сроку нет допустимого подтверждения; выполнена попытка принудительного завершения. Сама по себе это не ошибка очистки. |
| termination.terminate requested / failed | terminate вернулся нормально / бросил исключение; ни один исход не подтверждает физический выход. Исключение terminate также считается настоящей ошибкой очистки. |
| cleanup | Настоящие ошибки удалённых abort/return и локальных протокола закрытия/отправки/завершения/очистки, в том числе замеченные до принудительной остановки. |
| lateReadError | Первая настоящая операционная ошибка чтения после отмены или null. Не включает нормальную отмену/остановку и повторную передачу сводной ошибки очистки внешнему адаптеру. |

Acknowledged не означает нулевой счётчик очистки. Not-created может сочетаться
с disposed (отмена до чтения) или failed (исключение фабрики Worker). Создание
кандидата не меняет и не сбрасывает promise/отчёт старого сеанса. Отчёты,
описания завершения/ошибок, сводки и оболочки — readonly-снимки; исходные локальные
значения состояния/причины/ошибки не замораживаются глубоко.

Общий срок остановки начинается один раз при отмене/return/операционной ошибке;
повторы его не продлевают.
Гонка подтверждения/срока разрешается порядком обработки callbacks приложения:
подтверждение до действия terminate выигрывает; ответы после него не открывают
транспорт заново. Номинальный таймаут не является гарантией реального времени.
При естественном EOF итератор уже завершён;
локальная очистка/terminate выполняются до передачи done. Отмена при ожидающем
чтении транспорта оставляет его ожидающим до конца остановки; настоящая ошибка
очистки должна отклонить его и последующий return одной общей ошибкой очистки,
чтобы она попала во внешние cleanupErrors. Успешная принудительная остановка
может завершить отменённое внутреннее чтение с done, не меняя внешний disposed.
Операционные ошибки по-прежнему отклоняют запрос сразу, до конца очистки.

Ошибка без ожидающего чтения запоминается и начинает остановку, но pull-only
потребитель увидит её следующим запросом. Отчёт транспорта может завершиться
раньше; внешнему createAsyncSource.closed всё ещё нужен собственный EOF/ошибка/
dispose. После логического удаления виджета новых UI-callbacks нет; отдельно
подключённое продолжение closed сеанса принадлежит приложению. Поля
AsyncSourceCloseResult/PlayerCloseResult и правила callbacks/подсчёта ошибок
остаются прежними.

## Пример приложения

```ts
import { Player } from "@grundyjs/algiviz/player";
import { createWorkerSourceFactory } from "@grundyjs/algiviz/worker";

interface Init { readonly count: number }
interface State { readonly step: number; readonly values: ArrayBuffer }
declare function draw(values: Float64Array, progress: number): void;

const factory = createWorkerSourceFactory<State, Init>({
    worker: () => new Worker(new URL("./states.worker.js", import.meta.url), {
        type: "module",
    }),
    input: () => ({ count: 128 }),
    shutdown: { gracePeriodMs: 1000 },
});

const player = new Player<State>(document.querySelector<HTMLElement>("#demo")!, {
    asyncSource(signal) {
        const session = factory(signal);
        void session.closed.then(report => {
            console.info(report.kind, report.termination.kind, report.cleanup.count);
        }).catch(error => console.error("Report observer failed", error));
        return session;
    },
    render(frame) { draw(new Float64Array(frame.current.values), frame.progress); },
    stepDurationMs: 200,
    rewindCapacity: 4,
});

player.start();
// On application teardown: player.dispose(); await player.closed;
```

Наблюдатель необязателен: factory можно передать в asyncSource напрямую.
Для отдельного потребления фабрика передаётся в createAsyncSource, а удаляется
этот адаптер; результаты чтения остаются value/done/cancelled как в 0.15.0.

## Пример модуля выделенного Worker

```ts
import { exposeWorkerSource } from "@grundyjs/algiviz/worker/runtime";

interface Init { readonly count: number }
interface State { readonly step: number; readonly values: ArrayBuffer }

exposeWorkerSource<Init, State>({
    scope: self as DedicatedWorkerGlobalScope,
    source: function* (input, signal) {
        if (!Number.isSafeInteger(input.count) || input.count < 1)
            throw new RangeError("Expected a positive count");
        for (let step = 0; step < input.count; step++) {
            if (signal.aborted) return;
            const values = new Float64Array(input.count);
            values[step] = step;
            yield { step, values: values.buffer };
        }
    },
    transfer: state => [state.values],
});
```

Это проверенные на уровне типов прикладные примеры. Нативная проверка ниже
охватывает отдельный адаптер, не интеграцию с Player и не производительность. Источник выделяет новое хранилище, потому что передача
отсоединяет прежний буфер. Алгоритмы, рисование и доставка Worker-модуля
принадлежат приложению.

## Проверка проекта деклараций

Общие декларации и прежние headless-потребители проверяются только с ES2022;
приложение, прежний потребитель Player и новые положительные/отрицательные
сценарии — с DOM; обработчик/источник/передача/сигнал Worker — только с WebWorker.
Режимы: strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess, пустые
types, skipLibCheck false и noEmit, NodeNext и Bundler. Компиляторы —
TypeScript 5.0.4 и репозиторный 6.0.3. Блоки деклараций/примеров EN/RU совпадают.
Результаты записываются после этих проверок; компиляция деклараций не подтверждает
настоящий жизненный цикл Worker. Нативная/runtime-приёмка остаётся в
поведенческом контракте; результаты отдельной реализации приведены ниже.

До реализации, 2026-11-14, **12 конфигураций проекта деклараций прошли** без диагностик:
TypeScript 5.0.4 / 6.0.3 × NodeNext / Bundler × headless / DOM-приложение /
WebWorker. Использованы три блока деклараций и оба примера выше, прежние
headless/player-потребители и 29 новых общих отрицательных сценариев;
6.0.3 дополнительно отклоняет typed-array view как элемент списка ArrayBuffer.
Структурное принятие этого представления в 5.0.4 подтверждено и записано как
обязательная runtime-проверка. Прошли вывод типов, unknown State по умолчанию,
совместимость фабрик, явный undefined, обязательный return без input/throw,
изоляция сред, readonly-метаданные и сужение отчётов. Файлы не генерировались,
зависимости пакета не менялись, Worker не запускался.

## Отдельная реализация и проверки

Реализовано локально 2026-11-14 в [точке входа приложения](../../src/worker/index.ts)
и [обработчике Worker](../../src/worker/runtime.ts) без изменения /player и
основного async-адаптера. Новые модули входят в 0.16.0. Декларации Worker компилируются
отдельно с WebWorker через [tsconfig.worker.json](../../tsconfig.worker.json),
декларации приложения — с DOM. Прежние импорты изолированы от обеих точек входа.

Транспорт создаёт снимок native structuredClone до проверки фактического графа
данных и отправки. Getters исходника вычисляются один раз, поэтому getter не
подменяет значение разделяемой памятью после проверки. Копирование по умолчанию
включает предварительный снимок и копирование postMessage; zero-copy или общего
ускорения не обещается. Явная передача перемещает буферы через снимок и сообщение;
поздняя ошибка не отменяет отсоединение. Требуется native structuredClone,
polyfill и резервного JSON-преобразования нет.

Одно уточнение API добавляет teardown в WorkerSourceRemotePhase, чтобы ошибка
удаления обработчиков внутри Worker сохраняла свой этап. Неверный результат
return сохраняет классификацию protocol внутри диагностики очистки.
Нормализация произвольных исключений обрабатывает и Proxy с ловушкой
getPrototypeOf без необработанного отклонения. Принудительная остановка остаётся
отдельной от реальных ошибок очистки и не выдаётся за кооперативное подтверждение.

Проверки этого отдельного этапа:

- Прошли **293 теста репозитория**, включая **27 публичных Worker-тестов** и
  проверку границы ID. Управляемые сценарии охватывают идентичность/порядок
  протокола, копирование и передачу, враждебные исключения, обычный/нулевой/
  большой срок, гонки отмены/EOF, последовательный/неуспешный/вечный return,
  повторное владение, удаление слушателей и стабильные ограниченные отчёты.
- Свежий локальный архив прошёл точные runtime-экспорты/приватные пути и строгих
  потребителей ES2022-only headless, DOM и WebWorker с TypeScript 5.0.4/6.0.3 в
  NodeNext/Bundler. Все 27 Worker-сценариев также прошли на последнем установленном
  локальном архиве со строгой обработкой отклонений. Импорты модулей приложения/
  Worker проверены в Node без глобальных Worker/DOM.
- Проверки browser ESM-сборок прошли: старые модули и UI не включают Worker-код,
  стороны приложения/Worker не подтягивают противоположный обработчик,
  динамический import создаёт отложенные Worker-чанки.
- Во встроенном браузере прошли **20/20 нативных проверок выделенных модульных
  Worker**: копирование входа, отсоединение отправителя, сохранность снимков,
  графы клонирования, удалённые ошибки/сериализация/загрузка, кооперативная
  отмена, диагностика очистки, принудительная остановка next/return/CPU-цикла,
  молчаливый выход и отмена запуска. Неожиданных ошибок/отклонений и оставшихся
  принадлежащих Worker — ноль. [Нативный отчёт](../checks/worker-source-browser-2026-11-14.json)
  содержит SHA-256 исходников, сборки и стенда. Изоляция стенда позволяет
  проверить отказ от разделяемой памяти; самому адаптеру она не требуется.

После сборки `node scripts/serve-worker.mjs` позволяет повторить нативную
проверку во встроенном браузере. Это проверка локальной сборки, не релиза npm
и не всех версий браузеров. Последующее [подключение к Player](player-worker.md)
прошло 304 теста репозитория и 25 нативных проверок управления/клавиатуры/удаления.
Оно использует asyncSource напрямую, без новых опций и runtime-зависимости Player.
