# Текущий API и статус проверок

[English](../current-api.md) · [Совместимость](api-compatibility.md) · [Окружения](../support-matrix.md#current-support-boundary) · [Готовность 1.1](graph-readiness-1.1.md)

**Ревизия 2026-11-17.** Релизная база — 1.0.0 с коммита 3977c78. Она содержит
восемь точек входа. Рабочее дерево добавляет /graph и /canvas/graph в **кандидате
1.1.0**; package.json и оба корневых поля lockfile равны 1.1.0. Кандидат ещё не
опубликован. [Описание кандидата](candidate-1.1.md) фиксирует локальные проверки
и требование CI точного SHA. Свежая проверка npm latest здесь не заявляется.

F1/F2, U1/U2/U5, stepSource/isTerminal и done({ result }) входят в 1.0.0.
Они больше не являются локальными неопубликованными изменениями. Для перехода
с 0.16.0 см. [миграцию 1.0](migration-1.0.md). Восемь прежних реализаций и их
export-map записи не менялись после 3977c78; графовые API — новые отдельные entry.

## Опубликованное и локальное

| Область | Текущий статус |
| --- | --- |
| Релизная база | 1.0.0: 8 entry, 21 runtime-имя, 69 type-only экспортов, 57 различных типов |
| Рабочее дерево | 10 entry, 24 runtime-имени, 95 type-only экспортов, 83 различных типа |
| /graph | Локально реализован, не опубликован: createGraphTrace, graphScene и 22 типа; фиксированная топология, ID, отметки, подписи, результат, атомарная валидация |
| /canvas/graph | Локально реализован, не опубликован: createGraphRenderer и 4 типа; стрелки/петли/параллельные рёбра, интерполяция, зелёный результат, подписи и явный логический размер |
| BFS | Два прикладных примера с общим алгоритмом/Player: [подробный](../../examples/graph.html) и [штатный renderer](../../examples/graph-player.html); это не экспорт алгоритма библиотеки |
| Дерево/сетка/список | Только [контракты](tree-contract.md), [проверки](grid-contract.md) [совместимости с ядром](linked-list-contract.md); новых entry/реализаций нет |

## Справочники: восемь опубликованных и две локальные точки входа

| Entry | Справочник | Статус |
| --- | --- | --- |
| /playback | [Playback](../playback.md), [перемотка](../rewind-buffer.md), [async](async-source-api.md) | 1.0.0; без изменений |
| /scene | [Сцены](../scene.md) | 1.0.0; без изменений |
| /array | [Массивы](array.md), [результат](array-result.md) | 1.0.0; без изменений |
| /canvas | [Canvas массива](array.md#отрисовка-на-canvas) | 1.0.0; без изменений |
| /canvas/viewport | [Viewport](canvas-viewport.md) | 1.0.0; без изменений |
| /player | [Player](player.md), [явные шаги](player-step-source.md), [async](player-async-api.md), [Worker](player-worker.md) | 1.0.0; без изменений |
| /worker | [Worker source](worker-source-api.md) | 1.0.0; без изменений |
| /worker/runtime | [Worker endpoint](worker-source-api.md#декларации-worker-workerruntime) | 1.0.0; без изменений |
| /graph | [Graph API](graph-api.md), [подписи](graph-node-captions.md) | Локально, целевая 1.1.0 |
| /canvas/graph | [Рендерер](graph-api.md), [размещение](graph-node-captions.md) | Локально, целевая 1.1.0 |

## Проверенное состояние и следующие шаги

Сохранённые проверки текущей реализации: 595 repository tests, installed consumers
на TypeScript 5.0.4/5.4.5/5.9.3/6.0.3 (NodeNext/Bundler, ES2022/DOM/WebWorker),
26 bundle-вариантов, 31 автоматическая Canvas-проверка и 7 проверок страницы BFS.
[Отчёт подписей](../checks/graph-node-captions-implementation-2026-11-17.json)
фиксирует эти исходники; [итоговая ревизия](graph-readiness-1.1.md) проверяет
их соответствие рабочему дереву и границы доказательств. Это не CI для будущего
коммита 1.1.0 и не новая гарантия каждого браузера/шрифта.

Версия/lockfile/changelog/release-facing docs подготовлены для 1.1.0. Кандидат
нужно закоммитить/отправить и дождаться всех 11 CI jobs точного SHA. Тег/GitHub
Release, публикация workflow и проверка npm version/latest/provenance остаются
следующим отдельно порученным этапом. Полный список
и условия повторного использования проверок — в [ревизии 1.1](graph-readiness-1.1.md).

## Исторические доказательства

Датированные документы и JSON не переписываются задним числом. Их старые статусы
«локально», «кандидат», «baseline 0.16.0» относятся к этапу проверки, не к текущей
доступности 1.0.0. Статус релизной базы берётся из этого индекса.

- [Кандидат 1.0](candidate-1.0.md), [готовность ядра](core-readiness-1.0.md), [миграция](migration-1.0.md).
- F1/F2: [ошибка Memory](../checks/worker-memory-fix-2026-11-14.json), [отсутствующий SharedArrayBuffer](../checks/worker-shared-buffer-fix-2026-11-14.json).
- U1/U2/U5: [повторное управление](headless-reentrancy.md), [скорость](player-speed-validation.md), [host postMessage](worker-post-errors.md).
- [Первый Graph API](../checks/graph-implementation-2026-11-17.json), [первый Canvas](../checks/graph-canvas-implementation-2026-11-17.json), [подписи](../checks/graph-node-captions-implementation-2026-11-17.json).

Headless-модули требуют ES2022 declarations; Canvas/Player/viewport/Worker-host —
DOM, endpoint — отдельно WebWorker. Импорт необязательных модулей не обращается к
DOM globals; вызов требует своего host. Root/CommonJS/deep imports не добавляются.
Необязательная загрузка не означает экспериментальный API. Новые entry получают
ту же защиту 1.x при выпуске; протокол Worker приватен, host/endpoint одной версии.
