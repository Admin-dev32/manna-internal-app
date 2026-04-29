import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGLReportsDataset } from '../lib/finance/gl-reports.ts';

const accounts = [
  { id: 'a-ar', code: '1100', name: 'A/R', account_type: 'asset', normal_balance: 'debit' },
  { id: 'a-rev', code: '4000', name: 'Revenue', account_type: 'income', normal_balance: 'credit' },
  { id: 'a-exp', code: '6500', name: 'Expense', account_type: 'expense', normal_balance: 'debit' },
] as const;

const entries = [
  { id: 'je-posted', entry_date: '2026-05-01', status: 'posted', source_type: 'invoice_issue', source_id: 'inv-1' },
  { id: 'je-draft', entry_date: '2026-05-02', status: 'draft', source_type: 'invoice_issue', source_id: 'inv-2' },
] as const;

const lines = [
  { id: 'l1', journal_entry_id: 'je-posted', account_id: 'a-ar', debit: 100, credit: 0, memo: null, entity_type: null, entity_id: null },
  { id: 'l2', journal_entry_id: 'je-posted', account_id: 'a-rev', debit: 0, credit: 100, memo: null, entity_type: null, entity_id: null },
  { id: 'l3', journal_entry_id: 'je-draft', account_id: 'a-exp', debit: 50, credit: 0, memo: null, entity_type: null, entity_id: null },
  { id: 'l4', journal_entry_id: 'je-draft', account_id: 'a-ar', debit: 0, credit: 50, memo: null, entity_type: null, entity_id: null },
] as const;

test('posted entries only (draft excluded)', () => {
  const result = buildGLReportsDataset(entries as never, lines as never, accounts as never, {});
  assert.equal(result.generalLedgerRows.length, 2);
  assert.equal(result.generalLedgerRows.some((row) => row.journalEntryId === 'je-draft'), false);
});

test('trial balance debits equal credits for posted set', () => {
  const result = buildGLReportsDataset(entries as never, lines as never, accounts as never, {});
  assert.equal(result.trialBalanceTotals.totalDebit, result.trialBalanceTotals.totalCredit);
  assert.equal(result.trialBalanceTotals.isBalanced, true);
});

test('income/expense signs and grouping', () => {
  const postedExpenseEntry = [{ id: 'je-posted-exp', entry_date: '2026-05-03', status: 'posted', source_type: 'expense_approved', source_id: 'exp-1' }] as const;
  const postedExpenseLines = [
    { id: 'l5', journal_entry_id: 'je-posted-exp', account_id: 'a-exp', debit: 30, credit: 0, memo: null, entity_type: null, entity_id: null },
    { id: 'l6', journal_entry_id: 'je-posted-exp', account_id: 'a-ar', debit: 0, credit: 30, memo: null, entity_type: null, entity_id: null },
  ] as const;

  const result = buildGLReportsDataset(
    [...entries, ...postedExpenseEntry] as never,
    [...lines, ...postedExpenseLines] as never,
    accounts as never,
    {},
  );

  assert.equal(result.profitLoss.income, 100);
  assert.equal(result.profitLoss.expense, 30);
  assert.equal(result.profitLoss.estimatedNetIncome, 70);
});

test('date range filtering', () => {
  const result = buildGLReportsDataset(entries as never, lines as never, accounts as never, { dateFrom: '2026-05-02' });
  assert.equal(result.generalLedgerRows.length, 0);
});

test('account type filtering', () => {
  const result = buildGLReportsDataset(entries as never, lines as never, accounts as never, { accountType: 'income' });
  assert.equal(result.generalLedgerRows.length, 1);
  assert.equal(result.generalLedgerRows[0]!.accountType, 'income');
});
