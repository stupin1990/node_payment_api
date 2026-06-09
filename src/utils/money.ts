import { Decimal } from 'decimal.js';
import { Types } from 'mongoose';

export interface InvoiceAmounts {
  amount: string;
  feePercent: string;
  fee: string;
  amountToReceive: string;
}

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export function calculateInvoiceAmounts(amountInput: string | number, feePercentInput: string): InvoiceAmounts {
  const amount = new Decimal(amountInput);
  const feePercent = new Decimal(feePercentInput);

  if (!amount.isFinite() || amount.lte(0)) {
    throw new Error('amount must be greater than 0');
  }

  if (!feePercent.isFinite() || feePercent.lt(0) || feePercent.gte(1)) {
    throw new Error('merchant feePercent must be >= 0 and < 1');
  }

  const fee = amount.mul(feePercent);
  const amountToReceive = amount.minus(fee);

  return {
    amount: amount.toFixed(),
    feePercent: feePercent.toFixed(),
    fee: fee.toFixed(),
    amountToReceive: amountToReceive.toFixed(),
  };
}

export function decimal128(value: string): Types.Decimal128 {
  return Types.Decimal128.fromString(value);
}

export function decimalToString(value: unknown): string {
  if (value && typeof value === 'object' && 'toString' in value) {
    return value.toString();
  }

  return String(value);
}
