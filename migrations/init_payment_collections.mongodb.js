import { MongoClient, Decimal128 } from 'mongodb';
import { config } from '../dist/src/config.js';

const migrationName = 'init_payment_collections';
const direction = process.argv[2] || 'up';
const mongoUri = config.mongoUri;


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

  const merchantsCount = await db.collection('merchants').countDocuments();
  if (merchantsCount === 0) {
    const now = new Date();
    const testMerchants = [
      {
        _id: 'merch_apple_store',
        feePercent: Decimal128.fromString('0.015'), // 1.5%
        webhookSecret: 'v3ry_s3cr3t_wh_k3y_for_appl3_stor3_32ch',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: 'merch_google_play',
        feePercent: Decimal128.fromString('0.020'), // 2.0%
        webhookSecret: 'googl3_play_s3cr3t_signature_key_32chars',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: 'merch_steam_shop',
        feePercent: Decimal128.fromString('0.030'), // 3.0%
        webhookSecret: 'st3am_valv3_s3cr3t_webhook_token_32ch',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: 'merch_indie_games',
        feePercent: Decimal128.fromString('0.010'), // 1.0%
        webhookSecret: 'ind1e_g4m3s_wh_auth_k3y_length_gt_32',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: 'merch_inactive_biz',
        feePercent: Decimal128.fromString('0.025'), // 2.5%
        webhookSecret: 'dis4bl3d_merchant_t3st_wh_key_32chars',
        status: 'disabled',
        createdAt: now,
        updatedAt: now,
      },
    ];

    await db.collection('merchants').insertMany(testMerchants);
    console.log(`${migrationName}: seeded 5 test merchants`);
  }

}

async function down(db) {
  await dropCollectionIfExists(db, 'webhook_events');
  await dropCollectionIfExists(db, 'ledger_entries');
  await dropCollectionIfExists(db, 'invoices');
  await dropCollectionIfExists(db, 'merchants');
}

async function run() {
  if (!['up', 'down'].includes(direction)) {
    throw new Error(`Usage: node migrations/init_payment_collections.mongodb.js [up|down]`);
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
