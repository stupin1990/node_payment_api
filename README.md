Небольшой api сервис приёма платежей. Мерчант создаёт счёт (invoice) на оплату. Платёжная система позже присылает webhook со статусом оплаты. Деньги реальные, поэтому к подписи запросов, защите от повторных запросов и точности расчётов требования строгие.

Технологический стек:

-  Node.js + TypeScript + Express
-  MongoDB (Mongoose)
-  Redis
-  Тесты — Jest

Api endpoints:

1. POST /invoice — создание счёта
-  Входные поля: amount, currency, merchantId.
-  Комиссия: fee = amount × feePercent (feePercent берётся из настроек мерчанта).
-  Сумма к зачислению: amountToReceive = amount − fee.
-  Сохранить счёт в MongoDB со статусом pending.
-  Вернуть invoiceId и рассчитанные суммы.

2. POST /webhook — приём статуса оплаты
-  Заголовки: X-Signature (HMAC-SHA256 от тела запроса), X-Timestamp, X-Nonce.
-  Тело: { invoiceId, status }, где status = paid | failed.
-  Проверить подпись, актуальность времени (защита от повторной отправки) и уникальность nonce.
-  Обновить статус счёта.
-  При статусе paid зачисление должно произойти ровно один раз, даже если webhook придёт повторно.

3. GET /invoice/:id — получить текущий статус счёта

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
