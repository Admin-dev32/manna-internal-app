import test from 'node:test';
import assert from 'node:assert/strict';

import { getPaymentStatus } from '../lib/finance/payment-status.ts';

test('paid in full via invoice paid', () => {
  const result = getPaymentStatus({
    quoteTotalAmount: 1000,
    invoices: [{ status: 'paid', total_amount: 1000 }],
  });

  assert.equal(result.status, 'paid_in_full');
  assert.equal(result.amountDue, 0);
});

test('deposit paid balance pending via invoice partially paid', () => {
  const result = getPaymentStatus({
    quoteTotalAmount: 1000,
    expectedDeposit: 300,
    invoices: [{ status: 'partially_paid', total_amount: 1000 }],
  });

  assert.equal(result.status, 'deposit_paid_balance_pending');
  assert.equal(result.amountPaid, 300);
  assert.equal(result.amountDue, 700);
  assert.ok(result.reasons.includes('temporary_expected_deposit_fallback'));
});

test('payment pending with expected values but no invoice signal', () => {
  const result = getPaymentStatus({
    quoteTotalAmount: 1200,
    expectedDeposit: 400,
    estimatedBalance: 800,
  });

  assert.equal(result.status, 'payment_pending');
});

test('reserved but not fully paid for active reservation with issued invoice', () => {
  const result = getPaymentStatus({
    preEventStatus: 'en_preparacion',
    quoteTotalAmount: 900,
    invoices: [{ status: 'issued', total_amount: 900 }],
  });

  assert.equal(result.status, 'reserved_not_paid_in_full');
});

test('cancelled or inactive for cancelled event', () => {
  const result = getPaymentStatus({
    eventStatus: 'cancelado',
    quoteTotalAmount: 900,
    invoices: [{ status: 'paid', total_amount: 900 }],
  });

  assert.equal(result.status, 'cancelled_or_inactive');
});

test('unknown when insufficient data', () => {
  const result = getPaymentStatus({});

  assert.equal(result.status, 'unknown');
  assert.ok(result.reasons.includes('insufficient_data'));
});
