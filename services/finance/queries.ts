import { createSupabaseServerClient } from '@/lib/supabase/server';
import { calculateFinancialSummary } from '@/lib/finance/calculations';
import type {
  EditableFinancialExpense,
  FinancialSettingsExpenseRecord,
  FinancialSettingsRecord,
  FinancialChangeLogRecord,
  QuoteFinancialExpenseRecord,
  QuoteFinancialSheetDraft,
  QuoteFinancialSheetRecord,
  FinancialExpenseRecord,
  FinancialExpenseScope,
  FinancialExpenseStatus,
} from '@/types/finance';
import type { EventFinanceSnapshot } from '@/types/events';
import type { QuoteRecord } from '@/types/quotes';

function mapSettingsExpenseToEditable(expense: FinancialSettingsExpenseRecord | QuoteFinancialExpenseRecord): EditableFinancialExpense {
  return {
    id: expense.id,
    name: expense.name,
    expense_type: expense.expense_type,
    value: expense.value,
    calculation_base: expense.calculation_base,
    note: expense.note,
    sort_order: expense.sort_order,
  };
}

export async function getFinancialSettings() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      settings: null as FinancialSettingsRecord | null,
      expenses: [] as FinancialSettingsExpenseRecord[],
    };
  }

  const { data: settingsData } = await supabase
    .from('financial_settings')
    .select('*')
    .eq('config_key', 'global')
    .maybeSingle();

  const settings = (settingsData as FinancialSettingsRecord | null) ?? null;
  if (!settings) {
    return {
      settings: null,
      expenses: [] as FinancialSettingsExpenseRecord[],
    };
  }

  const { data: expenseData } = await supabase
    .from('financial_setting_default_expenses')
    .select('*')
    .eq('settings_id', settings.id)
    .order('sort_order', { ascending: true });

  return {
    settings,
    expenses: ((expenseData ?? []) as FinancialSettingsExpenseRecord[]).sort((a, b) => a.sort_order - b.sort_order),
  };
}

export async function getQuoteFinancialSheetDraft(quote: QuoteRecord): Promise<QuoteFinancialSheetDraft> {
  const supabase = await createSupabaseServerClient();
  const settingsResult = await getFinancialSettings();

  if (!supabase) {
    return {
      sheet: null,
      expenses: settingsResult.expenses.map(mapSettingsExpenseToEditable),
      initialGrossRevenue: Number(quote.total_amount ?? 0),
      revenueBaseSource: 'quote_total',
      latestChange: null,
      defaults: {
        settingsId: settingsResult.settings?.id ?? null,
        taxReservePercentage: settingsResult.settings?.default_tax_reserve_percentage ?? null,
        salesCommissionPercentage: settingsResult.settings?.default_sales_commission_percentage ?? null,
      },
    };
  }

  const { data: sheetData } = await supabase
    .from('quote_financial_sheets')
    .select('*')
    .eq('quote_id', quote.id)
    .maybeSingle();

  const sheet = (sheetData as QuoteFinancialSheetRecord | null) ?? null;

  if (!sheet) {
    return {
      sheet: null,
      expenses: settingsResult.expenses.map(mapSettingsExpenseToEditable),
      initialGrossRevenue: Number(quote.total_amount ?? 0),
      revenueBaseSource: 'quote_total',
      latestChange: null,
      defaults: {
        settingsId: settingsResult.settings?.id ?? null,
        taxReservePercentage: settingsResult.settings?.default_tax_reserve_percentage ?? null,
        salesCommissionPercentage: settingsResult.settings?.default_sales_commission_percentage ?? null,
      },
    };
  }

  const { data: expenseData } = await supabase
    .from('quote_financial_expenses')
    .select('*')
    .eq('sheet_id', sheet.id)
    .order('sort_order', { ascending: true });

  const { data: changeData } = await supabase
    .from('financial_change_logs')
    .select('*')
    .eq('quote_id', quote.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    sheet,
    expenses: ((expenseData ?? []) as QuoteFinancialExpenseRecord[])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(mapSettingsExpenseToEditable),
    initialGrossRevenue: Number(sheet.gross_revenue ?? 0),
    revenueBaseSource: 'persisted_sheet',
    latestChange: (changeData as FinancialChangeLogRecord | null) ?? null,
    defaults: {
      settingsId: sheet.defaults_source_settings_id,
      taxReservePercentage: settingsResult.settings?.default_tax_reserve_percentage ?? null,
      salesCommissionPercentage: settingsResult.settings?.default_sales_commission_percentage ?? null,
    },
  };
}

export async function getQuoteFinancialSummary(quoteId: string): Promise<EventFinanceSnapshot | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: sheetData } = await supabase
    .from('quote_financial_sheets')
    .select('*')
    .eq('quote_id', quoteId)
    .maybeSingle();

  const sheet = (sheetData as QuoteFinancialSheetRecord | null) ?? null;
  if (!sheet) return null;

  const { data: expenseData } = await supabase
    .from('quote_financial_expenses')
    .select('*')
    .eq('sheet_id', sheet.id)
    .order('sort_order', { ascending: true });

  const summary = calculateFinancialSummary({
    grossRevenue: sheet.gross_revenue,
    taxReservePercentage: sheet.tax_reserve_percentage,
    salesCommissionPercentage: sheet.sales_commission_percentage,
    expenses: ((expenseData ?? []) as QuoteFinancialExpenseRecord[]).map(mapSettingsExpenseToEditable),
  });

  return {
    grossRevenue: summary.grossRevenue,
    taxReserve: summary.taxReserve,
    salesCommission: summary.salesCommission,
    totalExtraExpenses: summary.totalExtraExpenses,
    netProfit: summary.netProfit,
  };
}


interface FinanceExpensesFilters {
  status?: FinancialExpenseStatus | 'all';
  scope?: FinancialExpenseScope | 'all';
  eventId?: string | 'all';
}

export async function getFinancialExpenses(filters: FinanceExpensesFilters = {}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      expenses: [] as FinancialExpenseRecord[],
      eventOptions: [] as Array<{ id: string; label: string }>,
    };
  }

  let query = supabase.from('financial_expenses').select('*').order('expense_date', { ascending: false }).order('created_at', { ascending: false }).limit(120);

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.scope && filters.scope !== 'all') {
    query = query.eq('expense_scope', filters.scope);
  }

  if (filters.eventId && filters.eventId !== 'all') {
    query = query.eq('event_id', filters.eventId);
  }

  const { data } = await query;
  const expenses = (data ?? []) as FinancialExpenseRecord[];

  const eventIds = [...new Set(expenses.map((expense) => expense.event_id).filter(Boolean))] as string[];
  if (eventIds.length === 0) {
    return { expenses, eventOptions: [] as Array<{ id: string; label: string }> };
  }

  const { data: eventsData } = await supabase.from('events').select('id, event_type, event_date').in('id', eventIds);
  const eventOptions = (eventsData ?? []).map((event) => ({
    id: String(event.id),
    label: `${event.event_type ?? 'Evento'} · ${event.event_date ?? 'sin fecha'} · #${String(event.id).slice(0, 8)}`,
  }));

  return { expenses, eventOptions };
}

export async function getFinancialExpensesByEventId(eventId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as FinancialExpenseRecord[];

  const { data } = await supabase
    .from('financial_expenses')
    .select('*')
    .eq('event_id', eventId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(40);

  return (data ?? []) as FinancialExpenseRecord[];
}
