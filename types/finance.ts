export const FINANCIAL_EXPENSE_TYPES = ['fixed', 'percentage'] as const;
export const FINANCIAL_PERCENTAGE_BASES = ['gross_revenue', 'after_tax', 'after_tax_and_commission'] as const;

export type FinancialExpenseType = (typeof FINANCIAL_EXPENSE_TYPES)[number];
export type FinancialPercentageBase = (typeof FINANCIAL_PERCENTAGE_BASES)[number];


export const FINANCIAL_EXPENSE_SCOPES = ['event', 'general'] as const;
export const FINANCIAL_EXPENSE_STATUSES = ['draft', 'submitted', 'approved', 'rejected'] as const;
export const CONTRACTOR_PAYOUT_STATUSES = ['draft', 'approved', 'paid', 'cancelled', 'reversed'] as const;
export const CONTRACTOR_PAYOUT_PAYMENT_METHODS = ['cash', 'zelle', 'bank_transfer', 'card', 'other'] as const;
export const CHART_ACCOUNT_TYPES = [
  'asset',
  'liability',
  'equity',
  'income',
  'cost_of_goods_sold',
  'expense',
  'other_income',
  'other_expense',
] as const;
export const CHART_ACCOUNT_NORMAL_BALANCES = ['debit', 'credit'] as const;
export const JOURNAL_ENTRY_STATUSES = ['draft', 'posted', 'reversed'] as const;
export const JOURNAL_ENTRY_SOURCE_TYPES = [
  'invoice_issue',
  'invoice_payment',
  'expense_approved',
  'payout_paid',
  'reversal',
  'adjustment',
  'opening_balance',
] as const;

export type FinancialExpenseScope = (typeof FINANCIAL_EXPENSE_SCOPES)[number];
export type FinancialExpenseStatus = (typeof FINANCIAL_EXPENSE_STATUSES)[number];
export type ContractorPayoutStatus = (typeof CONTRACTOR_PAYOUT_STATUSES)[number];
export type ContractorPayoutPaymentMethod = (typeof CONTRACTOR_PAYOUT_PAYMENT_METHODS)[number];
export type ChartAccountType = (typeof CHART_ACCOUNT_TYPES)[number];
export type ChartAccountNormalBalance = (typeof CHART_ACCOUNT_NORMAL_BALANCES)[number];
export type JournalEntryStatus = (typeof JOURNAL_ENTRY_STATUSES)[number];
export type JournalEntrySourceType = (typeof JOURNAL_ENTRY_SOURCE_TYPES)[number];

export interface ChartOfAccountRecord {
  id: string;
  code: string;
  name: string;
  account_type: ChartAccountType;
  normal_balance: ChartAccountNormalBalance;
  parent_account_id: string | null;
  description: string | null;
  active: boolean;
  system_account: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceAccountMappingRecord {
  id: string;
  mapping_key: string;
  account_id: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryRecord {
  id: string;
  entry_date: string;
  source_type: JournalEntrySourceType;
  source_id: string;
  description: string | null;
  status: JournalEntryStatus;
  created_by: string | null;
  posted_at: string | null;
  reversed_entry_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryLineRecord {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number | string;
  credit: number | string;
  memo: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

export interface JournalEntryWithLines {
  entry: JournalEntryRecord;
  lines: JournalEntryLineRecord[];
}

export interface FinancialSettingsRecord {
  id: string;
  config_key: string;
  default_tax_reserve_percentage: number | string | null;
  default_sales_commission_percentage: number | string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface FinancialSettingsExpenseRecord {
  id: string;
  settings_id: string;
  name: string;
  expense_type: FinancialExpenseType;
  value: number | string;
  calculation_base: FinancialPercentageBase | null;
  note: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface QuoteFinancialSheetRecord {
  id: string;
  quote_id: string;
  defaults_source_settings_id: string | null;
  gross_revenue: number | string;
  tax_reserve_percentage: number | string | null;
  sales_commission_percentage: number | string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface FinancialChangeLogRecord {
  id: string;
  entity_type: 'settings_defaults' | 'quote_sheet' | 'invoice' | 'expense';
  quote_id: string | null;
  settings_id: string | null;
  change_kind: string;
  summary_payload: Record<string, unknown>;
  changed_by: string;
  created_at: string;
}

export interface QuoteFinancialExpenseRecord {
  id: string;
  sheet_id: string;
  name: string;
  expense_type: FinancialExpenseType;
  value: number | string;
  calculation_base: FinancialPercentageBase | null;
  note: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface EditableFinancialExpense {
  id: string;
  name: string;
  expense_type: FinancialExpenseType;
  value: number | string | null;
  calculation_base: FinancialPercentageBase | null;
  note: string | null;
  sort_order: number;
}

export interface QuoteFinancialSheetDraft {
  sheet: QuoteFinancialSheetRecord | null;
  expenses: EditableFinancialExpense[];
  initialGrossRevenue: number;
  revenueBaseSource: 'quote_total' | 'persisted_sheet';
  latestChange: FinancialChangeLogRecord | null;
  defaults: {
    settingsId: string | null;
    taxReservePercentage: number | string | null;
    salesCommissionPercentage: number | string | null;
  };
}

export interface FinancialCalculationExpenseLine {
  id: string;
  name: string;
  amount: number;
  baseAmount: number | null;
  expenseType: FinancialExpenseType;
  calculationBase: FinancialPercentageBase | null;
  note: string | null;
}

export interface FinancialCalculationSummary {
  grossRevenue: number;
  taxReservePercentage: number;
  taxReserve: number;
  baseAfterTax: number;
  salesCommissionPercentage: number;
  salesCommission: number;
  totalExtraExpenses: number;
  netProfit: number;
  expenses: FinancialCalculationExpenseLine[];
}


export interface FinancialExpenseRecord {
  id: string;
  title: string;
  description: string | null;
  category: string;
  category_id: string | null;
  category_name?: string | null;
  category_slug?: string | null;
  category_report_group?: string | null;
  category_tax_sensitive?: boolean | null;
  category_requires_receipt?: boolean | null;
  expense_scope: FinancialExpenseScope;
  status: FinancialExpenseStatus;
  amount: number | string;
  currency: string;
  expense_date: string;
  event_id: string | null;
  quote_id: string | null;
  vendor_name: string | null;
  notes: string | null;
  receipt_file_name: string | null;
  receipt_storage_bucket: string | null;
  receipt_storage_path: string | null;
  receipt_signed_url?: string | null;
  receipt_metadata: Record<string, unknown>;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface FinancialExpenseCategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  irs_category: string | null;
  tax_sensitive: boolean;
  deductible_default: boolean;
  requires_receipt: boolean;
  report_group: string | null;
  default_account_id: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FinanceExpenseEventSearchOption {
  event_id: string;
  event_date: string | null;
  event_type: string | null;
  location: string | null;
  client_name: string | null;
  client_email: string | null;
  pre_event_id: string | null;
  pre_event_status: string | null;
  event_status: string | null;
  label: string;
  search_text: string;
}

export interface ContractorPayoutRecord {
  id: string;
  profile_id: string;
  event_id: string | null;
  assignment_id: string | null;
  amount: number | string;
  currency: 'usd';
  payout_date: string | null;
  payment_method: ContractorPayoutPaymentMethod;
  status: ContractorPayoutStatus;
  notes: string | null;
  external_reference: string | null;
  source_expense_id: string | null;
  idempotency_key: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}
