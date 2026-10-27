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
[Исходный код минимального примера](https://github.com/urffin/algiviz/blob/master/examples/visualization-pipeline.html)

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
`/array`, `/playback`, `/scene` и `/canvas`.

Алгоритмы находятся в коде приложения и примерах. В версии 0.x минорные релизы могут нарушать обратную совместимость;
при обновлении сверяйтесь с [CHANGELOG.md](../CHANGELOG.md).

## Начните с одного собственного объекта

Четыре состояния одного круга: `40 → 200 → 360 → 560`. Генератор задаёт
координаты, обработчик `dot` рисует круг, а плеер запрашивает следующее состояние.
Добавьте Canvas и кнопку в HTML, а JavaScript ниже подключите как модуль через
сборщик, разрешающий импорты установленного npm-пакета.

![Минимальный пример AlgiViz: код, последовательная подсветка вызовов и состояние Canvas](https://raw.githubusercontent.com/urffin/algiviz/master/docs/assets/minimal.gif)

*Реальные вызовы примера показаны замедленно. Точка меняет позицию на этапе отрисовки. [Открыть интерактивный разбор](https://github.com/urffin/algiviz/blob/master/examples/visualization-pipeline.html).*

```html
<canvas width="600" height="160"></canvas>
<button id="next">Следующее состояние</button>
```

```js
import { createPlayer } from '@grundyjs/algiviz/playback';
import { createSceneRenderer } from '@grundyjs/algiviz/scene';

const ctx = document.querySelector('canvas').getContext('2d');
function* steps() {
    for (const [index, x] of [40, 200, 360, 560].entries()) {
        const state = { objects: [{ id: 'circle', type: 'dot', data: { x } }] };
        yield { index, state, event: index === 3 ? 'done' : 'position' };
    }
}
const renderer = createSceneRenderer({
    dot(ctx, { current }) {
        ctx.beginPath();
        ctx.arc(current.data.x, 80, 18, 0, Math.PI * 2);
        ctx.fillStyle = '#b39bff';
        ctx.fill();
    },
});
const player = createPlayer(steps(), {
    isTerminal: step => step.event === 'done',
    render(frame) {
        ctx.clearRect(0, 0, 600, 160);
        renderer.render(ctx, frame);
    },
});
document.querySelector('#next').onclick = () => player.nextStep();
```

Первый кадр (`x = 40`) рисуется сразу внутри `createPlayer(...)`. Каждый клик
запрашивает следующее состояние: плеер возобновляет цикл до следующего
`yield`, затем вызывает отрисовку. Здесь нет плавного перехода: обработчик рисует
только `current`. Каждый снимок создаётся заново и больше не изменяется. При
удалении визуализации вызовите `player.dispose()`.

[Интерактивный разбор с последовательной подсветкой кода](https://github.com/urffin/algiviz/blob/master/examples/visualization-pipeline.html)
показывает создание первого кадра по кнопке «Начать» и последующие итерации цикла.
Это страница примера в репозитории; запускайте её по [инструкции локальной настройки](https://github.com/urffin/algiviz/blob/master/docs/minimal-example.md).

## Как это устроено

- **Алгоритм** выдаёт независимые снимки состояния через генератор.
- **Плеер** запрашивает шаги и передаёт кадр вашей функции отрисовки.
- **Сцена** описывает объекты: стабильный `id`, тип и собственные данные.
- **Обработчик** выбирает геометрию и способ рисования. Плавность — его решение.

Состояния после выдачи нельзя изменять. Плееру нужен явный завершающий шаг;
при удалении визуализации вызовите `dispose()`. Алгоритмы, раскладка и цикл
анимации принадлежат приложению.

## Режимы воспроизведения

| | Генератор: `createPlayer` | История: `createTimeline` |
| --- | --- | --- |
| Получение шагов | По мере продвижения | Все шаги заранее |
| Хранение | Соседние снимки | Вся история |
| Перемотка назад | Нет | Да, через `sample(timeMs)` |
| Общая длительность | Заранее неизвестна | Доступна |

Генератор сокращает хранимую историю, но не стоимость создания каждого снимка.
[Подробнее о памяти](https://github.com/urffin/algiviz/blob/master/docs/ru/performance.md).

## Модули и документация

| Модуль | Назначение |
| --- | --- |
| [`/playback`](https://github.com/urffin/algiviz/blob/master/docs/ru/playback.md) | Шаги, плеер, история, завершение и жизненный цикл |
| [`/scene`](https://github.com/urffin/algiviz/blob/master/docs/ru/scene.md) | Собственные типы, сопоставление объектов и проекция |
| [`/array` и `/canvas`](https://github.com/urffin/algiviz/blob/master/docs/ru/array.md) | Операции массива, готовый рендерер и палитра |

[Полный пример TypeScript](https://github.com/urffin/algiviz/blob/master/examples/custom-objects.ts) ·
[Настройка проекта и интеграция](https://github.com/urffin/algiviz/blob/master/docs/minimal-example.md) ·
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

[Полный каталог, локальный запуск и особенности алгоритмов](https://github.com/urffin/algiviz/blob/master/docs/ru/examples.md).
Примеры находятся в репозитории и не входят в npm-пакет.

## Разработка и лицензия

[Участие в разработке](https://github.com/urffin/algiviz/blob/master/ru/CONTRIBUTING.md) ·
[История изменений](https://github.com/urffin/algiviz/blob/master/CHANGELOG.md) ·
[Сообщить об ошибке](https://github.com/urffin/algiviz/issues)

Лицензия [MIT](https://github.com/urffin/algiviz/blob/master/LICENSE). В версии 0.x минорные релизы могут менять API.
