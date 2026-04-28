import test from 'node:test';
import assert from 'node:assert/strict';

import { computeInvoicePaymentSummary, validateRecordManualInvoicePaymentInput } from '../lib/finance/invoice-payments.ts';

test('computeInvoicePaymentSummary counts only succeeded payments toward paid totals', () => {
  const summary = computeInvoicePaymentSummary([
    {
      status: 'succeeded',
      amount: 100,
      fee_amount: 3,
      net_amount: 97,
      payment_date: '2026-05-01',
    },
    {
      status: 'pending',
      amount: 120,
      fee_amount: 4,
      net_amount: 116,
      payment_date: '2026-05-02',
    },
    {
      status: 'failed',
      amount: 130,
      fee_amount: 5,
      net_amount: 125,
      payment_date: '2026-05-03',
    },
    {
      status: 'refunded',
      amount: 80,
      fee_amount: 2,
      net_amount: 78,
      payment_date: '2026-05-04',
    },
  ]);

  assert.equal(summary.totalPaidSucceeded, 100);
  assert.equal(summary.totalFees, 3);
  assert.equal(summary.totalNet, 97);
  assert.equal(summary.paymentCount, 1);
  assert.equal(summary.latestPaymentDate, '2026-05-01');
});

test('computeInvoicePaymentSummary aggregates multiple succeeded payments and latest date', () => {
  const summary = computeInvoicePaymentSummary([
    {
      status: 'succeeded',
      amount: 100,
      fee_amount: 3,
      net_amount: 97,
      payment_date: '2026-05-01',
    },
    {
      status: 'succeeded',
      amount: 50,
      fee_amount: 1.25,
      net_amount: 48.75,
      payment_date: '2026-05-06',
    },
    {
      status: 'reversed',
      amount: 50,
      fee_amount: 1,
      net_amount: 49,
      payment_date: '2026-05-07',
    },
  ]);

  assert.equal(summary.totalPaidSucceeded, 150);
  assert.equal(summary.totalFees, 4.25);
  assert.equal(summary.totalNet, 145.75);
  assert.equal(summary.paymentCount, 2);
  assert.equal(summary.latestPaymentDate, '2026-05-06');
});

test('validateRecordManualInvoicePaymentInput validates amount/fee/date/method', () => {
  const ok = validateRecordManualInvoicePaymentInput({
    amount: 250,
    paymentDate: '2026-05-12',
    paymentMethod: 'zelle',
    feeAmount: 2.5,
    reference: 'ZELLE-123',
  });

  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.amount, 250);
    assert.equal(ok.value.feeAmount, 2.5);
    assert.equal(ok.value.netAmount, 247.5);
    assert.equal(ok.value.paymentDate, '2026-05-12');
  }

  const invalidDate = validateRecordManualInvoicePaymentInput({
    amount: 100,
    paymentDate: '05/12/2026',
    paymentMethod: 'cash',
  });
  assert.equal(invalidDate.ok, false);

  const invalidFee = validateRecordManualInvoicePaymentInput({
    amount: 100,
    paymentDate: '2026-05-12',
    paymentMethod: 'cash',
    feeAmount: 120,
  });
  assert.equal(invalidFee.ok, false);
});
