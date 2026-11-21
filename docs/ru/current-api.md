# Текущий API и статус проверок

[English](../current-api.md) · [Совместимость](api-compatibility.md) · [Окружения](../support-matrix.md#current-support-boundary) · [Заметки к 1.6.0](release-1.6.md)

**Версия 1.6.0** содержит 16 точек входа, 34 экспорта времени выполнения и
189 экспортов типов (177 различных имён). Она добавляет необязательную функцию
`itemLabel` в Canvas-рендерер массива. Прежние импорты и опции совместимы.

[Отчёт о публикации 1.5.0](../releases/1.5.0.json) содержит результаты проверок
предыдущего релиза.

**1.6.0 опубликована.** Проверены все 11 задач CI, подпись реестра, provenance и README. [Отчёт проверки](../releases/1.6.0.json).

## Карта точек входа

| Entry | Справочник | Статус/первая версия |
| --- | --- | --- |
| /playback | [Playback](../playback.md), [перемотка](../rewind-buffer.md), [async](async-source-api.md) | 1.0.0 |
| /scene | [Сцены](../scene.md) | 1.0.0 |
| /array | [Массивы](array.md), [результат](array-result.md) | 1.0.0 |
| /canvas | [Canvas массива](array.md#отрисовка-на-canvas), [подписи элементов](array.md#подписи-элементов) | 1.0.0, подписи с 1.6.0 |
| /canvas/viewport | [Viewport](canvas-viewport.md) | 1.0.0 |
| /player | [Player](player.md), [явные шаги](player-step-source.md), [async](player-async-api.md), [Worker](player-worker.md) | 1.0.0 |
| /worker | [Worker source](worker-source-api.md) | 1.0.0 |
| /worker/runtime | [Worker endpoint](worker-source-api.md#декларации-worker-workerruntime) | 1.0.0 |
| /graph | [API графа](graph-api.md), [динамическая топология](graph-dynamic-topology.md), [подписи](graph-node-captions.md) | 1.1.0, динамические изменения с 1.5.0 |
| /canvas/graph | [Рендерер](graph-api.md), [переходы](graph-dynamic-canvas.md), [размещение](graph-node-captions.md) | 1.1.0, опция переходов топологии с 1.5.0 |
| /tree | [Tree API](tree-api.md) | 1.2.0 |
| /canvas/tree | [Tree Canvas](tree-canvas-api.md) | 1.2.0 |
| /grid | [Grid API](grid-api.md) | 1.3.0 |
| /canvas/grid | [Grid Canvas](grid-canvas-api.md) | 1.3.0 |
| /list | [API списка](list-api.md) | 1.4.0 |
| /canvas/list | [Canvas списка](list-canvas-api.md) | 1.4.0 |

## Пример и проверки

[Пример пирамидальной сортировки](examples.md#пирамидальная-сортировка-с-player)
показывает, зачем массиву нужна отдельная отрисовка плиток в точке пересечения
подписей. [Ревизия готовности 1.6.0](readiness-1.6.md) фиксирует сравнение
рендереров и проверки совместимости с 1.5.0.

## Исторические доказательства

Датированные документы и JSON не переписываются задним числом. Их старые статусы
«локально», «кандидат», «baseline 0.16.0» относятся к этапу проверки.
API-контракт 1.6.0 описан в этом индексе и связанных справочниках.

- [Кандидат 1.0](candidate-1.0.md), [готовность ядра](core-readiness-1.0.md), [миграция](migration-1.0.md).
- F1/F2: [ошибка Memory](../checks/worker-memory-fix-2026-11-14.json), [отсутствующий SharedArrayBuffer](../checks/worker-shared-buffer-fix-2026-11-14.json).
- U1/U2/U5: [повторное управление](headless-reentrancy.md), [скорость](player-speed-validation.md), [host postMessage](worker-post-errors.md).
- [Первый Graph API](../checks/graph-implementation-2026-11-17.json), [первый Canvas](../checks/graph-canvas-implementation-2026-11-17.json), [подписи](../checks/graph-node-captions-implementation-2026-11-17.json).

Headless-модули требуют ES2022 declarations; Canvas/Player/viewport/Worker-host —
DOM, endpoint — отдельно WebWorker. Импорт необязательных модулей не обращается к
DOM globals; вызов требует своего host. Root/CommonJS/deep imports не добавляются.
Необязательная загрузка не означает экспериментальный API. Новые entry получают
ту же защиту 1.x при выпуске; протокол Worker приватен, host/endpoint одной версии.
