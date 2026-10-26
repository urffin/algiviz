# Публикация пакета

[README](../../ru/README.md) · [English](../publishing.md)

## Выпуск версии

Публикация выполняется сопровождающим проекта. Обновите версию пакета, lockfile
и changelog; запустите `npm test` и `npm run test:package`, сделайте коммит,
отправьте его и проверьте CI для этого коммита.

[Workflow публикации](https://github.com/urffin/algiviz/blob/master/.github/workflows/npm-publish.yml) запускается при публикации
стабильного GitHub Release. Черновики, предварительные релизы и отправка одного
лишь тега пакет не публикуют. Используйте `v` и точную версию пакета, например
`v0.8.0`, на проверенном коммите.

Workflow использует Node.js 24 и npm 11, проверяет версию и приложение с упакованным
пакетом, затем публикует с provenance через npm trusted publishing (OIDC).
Жизненный цикл публикации также запускает тесты и пересборку.
Секрет `NPM_TOKEN` не требуется.

Trusted publisher в npm должен соответствовать владельцу GitHub `urffin`,
репозиторию `algiviz` и workflow `npm-publish.yml`. GitHub environment не используется.
См. [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

После публикации проверьте запуск Actions и точную версию в npm.
Никогда не используйте повторно уже опубликованную версию npm. Если workflow завершился
ошибкой, проверьте, успел ли пакет опубликоваться, прежде чем запускать его повторно.
