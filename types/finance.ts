export const FINANCIAL_EXPENSE_TYPES = ['fixed', 'percentage'] as const;
export const FINANCIAL_PERCENTAGE_BASES = ['gross_revenue', 'after_tax', 'after_tax_and_commission'] as const;

export type FinancialExpenseType = (typeof FINANCIAL_EXPENSE_TYPES)[number];
export type FinancialPercentageBase = (typeof FINANCIAL_PERCENTAGE_BASES)[number];


export const FINANCIAL_EXPENSE_SCOPES = ['event', 'general'] as const;
export const FINANCIAL_EXPENSE_STATUSES = ['draft', 'submitted', 'approved', 'rejected'] as const;

export type FinancialExpenseScope = (typeof FINANCIAL_EXPENSE_SCOPES)[number];
export type FinancialExpenseStatus = (typeof FINANCIAL_EXPENSE_STATUSES)[number];

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
