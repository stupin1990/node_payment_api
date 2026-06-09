import { Schema, model, type InferSchemaType } from 'mongoose';

export const invoiceStatuses = ['pending', 'paid', 'failed'] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

const invoiceSchema = new Schema(
  {
    merchantId: { type: String, required: true, index: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    currency: { type: String, required: true, match: /^[A-Z]{3}$/ },
    feePercent: { type: Schema.Types.Decimal128, required: true },
    fee: { type: Schema.Types.Decimal128, required: true },
    amountToReceive: { type: Schema.Types.Decimal128, required: true },
    status: { type: String, required: true, enum: invoiceStatuses, default: 'pending' },
    paidAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    creditedAt: { type: Date, default: null },
  },
  {
    collection: 'invoices',
    timestamps: true,
    versionKey: false,
  },
);

export type InvoiceDocument = InferSchemaType<typeof invoiceSchema> & { _id: unknown };
export const Invoice = model('Invoice', invoiceSchema);
