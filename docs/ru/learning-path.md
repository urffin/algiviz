# От обычных состояний к визуализации алгоритма

[English](../learning-path.md) · [Полный quickstart поиска минимума](getting-started.md) · [Сравнение альтернатив](quickstart-comparison.md)

Главный quickstart уже показывает цель: настоящий поиск минимума на Canvas
с готовым управлением. Небольшие этапы ниже помогают понять каждую связь.
Страницы репозитория используют локальную сборку/import map; главный quickstart
даёт точные команды для отдельного приложения с опубликованным пакетом.

## 1. Обычные состояния и обычный вывод

Откройте [pre-states.html](../../examples/pre-states.html) и [исходник](../../examples/pre-states.mjs).
Генератор выдаёт [3,1,2], [1,3,2] и [1,2,3]. Player создаёт кнопки, render задаёт
pre.textContent через JSON.stringify(current). Алгоритма и API операций массива
пока нет. Новые массивы — независимые снимки, а не изменения уже выданного массива.

Этап показывает yield → состояние → render и независимость Player от Canvas.
Start лениво запускает источник, дополнительный Next state обнаруживает EOF,
Restart вызывает новую фабрику источника. При удалении нужен player.dispose().

## 2. Настоящий алгоритм и одна своя кнопка

Откройте [minimum-manual.html](../../examples/minimum-manual.html). Он использует
те же генератор minimum и Canvas-рендерер, что [главный quickstart](getting-started.md).
Trace создаёт snapshots/IDs/счётчики, штатный рендерер рисует массив. Алгоритм
определяется только циклом и условием сравнения.

Чтобы превратить скопированный главный quickstart в этот вариант, удалите импорт
Player, добавьте createArrayPlayer в импорт /array и кнопку после player div:

```html
<button id="next">Next step</button>
```

Оставьте minimum, renderer, ctx и result. Замените блок new Player следующим:

```js
const next = document.querySelector('#next');
const player = createArrayPlayer(minimum([7, 3, 5, 2, 6]), { render: frame => renderer.render(ctx, frame) });
next.onclick = () => {
  player.nextStep();
  next.disabled = player.finished;
};
window.addEventListener('pagehide', () => player.dispose(), { once: true });
```

Создание сразу рисует start-кадр; действия Start нет. Array player напрямую
передаёт рендереру готовый ArrayFrame и считает done терминальным: адаптер кадра и
дополнительный EOF-клик не нужны. Кнопкой и дополнительными controls владеет
приложение. При unmount очистите onclick и вызовите dispose; перезагрузка этой
самостоятельной страницы запускает новый поиск.

## 3. Готовая панель Player

[Главный quickstart](getting-started.md) использует stepSource и isTerminal.
Player получает шаги ArrayTrace и передаёт ArrayFrame прямо рендереру. done завершает
воспроизведение в том же Next; адаптер и дополнительный EOF-клик не нужны.
Start читает лениво, Restart создаёт новый генератор. Эти API доступны
в 1.0.0; установка из npm описана в quickstart.

## 4. Собственные объекты и интерполяция

Продолжите с [minimal.mjs](../../examples/minimal.mjs) и
[разбором сцен/интерполяции](../minimal-example.md). Этот пример вводит устойчивые
IDs объектов, types, явные события и интерполированную отрисовку. Он выходит за
пределы штатного array renderer; сохранённое имя файла не предлагает начинать с него.
