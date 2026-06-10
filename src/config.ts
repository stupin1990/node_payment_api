const port = Number(process.env.PORT ?? 3000);
const dbUsername = process.env.DB_USERNAME ?? 'admin';
const dbPassword = process.env.DB_PASSWORD ?? 'secret';
const dbHost = process.env.DB_HOST ?? 'mongodb';
const dbPort = process.env.DB_PORT ?? 27017;
const database = process.env.DB_DATABASE ?? 'node_payment_api';
const redisUrl = process.env.REDIS_URL ?? 'redis://redis:6379';
const webhookTimestampToleranceSeconds = Number(process.env.WH_TOLERANCE_SECONDS ?? 300);
const webhookNonceTtlSeconds = Number(process.env.WH_NONCE_SECONDS ?? 300);
const webhookLockTtlMs = Number(process.env.WH_LOCK_TTL_MS ?? 5000);
const merchantCacheTtlSeconds = Number(process.env.MERCHANT_CACHE_SECONDS ?? 3600);

export const config = {
  port: port,
  mongoUri: `mongodb://${dbUsername}:${dbPassword}@${dbHost}:${dbPort}/${database}?authSource=admin`,
  redisUrl: redisUrl,
  webhookTimestampToleranceSeconds: webhookTimestampToleranceSeconds,
  webhookNonceTtlSeconds: webhookNonceTtlSeconds,
  webhookLockTtlMs: webhookLockTtlMs,
  merchantCacheTtlSeconds: merchantCacheTtlSeconds
};
