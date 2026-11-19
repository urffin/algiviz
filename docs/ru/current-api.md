# Текущий API и статус проверок

[English](../current-api.md) · [Совместимость](api-compatibility.md) · [Окружения](../support-matrix.md#current-support-boundary) · [Релиз 1.1](release-1.1.md)

**Выпущено 2026-11-17.** Релизная база — **1.1.0** с
629defe2eb570034ea368d736c1e5fdf74ea3502. Все десять entry, включая /graph и
/canvas/graph, опубликованы. Metadata на этапе того выпуска — 1.1.0.
[Отчёт выпуска](../releases/1.1.0.json) фиксирует успешные CI точного SHA и
публикацию, свежую проверку exact version/latest, установку и provenance.
Закрытие документации использует наблюдения завершённой задачи выпуска.
Рабочая копия дополнительно реализует неопубликованные /tree и /canvas/tree:
**12 локальных entry, 27 runtime-имён, 128 type-only экспортов (116 различных)**;
в неопубликованном [кандидате 1.2.0](candidate-1.2.md). Версии package и обоих
корневых полей lockfile теперь 1.2.0.

F1/F2, U1/U2/U5, stepSource/isTerminal и done({ result }) выпущены с 1.0.0.
Восемь прежних реализаций/export-map записей не менялись в 1.1.0; миграция прежних
импортов не нужна. Графовые импорты требуют 1.1.0.

## Опубликованное и будущие проекты

| Область | Текущий статус |
| --- | --- |
| Релизная база | 1.1.0: 10 entry, 24 runtime-имени, 95 type-only экспортов, 83 различных типа |
| /graph | Опубликован: createGraphTrace, graphScene и 22 типа; фиксированная топология, ID, отметки, подписи, результат, атомарная валидация |
| /canvas/graph | Опубликован: createGraphRenderer и 4 типа; стрелки, петли, параллельные рёбра, интерполяция, результат и подписи |
| BFS | Два примера репозитория: [подробный](../../examples/graph.html) и [штатный](../../examples/graph-player.html); экспорт алгоритма не добавлен |
| /tree | [Реализован локально, не опубликован](tree-api.md): createTreeTrace, treeScene и 29 типов; атомарный edit топологии, явная раскладка, ordered/binary slots и выбывание ID |
| /canvas/tree | [Реализован локально, не опубликован](tree-canvas-api.md): createTreeRenderer и четыре типа; ordered/binary layout, пустые слоты, прикреплённые crossfade-связи, подписи и зелёный результат. [T1 закрыт](tree-readiness-1.2.md): учитываются полные painted bounds квадрата |
| Примеры дерева | [Штатная вставка/поворот и Player](../../examples/tree-player.html), плюс сохранённый [собственный обход](../../examples/tree.html) |
| Сетка/список | Только архитектурные [эскизы сетки](grid-contract.md) и [списка](linked-list-contract.md); entry нет |

## Справочники: десять опубликованных путей

| Entry | Справочник | Статус |
| --- | --- | --- |
| /playback | [Playback](../playback.md), [перемотка](../rewind-buffer.md), [async](async-source-api.md) | 1.0.0; без изменений в 1.1.0 |
| /scene | [Сцены](../scene.md) | 1.0.0; без изменений в 1.1.0 |
| /array | [Массивы](array.md), [результат](array-result.md) | 1.0.0; без изменений в 1.1.0 |
| /canvas | [Canvas массива](array.md#отрисовка-на-canvas) | 1.0.0; без изменений в 1.1.0 |
| /canvas/viewport | [Viewport](canvas-viewport.md) | 1.0.0; без изменений в 1.1.0 |
| /player | [Player](player.md), [явные шаги](player-step-source.md), [async](player-async-api.md), [Worker](player-worker.md) | 1.0.0; без изменений в 1.1.0 |
| /worker | [Worker source](worker-source-api.md) | 1.0.0; без изменений в 1.1.0 |
| /worker/runtime | [Worker endpoint](worker-source-api.md#декларации-worker-workerruntime) | 1.0.0; без изменений в 1.1.0 |
| /graph | [Graph API](graph-api.md), [подписи](graph-node-captions.md) | 1.1.0; опубликован |
| /canvas/graph | [Рендерер](graph-api.md), [размещение](graph-node-captions.md) | 1.1.0; опубликован |

## Проверки и следующая работа

Все [11 CI jobs](https://github.com/urffin/algiviz/actions/runs/44164521486) прошли
на релизном SHA. [Publish workflow](https://github.com/urffin/algiviz/actions/runs/44165469767)
успешен; проверены npm exact 1.1.0/latest, свежая установка, все 86 dist-файлов и
криптографические registry signature/provenance. Счётчики и ограничения — в
[отчёте](../releases/1.1.0.json); implementation/native-доказательства исторические.

Релизные шаги 1.1 завершены. Локальные [tree](tree-api.md) и [tree Canvas](tree-canvas-api.md)
проверены отдельно, включая native Canvas. Добавлен [штатный пример вставки/поворота](../../examples/tree-player.html)
рядом с собственным обходом. [Ревизия к 1.2.0](tree-readiness-1.2.md) завершена:
[T1 исправлен](../checks/tree-t1-fix-2026-11-19.json), затронутая Canvas/example-
приёмка обновлена. [Кандидат 1.2.0](candidate-1.2.md) фиксирует локальную подготовку
и проверку архива. До отдельно разрешённого выпуска нужны все 11 jobs на итоговом
коммите; 1.2.0 пока не опубликована.
Документы кандидата/готовности сохраняют объём предшествующей подготовки.

## Исторические доказательства

Датированные документы и JSON не переписываются задним числом. Их старые статусы
«локально», «кандидат», «baseline 0.16.0» относятся к этапу проверки, не к текущей
доступности 1.1.0. Статус релизной базы берётся из этого индекса.

- [Кандидат 1.0](candidate-1.0.md), [готовность ядра](core-readiness-1.0.md), [миграция](migration-1.0.md).
- F1/F2: [ошибка Memory](../checks/worker-memory-fix-2026-11-14.json), [отсутствующий SharedArrayBuffer](../checks/worker-shared-buffer-fix-2026-11-14.json).
- U1/U2/U5: [повторное управление](headless-reentrancy.md), [скорость](player-speed-validation.md), [host postMessage](worker-post-errors.md).
- [Первый Graph API](../checks/graph-implementation-2026-11-17.json), [первый Canvas](../checks/graph-canvas-implementation-2026-11-17.json), [подписи](../checks/graph-node-captions-implementation-2026-11-17.json).

Headless-модули требуют ES2022 declarations; Canvas/Player/viewport/Worker-host —
DOM, endpoint — отдельно WebWorker. Импорт необязательных модулей не обращается к
DOM globals; вызов требует своего host. Root/CommonJS/deep imports не добавляются.
Необязательная загрузка не означает экспериментальный API. Новые entry получают
ту же защиту 1.x при выпуске; протокол Worker приватен, host/endpoint одной версии.
