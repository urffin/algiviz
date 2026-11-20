# Текущий API и статус проверок

[English](../current-api.md) · [Совместимость](api-compatibility.md) · [Окружения](../support-matrix.md#current-support-boundary) · [Релиз/миграция 1.3.0](release-1.3.md) · [Патч 1.3.1](release-1.3.1.md)

**Версия пакета 1.3.1; API сохранён из 1.3.0:** 14 entry, 30 runtime-имён, 155 type-only экспортов
(143 различных). /grid добавляет createGridTrace, gridScene и 22 типа;
/canvas/grid — createGridRenderer и пять типов. Прежние двенадцать entry
не меняются и не требуют миграции. Grid imports требуют 1.3.0 или новее.

Функциональная релизная база — **1.3.0 / 90b26f8**. Все 11 CI jobs, публикация,
exact/latest, свежая установка, подпись, provenance и README проверены;
[заметки релиза](release-1.3.md) и [отчёт](../releases/1.3.0.json) фиксируют факты.
1.3.1 исправляет документацию; её собственные проверки публикации фиксируются
в [заметках патча](release-1.3.1.md), не выводятся из результатов 1.3.0.

## Карта четырнадцати entry

| Entry | Справочник | Статус/первая версия |
| --- | --- | --- |
| /playback | [Playback](../playback.md), [перемотка](../rewind-buffer.md), [async](async-source-api.md) | 1.0.0; без изменений в 1.3.1 |
| /scene | [Сцены](../scene.md) | 1.0.0; без изменений в 1.3.1 |
| /array | [Массивы](array.md), [результат](array-result.md) | 1.0.0; без изменений в 1.3.1 |
| /canvas | [Canvas массива](array.md#отрисовка-на-canvas) | 1.0.0; без изменений в 1.3.1 |
| /canvas/viewport | [Viewport](canvas-viewport.md) | 1.0.0; без изменений в 1.3.1 |
| /player | [Player](player.md), [явные шаги](player-step-source.md), [async](player-async-api.md), [Worker](player-worker.md) | 1.0.0; без изменений в 1.3.1 |
| /worker | [Worker source](worker-source-api.md) | 1.0.0; без изменений в 1.3.1 |
| /worker/runtime | [Worker endpoint](worker-source-api.md#декларации-worker-workerruntime) | 1.0.0; без изменений в 1.3.1 |
| /graph | [Graph API](graph-api.md), [подписи](graph-node-captions.md) | 1.1.0; опубликован |
| /canvas/graph | [Рендерер](graph-api.md), [размещение](graph-node-captions.md) | 1.1.0; опубликован |
| /tree | [Tree API](tree-api.md) | 1.2.0; опубликован |
| /canvas/tree | [Tree Canvas](tree-canvas-api.md) | 1.2.0; опубликован |
| /grid | [Grid API](grid-api.md) | 1.3.0 |
| /canvas/grid | [Grid Canvas](grid-canvas-api.md) | 1.3.0 |

## Примеры и проверка

Отдельный [BFS на сетке](examples.md#кратчайший-путь-bfs-на-сетке) использует /grid,
/canvas/grid и Player: расстояния, зелёный кратчайший путь, историю/ограниченную
перемотку и Restart. Прежний лабиринт, custom/stock BFS графа и оба дерева
сохраняются. Прикладные алгоритмы не экспортируются и не входят в npm-архив.

[Ревизия](grid-readiness-1.3.md) закрывает R0 и D1/D2 документации.
[Подготовка кандидата](../checks/candidate-1.3.0-2026-11-20.json) фиксирует R1/R2:
версию/lockfile, точный архив, свежие тесты/installed consumers/bundles, сверку
EN/RU README/changelog внутри архива и identity native-доказательств.
Прежние [18 renderer](../checks/grid-canvas-browser-2026-11-20.json) и
[23 UI-проверки BFS](../checks/grid-player-example-2026-11-20.json) переиспользуются
для неизменного runtime; HTML меняет только текст версии. Старые отчёты не
переписываются как свежие прогоны. Поддержка браузеров не расширяется.

R3 и R4 релиза 1.3.0 завершены: [все 11 jobs](https://github.com/urffin/algiviz/actions/runs/44642599848)
на точном SHA и [отчёт публикации](../releases/1.3.0.json). Эти результаты
не переносятся автоматически на последующие версии. Связный список остаётся
архитектурным эскизом, а не экспортируемым entry.

## Исторические доказательства

Датированные документы и JSON не переписываются задним числом. Их старые статусы
«локально», «кандидат», «baseline 0.16.0» относятся к этапу проверки, не к API-контракту 1.3.0. Статус релизной базы берётся из этого индекса.

- [Кандидат 1.0](candidate-1.0.md), [готовность ядра](core-readiness-1.0.md), [миграция](migration-1.0.md).
- F1/F2: [ошибка Memory](../checks/worker-memory-fix-2026-11-14.json), [отсутствующий SharedArrayBuffer](../checks/worker-shared-buffer-fix-2026-11-14.json).
- U1/U2/U5: [повторное управление](headless-reentrancy.md), [скорость](player-speed-validation.md), [host postMessage](worker-post-errors.md).
- [Первый Graph API](../checks/graph-implementation-2026-11-17.json), [первый Canvas](../checks/graph-canvas-implementation-2026-11-17.json), [подписи](../checks/graph-node-captions-implementation-2026-11-17.json).

Headless-модули требуют ES2022 declarations; Canvas/Player/viewport/Worker-host —
DOM, endpoint — отдельно WebWorker. Импорт необязательных модулей не обращается к
DOM globals; вызов требует своего host. Root/CommonJS/deep imports не добавляются.
Необязательная загрузка не означает экспериментальный API. Новые entry получают
ту же защиту 1.x при выпуске; протокол Worker приватен, host/endpoint одной версии.
