# Текущий API и статус проверок

[English](../current-api.md) · [Совместимость](api-compatibility.md) · [Окружения](../support-matrix.md#current-support-boundary) · [Релиз 1.2](release-1.2.md)

**Выпущено 2026-11-19.** База — **1.2.0** с 8e1f50b3fb0a565e1634066ebd9e3e32dd0ced1f.
Опубликованы все **12 entry, 27 runtime-имён, 128 type-only экспортов (116 различных)**.
Package и оба корневых поля lockfile содержат 1.2.1 для
[документационного патча](release-1.2.1.md); API 1.2.0 не меняется.
[Отчёт выпуска 1.2.0](../releases/1.2.0.json)
фиксирует CI 11/11, OIDC-публикацию, exact npm/latest, свежую установку и проверку
подписи/provenance завершённой задачи. Это документальное закрытие, не свежий lookup.
Десяти прежним импортам миграция не нужна; импорты дерева требуют 1.2.0.

## Выпущенная поверхность и будущие проекты

| Область | Текущий статус |
| --- | --- |
| Массив/playback/scenes/Player/Worker | Выпущены с 1.0.0; F1/F2, U1/U2/U5, stepSource/isTerminal и done({ result }) входят в стабильный контракт |
| /graph и /canvas/graph | Выпущены с 1.1.0: фиксированная топология, ID, отметки/подписи/результат, штатный Canvas |
| /tree | Выпущен с 1.2.0: createTreeTrace, treeScene и 29 типов; атомарный edit, ordered/binary slots и выбывание ID |
| /canvas/tree | Выпущен с 1.2.0: createTreeRenderer и четыре типа; layout, пустые слоты, crossfade-связи, подписи и зелёный результат; T1 закрыт до релиза |
| Примеры | Собственные и штатные BFS/дерево сохранены отдельно; алгоритмы примеров не экспортируются |
| Будущий /grid | [Публичный контракт](grid-api.md): фиксированная форма, координаты, generic values, атомарные операции, результат и путь; без реализации/exports |
| Будущий /canvas/grid | Только граница backend в контракте grid; полный API renderer ещё предстоит определить |
| Список | [Архитектурный эскиз](linked-list-contract.md); entry нет |

## Карта двенадцати опубликованных entry

| Entry | Справочник | Статус |
| --- | --- | --- |
| /playback | [Playback](../playback.md), [перемотка](../rewind-buffer.md), [async](async-source-api.md) | 1.0.0; без изменений в 1.2.0 |
| /scene | [Сцены](../scene.md) | 1.0.0; без изменений в 1.2.0 |
| /array | [Массивы](array.md), [результат](array-result.md) | 1.0.0; без изменений в 1.2.0 |
| /canvas | [Canvas массива](array.md#отрисовка-на-canvas) | 1.0.0; без изменений в 1.2.0 |
| /canvas/viewport | [Viewport](canvas-viewport.md) | 1.0.0; без изменений в 1.2.0 |
| /player | [Player](player.md), [явные шаги](player-step-source.md), [async](player-async-api.md), [Worker](player-worker.md) | 1.0.0; без изменений в 1.2.0 |
| /worker | [Worker source](worker-source-api.md) | 1.0.0; без изменений в 1.2.0 |
| /worker/runtime | [Worker endpoint](worker-source-api.md#декларации-worker-workerruntime) | 1.0.0; без изменений в 1.2.0 |
| /graph | [Graph API](graph-api.md), [подписи](graph-node-captions.md) | 1.1.0; опубликован |
| /canvas/graph | [Рендерер](graph-api.md), [размещение](graph-node-captions.md) | 1.1.0; опубликован |
| /tree | [Tree API](tree-api.md) | 1.2.0; опубликован |
| /canvas/tree | [Tree Canvas](tree-canvas-api.md) | 1.2.0; опубликован |

## Проверки и следующий шаг

Все [11 CI jobs](https://github.com/urffin/algiviz/actions/runs/44607527511) и
[publish workflow](https://github.com/urffin/algiviz/actions/runs/44608620588) успешны
на 8e1f50b. Проверены exact 1.2.0/latest, все 12 импортов и подпись/provenance.
Все 106 dist-файлов совпадают с кандидатом после нормализации переводов строк;
105 совпадают побайтово. Подробнее — [выпуск 1.2](release-1.2.md).
Кандидаты и датированные implementation/native-отчёты сохраняют исторический объём.
README/changelog внутри npm 1.2.0 сохранили устаревший статус кандидата; нынешняя
репозиторная документация исправляет его без замены опубликованного архива.

Следующее направление — [grid API](grid-api.md). Его декларации проверяются
изолированно; ни модуль, ни package stub не добавлены. Полные опции/сигнатуры
Canvas выбираются до его реализации. Grid/list не требуют менять API ядра.

## Исторические доказательства

Датированные документы и JSON не переписываются задним числом. Их старые статусы
«локально», «кандидат», «baseline 0.16.0» относятся к этапу проверки, не к текущей
доступности 1.2.0. Статус релизной базы берётся из этого индекса.

- [Кандидат 1.0](candidate-1.0.md), [готовность ядра](core-readiness-1.0.md), [миграция](migration-1.0.md).
- F1/F2: [ошибка Memory](../checks/worker-memory-fix-2026-11-14.json), [отсутствующий SharedArrayBuffer](../checks/worker-shared-buffer-fix-2026-11-14.json).
- U1/U2/U5: [повторное управление](headless-reentrancy.md), [скорость](player-speed-validation.md), [host postMessage](worker-post-errors.md).
- [Первый Graph API](../checks/graph-implementation-2026-11-17.json), [первый Canvas](../checks/graph-canvas-implementation-2026-11-17.json), [подписи](../checks/graph-node-captions-implementation-2026-11-17.json).

Headless-модули требуют ES2022 declarations; Canvas/Player/viewport/Worker-host —
DOM, endpoint — отдельно WebWorker. Импорт необязательных модулей не обращается к
DOM globals; вызов требует своего host. Root/CommonJS/deep imports не добавляются.
Необязательная загрузка не означает экспериментальный API. Новые entry получают
ту же защиту 1.x при выпуске; протокол Worker приватен, host/endpoint одной версии.
