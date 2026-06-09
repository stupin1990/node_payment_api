import { Types } from 'mongoose';
import { config } from '../config.js';
import { HttpError, isDuplicateKeyError } from '../errors.js';
import { Invoice, type InvoiceStatus } from '../models/invoice.js';
import { LedgerEntry } from '../models/ledger-entry.js';
import { WebhookEvent } from '../models/webhook-event.js';
import { acquireInvoiceLock, releaseInvoiceLock, reserveNonce } from '../redis.js';
import { decimalToString } from '../utils/money.js';
import {
  hashSignature,
  isTimestampFresh,
  parseWebhookTimestamp,
  verifyWebhookSignature,
} from '../utils/signature.js';
import { getMerchantSettings } from './merchant-settings.js';

interface WebhookBody {
  invoiceId: string;
  status: WebhookStatus;
}

interface WebhookHeaders {
  signature?: string;
  timestamp?: string;
  nonce?: string;
}

type WebhookStatus = Extract<InvoiceStatus, 'paid' | 'failed'>;
type InvoiceRecord = {
  _id: Types.ObjectId;
  merchantId: string;
  amountToReceive: Types.Decimal128;
  currency: string;
  status: InvoiceStatus;
  paidAt?: Date | null;
  failedAt?: Date | null;
  creditedAt?: Date | null;
};

function validateWebhookBody(body: Partial<WebhookBody>): WebhookBody {
  if (typeof body.invoiceId !== 'string' || !Types.ObjectId.isValid(body.invoiceId)) {
    throw new HttpError(400, 'invalid invoiceId');
  }

  if (body.status !== 'paid' && body.status !== 'failed') {
    throw new HttpError(400, 'status must be paid or failed');
  }

  return {
    invoiceId: body.invoiceId,
    status: body.status,
  };
}

function validateHeaders(headers: WebhookHeaders): Required<WebhookHeaders> {
  if (!headers.signature) {
    throw new HttpError(401, 'X-Signature header is required');
  }

  if (!headers.timestamp) {
    throw new HttpError(401, 'X-Timestamp header is required');
  }

  if (!headers.nonce || headers.nonce.length < 16) {
    throw new HttpError(401, 'X-Nonce header is required and must be at least 16 chars');
  }

  return headers as Required<WebhookHeaders>;
}

async function createWebhookEvent(input: {
  nonce: string;
  timestamp: Date;
  signature: string;
  invoiceId: Types.ObjectId;
  status: WebhookStatus;
  processed: boolean;
  error?: string;
}) {
  try {
    await WebhookEvent.create({
      nonce: input.nonce,
      timestamp: input.timestamp,
      signatureHash: hashSignature(input.signature),
      invoiceId: input.invoiceId,
      status: input.status,
      processed: input.processed,
      error: input.error ?? null,
      expiresAt: new Date(Date.now() + config.webhookNonceTtlSeconds * 1000),
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
  }
}

export async function markPaidOnce(invoice: InvoiceRecord | null) {
  if (!invoice) {
    throw new HttpError(404, 'invoice not found');
  }

  const now = new Date();
  let credited = false;

  try {
    await LedgerEntry.create({
      invoiceId: invoice._id,
      merchantId: invoice.merchantId,
      type: 'payment_credit',
      amount: invoice.amountToReceive,
      currency: invoice.currency,
      createdAt: now,
    });
    credited = true;
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
  }

  const update: Record<string, unknown> = {
    status: 'paid',
    failedAt: null,
  };

  if (!invoice.paidAt) {
    update.paidAt = now;
  }

  if (credited || !invoice.creditedAt) {
    update.creditedAt = credited ? now : invoice.creditedAt ?? now;
  }

  await Invoice.updateOne({ _id: invoice._id }, { $set: update });

  return {
    invoiceId: invoice._id.toString(),
    status: 'paid',
    credited,
  };
}

async function markFailed(invoice: InvoiceRecord | null) {
  if (!invoice) {
    throw new HttpError(404, 'invoice not found');
  }

  if (invoice.status === 'paid') {
    return {
      invoiceId: invoice._id.toString(),
      status: 'paid',
      credited: false,
    };
  }

  const now = new Date();
  await Invoice.updateOne(
    { _id: invoice._id, status: { $ne: 'paid' } },
    {
      $set: {
        status: 'failed',
        failedAt: invoice.failedAt ?? now,
      },
    },
  );

  return {
    invoiceId: invoice._id.toString(),
    status: 'failed',
    credited: false,
  };
}

export async function processWebhook(input: {
  rawBody: Buffer;
  body: unknown;
  headers: WebhookHeaders;
}) {
  const headers = validateHeaders(input.headers);
  const timestamp = parseWebhookTimestamp(headers.timestamp);

  if (!timestamp || !isTimestampFresh(timestamp, config.webhookTimestampToleranceSeconds)) {
    throw new HttpError(401, 'stale or invalid timestamp');
  }

  const body = validateWebhookBody(input.body as Partial<WebhookBody>);
  const invoice = (await Invoice.findById(body.invoiceId)) as InvoiceRecord | null;

  if (!invoice) {
    throw new HttpError(404, 'invoice not found');
  }

  const merchant = await getMerchantSettings(invoice.merchantId);

  if (!verifyWebhookSignature(input.rawBody, merchant.webhookSecret, headers.signature, headers.timestamp, headers.nonce)) {
    throw new HttpError(401, 'invalid signature');
  }

  const nonceReserved = await reserveNonce(headers.nonce, config.webhookNonceTtlSeconds);

  if (!nonceReserved) {
    throw new HttpError(409, 'duplicate webhook nonce');
  }

  const lockToken = await acquireInvoiceLock(body.invoiceId, config.webhookLockTtlMs);

  if (!lockToken) {
    await createWebhookEvent({
      nonce: headers.nonce,
      timestamp,
      signature: headers.signature,
      invoiceId: invoice._id,
      status: body.status,
      processed: false,
      error: 'invoice is locked',
    });
    throw new HttpError(409, 'invoice is locked, retry later');
  }

  try {
    const currentInvoice = (await Invoice.findById(body.invoiceId)) as InvoiceRecord | null;
    const result = body.status === 'paid' ? await markPaidOnce(currentInvoice) : await markFailed(currentInvoice);

    await createWebhookEvent({
      nonce: headers.nonce,
      timestamp,
      signature: headers.signature,
      invoiceId: invoice._id,
      status: body.status,
      processed: true,
    });

    return {
      ...result,
      amountToReceive: decimalToString(currentInvoice?.amountToReceive),
    };
  } finally {
    await releaseInvoiceLock(body.invoiceId, lockToken);
  }
}
