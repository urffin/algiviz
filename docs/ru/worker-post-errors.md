# Ошибки host postMessage: выбранный контракт U5

[English](../worker-post-errors.md) · [Worker API](worker-source-api.md) · [Текущий статус](current-api.md) · [Совместимость](api-compatibility.md)

**U5 закреплён постоянными регрессиями; опубликованный контракт с 1.0.0.**
Исходное исключение host postMessage сохраняется как unknown, без оборачивания
в транспортный WorkerSourceError. Контекст находится в существующем отчёте
сеанса. Это соответствует нынешнему коду на проверенных путях; нового экспорта,
поля, кода, класса ошибки и wire-сообщения нет.

## Граница и обоснование

Правило охватывает синхронное исключение при получении/вызове worker.postMessage
для фактической host-отправки **init, pull или cancel**. Оно одинаково для native
DOMException и исключений подменённого host-метода. Точное значение сохраняется
по Object.is, включая undefined, null, false, zero, строки, symbol, непрозрачные
объекты и уже созданный WorkerSourceError. Значение не исследуется, не
преобразуется в строку, не клонируется и не изменяется; metadata/cause к нему
не добавляются. Разные случаи не объединяются только из-за того же объекта.

Identity сохраняет прежнюю обработку локальных ошибок и произвольные значения
приложения без нового неограниченного cause-поля и потери информации. Следствие
выбрано явно: instanceof WorkerSourceError и caught.code не классифицируют все
отказы. У DOMException возможен свой числовой code; выброшенный WorkerSourceError
может иметь собственную несвязанную metadata. Действие адаптера определяется
origin/phase отчёта сеанса или контекстом cleanup issue.

Ошибки более ранних Worker/input-фабрик и проверки handle не переклассифицируются.
Например, исключение getter postMessage при начальной валидации handle остаётся
этапом create; то же исключение при попытке отправки — post. Preflight-валидация
данных остаётся serialization/serialize; remote-ошибки, Worker error/messageerror
и прочие ошибки, созданные адаптером, сохраняют нормализацию. Имя исключения
не превращает native send throw в serialization или cancellation. Нативный метод
синхронный/void; ожидание promise от async-подмены не входит в контракт.

## Активная отправка и приоритет исходов

| Ситуация при перехвате исключения | Наблюдаемый результат |
| --- | --- |
| Init/pull падает до фиксации terminal outcome | Ожидающий transport read сразу отклоняется исходным значением; фиксируется failed, origin host, phase post, затем начинается остановка |
| Ранняя операционная ошибка уже выиграла | Её primary/outcome сохраняются; поздний init/pull throw до окончательного закрытия может занять первый lateReadError с контекстом host/post |
| Отмена владельца/return уже выиграли внутри активной отправки | Сохраняются disposed и причина; последующий init/pull throw до окончательного закрытия — lateReadError, не новая primary/cleanup-ошибка |
| Cancel send бросает при остановке | Исходное значение записывается как настоящая host/post cleanup issue; прежние failure/disposal сохраняются |
| Транспорт полностью закрыт | Отчёт не открывается и не изменяется, очистка не повторяется, работа не назначается заново |

«Первое» — порядок наблюдения host, а не межпоточные timestamps. Primary со
значением undefined всё равно существует: наличие определяется wrapper/
discriminant, а не truthiness ошибки. Поздняя read-ошибка не является автоматически
cleanup failure. Init/pull failure не считается повторно в cleanup только из-за
последующей остановки; отдельный cancel throw — новый cleanup-случай, даже если
значение тождественно primary.

Retry, fallback-копирования, нового Worker и дублирующего pull нет. Исключение
не обещает отсутствие delivery/detachment-эффектов native-вызова: адаптер их
не откатывает и не отправляет данные заново. Остановка сохраняет одну попытку
cancel, прежний непродлеваемый grace deadline и terminate/teardown не более
одного раза. Неудачный cancel не доказывает remote acknowledgement и не отменяет
принудительную остановку. Подтверждение физического выхода браузерного Worker
не обещается.

## Transport closed и прямой return итератора

session.closed остаётся стабильным never-rejecting promise и завершается после
прежнего барьера остановки/очистки. Смысл полей сохраняется:

| Поле/путь | Выбранное поведение |
| --- | --- |
| kind failed, error, origin, phase | Если выиграл init/pull, error — точное исходное значение, origin host, phase post. Cleanup не заменяет primary |
| kind disposed, reason | Выигравшая отмена сохраняет disposed и исходную причину, даже если cancel send упал |
| cleanup.count / cleanup.first | Число реальных cleanup-случаев; первая issue в порядке наблюдения хранит origin host, phase post, error original, если первой была ошибка cancel send |
| lateReadError | Null либо первая настоящая поздняя operational issue с исходным значением/контекстом, в том числе undefined |
| termination | Реальные not-created/acknowledged/forced и requested/failed terminate, независимо от identity primary/cleanup |

