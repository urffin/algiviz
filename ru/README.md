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
  оставляя в плеере только соседние снимки состояния.
- **Без зависимостей во время выполнения:** ESM и декларации TypeScript;
  воспроизведение работает без DOM, React и Next.js.

Используйте библиотеку для учебных примеров, интерактивных статей и пошаговых разборов.
Алгоритмы и расположение объектов остаются в приложении; AlgiViz предоставляет API
воспроизведения и отрисовки.

## Установка

```sh
npm install @grundyjs/algiviz
```

У пакета нет корневой точки входа и сборки CommonJS. Импортируйте нужные модули:
`/player`, `/playback`, `/scene`, `/array` и `/canvas`.

Алгоритмы находятся в коде приложения и примерах. В версии 0.x минорные релизы могут нарушать обратную совместимость;
при обновлении сверяйтесь с [CHANGELOG.md](../CHANGELOG.md).

## Начните с одного круга

Генератор задаёт четыре позиции, а `Player` создаёт панель управления и передаёт
состояния вашей функции отрисовки. Добавьте HTML ниже, а JavaScript подключите как
модуль через сборщик, разрешающий импорты установленного npm-пакета.

```html
<div id="player">
  <canvas width="600" height="160"></canvas>
</div>
```

```js
import { Player } from '@grundyjs/algiviz/player';

const container = document.querySelector('#player');
const canvas = container.querySelector('canvas');
const ctx = canvas.getContext('2d');

const player = new Player(container, {
  viewport: canvas,
  source: function* () {
    for (const x of [40, 200, 360, 560]) yield { x };
  },
  render({ current }) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.arc(current.x, 80, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#b39bff';
    ctx.fill();
  },
});
```

Нажмите **Start**, чтобы показать первый кадр, и **Next state**, чтобы переместить
круг. Источник читается по запросу; ещё один клик после последней позиции обнаружит
завершение. Каждый снимок создаётся заново и больше не изменяется.

Здесь ручные шаги без плавного перехода. Добавьте `stepDurationMs: 1000`, чтобы
включить Play/Pause и выбор скорости. При удалении визуализации вызовите
`player.dispose()`; последний рисунок сохранится.

Продолжите с [пошаговым руководством](https://github.com/urffin/algiviz/blob/master/docs/ru/getting-started.md):
готовая панель, ручное управление и собственные типы объектов через `/scene`.
В [справочнике плеера](https://github.com/urffin/algiviz/blob/master/docs/ru/player.md)
описаны история, перемотка, подписи и загрузка по запросу.

## Модули и документация

| Модуль | Назначение |
| --- | --- |
| [`/player`](https://github.com/urffin/algiviz/blob/master/docs/ru/player.md) | Необязательный виджет `new Player(...)`, медиапанель, запись/поток и загрузка UI по запросу; добавлен в 0.12.0 |
| [`/playback`](https://github.com/urffin/algiviz/blob/master/docs/ru/playback.md) | Шаги, плеер, история, завершение и жизненный цикл |
| [`/scene`](https://github.com/urffin/algiviz/blob/master/docs/ru/scene.md) | Собственные типы, сопоставление объектов и проекция |
| [`/array` и `/canvas`](https://github.com/urffin/algiviz/blob/master/docs/ru/array.md) | Операции массива, готовый рендерер и палитра |

[Полный пример TypeScript](https://github.com/urffin/algiviz/blob/master/examples/custom-objects.ts) ·
[Начало работы](https://github.com/urffin/algiviz/blob/master/docs/ru/getting-started.md) ·
[Разбор собственных объектов графа](https://github.com/urffin/algiviz/blob/master/docs/custom-graph-example.md)

## Примеры

| Пример | Что демонстрирует |
| --- | --- |
| [Как рождается кадр](https://github.com/urffin/algiviz/blob/master/examples/visualization-pipeline.html) | Путь от генератора через плеер и сцену к отрисовке, показанный средствами AlgiViz |
| [Лаборатория сортировок](https://github.com/urffin/algiviz/blob/master/examples/index.html) | Сортировки вставками и пузырьком с операциями массива и готовым рендерером |
| [Сортировка слиянием](https://github.com/urffin/algiviz/blob/master/examples/merge.html) | Собственное состояние и сцена из двух строк для основного массива и буфера |
| [Разбиения быстрой сортировки](https://github.com/urffin/algiviz/blob/master/examples/quick.html) | Разбиения Ломуто и трёхстороннее с собственными состоянием и сценой |
| [Пирамидальная сортировка](https://github.com/urffin/algiviz/blob/master/examples/heap.html) | Построение max-heap и извлечение с согласованными идентификаторами элементов дерева и массива |
| [Бинарный поиск](https://github.com/urffin/algiviz/blob/master/examples/binary-search.html) | Первое вхождение в отсортированном массиве, замкнутый интервал поиска и ленивое воспроизведение |
| [BFS графа](https://github.com/urffin/algiviz/blob/master/examples/graph.html) | Очередь, слои, кратчайшие пути, недостижимая цель и история/генератор |
| [DFS графа](https://github.com/urffin/algiviz/blob/master/examples/dfs.html) | Стек вызовов, возвраты, глубина и путь дерева; история/генератор |
| [Лабиринт](https://github.com/urffin/algiviz/blob/master/examples/maze.html) | Генерация рандомизированным DFS, волна BFS, поиск DFS, циклы и недостижимый выход; история/генератор |
| [Обход дерева](https://github.com/urffin/algiviz/blob/master/examples/tree.html) | Собственные узлы, рёбра и указатель с Canvas и SVG с сохранением элементов |
| [Стая Boids](https://github.com/urffin/algiviz/blob/master/examples/boids.html) | Воспроизводимая симуляция, пять окружений и разбор одной птицы с соседями и управляющими векторами |
| [Падающий песок](https://github.com/urffin/algiviz/blob/master/examples/sand.html) | Воспроизводимая клеточная модель, редактор препятствий, затвор и разбор одной песчинки с разрешением конфликтов |

[Полный каталог, локальный запуск и особенности алгоритмов](https://github.com/urffin/algiviz/blob/master/docs/ru/examples.md).
Примеры находятся в репозитории и не входят в npm-пакет.

## Разработка и лицензия

[Участие в разработке](https://github.com/urffin/algiviz/blob/master/ru/CONTRIBUTING.md) ·
[История изменений](https://github.com/urffin/algiviz/blob/master/CHANGELOG.md) ·
[Сообщить об ошибке](https://github.com/urffin/algiviz/issues)

Лицензия [MIT](https://github.com/urffin/algiviz/blob/master/LICENSE). В версии 0.x минорные релизы могут менять API.
