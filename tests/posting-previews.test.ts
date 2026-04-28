import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildContractorPayoutPaidJournalPreview,
  buildExpenseApprovedJournalPreview,
  buildInvoiceIssueJournalPreview,
  buildInvoicePaymentJournalPreview,
  validatePostingPreviewForDraftCreation,
  validatePostingPreview,
} from '../lib/finance/posting-previews.ts';

test('Invoice issue no tax balances', () => {
  const preview = buildInvoiceIssueJournalPreview({
    invoice: {
      id: 'inv-1',
      issued_at: '2026-04-10',
      created_at: '2026-04-09T12:00:00Z',
      invoice_number: 'INV-001',
      total_amount: 100,
      tax_amount: 0,
      discount_amount: 0,
      sales_tax_payable_account_id: null,
    },
    accounts: {
      accountsReceivable: { id: 'ar', code: '1100', name: 'Accounts Receivable' },
      salesRevenue: { id: 'rev', code: '4000', name: 'Sales Revenue' },
      salesTaxPayable: { id: 'tax', code: '2100', name: 'Sales Tax Payable' },
    },
  });

  assert.equal(preview.isBalanced, true);
  assert.equal(preview.lines.length, 2);
  assert.equal(preview.totalDebits, 100);
  assert.equal(preview.totalCredits, 100);
  assert.equal(validatePostingPreview(preview).ok, true);
});

test('Invoice issue with tax balances', () => {
  const preview = buildInvoiceIssueJournalPreview({
    invoice: {
      id: 'inv-2',
      issued_at: '2026-04-11',
      created_at: '2026-04-10T12:00:00Z',
      invoice_number: 'INV-002',
      total_amount: 108,
      tax_amount: 8,
      discount_amount: 0,
      sales_tax_payable_account_id: null,
    },
    accounts: {
      accountsReceivable: { id: 'ar', code: '1100', name: 'Accounts Receivable' },
      salesRevenue: { id: 'rev', code: '4000', name: 'Sales Revenue' },
      salesTaxPayable: { id: 'tax', code: '2100', name: 'Sales Tax Payable' },
    },
  });

  assert.equal(preview.lines.length, 3);
  assert.equal(preview.totalDebits, 108);
  assert.equal(preview.totalCredits, 108);
  assert.equal(validatePostingPreview(preview).ok, true);
});

test('Invoice payment with fee balances', () => {
  const preview = buildInvoicePaymentJournalPreview({
    payment: {
      id: 'pay-1',
      invoice_id: 'inv-1',
      status: 'succeeded',
      amount: 100,
      fee_amount: 3,
      net_amount: 97,
      payment_date: '2026-04-12',
    },
    accounts: {
      cashOrBank: { id: 'cash', code: '1000', name: 'Cash' },
      merchantFees: { id: 'fee', code: '6500', name: 'Merchant Fees' },
      accountsReceivable: { id: 'ar', code: '1100', name: 'Accounts Receivable' },
    },
  });

  assert.equal(preview.lines.length, 3);
  assert.equal(preview.totalDebits, 100);
  assert.equal(preview.totalCredits, 100);
  assert.equal(validatePostingPreview(preview).ok, true);
});

test('Pending payment returns warning/not buildable', () => {
  const preview = buildInvoicePaymentJournalPreview({
    payment: {
      id: 'pay-2',
      invoice_id: 'inv-1',
      status: 'pending',
      amount: 100,
      fee_amount: 0,
      net_amount: 100,
      payment_date: '2026-04-13',
    },
    accounts: {
      cashOrBank: { id: 'cash', code: '1000', name: 'Cash' },
      merchantFees: { id: 'fee', code: '6500', name: 'Merchant Fees' },
      accountsReceivable: { id: 'ar', code: '1100', name: 'Accounts Receivable' },
    },
  });

  assert.equal(preview.buildable, false);
  assert.match(preview.warnings[0] ?? '', /not postable/i);
});

