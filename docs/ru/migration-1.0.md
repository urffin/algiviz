# Миграция с 0.16.0 на 1.0.0

[English](../migration-1.0.md) · [Совместимость](api-compatibility.md) · [Статус кандидата](candidate-1.0.md)

**1.0.0 — подготовленный локально, неопубликованный кандидат.** Здесь описаны
отличия от выпущенной 0.16.0. До релиза нужны CI и native-проверки именно кандидата.
Новых публичных методов, опций, status-полей, типов и экспортов не требуется.
Восемь ESM-путей и отсутствие runtime-зависимостей сохранены.

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

`Player.setSpeed(value: number)` использует единый контракт для `source`, `history`
и `asyncSource`, включая Worker. Sync/history уже давали `RangeError`; async/Worker
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

Оставшиеся CI/native-проверки точного SHA — в [статусе кандидата](candidate-1.0.md).
Эти заметки не объявляют 1.0.0 опубликованной.
