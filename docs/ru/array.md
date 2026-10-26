# Операции массива и Canvas

[README](../../ru/README.md) · [English](../array.md)

## Собственные алгоритмы

Новые приложения используют следующие точки входа, не импортирующие готовые алгоритмы:

- `@grundyjs/algiviz/array`: операции над массивами и определение генераторов.
- `@grundyjs/algiviz/playback`: универсальное воспроизведение неизменяемых состояний и событий.
- `@grundyjs/algiviz/scene`: типизированные объекты и пользовательские визуализации.
- `@grundyjs/algiviz/canvas`: готовый рендерер массива.

Циклы, условия и порядок операций определяете вы. Регистрация в библиотеке
или изменение AlgiViz не требуются. Например, разворот массива:

```js
import { defineArrayAlgorithm, createArrayPlayer, createArrayTimeline } from "@grundyjs/algiviz/array";
import { createArrayRenderer } from "@grundyjs/algiviz/canvas";

const reverse = defineArrayAlgorithm(function* (array) {
    yield array.start();
    for (let i = 0; i < Math.floor(array.length / 2); i++) {
        yield array.highlight([i, array.length - 1 - i]);
        yield array.swap(i, array.length - 1 - i);
    }
    yield array.done();
});

const options = { stepDurationMs: 350, finalHoldMs: 1000 };
const ctx = canvas.getContext("2d");
const renderer = createArrayRenderer({ theme: "dark" });
const player = createArrayPlayer(reverse.iterate([1, 2, 3, 4]), {
    ...options,
    render: frame => renderer.render(ctx, frame)
});
// Your animation loop calls player.advance(deltaMs * speed).
// No calls while paused; advance(0) redraws after resizing.
// On teardown: cancel your animation loop and call player.dispose().

// Alternatively, retain history and seek:
const timeline = createArrayTimeline(reverse.steps([1, 2, 3, 4]), options);
renderer.render(ctx, timeline.sample(500));
```

`defineArrayAlgorithm` возвращает `iterate(values)` и `steps(values)`. Каждый итератор
владеет отдельным рабочим состоянием, копирует и проверяет входные данные при первом
`next()`. `steps` собирает итератор в замороженный массив. Выдавайте результат каждой
операции сразу через `yield`, начинайте с `start` и заканчивайте `done`. Операция
обновляет рабочее состояние и возвращает неизменяемый снимок, но ничего не рисует.
Плеер вызывает переданный `render` при создании и каждом `advance`.
Ошибки отрисовки закрывают итератор и передаются вызывающему коду.

## Операции над массивом

| Операция | Действие |
| --- | --- |
| `at(index)`, `held`, `length` | Прочитать замороженный элемент, удерживаемый элемент или длину массива |
| `start(regions?)` | Выдать начальное состояние; вызывается один раз |
| `compare(left, right)` | Подсветить две позиции и учесть одно сравнение; любая позиция может быть `"held"` |
| `highlight(positions)` | Подсветить элементы на этом шаге без изменения счётчиков |
| `swap(left, right, regions?)` | Обменять занятые позиции и учесть две записи; поддерживаются несоседние позиции |
| `select(from, regions?)` | Удержать элемент, оставив пустую позицию; записи не учитываются |
| `shift(from, to, regions?)` | Переместить элемент в пустую позицию и учесть одну запись |
| `insert(to, regions?)` | Заполнить пустую позицию удерживаемым элементом и учесть одну запись |
| `pass(end, regions?)` | Описать завершённый проход без изменения элементов и счётчиков |
| `done(regions?)` | Завершить работу; удерживаемого элемента быть не должно; не сортирует и не определяет отсортированные области |

`regions` может содержать `sortedPrefixLength` и `sortedSuffixLength`.
Пропущенные маркеры сохраняют предыдущие значения. Автор алгоритма решает, когда область
отсортирована; AlgiViz проверяет границы, но не доказывает упорядоченность. Индексы
начинаются с нуля. Неверные позиции, занятые места назначения и неправильный порядок
операций вызывают исключение до изменения рабочего состояния. Читайте снимки, а не
изменяйте элементы самостоятельно. `createArrayTrace(values)` предоставляет те же
операции напрямую и сразу проверяет входные данные — для собственной оболочки генератора.

Сортировки вставками и пузырьком реализованы в [examples/algorithms.mjs](https://github.com/urffin/algiviz/blob/master/examples/algorithms.mjs).
Алгоритмы принадлежат приложению и не требуют изменений библиотеки.

Рендерер массива ожидает неизменяемые снимки. Для раскладки он использует размеры
битовой карты Canvas, рисует полный кадр и восстанавливает состояние контекста.
Высота столбца отрицательного значения определяется его модулем, а подпись сохраняет
знак; это не график со знаковой осью. В плотных диаграммах подписи скрываются.
Для записи используйте canvas с фиксированными размерами экспорта.
Отрисовка не запускает цикл анимации и не записывает видео.

### Пользовательские цвета массива

Рендерер принимает частичное переопределение палитры в `createArrayRenderer`
и совместимом псевдониме `createSortRenderer`:

```ts
import { createArrayRenderer, type ArrayPaletteOverrides } from '@grundyjs/algiviz/canvas';
const colors: ArrayPaletteOverrides = { background: '#ffffff', text: '#182230', active: '#e87900' };
const renderer = createArrayRenderer({ theme: 'light', colors });
renderer.render(ctx, currentFrame);
```

`ArrayPalette` задаёт шесть строковых ролей: `background` (весь canvas), `text`
(все подписи), `bar` (обычные столбцы), `sorted` (отсортированный префикс/суффикс),
`active` (подсвеченные, сравниваемые или перемещаемые элементы) и `held` (удерживаемый
элемент; приоритет выше active и sorted). `ArrayPaletteOverrides` — частичная форма
палитры, `ArrayRendererOptions` описывает объект настроек. Значения — строки цветов
Canvas, передаваемые без CSS-проверки. Для пропущенных ролей и `undefined` используется
выбранная тема. Вызовы только с темой и стандартные цвета не изменились.

Переопределения копируются при создании рендерера. Последующее изменение входного
объекта не влияет на результат. Для смены темы или палитры создайте новый рендерер
и нарисуйте тот же текущий кадр. Меняются только цвета, но не воспроизведение,
снимки, раскладка или обработка bitmap/DPR. Попробуйте темы, шесть полей выбора цвета
и сброс в [лаборатории сортировок](https://github.com/urffin/algiviz/blob/master/examples/index.html).
