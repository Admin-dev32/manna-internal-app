import type { ContractorPayoutRecord, FinancialExpenseRecord, JournalEntrySourceType } from '@/types/finance';
import type { InvoicePaymentRecord, InvoiceRecord } from '@/types/invoices';

function toMoney(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

function sumBy(values: PostingPreviewLine[], key: 'debit' | 'credit') {
  return toMoney(values.reduce((acc, value) => acc + toMoney(value[key]), 0));
}

export interface PostingPreviewLine {
  accountId: string | null;
  accountCode?: string | null;
  accountName?: string | null;
  debit: number;
  credit: number;
  memo: string;
  entityType?: string | null;
  entityId?: string | null;
}

export interface PostingPreview {
  sourceType: JournalEntrySourceType;
  sourceId: string;
  entryDate: string;
  description: string;
  lines: PostingPreviewLine[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  buildable: boolean;
  warnings: string[];
}

export interface PostingPreviewValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface DraftPostingPreviewValidationResult {
  ok: boolean;
  errors: string[];
}

export interface ResolvedPostingAccount {
  id: string | null;
  code?: string | null;
  name?: string | null;
}

interface BuildPreviewInputBase {
  sourceType: JournalEntrySourceType;
  sourceId: string;
  entryDate: string;
  description: string;
  lines: PostingPreviewLine[];
  warnings?: string[];
  buildable?: boolean;
}

function createPreview(input: BuildPreviewInputBase): PostingPreview {
  const totalDebits = sumBy(input.lines, 'debit');
  const totalCredits = sumBy(input.lines, 'credit');
  const isBalanced = totalDebits === totalCredits && totalDebits > 0;

  return {
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    entryDate: input.entryDate,
    description: input.description,
    lines: input.lines,
    totalDebits,
    totalCredits,
    isBalanced,
    buildable: input.buildable ?? true,
    warnings: input.warnings ?? [],
  };
}

export function validatePostingPreview(preview: PostingPreview): PostingPreviewValidationResult {
  const warnings = [...preview.warnings];
  const errors: string[] = [];

  if (!preview.buildable) {
    return {
      ok: false,
      errors: ['Preview is not buildable.'],
      warnings,
    };
  }

  if (preview.lines.length < 2) {
    errors.push('Posting preview must include at least two lines.');
  }

  for (const [index, line] of preview.lines.entries()) {
    const debit = toMoney(line.debit);
    const credit = toMoney(line.credit);

    if (!line.accountId) {
      warnings.push(`Line ${index + 1} is missing accountId.`);
    }

    if (debit <= 0 && credit <= 0) {
      errors.push(`Line ${index + 1} must have a positive debit or credit.`);
    }

    if (debit > 0 && credit > 0) {
      errors.push(`Line ${index + 1} cannot have both debit and credit > 0.`);
    }
  }

  if (toMoney(preview.totalDebits) !== toMoney(preview.totalCredits)) {
    errors.push('Total debits must equal total credits.');
  }

  if (preview.totalDebits <= 0 || preview.totalCredits <= 0) {
    errors.push('Total debits and credits must be greater than zero.');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export function validatePostingPreviewForDraftCreation(preview: PostingPreview): DraftPostingPreviewValidationResult {
  const baseValidation = validatePostingPreview(preview);
  const errors = [...baseValidation.errors];

  if (!String(preview.sourceType ?? '').trim()) {
    errors.push('sourceType is required.');
  }

  if (!String(preview.sourceId ?? '').trim()) {
    errors.push('sourceId is required.');
  }

  if (!String(preview.entryDate ?? '').trim()) {
    errors.push('entryDate is required.');
  }

  for (const [index, line] of preview.lines.entries()) {
    if (!String(line.accountId ?? '').trim()) {
      errors.push(`Line ${index + 1} is missing accountId.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export interface BuildInvoiceIssueJournalPreviewInput {
  invoice: Pick<InvoiceRecord, 'id' | 'issued_at' | 'created_at' | 'invoice_number' | 'total_amount' | 'tax_amount' | 'discount_amount' | 'sales_tax_payable_account_id'>;
  accounts: {
    accountsReceivable: ResolvedPostingAccount;
    salesRevenue: ResolvedPostingAccount;
    salesTaxPayable: ResolvedPostingAccount;
  };
}

export function buildInvoiceIssueJournalPreview(input: BuildInvoiceIssueJournalPreviewInput): PostingPreview {
  const totalAmount = toMoney(input.invoice.total_amount);
  const taxAmount = Math.max(0, toMoney(input.invoice.tax_amount));
  const discountAmount = Math.max(0, toMoney(input.invoice.discount_amount));
  const revenueAmount = toMoney(Math.max(0, totalAmount - taxAmount));

  const entryDate = String(input.invoice.issued_at ?? input.invoice.created_at).slice(0, 10);

  const lines: PostingPreviewLine[] = [
    {
      accountId: input.accounts.accountsReceivable.id,
      accountCode: input.accounts.accountsReceivable.code,
      accountName: input.accounts.accountsReceivable.name,
      debit: totalAmount,
      credit: 0,
      memo: `Invoice ${input.invoice.invoice_number} issued`,
      entityType: 'invoice',
      entityId: input.invoice.id,
    },
    {
      accountId: input.accounts.salesRevenue.id,
      accountCode: input.accounts.salesRevenue.code,
      accountName: input.accounts.salesRevenue.name,
      debit: 0,
      credit: revenueAmount,
      memo: `Revenue recognized for invoice ${input.invoice.invoice_number}`,
      entityType: 'invoice',
      entityId: input.invoice.id,
    },
  ];

  if (taxAmount > 0) {
    lines.push({
      accountId: input.invoice.sales_tax_payable_account_id ?? input.accounts.salesTaxPayable.id,
      accountCode: input.accounts.salesTaxPayable.code,
      accountName: input.accounts.salesTaxPayable.name,
      debit: 0,
      credit: taxAmount,
      memo: `Sales tax payable for invoice ${input.invoice.invoice_number}`,
      entityType: 'invoice',
      entityId: input.invoice.id,
    });
  }

  const warnings: string[] = [];
  if (discountAmount > 0) {
    warnings.push('Invoice discount is treated as netted into invoice total_amount in this preview phase.');
  }

  return createPreview({
    sourceType: 'invoice_issue',
    sourceId: input.invoice.id,
    entryDate,
    description: `Invoice issued ${input.invoice.invoice_number}`,
    lines,
    warnings,
  });
}

export interface BuildInvoicePaymentJournalPreviewInput {
  payment: Pick<InvoicePaymentRecord, 'id' | 'invoice_id' | 'status' | 'amount' | 'fee_amount' | 'net_amount' | 'payment_date'>;
  accounts: {
    cashOrBank: ResolvedPostingAccount;
    merchantFees: ResolvedPostingAccount;
    accountsReceivable: ResolvedPostingAccount;
  };
}

export function buildInvoicePaymentJournalPreview(input: BuildInvoicePaymentJournalPreviewInput): PostingPreview {
  const entryDate = String(input.payment.payment_date).slice(0, 10);
  if (input.payment.status !== 'succeeded') {
    return createPreview({
      sourceType: 'invoice_payment',
      sourceId: input.payment.id,
      entryDate,
      description: `Invoice payment ${input.payment.id}`,
      lines: [],
      warnings: [`Invoice payment status ${input.payment.status} is not postable; only succeeded is buildable.`],
      buildable: false,
    });
  }

  const amount = toMoney(input.payment.amount);
  const feeAmount = Math.max(0, toMoney(input.payment.fee_amount));
  const netAmount = toMoney(input.payment.net_amount);

  const lines: PostingPreviewLine[] = [
    {
      accountId: input.accounts.cashOrBank.id,
      accountCode: input.accounts.cashOrBank.code,
      accountName: input.accounts.cashOrBank.name,
      debit: netAmount,
      credit: 0,
      memo: `Cash received for invoice ${input.payment.invoice_id}`,
      entityType: 'invoice_payment',
      entityId: input.payment.id,
    },
    {
      accountId: input.accounts.accountsReceivable.id,
      accountCode: input.accounts.accountsReceivable.code,
      accountName: input.accounts.accountsReceivable.name,
      debit: 0,
      credit: amount,
      memo: `Apply cash to A/R for invoice ${input.payment.invoice_id}`,
      entityType: 'invoice_payment',
      entityId: input.payment.id,
    },
  ];

  if (feeAmount > 0) {
    lines.splice(1, 0, {
      accountId: input.accounts.merchantFees.id,
      accountCode: input.accounts.merchantFees.code,
      accountName: input.accounts.merchantFees.name,
      debit: feeAmount,
      credit: 0,
      memo: `Merchant fee for payment ${input.payment.id}`,
      entityType: 'invoice_payment',
      entityId: input.payment.id,
    });
  }

  return createPreview({
    sourceType: 'invoice_payment',
    sourceId: input.payment.id,
    entryDate,
    description: `Invoice payment succeeded ${input.payment.id}`,
    lines,
  });
}

export interface BuildExpenseApprovedJournalPreviewInput {
  expense: Pick<FinancialExpenseRecord, 'id' | 'title' | 'status' | 'amount' | 'expense_date' | 'category_id'>;
  accounts: {
    categoryExpense: ResolvedPostingAccount | null;
    defaultExpense: ResolvedPostingAccount;
    accountsPayable: ResolvedPostingAccount;
  };
}

export function buildExpenseApprovedJournalPreview(input: BuildExpenseApprovedJournalPreviewInput): PostingPreview {
  const amount = toMoney(input.expense.amount);
  const entryDate = String(input.expense.expense_date).slice(0, 10);
  const expenseAccount = input.accounts.categoryExpense?.id ? input.accounts.categoryExpense : input.accounts.defaultExpense;

  return createPreview({
    sourceType: 'expense_approved',
    sourceId: input.expense.id,
    entryDate,
    description: `Expense approved ${input.expense.title}`,
    lines: [
      {
        accountId: expenseAccount.id,
        accountCode: expenseAccount.code,
        accountName: expenseAccount.name,
        debit: amount,
        credit: 0,
        memo: `Expense recognized: ${input.expense.title}`,
        entityType: 'expense',
        entityId: input.expense.id,
      },
      {
        accountId: input.accounts.accountsPayable.id,
        accountCode: input.accounts.accountsPayable.code,
        accountName: input.accounts.accountsPayable.name,
        debit: 0,
        credit: amount,
        memo: `Accrue expense payable: ${input.expense.title}`,
        entityType: 'expense',
        entityId: input.expense.id,
      },
    ],
    warnings: ['Expense payment status is not modeled yet; preview uses Accounts Payable.'],
  });
}

export interface BuildContractorPayoutPaidJournalPreviewInput {
  payout: Pick<ContractorPayoutRecord, 'id' | 'profile_id' | 'status' | 'amount' | 'payout_date'>;
  accounts: {
    contractorLabor: ResolvedPostingAccount;
    cashOrBank: ResolvedPostingAccount;
  };
}

export function buildContractorPayoutPaidJournalPreview(input: BuildContractorPayoutPaidJournalPreviewInput): PostingPreview {
  const entryDate = String(input.payout.payout_date ?? '').slice(0, 10);
  if (input.payout.status !== 'paid') {
    return createPreview({
      sourceType: 'payout_paid',
      sourceId: input.payout.id,
      entryDate,
      description: `Contractor payout ${input.payout.id}`,
      lines: [],
      warnings: [`Contractor payout status ${input.payout.status} is not postable; only paid is buildable.`],
      buildable: false,
    });
  }

  const amount = toMoney(input.payout.amount);

  return createPreview({
    sourceType: 'payout_paid',
    sourceId: input.payout.id,
    entryDate,
    description: `Contractor payout paid ${input.payout.id}`,
    lines: [
      {
        accountId: input.accounts.contractorLabor.id,
        accountCode: input.accounts.contractorLabor.code,
        accountName: input.accounts.contractorLabor.name,
        debit: amount,
        credit: 0,
        memo: `Contractor payout expense for profile ${input.payout.profile_id}`,
        entityType: 'contractor_payout',
        entityId: input.payout.id,
      },
      {
        accountId: input.accounts.cashOrBank.id,
        accountCode: input.accounts.cashOrBank.code,
        accountName: input.accounts.cashOrBank.name,
        debit: 0,
        credit: amount,
        memo: `Cash paid for contractor payout ${input.payout.id}`,
        entityType: 'contractor_payout',
        entityId: input.payout.id,
      },
    ],
  });
}
