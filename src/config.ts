export const config = {
  port: Number(process.env.PORT),
  mongoUri: `mongodb://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}?authSource=admin`,
  redisUrl: process.env.REDIS_URL,
  webhookTimestampToleranceSeconds: 300,
  webhookNonceTtlSeconds: 300,
  webhookLockTtlMs: 5000,
  merchantCacheTtlSeconds: 3600
};
