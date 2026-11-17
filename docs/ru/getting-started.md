# Quickstart: поиск минимума на Canvas

[README](../../ru/README.md) · [English](../getting-started.md) · [Сравнение вариантов](quickstart-comparison.md)

Запустите настоящий однопроходный алгоритм на [7,3,5,2,6]. AlgiViz записывает
операции массива, рисует столбцы и даёт готовую панель Player. Ваш код задаёт цикл,
условие сравнения и текстовый итог. API stepSource и done({ result }) доступны
в опубликованной 1.0.0.

Пример использует заранее заданный непустой массив. Пользовательского ввода
и проверки пустого массива здесь нет.

## 1. Установите зависимости

Нужны Node.js **22.12 или новее** и npm для закреплённого [dev-инструмента Vite](https://vite.dev/guide/#manual-installation).
Это требование инструмента примера, а не новое runtime-требование AlgiViz.
Начните в родительской папке для нового приложения; клонировать AlgiViz не нужно.
В PowerShell или POSIX shell:

```sh
mkdir algiviz-quickstart
cd algiviz-quickstart
npm init -y
npm install --save-exact @grundyjs/algiviz@1.0.0
npm install --save-dev --save-exact vite@8.3.8
```

Версия AlgiViz закреплена для воспроизводимости. Vite устанавливается только в
приложение примера. Этот quickstart не использует неопубликованные /graph или
/canvas/graph; для графовых примеров рабочей копии нужна отдельная локальная сборка.

## 2. Скопируйте один файл

Создайте **index.html** в algiviz-quickstart и скопируйте весь файл:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AlgiViz · Find a minimum with Player</title>
  <style>
    body { max-width: 760px; margin: 32px auto; padding: 16px; font: 16px/1.5 system-ui; }
    canvas { display: block; width: 100%; height: auto; }
    button { padding: 8px 16px; font: inherit; }
  </style>
</head>
<body>
  <h1>Find a minimum with Player</h1>
  <p>Press Start, then Next state. The done step marks the minimum in green and finishes playback. Restart starts a fresh search.</p>
  <div id="player"><canvas width="720" height="300" aria-label="Array values and compared elements"></canvas></div>

  <p id="result" role="status">Press Start</p>
  <p>Compare highlights two bars; highlight marks the minimum found so far. The final minimum stays green. The input is not reordered.</p>
  <script type="module">
import { Player } from '@grundyjs/algiviz/player';
import { createArrayTrace } from '@grundyjs/algiviz/array';
import { createArrayRenderer } from '@grundyjs/algiviz/canvas';

const container = document.querySelector('#player');
const canvas = container.querySelector('canvas');
const ctx = canvas.getContext('2d');
const result = document.querySelector('#result');

function* minimum(values) {
  const array = createArrayTrace(values);
  result.textContent = 'Searching…';
  yield array.start();
  let min = 0;
  yield array.highlight([min]);
  for (let i = 1; i < array.length; i++) {
    yield array.compare(min, i);
    if (array.at(i).value < array.at(min).value) min = i;
    yield array.highlight([min]);
  }
  result.textContent = 'Minimum: ' + array.at(min).value;
  yield array.done({ result: [min] });
}

const renderer = createArrayRenderer({ theme: 'light' });
const player = new Player(container, {
  viewport: canvas,
  stepSource: () => minimum([7, 3, 5, 2, 6]),
  isTerminal: step => step.event.type === 'done',
  render: frame => renderer.render(ctx, frame),
});
  </script>
</body>
</html>
```

## 3. Запустите и проверьте

```sh
npx vite --host 127.0.0.1 --port 5173 --strictPort
```

Откройте **http://127.0.0.1:5173/**. Терминал продолжает работать; Ctrl+C останавливает
сервер. Открывайте HTTP-адрес, не файл двойным кликом. Если порт занят, выберите
другой в команде и адресе браузера.

Start рисует исходный массив. Next state продвигает на одну видимую операцию:
compare подсвечивает два сравниваемых столбца, highlight — текущий минимум.
Финальный done оставляет столбец минимума зелёным и показывает **Minimum: 2**, **4 сравнения** и **0 записей**.
Столбцы сохраняют исходный порядок. Шаг done завершает виджет. Restart создаёт новый генератор и сбрасывает ответ.

## Зачем здесь этот код

- createArrayTrace создаёт неизменяемые снимки и ведёт счётчики. compare записывает
  операцию; решение принимает обычное JavaScript-условие с оператором меньше.
  array.at(i).value читает число; у элемента также есть ID для подсветки.
- createArrayRenderer рисует Canvas. Массив не отмечается отсортированным:
  поиск минимума его не сортирует и не записывает значения в ячейки.
- Player получает явные шаги через stepSource и передаёт Frame прямо Canvas-рендереру.
  isTerminal распознаёт done: дополнительное чтение и адаптер кадра не нужны.
  Подробности — в [контракте stepSource](player-step-source.md).
- Генератор выводит Searching… перед start, а итог — перед done. Его локальный
  индекс min уже указывает на ответ; render только рисует Canvas. Итог нужно
  записать до yield done: терминальный шаг закрывает генератор. Вход здесь непустой;
  при равных минимумах сохраняется первый.
- done({ result: [min] }) записывает ответ в финальный снимок. Штатный рендерер
  оставляет этот столбец зелёным: собственный снимок, преобразование события и
  второй рендерер не нужны. Restart возвращает обычные цвета.
- При удалении приложения вызывайте player.dispose(). Пример идёт только вперёд;
  аннотации с seek должны входить в прикладное состояние каждого кадра.

## Изучайте по шагам

[Пошаговая инструкция](learning-path.md) начинает с обычных состояний и pre,
затем вводит createArrayPlayer с одной кнопкой, затем готовую панель выше.
[Сравните полные альтернативы](quickstart-comparison.md): различаются управление и API.
После них переходите к [сценам и интерполяции](../minimal-example.md).
[Пример репозитория](../../examples/getting-started.html) добавляет обработку lifecycle
страницы; [minimum-player.html](../../examples/minimum-player.html) — версия для сравнения.
