import { Schema, model } from 'mongoose';

const webhookEventSchema = new Schema(
  {
    nonce: { type: String, required: true, minlength: 16, unique: true },
    timestamp: { type: Date, required: true },
    signatureHash: { type: String, required: true },
    invoiceId: { type: Schema.Types.ObjectId, required: true, index: true },
    status: { type: String, required: true, enum: ['paid', 'failed'] },
    processed: { type: Boolean, required: true },
    error: { type: String, default: null },
    createdAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  {
    collection: 'webhook_events',
    versionKey: false,
  },
);

export const WebhookEvent = model('WebhookEvent', webhookEventSchema);
