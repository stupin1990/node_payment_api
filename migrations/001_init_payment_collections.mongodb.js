import { MongoClient } from 'mongodb';
import { config } from '../config.js';

const {DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE} = {...config};

const migrationName = '001_init_payment_collections';
const direction = process.argv[2] || 'up';
const mongoUri = `mongodb://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}?authSource=admin`;


const decimalType = 'decimal';
const dateType = 'date';
const objectIdType = 'objectId';
const stringType = 'string';

async function collectionExists(db, name) {
  const collections = await db.listCollections({ name }, { nameOnly: true }).toArray();
  return collections.length > 0;
}

async function createCollectionIfMissing(db, name, options) {
  if (!(await collectionExists(db, name))) {
    await db.createCollection(name, options);
    return;
  }

  if (options?.validator) {
    await db.command({
      collMod: name,
      validator: options.validator,
      validationLevel: options.validationLevel || 'strict',
      validationAction: options.validationAction || 'error',
    });
  }
}

async function dropCollectionIfExists(db, name) {
  if (await collectionExists(db, name)) {
    await db.collection(name).drop();
  }
}

async function up(db) {
  await createCollectionIfMissing(db, 'merchants', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['_id', 'feePercent', 'webhookSecret', 'status', 'createdAt', 'updatedAt'],
        additionalProperties: true,
        properties: {
          _id: {
            bsonType: stringType,
            description: 'External merchant id used by POST /invoice.',
          },
          feePercent: {
            bsonType: decimalType,
            description: 'Merchant fee rate as a fraction, for example 0.025 for 2.5%.',
          },
          webhookSecret: {
            bsonType: stringType,
            minLength: 32,
            description: 'Secret used to validate HMAC-SHA256 webhook signatures.',
          },
          status: {
            enum: ['active', 'disabled'],
          },
          createdAt: {
            bsonType: dateType,
          },
          updatedAt: {
            bsonType: dateType,
          },
        },
      },
    },
    validationLevel: 'strict',
    validationAction: 'error',
  });

  await createCollectionIfMissing(db, 'invoices', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: [
          'merchantId',
          'amount',
          'currency',
          'feePercent',
          'fee',
          'amountToReceive',
          'status',
          'createdAt',
          'updatedAt',
        ],
        additionalProperties: true,
        properties: {
          merchantId: {
            bsonType: stringType,
          },
          amount: {
            bsonType: decimalType,
          },
          currency: {
            bsonType: stringType,
            pattern: '^[A-Z]{3}$',
          },
          feePercent: {
            bsonType: decimalType,
          },
          fee: {
            bsonType: decimalType,
          },
          amountToReceive: {
            bsonType: decimalType,
          },
          status: {
            enum: ['pending', 'paid', 'failed'],
          },
          paidAt: {
            bsonType: [dateType, 'null'],
          },
          failedAt: {
            bsonType: [dateType, 'null'],
          },
          creditedAt: {
            bsonType: [dateType, 'null'],
            description: 'Set when the paid invoice has produced exactly one ledger credit.',
          },
          createdAt: {
            bsonType: dateType,
          },
          updatedAt: {
            bsonType: dateType,
          },
        },
      },
    },
    validationLevel: 'strict',
    validationAction: 'error',
  });

  await createCollectionIfMissing(db, 'ledger_entries', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: [
          'invoiceId',
          'merchantId',
          'type',
          'amount',
          'currency',
          'createdAt',
        ],
        additionalProperties: true,
        properties: {
          invoiceId: {
            bsonType: objectIdType,
          },
          merchantId: {
            bsonType: stringType,
          },
          type: {
            enum: ['payment_credit'],
          },
          amount: {
            bsonType: decimalType,
            description: 'Amount credited to merchant balance.',
          },
          currency: {
            bsonType: stringType,
            pattern: '^[A-Z]{3}$',
          },
          createdAt: {
            bsonType: dateType,
          },
        },
      },
    },
    validationLevel: 'strict',
    validationAction: 'error',
  });

  await createCollectionIfMissing(db, 'webhook_events', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: [
          'nonce',
          'timestamp',
          'signatureHash',
          'invoiceId',
          'status',
          'processed',
          'createdAt',
          'expiresAt',
        ],
        additionalProperties: true,
        properties: {
          nonce: {
            bsonType: stringType,
            minLength: 16,
          },
          timestamp: {
            bsonType: dateType,
            description: 'Value parsed from X-Timestamp.',
          },
          signatureHash: {
            bsonType: stringType,
            description: 'Hash of X-Signature for audit without storing the raw secret-derived value.',
          },
          invoiceId: {
            bsonType: objectIdType,
          },
          status: {
            enum: ['paid', 'failed'],
          },
          processed: {
            bsonType: 'bool',
          },
          error: {
            bsonType: [stringType, 'null'],
          },
          createdAt: {
            bsonType: dateType,
          },
          expiresAt: {
            bsonType: dateType,
            description: 'Retention boundary for replay/audit records.',
          },
        },
      },
    },
    validationLevel: 'strict',
    validationAction: 'error',
  });

  await createCollectionIfMissing(db, 'schema_migrations', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['name', 'appliedAt'],
        additionalProperties: true,
        properties: {
          name: {
            bsonType: stringType,
          },
          appliedAt: {
            bsonType: dateType,
          },
        },
      },
    },
    validationLevel: 'strict',
    validationAction: 'error',
  });

  await db.collection('merchants').createIndex({ status: 1 }, { name: 'merchants_status_idx' });
  await db.collection('merchants').createIndex({ updatedAt: -1 }, { name: 'merchants_updated_at_idx' });

  await db.collection('invoices').createIndex(
    { merchantId: 1, status: 1, createdAt: -1 },
    { name: 'invoices_merchant_status_created_at_idx' },
  );
  await db.collection('invoices').createIndex(
    { status: 1, createdAt: -1 },
    { name: 'invoices_status_created_at_idx' },
  );
  await db.collection('invoices').createIndex(
    { merchantId: 1, createdAt: -1 },
    { name: 'invoices_merchant_created_at_idx' },
  );

  await db.collection('ledger_entries').createIndex(
    { invoiceId: 1, type: 1 },
    {
      name: 'ledger_entries_invoice_credit_once_uidx',
      unique: true,
      partialFilterExpression: { type: 'payment_credit' },
    },
  );
  await db.collection('ledger_entries').createIndex(
    { merchantId: 1, currency: 1, createdAt: -1 },
    { name: 'ledger_entries_merchant_currency_created_at_idx' },
  );

  await db.collection('webhook_events').createIndex(
    { nonce: 1 },
    { name: 'webhook_events_nonce_uidx', unique: true },
  );
  await db.collection('webhook_events').createIndex(
    { invoiceId: 1, createdAt: -1 },
    { name: 'webhook_events_invoice_created_at_idx' },
  );
  await db.collection('webhook_events').createIndex(
    { expiresAt: 1 },
    { name: 'webhook_events_expires_at_ttl_idx', expireAfterSeconds: 0 },
  );

  await db.collection('schema_migrations').createIndex(
    { name: 1 },
    { name: 'schema_migrations_name_uidx', unique: true },
  );
  await db.collection('schema_migrations').updateOne(
    { name: migrationName },
    { $setOnInsert: { name: migrationName, appliedAt: new Date() } },
    { upsert: true },
  );
}

async function down(db) {
  await dropCollectionIfExists(db, 'webhook_events');
  await dropCollectionIfExists(db, 'ledger_entries');
  await dropCollectionIfExists(db, 'invoices');
  await dropCollectionIfExists(db, 'merchants');

  if (await collectionExists(db, 'schema_migrations')) {
    await db.collection('schema_migrations').deleteOne({ name: migrationName });
  }
}

async function run() {
  if (!['up', 'down'].includes(direction)) {
    throw new Error(`Usage: node migrations/001_init_payment_collections.mongodb.js [up|down]`);
  }

  const client = new MongoClient(mongoUri);
  await client.connect();

  try {
    const db = client.db();

    if (direction === 'up') {
      await up(db);
    } else {
      await down(db);
    }

    console.log(`${migrationName}: ${direction} complete`);
  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error(`${migrationName}: ${direction} failed`);
  console.error(error);
  process.exitCode = 1;
});