test('Expense approved uses category account if present', () => {
  const preview = buildExpenseApprovedJournalPreview({
    expense: {
      id: 'exp-1',
      title: 'Food ingredients',
      status: 'approved',
      amount: 75,
      expense_date: '2026-04-14',
      category_id: 'cat-1',
    },
    accounts: {
      categoryExpense: { id: 'cogs', code: '5010', name: 'Food Ingredients COGS' },
      defaultExpense: { id: 'exp', code: '6500', name: 'Default Expense' },
      accountsPayable: { id: 'ap', code: '2200', name: 'Accounts Payable' },
    },
  });

  assert.equal(preview.lines[0]?.accountId, 'cogs');
  assert.equal(preview.isBalanced, true);
});

test('Expense approved falls back to default expense account', () => {
  const preview = buildExpenseApprovedJournalPreview({
    expense: {
      id: 'exp-2',
      title: 'Misc expense',
      status: 'approved',
      amount: 50,
      expense_date: '2026-04-15',
      category_id: null,
    },
    accounts: {
      categoryExpense: null,
      defaultExpense: { id: 'exp', code: '6500', name: 'Default Expense' },
      accountsPayable: { id: 'ap', code: '2200', name: 'Accounts Payable' },
    },
  });

  assert.equal(preview.lines[0]?.accountId, 'exp');
  assert.match(preview.warnings[0] ?? '', /Accounts Payable/i);
});

test('Contractor payout paid balances', () => {
  const preview = buildContractorPayoutPaidJournalPreview({
    payout: {
      id: 'po-1',
      profile_id: 'pr-1',
      status: 'paid',
      amount: 90,
      payout_date: '2026-04-16',
    },
    accounts: {
      contractorLabor: { id: 'labor', code: '6100', name: 'Contractor Labor' },
      cashOrBank: { id: 'cash', code: '1000', name: 'Cash' },
    },
  });

  assert.equal(preview.totalDebits, 90);
  assert.equal(preview.totalCredits, 90);
  assert.equal(validatePostingPreview(preview).ok, true);
});

test('Non-paid payout returns warning/not buildable', () => {
  const preview = buildContractorPayoutPaidJournalPreview({
    payout: {
      id: 'po-2',
      profile_id: 'pr-1',
      status: 'approved',
      amount: 90,
      payout_date: '2026-04-16',
    },
    accounts: {
      contractorLabor: { id: 'labor', code: '6100', name: 'Contractor Labor' },
      cashOrBank: { id: 'cash', code: '1000', name: 'Cash' },
    },
  });

  assert.equal(preview.buildable, false);
  assert.match(preview.warnings[0] ?? '', /not postable/i);
});

test('Validation catches unbalanced preview', () => {
  const preview = buildInvoiceIssueJournalPreview({
    invoice: {
      id: 'inv-bad',
      issued_at: '2026-04-20',
      created_at: '2026-04-19T12:00:00Z',
      invoice_number: 'INV-BAD',
      total_amount: 100,
      tax_amount: 0,
      discount_amount: 0,
      sales_tax_payable_account_id: null,
    },
    accounts: {
      accountsReceivable: { id: 'ar', code: '1100', name: 'Accounts Receivable' },
      salesRevenue: { id: 'rev', code: '4000', name: 'Sales Revenue' },
      salesTaxPayable: { id: 'tax', code: '2100', name: 'Sales Tax Payable' },
    },
  });

  preview.lines[1]!.credit = 95;
  preview.totalCredits = 95;
  preview.isBalanced = false;

  const result = validatePostingPreview(preview);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' | '), /Total debits must equal total credits/i);
});

test('valid preview accepted for draft creation', () => {
  const preview = buildInvoiceIssueJournalPreview({
    invoice: {
      id: 'inv-draft-ok',
      issued_at: '2026-04-21',
      created_at: '2026-04-20T12:00:00Z',
      invoice_number: 'INV-DRAFT-OK',
      total_amount: 120,
      tax_amount: 0,
      discount_amount: 0,
      sales_tax_payable_account_id: null,
    },
    accounts: {
      accountsReceivable: { id: 'ar', code: '1100', name: 'Accounts Receivable' },
      salesRevenue: { id: 'rev', code: '4000', name: 'Sales Revenue' },
      salesTaxPayable: { id: 'tax', code: '2100', name: 'Sales Tax Payable' },
    },
  });

  const result = validatePostingPreviewForDraftCreation(preview);
  assert.equal(result.ok, true);
});

