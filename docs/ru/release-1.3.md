# Релиз 1.3.0

[English](../release-1.3.md) · [Текущий API](current-api.md)

**Выпущен 2026-11-20** с коммита `90b26f8b936ece9b149e0ac660856b2953ac2b4e`.
[GitHub Release](https://github.com/urffin/algiviz/releases/tag/v1.3.0) ·
[npm 1.3.0](https://www.npmjs.com/package/@grundyjs/algiviz/v/1.3.0).

Совместимый minor добавляет [/grid](grid-api.md) и [/canvas/grid](grid-canvas-api.md):
плотные сетки фиксированной формы, атомарные операции, стабильные ID координат,
подписи, зелёный результат и упорядоченные пути. Всего 14 entry, 30 runtime-имён
и 155 type-only экспортов (143 различных). Прежним двенадцати импортам миграция
не нужна; grid-импорты требуют 1.3.0 или новее. Отдельный [пример BFS](examples.md#кратчайший-путь-bfs-на-сетке)
и сохранённый лабиринт — прикладной код, а не экспорты алгоритмов npm.

## Завершённые проверки

- Все одиннадцать [CI jobs](https://github.com/urffin/algiviz/actions/runs/44642599848) успешны на релизном SHA.
- [Публикующий workflow](https://github.com/urffin/algiviz/actions/runs/44643911400) завершён успешно. При проверке exact npm и latest указывали на 1.3.0.
- Свежая установка из registry прошла проверки публичных и запрещённых импортов всех 14 entry. В архиве 131 файл, включая 126 dist-файлов, совпадающих с кандидатом после нормализации переводов строк.
- EN/RU README и changelog внутри пакета совпали с релизом; README registry совпал с архивом.
- Подпись registry и SLSA provenance криптографически проверены. Provenance связывает digest архива, исходный SHA, тег v1.3.0 и npm-publish workflow; [transparency record](https://search.sigstore.dev/?logIndex=4010859496).

Тег `latest` проверен в 2026-11-20T00:21:37.673Z.
Нативная приёмка renderer (18 проверок) и BFS UI (23 проверки) сохраняет границы
записанного host.

[Документационный патч 1.3.1](release-1.3.1.md) согласует статусы релиза и ссылки
README, сохраняя этот функциональный API.
