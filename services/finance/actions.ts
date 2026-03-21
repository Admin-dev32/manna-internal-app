'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';

import { requireActiveSession } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  EditableFinancialExpense,
  FinancialExpenseType,
  FinancialPercentageBase,
} from '@/types/finance';

function parseText(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const normalized = parseText(value);
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeExpenseType(value: unknown): FinancialExpenseType {
  return value === 'percentage' ? 'percentage' : 'fixed';
}

function normalizeCalculationBase(value: unknown): FinancialPercentageBase | null {
  if (value === 'after_tax' || value === 'after_tax_and_commission' || value === 'gross_revenue') {
    return value;
  }

  return null;
}

function parseExpensesJson(raw: FormDataEntryValue | null): EditableFinancialExpense[] {
  const normalized = String(raw ?? '').trim();
  if (!normalized) return [];

  let parsed: Array<Record<string, unknown>> = [];

  try {
    parsed = JSON.parse(normalized) as Array<Record<string, unknown>>;
  } catch {
    return [];
  }

  return parsed.map((expense, index) => ({
    id: String(expense.id ?? `expense-${index + 1}`),
    name: String(expense.name ?? '').trim(),
    expense_type: normalizeExpenseType(expense.expense_type),
    value: expense.value === '' || expense.value === null || expense.value === undefined ? null : Number(expense.value),
    calculation_base: normalizeExpenseType(expense.expense_type) === 'percentage' ? normalizeCalculationBase(expense.calculation_base) : null,
    note: String(expense.note ?? '').trim() || null,
    sort_order: Number.isFinite(Number(expense.sort_order)) ? Number(expense.sort_order) : index,
  }));
}

function sanitizeExpenses(expenses: EditableFinancialExpense[]) {
  return expenses
    .filter((expense) => expense.name.trim().length > 0)
    .map((expense, index) => ({
      name: expense.name.trim(),
      expense_type: expense.expense_type,
      value: Math.max(Number(expense.value ?? 0), 0),
      calculation_base: expense.expense_type === 'percentage' ? expense.calculation_base ?? 'gross_revenue' : null,
      note: expense.note?.trim() || null,
      sort_order: index,
    }));
}

export async function saveFinancialSettingsAction(formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user || session.user.rol !== 'owner') {
    return;
  }

  const payload = {
    config_key: 'global',
    default_tax_reserve_percentage: parseOptionalNumber(formData.get('default_tax_reserve_percentage')),
    default_sales_commission_percentage: parseOptionalNumber(formData.get('default_sales_commission_percentage')),
    updated_by: session.user.id,
  };

  const { data: existingSettings } = await supabase
    .from('financial_settings')
    .select('id')
    .eq('config_key', 'global')
    .maybeSingle();

  const { data: settings } = existingSettings
    ? await supabase
        .from('financial_settings')
        .update(payload)
        .eq('id', existingSettings.id)
        .select('id')
        .single()
    : await supabase
        .from('financial_settings')
        .insert({
          ...payload,
          created_by: session.user.id,
        })
        .select('id')
        .single();

  if (!settings) {
    return;
  }

  await supabase.from('financial_setting_default_expenses').delete().eq('settings_id', settings.id);

  const expenses = sanitizeExpenses(parseExpensesJson(formData.get('default_expenses_json')));

  if (expenses.length > 0) {
    await supabase.from('financial_setting_default_expenses').insert(
      expenses.map((expense) => ({
        settings_id: settings.id,
        ...expense,
      })),
    );
  }

  revalidatePath('/finanzas');
}

export async function saveQuoteFinancialSheetAction(quoteId: string, formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user || !hasPermission(session.user, 'finance.view')) {
    return;
  }

  const defaultSettingsId = parseText(formData.get('defaults_source_settings_id'));
  const payload = {
    quote_id: quoteId,
    defaults_source_settings_id: defaultSettingsId,
    gross_revenue: Math.max(parseOptionalNumber(formData.get('gross_revenue')) ?? 0, 0),
    tax_reserve_percentage: parseOptionalNumber(formData.get('tax_reserve_percentage')),
    sales_commission_percentage: parseOptionalNumber(formData.get('sales_commission_percentage')),
    updated_by: session.user.id,
  };

  const { data: existingSheet } = await supabase
    .from('quote_financial_sheets')
    .select('id')
    .eq('quote_id', quoteId)
    .maybeSingle();

  const { data: sheet } = existingSheet
    ? await supabase
        .from('quote_financial_sheets')
        .update(payload)
        .eq('id', existingSheet.id)
        .select('id')
        .single()
    : await supabase
        .from('quote_financial_sheets')
        .insert({
          ...payload,
          created_by: session.user.id,
        })
        .select('id')
        .single();

  if (!sheet) {
    return;
  }

  await supabase.from('quote_financial_expenses').delete().eq('sheet_id', sheet.id);

  const expenses = sanitizeExpenses(parseExpensesJson(formData.get('expenses_json')));

  if (expenses.length > 0) {
    await supabase.from('quote_financial_expenses').insert(
      expenses.map((expense) => ({
        sheet_id: sheet.id,
        ...expense,
      })),
    );
  }

  revalidatePath(`/cotizaciones/${quoteId}` as Route);
  revalidatePath('/finanzas');
}
