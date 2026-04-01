'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';

import { requireActiveSession } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { FinancialExpenseActionState } from '@/services/finance/expenses-form-state';
import type {
  EditableFinancialExpense,
  FinancialExpenseType,
  FinancialPercentageBase,
  FinancialExpenseStatus,
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

  if (!supabase || !session.user || !hasPermission(session.user, 'finance.manage_defaults')) {
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

  await supabase.from('financial_change_logs').insert({
    entity_type: 'settings_defaults',
    quote_id: null,
    settings_id: settings.id,
    change_kind: existingSettings ? 'settings_updated' : 'settings_created',
    summary_payload: {
      taxReserve: payload.default_tax_reserve_percentage,
      salesCommission: payload.default_sales_commission_percentage,
      expensesCount: expenses.length,
    },
    changed_by: session.user.id,
  });

  revalidatePath('/finanzas');
}

export async function saveQuoteFinancialSheetAction(quoteId: string, formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user || !hasPermission(session.user, 'finance.edit_quote_sheet')) {
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

  await supabase.from('financial_change_logs').insert({
    entity_type: 'quote_sheet',
    quote_id: quoteId,
    settings_id: defaultSettingsId,
    change_kind: existingSheet ? 'quote_sheet_updated' : 'quote_sheet_created',
    summary_payload: {
      grossRevenue: payload.gross_revenue,
      taxReservePercentage: payload.tax_reserve_percentage,
      salesCommissionPercentage: payload.sales_commission_percentage,
      expensesCount: expenses.length,
    },
    changed_by: session.user.id,
  });

  revalidatePath(`/cotizaciones/${quoteId}` as Route);
  revalidatePath('/finanzas');
}


function normalizeExpenseScope(value: FormDataEntryValue | null): 'event' | 'general' {
  return String(value ?? 'general') === 'event' ? 'event' : 'general';
}

function normalizeExpenseStatus(value: FormDataEntryValue | null): FinancialExpenseStatus {
  const normalized = String(value ?? '').trim();
  if (normalized === 'submitted' || normalized === 'approved' || normalized === 'rejected') {
    return normalized;
  }

  return 'draft';
}

export async function upsertFinancialExpenseAction(
  _previousState: FinancialExpenseActionState,
  formData: FormData,
): Promise<FinancialExpenseActionState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  if (!hasPermission(session.user, 'finance.expenses.manage')) {
    return { status: 'error', message: 'No tienes permisos para registrar gastos.' };
  }

  const expenseId = parseText(formData.get('expense_id'));
  const title = parseText(formData.get('title'));
  const category = parseText(formData.get('category'));
  const amount = parseOptionalNumber(formData.get('amount'));
  const expenseDate = parseText(formData.get('expense_date'));
  const expenseScope = normalizeExpenseScope(formData.get('expense_scope'));
  const eventId = expenseScope === 'event' ? parseText(formData.get('event_id')) : null;
  const quoteId = parseText(formData.get('quote_id'));

  if (!title) {
    return { status: 'error', message: 'El título del gasto es obligatorio.' };
  }

  if (!category) {
    return { status: 'error', message: 'La categoría del gasto es obligatoria.' };
  }

  if (amount === null || amount < 0) {
    return { status: 'error', message: 'El monto del gasto debe ser mayor o igual a 0.' };
  }

  if (!expenseDate) {
    return { status: 'error', message: 'La fecha del gasto es obligatoria.' };
  }

  if (expenseScope === 'event' && !eventId) {
    return { status: 'error', message: 'Debes seleccionar un evento cuando el gasto es de alcance event.' };
  }

  const payload = {
    title,
    description: parseText(formData.get('description')),
    category,
    amount,
    currency: 'usd',
    expense_scope: expenseScope,
    status: normalizeExpenseStatus(formData.get('status')),
    expense_date: expenseDate,
    event_id: eventId,
    quote_id: quoteId,
    vendor_name: parseText(formData.get('vendor_name')),
    notes: parseText(formData.get('notes')),
    receipt_file_name: parseText(formData.get('receipt_file_name')),
    receipt_storage_bucket: parseText(formData.get('receipt_storage_bucket')),
    receipt_storage_path: parseText(formData.get('receipt_storage_path')),
    receipt_metadata: {
      externalReference: parseText(formData.get('receipt_external_reference')),
      source: 'manual',
    },
    rejection_reason: null,
    updated_by: session.user.id,
  };

  const operation = expenseId
    ? await supabase.from('financial_expenses').update(payload).eq('id', expenseId)
    : await supabase.from('financial_expenses').insert({
        ...payload,
        created_by: session.user.id,
      });

  if (operation.error) {
    return { status: 'error', message: `No pudimos guardar el gasto (${operation.error.code ?? 'error-desconocido'}).` };
  }

  await supabase.from('financial_change_logs').insert({
    entity_type: 'expense',
    quote_id: quoteId,
    settings_id: null,
    change_kind: expenseId ? 'expense_updated' : 'expense_created',
    summary_payload: {
      expenseScope,
      eventId,
      amount,
      status: payload.status,
      category,
      expenseDate,
    },
    changed_by: session.user.id,
  });

  revalidatePath('/finanzas');
  if (eventId) {
    revalidatePath(`/eventos/${eventId}` as Route);
  }

  return { status: 'success', message: expenseId ? 'Gasto actualizado.' : 'Gasto creado en estado draft.' };
}