После primary post failure следующие прямые next() отклоняются той же primary.
Прямой return() наблюдает cleanup: при успешной очистке завершается, не выбрасывая
повторно уже доставленную primary. При ошибке cleanup ожидающий отменённый
transport read и прямой return отклоняются одной существующей **сводной ошибкой
WorkerSourceError с code cleanup**. Повторный return не повторяет остановку;
тождество return-promises не обещается.

Эта сводка не является нормализацией исходной send-ошибки. В cleanup.first.error
остаётся исходное значение, origin/phase сводки берутся из первой cleanup issue,
которая могла предшествовать post failure. Сам raw cancel throw не превращается
в code transport wrapper. Нового cause/remote descriptor для host throw нет.
Счётчик насыщается, отчёт держит одну first cleanup issue и одну late issue,
а не историю ошибок. Сохранение ссылок ограничивает число диагностик, но не
размер прикладных графов, удерживаемых исходными объектами. Прежние правила
естественного EOF/cleanup-promotion сохраняются; EOF не отправляет cancel.

## Async-адаптер и Player

При активном send failure через createAsyncSource публичное чтение отклоняется
той же primary; failed-отчёт сохраняет её. Вторичная ошибка остановки приходит
через прежний return cleanup-путь, поэтому внешний отчёт получает cleanup error
с phase return без подмены primary.

Если disposal владельца выиграл первым, внешнее публичное чтение быстро
завершается cancelled, а отчёт остаётся disposed. Ошибка cancel send затем
попадает в cleanupErrors через return как общая сводка; отменённое внутреннее
transport-чтение может также дать lateReadError с этой сводкой. Второй primary
не возникает, штатная отмена не становится active-read failure. Отчёты транспорта
и внешнего адаптера различаются.

Player сохраняет прежние правила подготовки/Restart, cleanup barrier и доставки
ошибок/отчётов. Ошибка cleanup может запретить замену; dispose сразу снимает UI,
поздняя очистка источника не вызывает новых UI callbacks. U5 не добавляет callback,
статус, восстановление или автоматический restart источника.

## Приёмка и доказательства

Публичный набор [worker-post-errors.test.mjs](../../test/worker-post-errors.test.mjs)
теперь покрывает матрицу 75 регрессиями и также запускается на установленном
архиве. Правки production-исходников не потребовались. Матрица приёмки:

| Сценарий | Требуемое наблюдение |
| --- | --- |
| Init/pull с DOMException, Error, non-Error/undefined/hostile value | Точное identity в быстром отказе чтения, следующих чтениях и failed-отчёте; host/post, без преобразования/мутации/retry |
| Getter фактической отправки и начальная валидация handle | Правильный post/create без изменения factory/input/serialization-правил |
| Primary post error плюс cancel/terminate/teardown-ошибки | Primary прежняя; вторичные случаи учтены по одному; сохранены первый cleanup-контекст и общая сводка |
| Отмена до send throw и ошибка cancel send | Выигрывают disposed/reason; поздняя operational issue отделена от cleanup, undefined не теряется |
| Прямой transport и createAsyncSource/Player | Прежний return cleanup barrier, cancelled/failed внешнего адаптера и отчёты, без дублирования primary/UI callbacks |
| Успех, EOF, повторные return/dispose и поздние ответы | Прежние data/transfer-правила, без cancel на EOF, однократная очистка, неизменный завершённый отчёт |

Историческая [проверка контракта](../checks/u5-post-errors-contract-2026-11-14.json) фиксирует
30 read-only fault-injection проб неизменённого публичного адаптера с настоящим
endpoint через прежний внутрипроцессный клонирующий транспорт и fake clock.
Охвачены init/pull значения/getters, primary/cancel, прямая/внешняя отмена и
отмена до throw. Это не native browser failure и не новый прогон установленного
пакета, полного набора или CI. Исходный аудит 0.16.0 остаётся историческим;
U5 теперь решён как контракт. Последующий постоянный набор прошёл все 75 случаев:
create/post getters, виды отправки, первые late/cleanup issue, повторный return,
естественный EOF, copy/transfer, отправка до throw и Player Start/Next/Restart/dispose.
Все 503 теста репозитория прошли. [Отчёт регрессий](../checks/u5-post-errors-regressions-2026-11-14.json)
фиксирует установленных потребителей и прежние production/declaration/build hashes.
Это настоящий adapter/endpoint через прежний внутрипроцессный транспорт, а не
новый native browser или CI-прогон. Этот датированный отчёт предшествовал выпуску 1.0.0; нынешний релизный статус
приведён в [текущем индексе](current-api.md).
