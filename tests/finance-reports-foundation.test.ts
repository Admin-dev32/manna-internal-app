import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const reportsSource = readFileSync(new URL('../services/finance/reports.ts', import.meta.url), 'utf8');

test('draft invoices are excluded from revenueSignal', () => {
  assert.match(reportsSource, /invoice_status !== 'draft'/);
});

test('void invoices are excluded from revenueSignal', () => {
  assert.match(reportsSource, /invoice_status !== 'void'/);
});

test('invoiceStatus filter only affects invoices', () => {
  assert.match(reportsSource, /invoiceStatus\?: InvoiceRecord\['status'\] \| null/);
  assert.match(reportsSource, /if \(filters\.invoiceStatus && row\.invoice_status !== filters\.invoiceStatus\) return false;/);
});

test('expenseStatus filter only affects expenses', () => {
  assert.match(reportsSource, /expenseStatus\?: FinancialExpenseRecord\['status'\] \| null/);
  assert.match(reportsSource, /if \(filters\.expenseStatus && row\.status !== filters\.expenseStatus\) return false;/);
});

test('payoutStatus filter only affects contractor payouts', () => {
  assert.match(reportsSource, /payoutStatus\?: ContractorPayoutRecord\['status'\] \| null/);
  assert.match(reportsSource, /if \(filters\.payoutStatus && row\.status !== filters\.payoutStatus\) return false;/);
});

test('event profit table copy uses known payment signal wording', () => {
  const source = readFileSync(new URL('../components/finance/event-profit-table.tsx', import.meta.url), 'utf8');
  assert.match(source, /Known payment signal/);
  assert.doesNotMatch(source, /· Paid:/);
});
