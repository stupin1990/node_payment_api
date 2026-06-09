import { Types } from 'mongoose';
import { HttpError } from '../errors.js';
import { Invoice } from '../models/invoice.js';
import { calculateInvoiceAmounts, decimal128, decimalToString } from '../utils/money.js';
import { getMerchantSettings } from './merchant-settings.js';

interface CreateInvoiceInput {
  amount: string | number;
  currency: string;
  merchantId: string;
}

function validateCreateInvoiceInput(body: Partial<CreateInvoiceInput>): CreateInvoiceInput {
  if (typeof body.merchantId !== 'string' || body.merchantId.trim() === '') {
    throw new HttpError(400, 'merchantId is required');
  }

  if (typeof body.currency !== 'string' || !/^[A-Z]{3}$/.test(body.currency)) {
    throw new HttpError(400, 'currency must be ISO 4217 uppercase code');
  }

  if (typeof body.amount !== 'string' && typeof body.amount !== 'number') {
    throw new HttpError(400, 'amount is required');
  }

  return {
    amount: body.amount,
    currency: body.currency,
    merchantId: body.merchantId,
  };
}

export async function createInvoice(body: unknown) {
  const input = validateCreateInvoiceInput(body as Partial<CreateInvoiceInput>);
  const merchant = await getMerchantSettings(input.merchantId);

  let amounts;
  try {
    amounts = calculateInvoiceAmounts(input.amount, merchant.feePercent);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : 'invalid amount');
  }

  const invoice = await Invoice.create({
    merchantId: input.merchantId,
    amount: decimal128(amounts.amount),
    currency: input.currency,
    feePercent: decimal128(amounts.feePercent),
    fee: decimal128(amounts.fee),
    amountToReceive: decimal128(amounts.amountToReceive),
    status: 'pending',
  });

  return {
    invoiceId: invoice._id.toString(),
    amount: amounts.amount,
    currency: input.currency,
    feePercent: amounts.feePercent,
    fee: amounts.fee,
    amountToReceive: amounts.amountToReceive,
    status: invoice.status,
  };
}

export async function getInvoiceStatus(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(400, 'invalid invoice id');
  }

  const invoice = await Invoice.findById(id).lean();

  if (!invoice) {
    throw new HttpError(404, 'invoice not found');
  }

  return {
    invoiceId: invoice._id.toString(),
    merchantId: invoice.merchantId,
    amount: decimalToString(invoice.amount),
    currency: invoice.currency,
    fee: decimalToString(invoice.fee),
    amountToReceive: decimalToString(invoice.amountToReceive),
    status: invoice.status,
    paidAt: invoice.paidAt,
    failedAt: invoice.failedAt,
    creditedAt: invoice.creditedAt,
  };
}
