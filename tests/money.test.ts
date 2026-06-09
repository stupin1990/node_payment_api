import { calculateInvoiceAmounts } from '../src/utils/money.js';

describe('calculateInvoiceAmounts', () => {
  it('calculates fee and amountToReceive exactly', () => {
    expect(calculateInvoiceAmounts('100.00', '0.025')).toEqual({
      amount: '100',
      feePercent: '0.025',
      fee: '2.5',
      amountToReceive: '97.5',
    });
  });
});
