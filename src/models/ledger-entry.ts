import { Schema, model } from 'mongoose';

const ledgerEntrySchema = new Schema(
  {
    invoiceId: { type: Schema.Types.ObjectId, required: true, index: true },
    merchantId: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ['payment_credit'] },
    amount: { type: Schema.Types.Decimal128, required: true },
    currency: { type: String, required: true, match: /^[A-Z]{3}$/ },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  {
    collection: 'ledger_entries',
    versionKey: false,
  },
);

export const LedgerEntry = model('LedgerEntry', ledgerEntrySchema);
