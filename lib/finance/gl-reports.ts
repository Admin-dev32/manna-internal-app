import type { ChartAccountNormalBalance, ChartAccountType, JournalEntrySourceType, JournalEntryStatus } from '@/types/finance';

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface GLReportFilters {
  dateFrom?: string | null;
  dateTo?: string | null;
  accountId?: string | null;
  accountType?: ChartAccountType | 'all';
  sourceType?: JournalEntrySourceType | 'all';
}

export interface GLReportEntryRecord {
  id: string;
  entry_date: string;
  status: JournalEntryStatus | string;
  source_type: JournalEntrySourceType | string;
  source_id: string;
}

export interface GLReportLineRecord {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number | string;
  credit: number | string;
  memo: string | null;
  entity_type: string | null;
  entity_id: string | null;
}

export interface GLReportAccountRecord {
  id: string;
  code: string;
  name: string;
  account_type: ChartAccountType | string;
  normal_balance: ChartAccountNormalBalance;
}

export interface GeneralLedgerRow {
  entryDate: string;
  journalEntryId: string;
  sourceType: JournalEntrySourceType | string;
  sourceId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: ChartAccountType | string;
  debit: number;
  credit: number;
  memo: string | null;
  entityType: string | null;
  entityId: string | null;
}

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: ChartAccountType | string;
  normalBalance: ChartAccountNormalBalance;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
  displayBalance: number;
}

export interface AccountActivityRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: ChartAccountType | string;
  openingBalance: number;
  periodDebits: number;
  periodCredits: number;
  endingBalance: number;
}

export interface BasicProfitLoss {
  income: number;
  costOfGoodsSold: number;
  expense: number;
  otherIncome: number;
  otherExpense: number;
  estimatedNetIncome: number;
}

export interface GLReportsDataset {
  generalLedgerRows: GeneralLedgerRow[];
  trialBalanceRows: TrialBalanceRow[];
  accountActivityRows: AccountActivityRow[];
  trialBalanceTotals: {
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
  };
  profitLoss: BasicProfitLoss;
}

export function buildGLReportsDataset(
  entries: GLReportEntryRecord[],
  lines: GLReportLineRecord[],
  accounts: GLReportAccountRecord[],
  filters: GLReportFilters = {},
): GLReportsDataset {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const postedEntries = entries
    .filter((entry) => entry.status === 'posted')
    .filter((entry) => !filters.dateFrom || entry.entry_date >= filters.dateFrom)
    .filter((entry) => !filters.dateTo || entry.entry_date <= filters.dateTo)
    .filter((entry) => !filters.sourceType || filters.sourceType === 'all' || entry.source_type === filters.sourceType);
  const entryById = new Map(postedEntries.map((entry) => [entry.id, entry]));

  const filteredLines = lines
    .filter((line) => entryById.has(line.journal_entry_id))
    .filter((line) => !filters.accountId || line.account_id === filters.accountId)
    .filter((line) => {
      if (!filters.accountType || filters.accountType === 'all') return true;
      return accountById.get(line.account_id)?.account_type === filters.accountType;
    });

  const generalLedgerRows = filteredLines
    .map((line) => {
      const entry = entryById.get(line.journal_entry_id);
      const account = accountById.get(line.account_id);
      if (!entry || !account) return null;

      return {
        entryDate: entry.entry_date,
        journalEntryId: entry.id,
        sourceType: entry.source_type,
        sourceId: entry.source_id,
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.account_type,
        debit: asNumber(line.debit),
        credit: asNumber(line.credit),
        memo: line.memo,
        entityType: line.entity_type,
        entityId: line.entity_id,
      } satisfies GeneralLedgerRow;
    })
    .filter(Boolean) as GeneralLedgerRow[];

  const trialMap = new Map<string, TrialBalanceRow>();
  for (const row of generalLedgerRows) {
    const current = trialMap.get(row.accountId) ?? {
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      accountType: row.accountType,
      normalBalance: accountById.get(row.accountId)?.normal_balance ?? 'debit',
      totalDebit: 0,
      totalCredit: 0,
      netBalance: 0,
      displayBalance: 0,
    };

    current.totalDebit = Math.round((current.totalDebit + row.debit) * 100) / 100;
    current.totalCredit = Math.round((current.totalCredit + row.credit) * 100) / 100;
    current.netBalance = Math.round((current.totalDebit - current.totalCredit) * 100) / 100;
    current.displayBalance = current.normalBalance === 'debit'
      ? current.netBalance
      : Math.round((current.totalCredit - current.totalDebit) * 100) / 100;

    trialMap.set(row.accountId, current);
  }

  const trialBalanceRows = [...trialMap.values()].sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const totalDebit = Math.round(trialBalanceRows.reduce((sum, row) => sum + row.totalDebit, 0) * 100) / 100;
  const totalCredit = Math.round(trialBalanceRows.reduce((sum, row) => sum + row.totalCredit, 0) * 100) / 100;

  const accountActivityRows = trialBalanceRows.map((row) => ({
    accountId: row.accountId,
    accountCode: row.accountCode,
    accountName: row.accountName,
    accountType: row.accountType,
    openingBalance: 0,
    periodDebits: row.totalDebit,
    periodCredits: row.totalCredit,
    endingBalance: row.displayBalance,
  }));

  const sumByAccountType = (accountType: ChartAccountType) =>
    Math.round(
      trialBalanceRows
        .filter((row) => row.accountType === accountType)
        .reduce((sum, row) => sum + row.displayBalance, 0) *
        100,
    ) / 100;

  const profitLoss = {
    income: sumByAccountType('income'),
    costOfGoodsSold: sumByAccountType('cost_of_goods_sold'),
    expense: sumByAccountType('expense'),
    otherIncome: sumByAccountType('other_income'),
    otherExpense: sumByAccountType('other_expense'),
    estimatedNetIncome: 0,
  } satisfies BasicProfitLoss;

  profitLoss.estimatedNetIncome = Math.round(
    (profitLoss.income + profitLoss.otherIncome - profitLoss.costOfGoodsSold - profitLoss.expense - profitLoss.otherExpense) * 100,
  ) / 100;

  return {
    generalLedgerRows,
    trialBalanceRows,
    accountActivityRows,
    trialBalanceTotals: {
      totalDebit,
      totalCredit,
      isBalanced: totalDebit === totalCredit,
    },
    profitLoss,
  };
}
