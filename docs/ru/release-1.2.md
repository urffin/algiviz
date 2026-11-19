# Выпуск AlgiViz 1.2.0

[English](../release-1.2.md) · [Отчёт](../releases/1.2.0.json) · [Текущий API](current-api.md) · [Changelog](../../CHANGELOG.md)

**Выпущено 2026-11-19** с 8e1f50b3fb0a565e1634066ebd9e3e32dd0ced1f.
[Стабильный GitHub Release](https://github.com/urffin/algiviz/releases/tag/v1.2.0),
[все 11 CI jobs](https://github.com/urffin/algiviz/actions/runs/44607527511)
и [OIDC publish workflow](https://github.com/urffin/algiviz/actions/runs/44608620588)
успешны на этом коммите. Проверены exact npm 1.2.0 и latest = 1.2.0.
Этот документ фиксирует завершённую задачу выпуска, не выполняет свежую проверку
реестра или новую публикацию.

## Состав и совместимость

Опубликованы двенадцать ESM entry: десять путей 1.1.0 плюс `/tree` и
`/canvas/tree`. Поверхность: 27 runtime-имён, 128 type-only экспортов, 116 различных
типов. Десять прежних реализаций/export-map записей, runtime/build-зависимости и
Player API не меняются; прежним импортам миграция не нужна.

Tree trace поддерживает ordered/binary деревья, стабильные ID, атомарные edit,
явную раскладку, отметки, подписи и независимый результат. Canvas добавляет
ordered/binary layout, пустые слоты, прикреплённые crossfade-связи, измеренный текст
и зелёный результат. T1 закрыт до релиза с учётом полной обводки пустого слота.
Вставка/правый поворот — отдельный пример репозитория, не экспорт алгоритма.
Сетка/список остаются проектами, package entry нет.

## Проверки и доказательства

- Локальный кандидат: 648 репозиторных тестов, 403 installed-package регрессии и
  34 bundle-варианта; затем 11 CI jobs точного SHA.
- Свежая установка npm: 1.2.0, двенадцать путей и 27 runtime-имён, private paths
  отклонены. Все 106 dist-файлов совпадают после нормализации переводов строк;
  105 побайтово одинаковы. LICENSE и dist/player/mount.js различаются только
  Windows/Linux-переводами строк; metadata/export mappings проверены отдельно.
- npm audit signatures подтвердил одну registry signature и одну attestation,
  без invalid/missing signatures. Provenance связывает SHA-512 архива, source SHA,
  refs/tags/v1.2.0 и .github/workflows/npm-publish.yml с успешным запуском.
  [Запись transparency log](https://search.sigstore.dev/?logIndex=4005857088).
- Для неизменного кандидата использована native-приёмка: 32 проверки renderer
  и 17 UI-проверок примера. Это записанный встроенный Chromium host, без расширения
  браузерных гарантий или заявления forced GPU context loss.

Workflow завершился раньше обработки npm. Публикация проверена после появления
exact-version/latest metadata; повторной публикации или обхода approval не было.
Полные счётчики, digests и ограничения — в отчёте.

## Исправление документации

Неизменяемый архив npm 1.2.0 сохранил статус кандидата в EN/RU README и changelog:
деревья названы неопубликованными. Устарел этот статус; API, package exports и
реализация выпущены и проверены. Нынешнее обновление исправляет документацию
репозитория и сохраняет датированные доказательства. Оно не заменяет файлы уже
опубликованной версии. Исправление пакетной документации входит в
[документационный патч 1.2.1](release-1.2.1.md).
