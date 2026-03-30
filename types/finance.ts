export const FINANCIAL_EXPENSE_TYPES = ['fixed', 'percentage'] as const;
export const FINANCIAL_PERCENTAGE_BASES = ['gross_revenue', 'after_tax', 'after_tax_and_commission'] as const;

export type FinancialExpenseType = (typeof FINANCIAL_EXPENSE_TYPES)[number];
export type FinancialPercentageBase = (typeof FINANCIAL_PERCENTAGE_BASES)[number];

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
