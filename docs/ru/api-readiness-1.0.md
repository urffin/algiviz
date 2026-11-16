# Ревизия готовности восьми точек входа после F2

[English](../api-readiness-1.0.md) · [Текущий API](current-api.md) · [Совместимость](api-compatibility.md) · [Граница окружений](../support-matrix.md#current-support-boundary)

**Кандидат, 2026-11-16:** локально поручена [подготовка 1.0.0](candidate-1.0.md):
версия/lock, заметки, проверки и commit. Metadata — 1.0.0; [миграция](migration-1.0.md)
описывает U1/U2. Публикация не поручена. Ревизия ниже — историческая оценка с
metadata 0.16.0; статус кандидата заменяет формулировку ещё не начатого G1.
Raw-свидетельства сохранены.

**Повторная проверка 2026-11-14: готово к подготовке кандидата 1.0 в проверенных
границах.** Все восемь entry готовы локально; известных технических блокеров и
неразрешённых уточнений API из F1/F2 и U1–U5 не осталось. До релиза остаются выбор
кандидата, CI его точного состояния и native-проверки (G1–G3).

Проверено незакоммиченное рабочее дерево на базе
`12173e01b9e175f18ea63c6becf41eb7724a9c56`. В метаданных остаётся **0.16.0**;
неизменяемого кандидата 1.0 ещё нет. Ревизия меняет документацию и добавляет отчёт,
не меняя API, реализацию, тесты, workflows, зависимости и версию. Commit/push,
запуск CI и публикация не выполняются.

## Текущий результат по восьми entry

«Готово локально» означает отсутствие найденного обязательного изменения
API/реализации в описанных границах контракта и окружений. Это не сертификация
точного кандидата и не гарантия непроверенных браузеров.

| Entry | Runtime/type-only имён | Статус | Проверенный контракт и границы |
| --- | --- | --- | --- |
| /playback | 6 / 10 | Готово локально | Explicit/plain-state playback, timeline, emitter, ограниченная перемотка и async-владение/отмена; U1 защищает callbacks/getters, primary-ошибки и идемпотентный dispose. Декларации ES2022-only. [Справочник](playback.md) |
| /scene | 3 / 5 | Готово локально | Identity/type/layers, nullable enter/exit endpoints, pure projection и ограниченный matching-cache; снимки приложения неизменяемы. [Справочник](scene.md) |
| /array | 4 / 10 | Готово локально | Trace/event-семантика, immutable snapshots/IDs/counters/markers; общая U1-защита playback. ArrayEvent закрыт по U3. [Справочник](array.md) |
| /canvas | 3 / 4 | Готово локально | Alias identity renderer, копирование palette, bitmap-координаты, восстановление контекста и переиспользование dispatcher; размером владеет приложение. Нужен Canvas 2D. [Справочник](array.md#отрисовка-на-canvas) |
| /canvas/viewport | 1 / 3 | Готово локально | Явное владение CSS-высотой/bitmap/transform, независимая ширина, DPR, null/invalid sizes, invalidation и dispose; явно требуемые browser APIs. [Справочник](canvas-viewport.md) |
| /player | 1 / 4 | Готово локально | Sync/history/async/Worker controls, ограничение работы/перемотки, ожидание без polling, transactional Restart и closed-отчёты; U2 value-first RangeError и U5 error/cleanup-регрессии. DOM-виджет. [Справочник](player.md) |
| /worker | 2 / 17 | Готово локально | Lazy exclusive ownership, один pull, copy/transfer, F1/F2-запрет графов с общей памятью, исходные U5 host-post ошибки и ограниченное завершение/отчёты; host выделенного browser module Worker. [Справочник](worker-source-api.md#декларации-приложения-worker) |
| /worker/runtime | 1 / 15 | Готово локально | Явная установка endpoint/source, input/state-валидация с F1/F2, cancellation/return и ограниченная remote-диагностика; отдельная проверка WebWorker-деклараций. Host/endpoint одной версии. [Справочник](worker-source-api.md#декларации-worker-workerruntime) |

Свежий подсчёт подтвердил **21 runtime-имя, 68 type-only экспортов и
56 различных type-only имён**, как в прежней ревизии. 12 общих Worker-типов
учитываются по обоим путям. Новый запуск runtime-фикстуры проверяет точные
namespaces, alias identity renderer и запрет root/private paths без DOM/Worker
globals. Публичные сигнатуры прежние; ранее изменённый U1 приватный
state-steps.d.ts не является экспортированным путём.

## Статус F1/F2 и U1–U5

| Пункт | Текущее решение | Доказательство и объём |
| --- | --- | --- |
| F1 | Закрыт локально, без публикации | Общая WebAssembly.Memory storage отклоняется в input/state, включая вложенные/foreign instances; исходные восемь регрессий и шесть native-случаев. F2 сохраняет Memory-контроли. [Исправление](../checks/worker-memory-fix-2026-11-14.json) |
| F2 | Закрыт локально, без публикации | Нативная проверка типа без конструктора; buffers/views/вложенные и циклические графы отклоняются в обоих направлениях и на получателях. Copy/transfer, сохранённые состояния и очистка прежние. [Исправление](../checks/worker-shared-buffer-fix-2026-11-14.json), [34 native-случая](../checks/worker-shared-buffer-fix-browser-2026-11-14.json) |
| U1 | Закрыт локально, без публикации | Контракт повторного headless-управления/getters, приоритет primary-ошибки, независимые экземпляры и идемпотентный dispose; 61 публичный/installed случай. [Контракт](headless-reentrancy.md), [отчёт](../checks/u1-reentrancy-2026-11-14.json) |
| U2 | Закрыт локально, без публикации | Неверная скорость даёт RangeError до lifecycle guards, без coercion/эффектов; 55 публичных/installed случаев для всех источников и учёта времени. [Контракт](player-speed-validation.md), [отчёт](../checks/u2-speed-implementation-2026-11-14.json) |
| U3 | Политика выбрана | Равная защита восьми entry для будущей 1.x; определены public shapes/unions, ошибки, loading/environment и допустимые изменения. [Политика](api-compatibility.md) |
| U4 | Документация согласована | Текущие EN/RU-справочники отделены от прошлых проверок; эта ревизия заменяет таблицу до F2 и исправляет вводную support matrix. [Статус](current-api.md) |
| U5 | Закрыт локально с постоянным покрытием | Исходное host postMessage исключение остаётся unknown; init/pull primary, cancel/late/cleanup и transport/async/Player-отчёты покрыты 75 публичными/installed случаями. [Контракт](worker-post-errors.md), [отчёт](../checks/u5-post-errors-regressions-2026-11-14.json) |

## Проверки и их границы

Последние завершённые runtime-проверки — этап F2: **509 успешных тестов
репозитория**, installed TypeScript 6.0.3 NodeNext/Bundler consumers (раздельные
ES2022-only, DOM и WebWorker libs), новая bundle isolation и **34 native Worker
сценария**. Три родительских F2-теста запускают **121 изолированный публичный
сценарий** (41/41/39), также проверенный installed; дочерние случаи не прибавляются
к 509. Globals скрыты до импорта в контролируемых конфигурациях; это не обещание
новых host-окружений и не доказательство browser exploit.

Повторно сверены production/build/metadata-база F2, все 41 декларации сборки,
test/runner/native provenance и прежние implementation/regression-файлы U1/U2/U5.
Старые F1-хэши валидатора/private-теста и package runner заменены описанными
расширениями F2, а не новой регрессией. Полный набор, installed consumers, bundle
и браузер **не запускались повторно** ради этой ревизии документации. Свежий
подсчёт символов проверяет инвентарь, а не строгую компиляцию потребителей.

[Новый машинный отчёт](../checks/api-readiness-1.0-after-f2-2026-11-14.json) фиксирует новые проверки, неизменность
файлов и текущие решения. CI точного кандидата, новая registry-проверка и
native-сертификация всего кандидата не заявляются.

## Оставшиеся релизные шаги

Это релизные проверки, а не новые дефекты API и обязательные новые возможности.

| ID | Шаг | Что подтверждает завершение |
| --- | --- | --- |
| G1 | Определить и зафиксировать отдельно порученный кандидат | Выбрать версию по U3; согласовать package/lock/changelog и migration notes; закоммитить намеченные code/tests/docs и записать неизменяемые SHA/архив/хэши. Описать F1/F2-отклонение запрещённой общей памяти, U1-запрет команд из callbacks и U2 async/Worker TypeError → RangeError. Здесь metadata кандидата не готовится |
| G2 | Проверить именно этот кандидат локально и в CI | Repository, installed-package и bundle-проверки кандидата. Все **11 настроенных CI jobs** на его SHA: шесть Node 22/24/26 × Windows/Linux, четыре TypeScript 5.0.4/5.4.5/5.9.3/6.0.3 с NodeNext/Bundler, bundle isolation. Записать реальные версии/run URL/SHA; прежний релиз и проверки до кандидата не заменяют этот шаг |
| G3 | Проверить native-поведение того же кандидата | В прежней Windows built-in browser границе записать candidate/build/host-хэши и целевые minimal playback, scene enter/update/exit, Canvas/viewport sizing/disposal, Worker F1/F2 data/copy/transfer/cleanup и Player waiting/Pause/Next/Restart/dispose. Изменение source/артефакта отменяет затронутые результаты и требует соответствующих перепроверок |
| Публикация | Выпустить и проверить по отдельному поручению после G1–G3 | Сопоставить release tag/версию с проверенным SHA; использовать GitHub Release → npm workflow. Затем проверить успех workflow, точную registry-версию/latest, свежих installed consumers, source/archive/digest и signature/provenance. Publish workflow сам не требует успеха всех 11 CI jobs; CI точного SHA остаётся явным релизным условием |

Не обязательны промежуточный 0.x-релиз, новый алгоритм/renderer, квота внешних
пользователей и обновление сайта. Новые браузеры, Bun/Deno/CommonJS,
Node worker_threads и SharedWorker/ServiceWorker остаются вне этого объёма.
Новых обещаний поддержки и продолжающейся release automation нет.

## Исторические находки

[Исходная ревизия восьми entry](../api-readiness-0.16.0.md) и
[итоговый отчёт до F2](../checks/api-readiness-1.0-2026-11-14.json) сохраняют
свои результаты. Последний нашёл шесть готовых entry и две с требованием F2 по
20 контролируемым случаям до исправления. Отчёт закрытия F2 и эта ревизия заменяют
его открытый статус. Raw release/benchmark/audit JSON и исторические числа сохранены.
