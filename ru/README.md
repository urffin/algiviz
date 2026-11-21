# AlgiViz

[English](../README.md)

**Ваши алгоритмы и объекты. Пошаговое воспроизведение и собственная отрисовка.**

TypeScript-библиотека для интерактивного объяснения алгоритмов. Напишите алгоритм
как генератор, выдавайте неизменяемые состояния и определяйте внешний вид объектов.
AlgiViz управляет воспроизведением и сопоставляет объекты сцен; операции над массивами
и готовый Canvas-рендерер помогают начать работу.

[Интерактивная сортировка](https://grundyjs.ru/algorithms/insertion-sort/) ·
[Обзор библиотеки](https://grundyjs.ru/algiviz/) ·
[Пакет npm](https://www.npmjs.com/package/@grundyjs/algiviz) ·
[Начало работы](https://github.com/urffin/algiviz/blob/master/docs/ru/getting-started.md)

- **Ваш алгоритм:** вы управляете циклами, условиями и порядком операций.
- **Ваши объекты:** определяйте собственные типы и обработчики для Canvas, SVG или другой среды отрисовки.
- **Два режима воспроизведения:** сохраняйте историю для перемотки или читайте генератор,
  оставляя соседние снимки или ограниченное окно при включённой перемотке.
- **Без зависимостей во время выполнения:** ESM и декларации TypeScript;
  воспроизведение работает без DOM, React и Next.js.

Используйте библиотеку для учебных примеров, интерактивных статей и пошаговых разборов.
Алгоритмы и расположение объектов остаются в приложении; AlgiViz предоставляет API
воспроизведения и отрисовки.

Версия **1.7.0** добавляет `stepHistory` в `Player`. Явные шаги можно записать
вместе с событиями и перематывать по времени. Кадр сохраняет событие и исходный
индекс целевого шага.
[Полная история шагов](https://github.com/urffin/algiviz/blob/master/docs/ru/player.md#полная-история-шагов) ·
[Заметки к выпуску](https://github.com/urffin/algiviz/blob/master/docs/ru/release-1.7.md) ·
[Текущий API](https://github.com/urffin/algiviz/blob/master/docs/ru/current-api.md)

## Установка

```sh
npm install @grundyjs/algiviz
```

Пакет использует отдельные точки входа ESM. Корневой точки входа и сборки
CommonJS нет. Версия 1.7.0 содержит 16 точек входа:
`/player`, `/playback`, `/scene`, `/array`, `/canvas`, `/canvas/viewport`,
`/worker`, `/worker/runtime`, `/graph`, `/canvas/graph`, `/tree`, `/canvas/tree`,
`/grid`, `/canvas/grid`, `/list` и `/canvas/list`.

Модули графа доступны с 1.1.0, дерева — с 1.2.0, сетки — с 1.3.0, списка — с 1.4.0.
Алгоритмы находятся в коде приложения и примерах. Совместимые возможности выходят
в minor по [политике 1.x](https://github.com/urffin/algiviz/blob/master/docs/ru/api-compatibility.md);
при обновлении сверяйтесь с [CHANGELOG.md](../CHANGELOG.md).

## Quickstart: поиск минимума на Canvas

Главный quickstart использует `stepSource`/`isTerminal` и `done({ result })`, доступные
в 1.0.0. Инструкция устанавливает точную npm-версию 1.0.0 в отдельное приложение;
клонировать репозиторий для quickstart не требуется.

[Скопируйте один полный HTML и точные команды запуска](https://github.com/urffin/algiviz/blob/master/docs/ru/getting-started.md).
Однопроходный поиск минимума сравнивает [7,3,5,2,6]. Операции массива создают снимки,
штатный рендерер рисует Canvas, Player даёт Start/Next/Restart. Ответ остаётся
видимым: “Minimum: 2”, столбец минимума — зелёным. Пример для фиксированного
непустого массива занимает 28 непустых строк JS; сам алгоритм принадлежит приложению.

[Сравнение Player и одной кнопки](https://github.com/urffin/algiviz/blob/master/docs/ru/quickstart-comparison.md)
и [пошаговая инструкция](https://github.com/urffin/algiviz/blob/master/docs/ru/learning-path.md):
обычные состояния/pre → createArrayPlayer → готовый Player → сцены/интерполяция.

## Модули и документация

| Модуль | Назначение | Первый выпуск 1.x |
| --- | --- | --- |
| [`/playback`](https://github.com/urffin/algiviz/blob/master/docs/playback.md) | Шаги, плееры, история, завершение и жизненный цикл | 1.0.0 |
| [`/scene`](https://github.com/urffin/algiviz/blob/master/docs/scene.md) | Собственные типы, сопоставление объектов и проекция | 1.0.0 |
| [`/array`](https://github.com/urffin/algiviz/blob/master/docs/ru/array.md) | Неизменяемые операции массива, отметки и результат | 1.0.0 |
| [`/canvas`](https://github.com/urffin/algiviz/blob/master/docs/ru/array.md) | Готовый Canvas-рендерер массива и палитры. Настраиваемые подписи элементов с 1.6.0 | 1.0.0 |
| [`/canvas/viewport`](https://github.com/urffin/algiviz/blob/master/docs/ru/canvas-viewport.md) | CSS-размеры Canvas, DPR и очистка | 1.0.0 |
| [`/player`](https://github.com/urffin/algiviz/blob/master/docs/ru/player.md) | Необязательный виджет Player, медиапанель, запись/поток, загрузка по запросу | 1.0.0 |
| [`/worker`](https://github.com/urffin/algiviz/blob/master/docs/ru/worker-source-api.md) | Фабрика выделенного браузерного Worker и ошибки транспорта | 1.0.0 |
| [`/worker/runtime`](https://github.com/urffin/algiviz/blob/master/docs/ru/worker-source-api.md) | Endpoint внутри Worker; отдельные типы WebWorker | 1.0.0 |
| [`/graph`](https://github.com/urffin/algiviz/blob/master/docs/ru/graph-api.md) | Шаги графа, отметки, подписи, результат и сцена. Динамические изменения с 1.5.0 | 1.1.0 |
| [`/canvas/graph`](https://github.com/urffin/algiviz/blob/master/docs/ru/graph-api.md) | Стрелки, петли, параллельные рёбра и подписи. Опция переходов топологии с 1.5.0 | 1.1.0 |
| [`/tree`](https://github.com/urffin/algiviz/blob/master/docs/ru/tree-api.md) | Ordered/binary trace, атомарный edit топологии и проекция сцены | 1.2.0 |
| [`/canvas/tree`](https://github.com/urffin/algiviz/blob/master/docs/ru/tree-canvas-api.md) | Явная раскладка дерева, пустые слоты, интерполяция связей, подписи и результат | 1.2.0 |
| [`/grid`](https://github.com/urffin/algiviz/blob/master/docs/ru/grid-api.md) | Плотная сетка, атомарные операции, отметки, результат/путь и сцена | 1.3.0 |
| [`/canvas/grid`](https://github.com/urffin/algiviz/blob/master/docs/ru/grid-canvas-api.md) | Регулярные клетки, значения/подписи, зелёный результат и пути | 1.3.0 |
| [`/list`](https://github.com/urffin/algiviz/blob/master/docs/ru/list-api.md) | Односвязные списки со стабильными ID узлов и слотов, атомарными изменениями и результатами | 1.4.0 |
| [`/canvas/list`](https://github.com/urffin/algiviz/blob/master/docs/ru/list-canvas-api.md) | Раскладка, анимация указателей, head и null, подписи и зелёный результат | 1.4.0 |

[API динамического графа](https://github.com/urffin/algiviz/blob/master/docs/ru/graph-dynamic-topology.md) ·
[Переходы Canvas](https://github.com/urffin/algiviz/blob/master/docs/ru/graph-dynamic-canvas.md).

Headless-модули не требуют DOM. Canvas/Player/viewport и Worker-host требуют своих
host и DOM-типов; endpoint Worker — WebWorker-типов. Безопасный импорт не заменяет
host для вызова. [Граница окружений](https://github.com/urffin/algiviz/blob/master/docs/support-matrix.md#current-support-boundary).

[Полный пример TypeScript](https://github.com/urffin/algiviz/blob/master/examples/custom-objects.ts) ·
[Начало работы](https://github.com/urffin/algiviz/blob/master/docs/ru/getting-started.md) ·
[Разбор собственных объектов графа](https://github.com/urffin/algiviz/blob/master/docs/custom-graph-example.md)

## Источники и воспроизведение

Player принимает обычные состояния через `source`, явные шаги через
`stepSource` и асинхронные состояния через `asyncSource`. Для записи
состояний используйте `history`, а для записи шагов с событиями — `stepHistory`.
[Выбор источника](https://github.com/urffin/algiviz/blob/master/docs/ru/player.md).

Для потока опция [rewindCapacity](https://github.com/urffin/algiviz/blob/master/docs/ru/player.md)
включает возврат в ограниченном окне. [maxStepsPerFrame](https://github.com/urffin/algiviz/blob/master/docs/ru/player-work-budget.md)
ограничивает запросы следующих состояний за кадр, сохраняя остаток времени;
это не ограничение стоимости одного шага или render.

[createAsyncSource](https://github.com/urffin/algiviz/blob/master/docs/ru/async-source-api.md)
управляет ожиданием, отменой и очисткой. Само async-вычисление не переносит CPU-работу
в другой поток. [Worker-адаптер](https://github.com/urffin/algiviz/blob/master/docs/ru/worker-source-api.md)
использует тот же [asyncSource в Player](https://github.com/urffin/algiviz/blob/master/docs/ru/player-worker.md),
поддерживает явный ArrayBuffer transfer и наблюдаемое завершение через closed.

## Примеры

| Пример | Что демонстрирует |
| --- | --- |
| [Первый Player](https://github.com/urffin/algiviz/blob/master/examples/getting-started.html) | Однопроходный поиск минимума, штатный Canvas, панель Player и явный итог |
| [Как рождается кадр](https://github.com/urffin/algiviz/blob/master/examples/visualization-pipeline.html) | Путь от генератора через плеер и сцену к отрисовке, показанный средствами AlgiViz |
| [Лаборатория сортировок](https://github.com/urffin/algiviz/blob/master/examples/index.html) | Сортировки вставками и пузырьком с операциями массива и готовым рендерером |
| [Сортировка слиянием](https://github.com/urffin/algiviz/blob/master/examples/merge.html) | Собственное состояние и сцена из двух строк для основного массива и буфера |
| [Разбиения быстрой сортировки](https://github.com/urffin/algiviz/blob/master/examples/quick.html) | Разбиения Ломуто и трёхстороннее с собственными состоянием и сценой |
| [Пирамидальная сортировка](https://github.com/urffin/algiviz/blob/master/examples/heap.html) | Построение max-heap и извлечение с согласованными идентификаторами элементов дерева и массива |
| [Пирамидальная сортировка с Player](https://github.com/urffin/algiviz/blob/master/examples/heap-player.html) | Сортировка `[2a, 2b, 1]` с синхронными панелями массива и кучи, перемоткой и Restart |
| [Бинарный поиск](https://github.com/urffin/algiviz/blob/master/examples/binary-search.html) | Первое вхождение в отсортированном массиве, замкнутый интервал поиска и ленивое воспроизведение |
| [Подробный BFS графа](https://github.com/urffin/algiviz/blob/master/examples/graph.html) | Своя сцена: анимированная очередь, расстояния у вершин и отметки пути; штатный Player |
| [BFS со штатным графическим renderer](https://github.com/urffin/algiviz/blob/master/examples/graph-player.html) | Тот же алгоритм с createGraphTrace, расстояниями у вершин, /canvas/graph и Player |
| [BFS с графом и очередью](https://github.com/urffin/algiviz/blob/master/examples/graph-queue.html) | Граф и FIFO-очередь на связном списке анимируются вместе в одном Player |
| [Стягивание ребра](https://github.com/urffin/algiviz/blob/master/examples/graph-contraction.html) | Одна операция удаляет вершину и перенаправляет два ребра с сохранением их ID. Использует динамический API графа с 1.5.0 |
| [Минимальное остовное дерево Краскала](https://github.com/urffin/algiviz/blob/master/examples/kruskal.html) | Взвешенный граф и растущий лес воспроизводятся синхронно в одном Player |
| [DFS графа](https://github.com/urffin/algiviz/blob/master/examples/dfs.html) | Стек вызовов, возвраты, глубина и путь дерева; история/генератор |
| [Лабиринт](https://github.com/urffin/algiviz/blob/master/examples/maze.html) | Генерация рандомизированным DFS, волна BFS, поиск DFS, циклы и недостижимый выход; история/генератор |
| [BFS на сетке](https://github.com/urffin/algiviz/blob/master/examples/grid-player.html) | Кратчайший путь между препятствиями: /grid, штатный Canvas и Player; расстояния, зелёный итог, история и генератор |
| [Обход дерева](https://github.com/urffin/algiviz/blob/master/examples/tree.html) | Собственные узлы, рёбра и указатель с Canvas и SVG с сохранением элементов |
| [Вставка и поворот дерева](https://github.com/urffin/algiviz/blob/master/examples/tree-player.html) | Фиксированная BST-вставка, один правый поворот, штатные layout/Canvas и Player; зелёный итог и перемотка |
| [Операции со связным списком](https://github.com/urffin/algiviz/blob/master/examples/list-player.html) | Вставка, удаление и разворот со штатным Canvas и Player |
| [Стая Boids](https://github.com/urffin/algiviz/blob/master/examples/boids.html) | Воспроизводимая симуляция, пять окружений и разбор одной птицы с соседями и управляющими векторами |
| [Падающий песок](https://github.com/urffin/algiviz/blob/master/examples/sand.html) | Воспроизводимая клеточная модель, редактор препятствий, затвор и разбор одной песчинки с разрешением конфликтов |

[Полный каталог, локальный запуск и особенности алгоритмов](https://github.com/urffin/algiviz/blob/master/docs/ru/examples.md).
Примеры находятся в репозитории и не входят в npm-пакет.

## Разработка и лицензия

[Участие в разработке](https://github.com/urffin/algiviz/blob/master/ru/CONTRIBUTING.md) ·
[История изменений](https://github.com/urffin/algiviz/blob/master/CHANGELOG.md) ·
[Сообщить об ошибке](https://github.com/urffin/algiviz/issues)

Лицензия [MIT](https://github.com/urffin/algiviz/blob/master/LICENSE).