export async function submitFinancialExpenseAction(expenseId: string): Promise<void> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user || !hasPermission(session.user, 'finance.expenses.manage')) {
    return;
  }

  const { data: expense } = await supabase.from('financial_expenses').select('id, event_id, quote_id').eq('id', expenseId).maybeSingle();
  if (!expense) return;

  await supabase
    .from('financial_expenses')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      updated_by: session.user.id,
    })
    .eq('id', expenseId);

  await supabase.from('financial_change_logs').insert({
    entity_type: 'expense',
    quote_id: expense.quote_id,
    settings_id: null,
    change_kind: 'expense_submitted',
    summary_payload: { expenseId },
    changed_by: session.user.id,
  });

  revalidatePath('/finanzas');
  if (expense.event_id) revalidatePath(`/eventos/${expense.event_id}` as Route);
}

export async function reviewFinancialExpenseAction(expenseId: string, decision: 'approved' | 'rejected', formData?: FormData): Promise<void> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user || !hasPermission(session.user, 'finance.expenses.approve')) {
    return;
  }

  const { data: expense } = await supabase.from('financial_expenses').select('id, event_id, quote_id').eq('id', expenseId).maybeSingle();
  if (!expense) return;

  await supabase
    .from('financial_expenses')
    .update({
      status: decision,
      approved_by: decision === 'approved' ? session.user.id : null,
      approved_at: decision === 'approved' ? new Date().toISOString() : null,
      rejection_reason: decision === 'rejected' ? parseText(formData?.get('rejection_reason') ?? null) ?? 'Sin motivo registrado.' : null,
      updated_by: session.user.id,
    })
    .eq('id', expenseId);

  await supabase.from('financial_change_logs').insert({
    entity_type: 'expense',
    quote_id: expense.quote_id,
    settings_id: null,
    change_kind: decision === 'approved' ? 'expense_approved' : 'expense_rejected',
    summary_payload: {
      expenseId,
      decision,
      rejectionReason: decision === 'rejected' ? parseText(formData?.get('rejection_reason') ?? null) ?? null : null,
    },
    changed_by: session.user.id,
  });

  revalidatePath('/finanzas');
  if (expense.event_id) revalidatePath(`/eventos/${expense.event_id}` as Route);
}

export async function approveFinancialExpenseAction(expenseId: string): Promise<void> {
  await reviewFinancialExpenseAction(expenseId, 'approved');
}

export async function rejectFinancialExpenseAction(expenseId: string, formData: FormData): Promise<void> {
  await reviewFinancialExpenseAction(expenseId, 'rejected', formData);
}
