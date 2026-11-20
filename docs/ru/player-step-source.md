# Явные шаги в Player: выбранный проект контракта

[English](../player-step-source.md) · [Текущий Player](player.md) · [Сравнение quickstart](quickstart-comparison.md) · [Совместимость](api-compatibility.md)

**Доступно с 1.0.0; без изменений в 1.3.1.**
stepSource и isTerminal входят в опубликованный Player.
[Текущий API](current-api.md) определяет релизный статус; датированные проверки
ниже сохраняют свой исходный объём.

## Модель источника и кадра

Добавить одну синхронную capability **stepSource**, взаимоисключающую с source,
history и asyncSource. Это синхронная фабрика свежего Iterable<Step<State, Event>>
на Start/Restart. Уже созданные player, iterator, Promise, async-only iterable
и массив сохранённой истории не заменяют фабрику. Фабрика может вернуть свежий
массив как iterable; режим всё равно stream, а не автоматически выбранная запись.
Async explicit steps и записи из явных шагов вне первого контракта. Прежние
asyncSource/history остаются state-only; Worker-интеграция и дополнительные
обязательные релизные этапы из этого проекта не следуют.

Для stepSource обязателен **isTerminal(step): boolean**. Предикат относится
только к этой ветке; с source/history/asyncSource он будет ошибкой конфигурации
нового API. Ровно одна не-undefined фабрика должна быть callable; явный undefined
в остальных ветках допустим. Нет распознавания формы объекта, автоматического
event.type === 'done' и зависимости от /array.

render и getter frame выдают **Frame<State, Event>**: концы State, Event текущего
шага и переданный index. Вложенные ArrayStep-состояния в этом режиме не выдаются.
Целевое подключение quickstart:

```ts
// @grundyjs/algiviz >= 1.0.0
const player = new Player(container, {
  viewport: canvas,
  stepSource: () => minimum([7, 3, 5, 2, 6]),
  isTerminal: step => step.event.type === 'done',
  render: draw,
});
```

Прежний minimum и draw(ArrayFrame) соединяются напрямую. Явный текстовый итог
по-прежнему принадлежит приложению: новая capability не заставляет штатный
array renderer сохранять подсветку завершённого шага.

## Направление публичных типов

Переиспользовать Step и Frame из /playback. Расширить существующие имена до
Player<State, Event = undefined> и PlayerOptions<State, Event = undefined>.
Getter frame класса имеет тип Frame<State, Event> | null, предикат получает
Readonly<Step<State, Event>>. Вывод из stepSource должен сохранять State/Event
в render, isTerminal и frame без явных generic-аргументов.

Прежние применения с одним параметром и типизированные source/history/asyncSource
options остаются присваиваемыми с event типа undefined. State-only режимы
по-прежнему выдают undefined, даже если State содержит свои поля state/event.
Явно выбранный Event, не включающий undefined, не должен принимать state-only
источник: Player<number, string> не может обещать строковые события из
source: () => [1]. Event = never не обходит правило. Расширенный явный Event
может включать undefined, но runtime-значение state-only режима не меняется.

Новая ветка сохраняет viewport, labels, callbacks, timing, rewindCapacity и
maxStepsPerFrame. Не добавляются status/report-поля, phase/mode literals, label
roles, runtime exports, factory helpers и классы ошибок. Event должен
пройти через внутренние controls/sessions, а не скрываться type casts.

## Приём шага, индексы и терминальный признак

Каждое успешное чтение выдаёт object-like шаг. Его основная оболочка захватывается
в порядке index, state, event. index — примитивное конечное число: неверный тип
даёт TypeError; NaN/бесконечность — RangeError до чтения state/event. Отрицательные,
дробные, повторяющиеся и непоследовательные конечные индексы разрешены. Время и
навигация используют позицию в последовательности, не разность индексов.
Для State/Event, включая undefined, нет проверки прикладной схемы. Неверный
yielded step, полученный iterator или next()-result дают TypeError в момент
обнаружения; это не добавляет проверки результатов return().
Iterator result должен быть object-like; done использует обычную truthiness
протокола итератора. Truthy done до terminal-шага означает ранний EOF.

Хранить поверхностную неизменяемую оболочку основных полей и передавать её
isTerminal. State/event сохраняют ссылки: глубокого clone/freeze прикладных
значений нет. Тождество с producer-wrapper и его дополнительные поля не обещаются.
Producer может переиспользовать свою оболочку, если сохранённые State/Event
остаются неизменяемыми. Envelope getters выполняются при приёме под control
guard; их исключения сохраняются как исходные unknown.

