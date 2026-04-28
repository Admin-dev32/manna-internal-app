import test from 'node:test';
import assert from 'node:assert/strict';

import { computeFinanceInvoiceAgingSummary } from '../services/invoices/aging.ts';

const NOW = new Date('2026-04-27T12:00:00.000Z');

test('paid and void invoices are excluded from outstanding', () => {
  const summary = computeFinanceInvoiceAgingSummary([
    { id: '1', invoice_number: 'INV-1', status: 'paid', balance_due: 100, due_at: '2026-04-10', client_full_name: 'A' },
    { id: '2', invoice_number: 'INV-2', status: 'void', balance_due: 50, due_at: '2026-04-11', client_full_name: 'B' },
  ], NOW);

  assert.equal(summary.totalOutstandingBalance, 0);
  assert.equal(summary.overdueCount, 0);
  assert.equal(summary.paidCount, 1);
});

test('overdue invoice counted correctly', () => {
  const summary = computeFinanceInvoiceAgingSummary([
    { id: '1', invoice_number: 'INV-1', status: 'issued', balance_due: 125, due_at: '2026-04-20', client_full_name: 'A' },
  ], NOW);

  assert.equal(summary.totalOutstandingBalance, 125);
  assert.equal(summary.totalOverdueBalance, 125);
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.agingBuckets['1_30'].count, 1);
});

test('due soon invoice counted correctly', () => {
  const summary = computeFinanceInvoiceAgingSummary([
    { id: '1', invoice_number: 'INV-1', status: 'issued', balance_due: 80, due_at: '2026-05-02', client_full_name: 'A' },
  ], NOW);

  assert.equal(summary.dueSoonBalance, 80);
  assert.equal(summary.agingBuckets.current.count, 1);
  assert.equal(summary.followUpInvoices[0]?.urgency, 'due_soon');
});

test('aging buckets classify by overdue days', () => {
  const summary = computeFinanceInvoiceAgingSummary([
    { id: '1', invoice_number: 'INV-1', status: 'issued', balance_due: 10, due_at: '2026-03-20', client_full_name: 'A' }, // 38
    { id: '2', invoice_number: 'INV-2', status: 'issued', balance_due: 20, due_at: '2026-02-20', client_full_name: 'B' }, // 66
    { id: '3', invoice_number: 'INV-3', status: 'issued', balance_due: 30, due_at: '2025-12-20', client_full_name: 'C' }, // 128+
  ], NOW);

  assert.equal(summary.agingBuckets['31_60'].count, 1);
  assert.equal(summary.agingBuckets['61_90'].count, 1);
  assert.equal(summary.agingBuckets['90_plus'].count, 1);
});

test('missing due_at goes to unknown bucket', () => {
  const summary = computeFinanceInvoiceAgingSummary([
    { id: '1', invoice_number: 'INV-1', status: 'issued', balance_due: 77, due_at: null, client_full_name: 'A' },
  ], NOW);

  assert.equal(summary.agingBuckets.unknown.count, 1);
  assert.equal(summary.agingBuckets.unknown.balance, 77);
  assert.equal(summary.dueSoonBalance, 0);
});
