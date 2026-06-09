import { Schema, model, type InferSchemaType } from 'mongoose';

const merchantSchema = new Schema(
  {
    _id: { type: String, required: true },
    feePercent: { type: Schema.Types.Decimal128, required: true },
    webhookSecret: { type: String, required: true, minlength: 32 },
    status: { type: String, required: true, enum: ['active', 'disabled'] },
  },
  {
    collection: 'merchants',
    timestamps: true,
    versionKey: false,
  },
);

export type MerchantDocument = InferSchemaType<typeof merchantSchema>;
export const Merchant = model('Merchant', merchantSchema);
