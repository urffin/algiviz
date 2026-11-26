# AlgiViz 1.9.0

[English](../release-1.9.md) · [Текущий API](current-api.md) · [Окружения](../support-matrix.md#current-support-boundary)

AlgiViz 1.9.0 добавляет в Canvas-рендерер графа опцию размещения подписей рёбер.

```ts
import { createGraphRenderer } from "@grundyjs/algiviz/canvas/graph";

const renderer = createGraphRenderer({
    theme: "light",
    edgeLabels: { placement: "auto", preferredSide: "left" }
});
```

Рендерер измеряет горизонтальный текст и ищет место рядом с кривой, где
подпись не перекрывает линии, наконечники стрелок, узлы и другие подписи
рёбер. Если подходящего места в пределах Canvas нет, подпись пропускается.
Предпочтительная сторона по умолчанию левая по направлению ребра.
Без `edgeLabels` сохраняются прежнее размещение и порядок отрисовки.
[Canvas API графа](graph-api.md#размещение-подписей-рёбер).

[Браузерная проверка](../../test/graph-edge-labels-browser.html) использует
русский и английский примеры Ахо — Корасика, а также словарь, на котором
переходы по буквам пересекаются с суффиксными ссылками.

У пакета 16 точек входа ESM и нет зависимостей времени выполнения. Опция
расширяет существующий модуль /canvas/graph.

[Changelog](../../CHANGELOG.md)
