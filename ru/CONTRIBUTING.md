# Разработка AlgiViz

## Разработка

Требуются Node.js 22 или новее и npm.

```sh
npm ci
npm test
npm run test:package
```

`npm test` собирает библиотеку, проверяет TypeScript-примеры и запускает тесты.
`npm run test:package` собирает архив, устанавливает его без сети в изолированное
временное приложение, компилирует код с установленными декларациями и проверяет
публичный API, включая отказ для удалённого экспорта `/core`.
Затем временное приложение удаляется.

GitHub Actions запускает обе проверки при push в `master` и в pull request,
используя Node.js 22 и 24 на Linux и Windows. Проверки CI не публикуют пакеты.

`npm pack` автоматически пересобирает пакет. Архив включает dist, README, LICENSE,
CHANGELOG и метаданные пакета. Исходный код и задачи:
[urffin/algiviz](https://github.com/urffin/algiviz). Лицензия MIT.

[Бенчмарки](https://github.com/urffin/algiviz/blob/master/docs/ru/performance.md) · [Выпуск версии](https://github.com/urffin/algiviz/blob/master/docs/ru/publishing.md)