isTerminal вызывается ровно один раз для каждой новой принятой позиции, после
захвата полей и до presentation/добавления в окно. Он синхронно возвращает
примитивный boolean: без truthy-coercion и ожидания Promise. Неверный результат —
TypeError; выброшенное значение сохраняется. Признак хранится с записью.
Redraw, чтение frame, hold, Pause и replay буфера его не вызывают. Тот же объект/
index в другой позиции принимается заново. Предикат классифицирует данные,
не планирует команды и не использует счётчик вызовов как алгоритм.

Первый terminal-признак закрывает логический хвост: следующих next() нет,
в том числе при интерполяции и перемотке. Его текущий переход завершается по
обычным правилам, затем iterator.return вызывается не более одного раза.
Код после terminal yield не обязан выполниться; очистка помещается в finally.
finalHoldMs начинается на завершённом endpoint после закрытия источника.
Само обнаружение terminal не обрывает интерполяцию и hold досрочно.

Пустой источник и EOF до принятого terminal-шага — **RangeError**. Неявного
финального шага и fallback по EOF нет. Единственный terminal первый шаг имеет
previous === current и progress 1; с нулевым hold Start сразу его завершает.
Бесконечные нетерминальные источники допустимы; dispose закрывает их досрочно.

## Управление

| Команда | Поведение stepSource |
| --- | --- |
| Создание/status | Проверить конфигурацию до вызова фабрики/перемещения viewport. Смонтировать idle без чтения/рендера источника. Захватить callbacks options; async-подготовки нет |
| Start | Подготовить свежий кандидат, прочитать/классифицировать первую запись и установить её. Показать кадр paused либо finished для уже terminal с нулевым hold. Повторный Start не создаёт источник |
| Next | Пауза и сброс долга времени. Завершить частичный переход без чтения либо получить не более одной следующей записи на границе. Terminal endpoint с нулевым hold завершает ту же команду без EOF-клика. На terminal endpoint Next завершает оставшийся hold |
| Play | Нужны timing и готовая пригодная сессия. Интерполяция идёт по порядку записей; остановка после terminal-перехода и hold. Finished-сессия сама не перезапускается |
| Pause/скрытие документа | Остановить планирование и сбросить pending time, сохранив кадр, принятый terminal-признак и владение источником. Нет неявного return или дополнительного чтения |
| Previous | Только с rewindCapacity; пауза, отказ от частичного перехода и предыдущая сохранённая запись с progress 1. Нет вызова фабрики/предиката. На старейшей позиции no-op |
| Restart/Replay | Пауза и подготовка нового кандидата до закрытия старого источника. Restart остаётся paused либо завершает единственный terminal; Replay запрашивает autoplay только после успешной подготовки и при наличии timing. Окно, признаки и долг сбрасываются |
| Speed/reduced motion | Прежние U2 primitive finite-positive/value-first RangeError и учёт часов. Reduced motion меняет presentation, не логическое terminal/hold-время и event/index |
| seek | По-прежнему недоступен: это stream с неизвестной длительностью, а не запись |
| dispose | Логическая остановка до cleanup; завершить владение iterator/window, остановить RAF и удалить UI. Идемпотентен, без нового predicate/next/render и поздних уведомлений. Последний читаемый кадр может сохранять прикладные ссылки |

Status остаётся mode stream, positionMs/durationMs null, waiting false,
preparing null, cleanupPending false на нормальных публичных границах. Прежние
capability-правила действуют; Previous может быть доступен после завершения, если
сохранены старые записи. frame/status.stepIndex сохраняют step.index.
rewindStartIndex/rewindEndIndex — абсолютные **позиции последовательности с нуля**,
не пользовательские step.index. У ArrayTrace они совпадают, но произвольный
Step.index может не лежать численно внутри показываемого диапазона окна.

## Перемотка, работа и владение

rewindCapacity считает принятые записи, включая текущую. Хранятся основные поля
шага и terminal-bit; replay сохраняет исходные event/index и не вызывает
isTerminal повторно. Обнаруженный terminal остаётся хвостом буфера, после него
значения не читаются. Если Previous прерывает его переход, источник остаётся во
владении до первого завершённого endpoint или dispose. После закрытия replay
не вызывает return исходного итератора повторно и начинает final hold заново.

maxStepsPerFrame сохраняет смысл лимита запросов: считаются новые и буферные
advance-запросы, а callbacks/render не получают временной бюджет. Нет prefetch,
пропуска записей и прерывания дорогого callback. Принятому terminal endpoint/hold
не нужен EOF-probe. Сохраняются RAF wall-clock clamp, один presentation за RAF
и правила долга/скорости. Лимит записей не ограничивает байты и ссылки приложения.

## Ошибки, замена и очистка

