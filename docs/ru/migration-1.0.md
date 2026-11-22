# Миграция с 0.16.0 на 1.0.0

[English](../migration-1.0.md) · [Совместимость](api-compatibility.md) · [Текущий API](current-api.md)

**1.0.0 выпущена; эти заметки описывают переход с 0.16.0.**
Явные шаги и результаты массива доступны с 1.0.0. Приложения могут не включать
новые возможности, но исчерпывающие проверки PlayerOptions должны учитывать
ветку stepSource. Исходные восемь ESM-путей, их runtime-экспорты и отсутствие
runtime-зависимостей сохранены; поздние minor-релизы добавили независимые entry.
[Текущий API](current-api.md) описывает все четырнадцать путей в 1.3.1.

## Player: явные шаги без адаптера кадра

Новая взаимоисключающая ветка stepSource предназначена для генератора
Step<State, Event>, в том числе шагов ArrayTrace. Обычный source по-прежнему
считает каждое выданное значение состоянием, даже если в нём есть index/state/
event. При переходе нужно изменить и имя опции, и убрать раскрытие вложенного
state в render: новая ветка сразу передаёт State и Event.

```js
const ui = new Player(container, {
  viewport: canvas,
  stepSource: () => minimum([7, 3, 5, 2, 6]),
  isTerminal: step => step.event.type === 'done',
  render: frame => renderer.render(ctx, frame),
});
```

Здесь frame.current/previous — снимки массива, не обёртки ArrayStep.
Player<State, Event = undefined> и PlayerOptions<State, Event = undefined>
выводят оба типа; getter кадра — Frame<State, Event> | null. Прежнее применение
одного generic сохраняет event: undefined. Явный Event, исключающий undefined
(включая never), не допускает state-only ветки.

isTerminal обязателен только для stepSource и синхронно возвращает примитивный
boolean. Он вызывается один раз на новую позицию, не при повторе буфера.
Автоматического распознавания done, async-шагов или сбора iterable в history
нет. Async/Worker по-прежнему используют state-only ветку asyncSource.

Терминальный шаг завершает переход и однократно закрывает итератор до final hold,
без чтения EOF и дополнительного клика. Финальные побочные эффекты выполняйте
до yield: код после терминального yield не обязан исполниться. Пустой источник/
EOF без терминального шага даёт операционный RangeError через status.error/
hasError и onError по прежним правилам sync-виджета. Команды возвращают status;
нового синхронного throw из Next при ошибке источника нет. Pause, ограниченный
Previous, подготовка перед заменой при Restart и идемпотентный dispose сохраняют
контракт. Терминальный признак хранится вместе с записью окна.

При приёме шага фиксируется замороженная обёртка index/state/event. Тождество
producer-wrapper и его дополнительные поля не сохраняются; ссылки State/Event
сохраняются. Index — примитивное конечное число: неверный тип даёт TypeError,
неконечное число RangeError. Допустимы повторы и дробные индексы; границы окна
по-прежнему порядковые позиции. Подробности — в [контракте](player-step-source.md).

### Обновите проверки типа источника

PlayerOptions теперь выбирает ровно одну из **четырёх** фабрик. Ветка
source/asyncSource/else-history должна учитывать stepSource: последний else
больше не обязательно history. Например:

```ts
function sourceKind<State, Event>(options: PlayerOptions<State, Event>) {
  if (options.stepSource !== undefined) return 'steps';
  if (options.source !== undefined) return 'states';
  if (options.asyncSource !== undefined) return 'async';
  return 'history';
}
```

По U3 расширение закрытого union является breaking, несмотря на opt-in и
generic Event с default. Прежние source/history/asyncSource и runtime-форма
их кадров не меняются.

## Array: результат в done

Необязательный API заменяет собственный финальный снимок, второй рендерер и
подмену события для отображения в quickstart:

```js
result.textContent = 'Minimum: ' + array.at(min).value;
yield array.done({ result: [min] });
```

Передаются позиции на момент завершения. Trace получает собственные замороженные
уникальные ID в необязательном ArraySnapshot.resultItemIds. Событие остаётся
done; сортировка и новые счётчики не выводятся. Type-only экспорт
ArrayDoneOptions extends SortedRegions сохраняет совместные sorted/result-опции.
Несколько результатов — несколько позиций; [] явно означает отсутствие
выделения, в том числе на пустом входе. Пропуск/undefined сохраняет старую форму
снимка. Неверная коллекция, дырки или подменённая некорректная длина дают
TypeError; неверные позиции — RangeError до изменения собственных данных trace.

Один штатный рендерер читает аннотацию. Необязательный colors.result по умолчанию
зелёный; приоритет held > active > result > sorted > обычный столбец. Цвет не
зависит от предыдущего render. Перемотка на снимок без отметки убирает её,
Restart начинает без результата. Старые done(), sorted-маркеры, палитры из шести
ролей и рукописные снимки сохраняют смысл и совместимость типов. При чтении
старых и новых снимков используйте ?? [] для необязательного поля.

[Главный quickstart](getting-started.md) намеренно использует фиксированный
непустой вход и 31 строку JS. Это не убирает поддержку пустых массивов в
библиотеке. Валидация и цвета подробно описаны в [контракте](array-result.md).

## U1: команды headless-плеера после возврата из callbacks

Правило действует для `createPlayer`, `createStatePlayer`, `createArrayPlayer`.
Вызов `nextStep()`, `advance(...)` или первого `dispose()` того же плеера из его
активного синхронного callback/getter теперь бросает встроенный `Error` до второго
чтения/рендера, изменения кадра/времени или disposal. Защита охватывает `render`,
`isTerminal`, получение итератора/`next`/`return`, result/step getters и вызываемые
ими синхронные функции. Чтение `frame`, входящее в step getter, тоже защищено.
Внутри этого интервала отклоняются даже `advance(0)` и команды finished-плеера.

