import { jest } from '@jest/globals';
import { Types } from 'mongoose';
import { Invoice } from '../src/models/invoice.js';
import { LedgerEntry } from '../src/models/ledger-entry.js';
import { markPaidOnce } from '../src/services/webhook-service.js';

describe('webhook paid idempotency', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not credit twice when the ledger unique key already exists', async () => {
    const invoice = {
      _id: new Types.ObjectId(),
      merchantId: 'merchant-1',
      amountToReceive: Types.Decimal128.fromString('97.5'),
      currency: 'USD',
      status: 'pending' as const,
      paidAt: null,
      creditedAt: null,
    };

    const createLedger = jest.spyOn(LedgerEntry, 'create');
    createLedger.mockResolvedValueOnce({} as never);
    createLedger.mockRejectedValueOnce({ code: 11000 });
    jest.spyOn(Invoice, 'updateOne').mockResolvedValue({ acknowledged: true } as never);

    await expect(markPaidOnce(invoice)).resolves.toMatchObject({ credited: true, status: 'paid' });
    await expect(markPaidOnce(invoice)).resolves.toMatchObject({ credited: false, status: 'paid' });
    expect(createLedger).toHaveBeenCalledTimes(2);
  });
});