Неверный выбор/callability источника, отсутствие/неверный isTerminal и несовместимые
options дают configuration TypeError/RangeError до factory/DOM-эффектов по прежним
областям опций. Options getters могут бросать исходные значения. Source/predicate/
render-исключения не нормализуются, наличие ошибки не определяется её truthiness.

Сбой фабрики/acquisition/первого чтения/admission/predicate — ошибка подготовки.
Очистка кандидата пробуется один раз; прежние пригодные session/window/frame
сохраняются на паузе. Первоначальный сбой оставляет возможность повторить Start.
Откат побочных эффектов фабрики не обещается. После готовности кандидата старый
источник закрывается до показа нового кадра. Сбой старого return запрещает
установку, закрывает кандидат и оставляет ошибочный виджет со старым читаемым
кадром. Сбой render после установки — operational failure, не возврат к уже
закрытому источнику.

Позднее чтение, ранний EOF, predicate, render или terminal-return завершаются по
прежним sync-widget правилам: остановить/закрыть сессию, сохранить primary в
error/hasError, вызвать onError после cleanup и вернуть status команды.
Operational-ошибки не начинают заново выбрасываться из Next/Start/Restart;
исключения callbacks уведомления имеют прежние propagation/diagnostic-правила.
RAF-ошибки не создают detached promise rejections.

Cleanup не заменяет прежний primary, включая undefined. Отдельная ошибка
dispose-cleanup пробрасывается после UI-очистки и записывается с прежней фазой
dispose. Не вводятся drain, retry, async return barrier и новая валидация
результата return. Player.closed — never-rejecting отчёт **disposal виджета**,
не естественного конца источника; sync steps не добавляют AsyncSourceCloseResult
в его список sources.

Mutating-вызовы того же экземпляра из source/admission getters, isTerminal,
render и status callbacks защищены прежними widget guards. Чтения committed
frame/status разрешены; для кандидата предикат использует свой захваченный step.
Повторный dispose после логического disposal безвреден. U2-валидация неверной
скорости по-прежнему предшествует lifecycle/reentrancy-отказу. Очереди команд и
поддержки async callbacks нет.

## История совместимости и приёмки

Ниже сохранён проектный этап до 1.0.0. Выбранная ветка stepSource включена в
выпущенную 1.0.0; ограничения будущих изменений union определяет [политика U3](api-compatibility.md).

Это расширение публичного API, не исправление нынешнего quickstart. Оно расширяет
экспортированный union источников: прежнее source/async/else-history narrowing
может сломаться. По union/public-type правилам U3 проект классифицируется как
breaking даже при opt-in; generic с default не доказывает совместимость. До публикации 1.0
это можно проверить в **новом отдельно порученном кандидате 1.0** с новым CI/native
точного SHA. После stable-публикации такое расширение closed union требует
breaking-release классификации; нельзя молча выпустить его minor под названием
«необязательная опция». Кандидат 5e2fd18, его архив и прежний CI относятся к предыдущему этапу.
Реализация, декларации и quickstart изменены локально; до публикации нужны
новые проверки точного SHA.

| Группа приёмки | Что проверить |
| --- | --- |
| Типы | Вывод State/Event и прямой array renderer, точный getter frame, legacy options/default undefined event, четыре exclusive ветки и отрицательные конфигурации; вся выбранная compiler/resolution matrix |
| Terminal | Первый/единственный и поздний terminal, положительный hold/manual skip, Pause внутри перехода, отсутствие trailing reads, пустой/ранний EOF и falsy throws |
| Admission | Порядок/getter-ошибки, произвольные конечные/повторяющиеся индексы, повтор producer-envelope, тождество State/Event, boolean-валидация и cached classification по позициям |
| Lifecycle | Откат подготовки, сбои old/candidate return, приоритет render/status/onError, callback reentrancy, early/idempotent dispose и момент disposal-report |
| Rewind/work | Capacities 1/N, вытеснение, ordinal window против custom indices, terminal replay без predicate/source calls, RAF budget/debt/speed и reduced motion |
| Интеграция | Minimum quickstart без адаптера и EOF-клика; все прежние source/history/async/Worker-поведения, декларации, экспорты и loading boundaries сохранены |

Изолированная проверка проекта типов прошла TypeScript 6.0.3 strict
NodeNext/Bundler с восемью отрицательными случаями и поломкой прежнего exhaustive
narrowing. Это не runtime-декларация,
полная compiler matrix, implementation regression suite и native-проверка.
[Запись проектного этапа](../checks/player-step-source-contract-2026-11-16.json).

Результаты реализации: [локальный отчёт](../checks/player-step-source-implementation-2026-11-16.json).