Раньше render мог повторно войти в playback, а генератор — завершиться ошибкой
из-за пересечения iterator calls. На такие результаты полагаться нельзя.
Например, эта повторная команда в 1.0 отклоняется:

```js
let player;
player = createStatePlayer([0, 1, 2], {
  render(frame) {
    draw(frame);
    if (frame.current === 1) player.nextStep();
  },
});
player.nextStep(); // render входит в другую команду и бросает ошибку
```

Запишите намерение в callback и выполните его после возврата внешней команды:

```js
let requestNext = false;
const player = createStatePlayer([0, 1, 2], {
  render(frame) {
    draw(frame);
    requestNext = frame.current === 1;
  },
});
player.nextStep();
if (requestNext && !player.finished) {
  requestNext = false;
  player.nextStep();
}
```

Можно запланировать работу на следующую microtask/событие, самостоятельно проверив
lifecycle и обработав позднюю ошибку. Библиотека не добавляет очередь и не ждёт
Promise из callback. Неперехваченный async callback не заменяет синхронный цикл
управления.

Чтения `frame`/`finished` разрешены; другим свободным плеером можно управлять.
Для текущего кандидата используйте аргумент frame/step callback: чтения не являются
транзакцией или барьером очистки. После начала логического disposal повторный
`dispose()` ничего не делает, в том числе из собственной очистки. Первый dispose
при обычном терминальном закрытии источника ещё защищён: закрытие источника и
логический disposal плеера различаются.

Перехваченный приложением внутренний отказ не завершает внешнюю операцию ошибкой.
Если он выходит из callback команды, работают прежние failure/disposal-правила:
исходная primary-ошибка сохраняется, очистка своего источника вызывается не более
одного раза. Для `nextStep`/`advance` проверка reentrancy предшествует валидации
аргумента; `dispose` сначала проверяет идемпотентность уже начатого disposal.
Ошибка getter при отдельном idle-чтении frame сама по себе не вызывает disposal.

Это контракт headless, не изменение guards `/player` и не изменение объединения
pending-чтений `createAsyncSource`. Полный [контракт U1](headless-reentrancy.md).

## U2: неверная скорость виджета даёт RangeError

`Player.setSpeed(value: number)` использует единый контракт для `source`, `history`,
`asyncSource` и нового `stepSource`, включая Worker. Sync/history уже давали `RangeError`; async/Worker
в 0.16.0 давали `TypeError`. Обновите зависящие от класса ошибки обработчики:

```js
try {
  ui.setSpeed(speed);
} catch (error) {
  if (error instanceof RangeError) showInvalidSpeed();
  else throw error;
}
```

Принимаются только примитивные конечные числа больше нуля, включая дроби и
конечные крайние значения. Ноль, минус ноль, отрицательные, NaN, бесконечности,
строки, boxed numbers и другие runtime-типы синхронно дают `RangeError` без
coercion, округления и ограничения диапазона. Тексты ошибок не стабилизируются.

Сначала проверяется значение, даже из render/status callbacks, во время подготовки/
очистки и после disposal: неверное даёт `RangeError`, верное подчиняется прежним
lifecycle/reentrancy guards. Сам отказ не меняет speed/frame/intent/time debt,
не вызывает callbacks, не получает/читает/закрывает источник, не создаёт Worker,
не шлёт сообщения и не планирует RAF. Если ошибка выходит из окружающего callback,
внешняя операция всё равно применяет обычные правила обработки ошибок.

Параметр, возвращаемый тип, начальная скорость `1` и учёт времени с верной
скоростью прежние. Headless `advance`, генератор и Worker не настраиваются этим
правилом. Полная матрица — в [U2](player-speed-validation.md).

## Данные и ошибки Worker

F1/F2 обеспечивают прежний запрет общей изменяемой памяти. Input/state-графы с
shared WebAssembly.Memory, её буфером, shared typed views/DataView и вложенными/
циклическими обёртками теперь завершаются serialization-ошибкой, в том числе без
SharedArrayBuffer при импорте. Передавайте обычные снимки приложения; новое view
над общей памятью не копирует байты:

```js
const bytes = Uint8Array.from(new Uint8Array(memory.buffer));
// bytes.buffer — обычный ArrayBuffer со снимком данных.
```

Согласованием конкурентных записей при создании снимка занимается приложение.
Обычный copy/явный ArrayBuffer transfer и сохранённые host-снимки имеют прежний
контракт. Неверная сериализация завершает сессию без скрытого повтора и без
восстановления уже затронутых ресурсов отправителя.

U5 постоянно проверяет прежнее поведение, не вводя новую обёртку: исключения
приложения и host postMessage могут быть любым `unknown`, включая `undefined`.
`instanceof WorkerSourceError` не охватывает их все. Init/pull сохраняют исходное
исключение с host/post-контекстом отчёта. Поздний cancel/cleanup-сбой не заменяет
прежнюю primary-ошибку; очистку смотрите в отдельном close-отчёте.
См. [контракт ошибок Worker](worker-post-errors.md).

## Стабильная поверхность и оставшиеся проверки

[Общая политика](api-compatibility.md) одинаково защищает восемь entry в 1.x,
включая public structural shapes, закрытые unions, приоритет ошибок и описанное
владение/timing. Optional-загрузка не означает experimental. Root/CommonJS,
публичных internal deep paths и cross-version Worker protocol обещания нет.
Host и endpoint используют одну версию пакета. Граница окружений прежняя;
подготовка кандидата не добавляет гарантию браузера, компилятора,
Node worker_threads, SharedWorker или ServiceWorker.
