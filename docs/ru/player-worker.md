# Worker-источники в Player

[English](../player-worker.md) · [Плеер](player.md) · [Worker API](worker-source-api.md)

**Добавлено в 0.16.0, 2026-11-14.** В версии 0.15.0
Worker-точек входа нет. `createWorkerSourceFactory` передаётся прямо в
`asyncSource`. Существующие контроллер и типы Player уже поддерживают эту
границу; дополнительной опции источника, фазы, команды и неявного импорта Worker нет.

## Подключение источника

Приложение задаёт URL модуля Worker, алгоритм и отрисовку. Фабрика приложения
создаёт новый выделенный модульный Worker для каждой сессии. Монтаж Player её
не вызывает; первую сессию создаёт Start. Обработчик использует
`exposeWorkerSource`, как в [примерах Worker API](worker-source-api.md).

```ts
import { Player } from '@grundyjs/algiviz/player';
import { createWorkerSourceFactory } from '@grundyjs/algiviz/worker';

interface Init { readonly count: number }
interface State { readonly step: number; readonly values: ArrayBuffer }

export function mount(container: HTMLElement, draw: (state: State) => void) {
    const factory = createWorkerSourceFactory<State, Init>({
        worker: () => new Worker(new URL('./states.worker.js', import.meta.url), { type: 'module' }),
        input: () => ({ count: 100 }),
        shutdown: { gracePeriodMs: 1000 },
    });
    return new Player(container, {
        asyncSource: factory,
        render(frame) { draw(frame.current); },
        stepDurationMs: 200,
        rewindCapacity: 32,
        maxStepsPerFrame: 4,
    });
}
```

Без `stepDurationMs` доступно ручное воспроизведение через Next. `rewindCapacity`
хранит только заданное окно; при повторном просмотре Worker не вычисляет его
заново. Переданные приложению состояния остаются читаемыми при перемотке,
Restart и dispose. Алгоритм в Worker выделяет новые буферы для следующих
состояний вместо изменения или повторной передачи уже отправленного хранилища.

## Управление и жизненный цикл

| Действие | Поведение с Worker-источником |
| --- | --- |
| Start | Ждёт первое состояние с `waiting` и `preparing: 'start'`; до завершения подготовки управление недоступно. Первый кадр устанавливается на паузе. |
| Next | При необходимости запрашивает одно состояние; повторные команды разделяют ожидаемый запрос. Готовый ответ применяется без нового запроса. Незавершённый переход с таймером сначала доводится до конца. |
| Pause | Меняет намерение воспроизведения без отмены Worker и ожидаемого запроса. Позднее значение или EOF сохраняется до Next/Play. Ошибка по-прежнему останавливает сессию. При ожидающем ручном Next кнопка Pause доступна через `canPause`. |
| Play / ожидание данных | `waiting` обозначает отсутствие данных без опроса через RAF. Часы отбрасывают время ожидания; ответ начинает новый переход с нулевым прогрессом. |
| Restart / Replay | Готовит одного нового кандидата до закрытия старой сессии. Старые ответы изолируются. Ошибка кандидата возвращает рабочую старую сессию; успех ждёт её очистки перед установкой. Restart устанавливает паузу; Replay запускает воспроизведение, только пока намерение актуально. Во владении максимум два Worker. |
| dispose | Синхронно удаляет UI/слушатели/таймеры, возвращает viewport и сохраняет последний рисунок. Отменяет все принадлежащие сессии, включая кандидата. `closed` ждёт их остановки и очистки UI; поздних render/status/error callbacks нет. |

После конечного срока кооперативной остановки неотвечающий Worker завершается
принудительно. Само принудительное завершение позволяет замену и не является
реальной ошибкой очистки. Если закрытие старого источника сообщает настоящую
ошибку очистки, Player закрывает кандидата, сохраняет читаемый рисунок и
сообщает об ошибке. Закрытый старый источник не возобновляется. Бюджет кадра
ограничивает запросы, а не длительность шага Worker, клонирования или отрисовки.

## Наблюдение за завершением транспорта

`ui.closed` — прежний `Promise<PlayerCloseResult>`. Его отчёты источников
описывают жизненный цикл async-адаптера и не включают метаданные завершения
Worker. Для различения принудительной остановки и подтверждения оберните
фабрику и наблюдайте отдельный неотклоняющийся `closed` каждой сессии:

```ts
import { Player } from '@grundyjs/algiviz/player';
import { createWorkerSourceFactory, type WorkerSourceCloseResult } from '@grundyjs/algiviz/worker';

export function mountObserved(container: HTMLElement, onClosed: (report: WorkerSourceCloseResult) => void) {
    const factory = createWorkerSourceFactory<number>({
        worker: () => new Worker(new URL('./numbers.worker.js', import.meta.url), { type: 'module' }),
        input: () => undefined,
    });
    return new Player(container, {
        asyncSource(signal) {
            const session = factory(signal);
            // The application callback must not throw; handle its errors locally.
            void session.closed.then(onClosed);
            return session;
        },
        render(frame) { container.dataset.step = String(frame.current); },
    });
}
```

Наблюдайте каждую сессию по завершении вместо накопления неограниченного
журнала. Отмена доходит до Worker в виде ограниченной clone-safe причины.
Реальные удалённые сбои представлены `WorkerSourceError`; диагностика очистки
и вид завершения различаются. Подробнее — [Worker-контракт](worker-source.md).

## Проверка

На 2026-11-14 прошли **304 теста репозитория**, включая **11 интеграционных
сценариев Player/Worker** в [управляемом наборе](../../test/player-worker.test.mjs).
Они также прошли на свежем установленном локальном архиве со строгой обработкой
отклонений. Строгие потребители TypeScript 5.0.4/6.0.3 прошли NodeNext/Bundler:
прямая совместимость фабрики, вывод State, прежние синхронные команды,
раздельные отчёты завершения и взаимоисключающие источники. Проверки headless
с ES2022 и раздельных деклараций DOM/WebWorker сохранились.

Проверки ESM-сборок установленного пакета охватывают совместную отложенную
загрузку Player и адаптера приложения; начальные/старые графы их не включают,
граф UI не импортирует Worker-код. Обработчик runtime отделён от приложения.

Во встроенном браузере прошли **25/25 нативных проверок** с выделенными
модульными Worker: 23 автоматических сценария, настоящее нажатие Enter на
Start/Next/Pause и окончательное удаление. [Отчёт](../checks/player-worker-browser-2026-11-14.json)
содержит 31 SHA-256 исходников/сборки/стенда, ноль неожиданных ошибок, максимум
два принадлежащих Worker и ноль оставшихся Worker/RAF. Отдельный
[отчёт из 20 сценариев](../checks/worker-source-browser-2026-11-14.json)
охватывает нативное копирование, передачу, сериализацию и принудительную
остановку CPU-цикла.

Повторение: `npm test`, `npm run test:package -- --resolution=all`,
`npm run test:package -- --typescript=5.0.4 --resolution=all` и
`npm run test:bundle`. После сборки `node scripts/serve-worker.mjs --player`
выводит локальный URL нативного стенда. Запустите автопроверки, выполните
показанную последовательность клавиатурой, удалите плеер, разрешите очистку и
сохраните отчёт. Это проверка локальной сборки, не публикации, производительности
или всех версий браузеров.
