import { createWebhookSignature, verifyWebhookSignature } from '../src/utils/signature.js';

describe('webhook signature', () => {
  it('validates HMAC-SHA256 against the raw body', () => {
    const rawBody = Buffer.from(JSON.stringify({ invoiceId: '507f1f77bcf86cd799439011', status: 'paid' }));
    const secret = 'a'.repeat(32);
    const timestamp = '1760000000';
    const nonce = 'nonce-1234567890';
    const signature = createWebhookSignature(rawBody, secret, timestamp, nonce);

    expect(verifyWebhookSignature(rawBody, secret, signature, timestamp, nonce)).toBe(true);
    expect(verifyWebhookSignature(rawBody, secret, `sha256=${signature}`, timestamp, nonce)).toBe(true);
    expect(verifyWebhookSignature(rawBody, secret, signature, timestamp, 'different-nonce')).toBe(false);
    expect(verifyWebhookSignature(rawBody, secret, '0'.repeat(64), timestamp, nonce)).toBe(false);
  });
});
