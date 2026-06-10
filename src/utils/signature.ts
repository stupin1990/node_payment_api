import crypto from 'node:crypto';

export function createWebhookSignature(rawBody: Buffer | string, secret: string, timestamp: string, nonce: string): string {
  const payload = Buffer.concat([
    Buffer.from(`${timestamp}.${nonce}.`),
    Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody)
  ]);
  
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyWebhookSignature(rawBody: Buffer, secret: string, signatureHeader: string, timestamp: string, nonce: string): boolean {
  const signature = createWebhookSignature(rawBody, secret, timestamp, nonce);
  const expected = Buffer.from(signature, 'hex');

  const normalizedSignature = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice('sha256='.length)
    : signatureHeader;

  if (!/^[a-f0-9]{64}$/i.test(normalizedSignature)) {
    return false;
  }

  const received = Buffer.from(normalizedSignature, 'hex');
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export function hashSignature(signatureHeader: string): string {
  return crypto.createHash('sha256').update(signatureHeader).digest('hex');
}

export function parseWebhookTimestamp(value: string): Date | null {
  const numeric = Number(value);

  if (Number.isFinite(numeric)) {
    return new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isTimestampFresh(timestamp: Date, toleranceSeconds: number, now = new Date()): boolean {
  const driftMs = Math.abs(now.getTime() - timestamp.getTime());
  return driftMs <= toleranceSeconds * 1000;
}