test('missing accountId rejected for draft creation', () => {
  const preview = buildInvoiceIssueJournalPreview({
    invoice: {
      id: 'inv-draft-missing-account',
      issued_at: '2026-04-21',
      created_at: '2026-04-20T12:00:00Z',
      invoice_number: 'INV-DRAFT-MA',
      total_amount: 120,
      tax_amount: 0,
      discount_amount: 0,
      sales_tax_payable_account_id: null,
    },
    accounts: {
      accountsReceivable: { id: 'ar', code: '1100', name: 'Accounts Receivable' },
      salesRevenue: { id: 'rev', code: '4000', name: 'Sales Revenue' },
      salesTaxPayable: { id: 'tax', code: '2100', name: 'Sales Tax Payable' },
    },
  });
  preview.lines[0]!.accountId = null;

  const result = validatePostingPreviewForDraftCreation(preview);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' | '), /missing accountId/i);
});

test('less than 2 lines rejected for draft creation', () => {
  const preview = buildInvoiceIssueJournalPreview({
    invoice: {
      id: 'inv-draft-one-line',
      issued_at: '2026-04-22',
      created_at: '2026-04-20T12:00:00Z',
      invoice_number: 'INV-DRAFT-ONE',
      total_amount: 120,
      tax_amount: 0,
      discount_amount: 0,
      sales_tax_payable_account_id: null,
    },
    accounts: {
      accountsReceivable: { id: 'ar', code: '1100', name: 'Accounts Receivable' },
      salesRevenue: { id: 'rev', code: '4000', name: 'Sales Revenue' },
      salesTaxPayable: { id: 'tax', code: '2100', name: 'Sales Tax Payable' },
    },
  });
  preview.lines = [preview.lines[0]!];
  preview.totalDebits = 120;
  preview.totalCredits = 0;
  preview.isBalanced = false;

  const result = validatePostingPreviewForDraftCreation(preview);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' | '), /at least two lines/i);
});

test('line with debit and credit rejected for draft creation', () => {
  const preview = buildInvoiceIssueJournalPreview({
    invoice: {
      id: 'inv-draft-both-sides',
      issued_at: '2026-04-22',
      created_at: '2026-04-20T12:00:00Z',
      invoice_number: 'INV-DRAFT-BOTH',
      total_amount: 120,
      tax_amount: 0,
      discount_amount: 0,
      sales_tax_payable_account_id: null,
    },
    accounts: {
      accountsReceivable: { id: 'ar', code: '1100', name: 'Accounts Receivable' },
      salesRevenue: { id: 'rev', code: '4000', name: 'Sales Revenue' },
      salesTaxPayable: { id: 'tax', code: '2100', name: 'Sales Tax Payable' },
    },
  });
  preview.lines[0]!.credit = 10;
  preview.totalCredits = 130;
  preview.isBalanced = false;

  const result = validatePostingPreviewForDraftCreation(preview);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' | '), /cannot have both debit and credit/i);
});

test('sourceType/sourceId missing rejected for draft creation', () => {
  const preview = buildInvoiceIssueJournalPreview({
    invoice: {
      id: 'inv-draft-source-missing',
      issued_at: '2026-04-22',
      created_at: '2026-04-20T12:00:00Z',
      invoice_number: 'INV-DRAFT-SRC',
      total_amount: 120,
      tax_amount: 0,
      discount_amount: 0,
      sales_tax_payable_account_id: null,
    },
    accounts: {
      accountsReceivable: { id: 'ar', code: '1100', name: 'Accounts Receivable' },
      salesRevenue: { id: 'rev', code: '4000', name: 'Sales Revenue' },
      salesTaxPayable: { id: 'tax', code: '2100', name: 'Sales Tax Payable' },
    },
  });
  (preview as { sourceType: string; sourceId: string }).sourceType = '';
  (preview as { sourceType: string; sourceId: string }).sourceId = '';

  const result = validatePostingPreviewForDraftCreation(preview);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' | '), /sourceType is required/i);
  assert.match(result.errors.join(' | '), /sourceId is required/i);
});
