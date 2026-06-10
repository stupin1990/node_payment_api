Небольшой api сервис приёма платежей. Мерчант создаёт счёт (invoice) на оплату. Платёжная система позже присылает webhook со статусом оплаты. Деньги реальные, поэтому к подписи запросов, защите от повторных запросов и точности расчётов требования строгие.

Технологический стек:

-  Node.js + TypeScript + Express
-  MongoDB (Mongoose)
-  Redis
-  Тесты — Jest

Api endpoints:

1. POST http://localhost:3000/invoice — создание счёта
-  Входные поля: amount, currency, merchantId.
-  Комиссия: fee = amount × feePercent (feePercent берётся из настроек мерчанта).
-  Сумма к зачислению: amountToReceive = amount − fee.
-  Сохраняет счёт в MongoDB со статусом pending.
-  Возвращает invoiceId и рассчитанные суммы.

2. POST http://localhost:3000/webhook — приём статуса оплаты
-  Заголовки: X-Signature, X-Timestamp, X-Nonce.
-  Сигнатура рассчитывается по алгоритму hmac sha256 от строки X-Timestamp + '.' + X-Nonce + '.' + [тело запроса] с использованием секретного ключа мерчанта для которого был invoice.
-  Тело: { invoiceId, status }, где status = paid | failed.
-  Проверяется подпись, актуальность времени (защита от повторной отправки) и уникальность nonce.
-  Обновляется статус счёта.
-  Сохраняет факт приема вебхука в коллекции webhook_events
-  Сохраняет зачисление в коллекции ledger_entries
-  При статусе paid зачисление происходит ровно один раз, даже если webhook придёт повторно.

3. GET http://localhost:3000/invoice/:id — получить текущий статус счёта

4. Тесты
- проверка подписи
- идемпотентность webhook (повторная доставка)
- расчёт комиссии.

ЗАПУСК:

Через Docker:
- docker compose up --build -d
- docker compose exec app npm run migrate:up

Без Docker:
- Изменить конфигурацию mongo, redis на нужные в /src/config.ts
- npm install
- npm run build
- npm run migrate:up
- npm run start

Тесты: npm run test
