import { randomUUID } from 'node:crypto';
import { createClient, type RedisClientType } from 'redis';
import { config } from './config.js';

let client: RedisClientType | null = null;

export async function connectRedis(): Promise<RedisClientType> {
  if (client?.isOpen) {
    return client;
  }

  client = createClient({ url: config.redisUrl });
  client.on('error', (error) => {
    console.error('Redis error', error);
  });
  await client.connect();
  return client;
}

export function getRedis(): RedisClientType {
  if (!client?.isOpen) {
    throw new Error('Redis is not connected');
  }

  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (client?.isOpen) {
    await client.quit();
  }
  client = null;
}

export async function setJsonCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await getRedis().set(key, JSON.stringify(value), { EX: ttlSeconds });
}

export async function getJsonCache<T>(key: string): Promise<T | null> {
  const cached = await getRedis().get(key);
  return cached ? (JSON.parse(cached) as T) : null;
}

export async function reserveNonce(nonce: string, ttlSeconds: number): Promise<boolean> {
  const result = await getRedis().set(`webhook:nonce:${nonce}`, '1', { NX: true, EX: ttlSeconds });
  return result === 'OK';
}

export async function acquireInvoiceLock(invoiceId: string, ttlMs: number): Promise<string | null> {
  const token = randomUUID();
  const result = await getRedis().set(`webhook:lock:invoice:${invoiceId}`, token, { NX: true, PX: ttlMs });
  return result === 'OK' ? token : null;
}

export async function releaseInvoiceLock(invoiceId: string, token: string): Promise<void> {
  await getRedis().eval(
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
    {
      keys: [`webhook:lock:invoice:${invoiceId}`],
      arguments: [token],
    },
  );
}
