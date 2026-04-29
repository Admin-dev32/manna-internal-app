'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';

import { requireActiveSession } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import {
  canApproveContractorPayout,
  canEditContractorPayoutDraft,
  canMarkContractorPayoutPaid,
  normalizeContractorPayoutPaymentMethod,
  canCancelContractorPayout,
  canTransitionContractorPayoutStatus,
  validateContractorPayoutAssignmentConsistency,
  validateContractorPayoutDraftInput,
  validateContractorPayoutPaidInput,
} from '@/lib/finance/contractor-payouts';
import { resolveLegacyExpenseCategoryText } from '@/lib/finance/expense-categories';
import { validateDraftJournalForPosting } from '@/lib/finance/journal-posting';
import { validatePostingPreviewForDraftCreation, type PostingPreview } from '@/lib/finance/posting-previews';
import { buildFinanceReceiptStoragePath, financeReceiptUploadConfig, validateReceiptFile } from '@/lib/finance/receipt-upload';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { FinancialExpenseActionState } from '@/services/finance/expenses-form-state';
import type {
    ContractorPayoutRecord,
    EditableFinancialExpense,
    FinancialExpenseCategoryRecord,
    FinancialExpenseType,
  FinancialPercentageBase,
  FinancialExpenseStatus,
} from '@/types/finance';
import type { ContractorPayoutDraftInput } from '@/lib/finance/contractor-payouts';

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

interface ContractorPayoutActionResult {
  status: 'success' | 'error';
  message: string;
  payout: ContractorPayoutRecord | null;
}

interface MarkContractorPayoutPaidInput {
  payout_date?: string | null;
  payment_method?: string | null;
  external_reference?: string | null;
}

export interface CreateDraftJournalEntryFromPreviewResult {
  status: 'success' | 'error';
  message: string;
  journalEntryId: string | null;
}

export interface PostDraftJournalEntryResult {
  status: 'success' | 'error';
  message: string;
  journalEntryId: string | null;
}

export async function createDraftJournalEntryFromPreviewAction(preview: PostingPreview): Promise<CreateDraftJournalEntryFromPreviewResult> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.', journalEntryId: null };
  }

  const rawPermissions = new Set<string>((session.user.permissions ?? []) as unknown as string[]);
  const canManageLedger =
    rawPermissions.has('finance.ledger.post')
    || rawPermissions.has('finance.accounts.manage')
    || hasPermission(session.user, 'finance.expenses.manage');

  if (!canManageLedger) {
    return { status: 'error', message: 'No tienes permisos para crear asientos contables en borrador.', journalEntryId: null };
  }

  const validation = validatePostingPreviewForDraftCreation(preview);
  if (!validation.ok) {
    return { status: 'error', message: validation.errors.join(' '), journalEntryId: null };
  }

  const entryDescription = String(preview.description ?? '').trim() || null;

  const { data: entryData, error: entryError } = await supabase
    .from('journal_entries')
    .insert({
      entry_date: preview.entryDate,
      source_type: preview.sourceType,
      source_id: preview.sourceId,
      description: entryDescription,
      status: 'draft',
      created_by: session.user.id,
    })
    .select('id')
    .single();

  if (entryError || !entryData?.id) {
    return { status: 'error', message: entryError?.message ?? 'No se pudo crear el journal entry draft.', journalEntryId: null };
  }

  const entryId = String(entryData.id);
  const linesPayload = preview.lines.map((line) => ({
    journal_entry_id: entryId,
    account_id: String(line.accountId),
    debit: line.debit,
    credit: line.credit,
    memo: line.memo ?? null,
    entity_type: line.entityType ?? null,
    entity_id: line.entityId ?? null,
  }));

  const { error: linesError } = await supabase.from('journal_entry_lines').insert(linesPayload);

  if (linesError) {
    await supabase.from('journal_entries').delete().eq('id', entryId).eq('status', 'draft');
    return { status: 'error', message: linesError.message, journalEntryId: null };
  }

  revalidatePath('/finanzas');

  return {
    status: 'success',
    message: 'Draft journal entry creado correctamente.',
    journalEntryId: entryId,
  };
}

export async function postDraftJournalEntryAction(journalEntryId: string): Promise<PostDraftJournalEntryResult> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.', journalEntryId: null };
  }

  const rawPermissions = new Set<string>((session.user.permissions ?? []) as unknown as string[]);
  const canManageLedger =
    rawPermissions.has('finance.ledger.post')
    || rawPermissions.has('finance.accounts.manage')
    || hasPermission(session.user, 'finance.expenses.manage');

  if (!canManageLedger) {
    return { status: 'error', message: 'No tienes permisos para postear journal entries.', journalEntryId: null };
  }

  const { data: entryData } = await supabase
    .from('journal_entries')
    .select('id, status, source_type, source_id, entry_date')
    .eq('id', journalEntryId)
    .maybeSingle();

  const entry = (entryData ?? null) as {
    id: string;
    status: 'draft' | 'posted' | 'reversed';
    source_type: string;
    source_id: string;
    entry_date: string;
  } | null;

  const { data: linesData } = await supabase
    .from('journal_entry_lines')
    .select('id, account_id, debit, credit')
    .eq('journal_entry_id', journalEntryId)
    .order('created_at', { ascending: true });

  const lines = (linesData ?? []) as Array<{
    id: string;
    account_id: string;
    debit: number | string;
    credit: number | string;
  }>;

  const validation = validateDraftJournalForPosting({ entry, lines });
  if (!validation.ok) {
    return { status: 'error', message: validation.errors.join(' '), journalEntryId: null };
  }

  const { error: updateError } = await supabase
    .from('journal_entries')
    .update({
      status: 'posted',
      posted_at: new Date().toISOString(),
    })
    .eq('id', journalEntryId)
    .eq('status', 'draft');

  if (updateError) {
    return { status: 'error', message: updateError.message, journalEntryId: null };
  }

  revalidatePath('/finanzas');

  return {
    status: 'success',
    message: 'Journal entry posteado correctamente.',
    journalEntryId,
  };
}

async function resolveAssignmentForPayout(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  assignmentId: string | null,
) {
  if (!assignmentId) return null;

  const { data } = await supabase
    .from('event_staff_assignments')
    .select('id, event_id, profile_id')
    .eq('id', assignmentId)
    .maybeSingle();

  if (!data) return null;
  return {
    id: String(data.id),
    event_id: String(data.event_id),
    profile_id: String(data.profile_id),
  };
}

export async function createContractorPayoutDraftAction(input: ContractorPayoutDraftInput): Promise<ContractorPayoutActionResult> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.', payout: null };
  }

  if (!hasPermission(session.user, 'finance.expenses.manage')) {
    return { status: 'error', message: 'No tienes permisos para registrar pagos de contratistas.', payout: null };
  }

  const validation = validateContractorPayoutDraftInput(input);
  if (!validation.ok) {
    return { status: 'error', message: validation.message, payout: null };
  }

  const assignment = await resolveAssignmentForPayout(supabase, input.assignment_id ?? null);
  if (input.assignment_id && !assignment) {
    return { status: 'error', message: 'assignment_id no existe o no está disponible.', payout: null };
  }

  const consistencyValidation = validateContractorPayoutAssignmentConsistency({
    eventId: input.event_id ?? null,
    profileId: input.profile_id,
    assignment,
  });

  if (!consistencyValidation.ok) {
    return { status: 'error', message: consistencyValidation.message, payout: null };
  }

  const payload = {
    profile_id: input.profile_id,
    event_id: input.event_id ?? null,
    assignment_id: input.assignment_id ?? null,
    amount: input.amount,
    currency: 'usd' as const,
    payout_date: input.payout_date ?? null,
    payment_method: normalizeContractorPayoutPaymentMethod(input.payment_method),
    status: 'draft' as const,
    notes: input.notes ?? null,
    external_reference: input.external_reference ?? null,
    source_expense_id: null,
    idempotency_key: input.idempotency_key ?? null,
    created_by: session.user.id,
    updated_by: session.user.id,
  };

  const { data, error } = await supabase.from('contractor_payouts').insert(payload).select('*').maybeSingle();
  if (error || !data) {
    return { status: 'error', message: `No pudimos crear el pago (${error?.code ?? 'error-desconocido'}).`, payout: null };
  }

  // Intentionally omitted financial_change_logs for payouts in this phase:
  // current entity_type union is focused on settings/quote_sheet/invoice/expense.

  revalidatePath('/finanzas');
  if (payload.event_id) {
    revalidatePath(`/eventos/${payload.event_id}` as Route);
  }

  return { status: 'success', message: 'Pago de contratista en borrador creado.', payout: data as ContractorPayoutRecord };
}

export async function updateContractorPayoutDraftAction(
  payoutId: string,
  input: ContractorPayoutDraftInput,
): Promise<ContractorPayoutActionResult> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.', payout: null };
  }

  if (!hasPermission(session.user, 'finance.expenses.manage')) {
    return { status: 'error', message: 'No tienes permisos para editar pagos de contratistas.', payout: null };
  }

  const { data: current } = await supabase
    .from('contractor_payouts')
    .select('*')
    .eq('id', payoutId)
    .maybeSingle();

  const currentPayout = (current as ContractorPayoutRecord | null) ?? null;
  if (!currentPayout) {
    return { status: 'error', message: 'No encontramos el payout para editar.', payout: null };
  }

  if (!canEditContractorPayoutDraft(currentPayout.status)) {
    return { status: 'error', message: 'Solo los payouts en draft se pueden editar.', payout: null };
  }

  const validation = validateContractorPayoutDraftInput(input);
  if (!validation.ok) {
    return { status: 'error', message: validation.message, payout: null };
  }

  const assignment = await resolveAssignmentForPayout(supabase, input.assignment_id ?? null);
  if (input.assignment_id && !assignment) {
    return { status: 'error', message: 'assignment_id no existe o no está disponible.', payout: null };
  }

  const consistencyValidation = validateContractorPayoutAssignmentConsistency({
    eventId: input.event_id ?? null,
    profileId: input.profile_id,
    assignment,
  });

  if (!consistencyValidation.ok) {
    return { status: 'error', message: consistencyValidation.message, payout: null };
  }

  const payload = {
    profile_id: input.profile_id,
    event_id: input.event_id ?? null,
    assignment_id: input.assignment_id ?? null,
    amount: input.amount,
    currency: 'usd' as const,
    payout_date: input.payout_date ?? null,
    payment_method: normalizeContractorPayoutPaymentMethod(input.payment_method),
    notes: input.notes ?? null,
    external_reference: input.external_reference ?? null,
    source_expense_id: null,
    idempotency_key: input.idempotency_key ?? null,
    updated_by: session.user.id,
  };

  const { data, error } = await supabase.from('contractor_payouts').update(payload).eq('id', payoutId).select('*').maybeSingle();
  if (error || !data) {
    return { status: 'error', message: `No pudimos actualizar el pago (${error?.code ?? 'error-desconocido'}).`, payout: null };
  }

  // Intentionally omitted financial_change_logs for payouts in this phase:
  // current entity_type union is focused on settings/quote_sheet/invoice/expense.

  revalidatePath('/finanzas');
  if (currentPayout.event_id) {
    revalidatePath(`/eventos/${currentPayout.event_id}` as Route);
  }
  if (payload.event_id && payload.event_id !== currentPayout.event_id) {
    revalidatePath(`/eventos/${payload.event_id}` as Route);
  }

  return { status: 'success', message: 'Pago de contratista en borrador actualizado.', payout: data as ContractorPayoutRecord };
}

export async function approveContractorPayoutAction(payoutId: string): Promise<ContractorPayoutActionResult> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.', payout: null };
  }

  if (!hasPermission(session.user, 'finance.expenses.approve')) {
    return { status: 'error', message: 'No tienes permisos para aprobar pagos de contratistas.', payout: null };
  }

  const { data: current } = await supabase.from('contractor_payouts').select('*').eq('id', payoutId).maybeSingle();
  const currentPayout = (current as ContractorPayoutRecord | null) ?? null;
  if (!currentPayout) {
    return { status: 'error', message: 'No encontramos el payout para aprobar.', payout: null };
  }

  if (!canApproveContractorPayout(currentPayout.status)) {
    return { status: 'error', message: 'Solo los payouts en draft se pueden aprobar.', payout: null };
  }

  const { data, error } = await supabase
    .from('contractor_payouts')
    .update({
      status: 'approved',
      updated_by: session.user.id,
    })
    .eq('id', payoutId)
    .select('*')
    .maybeSingle();

  if (error || !data) {
    return { status: 'error', message: `No pudimos aprobar el payout (${error?.code ?? 'error-desconocido'}).`, payout: null };
  }

  // Intentionally omitted financial_change_logs for payouts in this phase:
  // current entity_type union is focused on settings/quote_sheet/invoice/expense.

  revalidatePath('/finanzas');
  if (currentPayout.event_id) {
    revalidatePath(`/eventos/${currentPayout.event_id}` as Route);
  }

  return { status: 'success', message: 'Pago de contratista aprobado.', payout: data as ContractorPayoutRecord };
}

export async function markContractorPayoutPaidAction(
  payoutId: string,
  input: MarkContractorPayoutPaidInput = {},
): Promise<ContractorPayoutActionResult> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.', payout: null };
  }

  if (!hasPermission(session.user, 'finance.expenses.manage') && !hasPermission(session.user, 'finance.expenses.approve')) {
    return { status: 'error', message: 'No tienes permisos para marcar pagos de contratistas como pagados.', payout: null };
  }

  const { data: current } = await supabase.from('contractor_payouts').select('*').eq('id', payoutId).maybeSingle();
  const currentPayout = (current as ContractorPayoutRecord | null) ?? null;
  if (!currentPayout) {
    return { status: 'error', message: 'No encontramos el payout para marcar como pagado.', payout: null };
  }

  if (!canMarkContractorPayoutPaid(currentPayout.status)) {
    return { status: 'error', message: 'Solo los payouts en approved se pueden marcar como pagados.', payout: null };
  }

  const validation = validateContractorPayoutPaidInput(input);
  if (!validation.ok) {
    return { status: 'error', message: validation.message, payout: null };
  }

  const nextPayoutDate = input.payout_date?.trim() || new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('contractor_payouts')
    .update({
      status: 'paid',
      payout_date: nextPayoutDate,
      payment_method: input.payment_method ? normalizeContractorPayoutPaymentMethod(input.payment_method) : currentPayout.payment_method,
      external_reference: input.external_reference ?? currentPayout.external_reference,
      updated_by: session.user.id,
    })
    .eq('id', payoutId)
    .select('*')
    .maybeSingle();

  if (error || !data) {
    return { status: 'error', message: `No pudimos marcar el payout como pagado (${error?.code ?? 'error-desconocido'}).`, payout: null };
  }

  // Intentionally omitted financial_change_logs for payouts in this phase:
  // current entity_type union is focused on settings/quote_sheet/invoice/expense.

  revalidatePath('/finanzas');
  if (currentPayout.event_id) {
    revalidatePath(`/eventos/${currentPayout.event_id}` as Route);
  }

  return { status: 'success', message: 'Pago de contratista marcado como pagado.', payout: data as ContractorPayoutRecord };
}

export async function cancelContractorPayoutAction(payoutId: string): Promise<ContractorPayoutActionResult> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.', payout: null };
  }

  if (!hasPermission(session.user, 'finance.expenses.manage') && !hasPermission(session.user, 'finance.expenses.approve')) {
    return { status: 'error', message: 'No tienes permisos para cancelar pagos de contratistas.', payout: null };
  }

  const { data: current } = await supabase.from('contractor_payouts').select('*').eq('id', payoutId).maybeSingle();
  const currentPayout = (current as ContractorPayoutRecord | null) ?? null;
  if (!currentPayout) {
    return { status: 'error', message: 'No encontramos el payout para cancelar.', payout: null };
  }

  if (!canCancelContractorPayout(currentPayout.status) || !canTransitionContractorPayoutStatus(currentPayout.status, 'cancelled')) {
    return { status: 'error', message: 'Solo los payouts en draft o approved se pueden cancelar.', payout: null };
  }

  const { data, error } = await supabase
    .from('contractor_payouts')
    .update({
      status: 'cancelled',
      updated_by: session.user.id,
    })
    .eq('id', payoutId)
    .select('*')
    .maybeSingle();

  if (error || !data) {
    return { status: 'error', message: `No pudimos cancelar el payout (${error?.code ?? 'error-desconocido'}).`, payout: null };
  }

  // Intentionally omitted financial_change_logs for payouts in this phase:
  // current entity_type union is focused on settings/quote_sheet/invoice/expense.

  revalidatePath('/finanzas');
  if (currentPayout.event_id) {
    revalidatePath(`/eventos/${currentPayout.event_id}` as Route);
  }

  return { status: 'success', message: 'Pago de contratista cancelado.', payout: data as ContractorPayoutRecord };
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
  const categoryId = parseText(formData.get('category_id'));
  const amount = parseOptionalNumber(formData.get('amount'));
  const expenseDate = parseText(formData.get('expense_date'));
  const expenseScope = normalizeExpenseScope(formData.get('expense_scope'));
  const eventId = expenseScope === 'event' ? parseText(formData.get('event_id')) : null;
  const quoteId = parseText(formData.get('quote_id'));

  if (!title) {
    return { status: 'error', message: 'El título del gasto es obligatorio.' };
  }

  let resolvedCategoryId: string | null = null;
  let resolvedCategoryName: string | null = category;
  if (categoryId) {
    const { data: selectedCategory } = await supabase
      .from('financial_expense_categories')
      .select('id, name, active')
      .eq('id', categoryId)
      .maybeSingle();

    const parsedCategory = (selectedCategory ?? null) as Pick<FinancialExpenseCategoryRecord, 'id' | 'name' | 'active'> | null;
    if (!parsedCategory || !parsedCategory.active) {
      return { status: 'error', message: 'La categoría seleccionada no existe o está inactiva.' };
    }

    resolvedCategoryId = parsedCategory.id;
    resolvedCategoryName = resolveLegacyExpenseCategoryText({
      legacyCategory: category,
      selectedCategoryName: parsedCategory.name,
    });
  }

  if (!resolvedCategoryName) {
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
    category: resolvedCategoryName,
    category_id: resolvedCategoryId,
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
      category: resolvedCategoryName,
      categoryId: resolvedCategoryId,
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

export async function uploadFinancialExpenseReceiptAction(
  _previousState: FinancialExpenseActionState,
  formData: FormData,
): Promise<FinancialExpenseActionState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  if (!hasPermission(session.user, 'finance.expenses.manage')) {
    return { status: 'error', message: 'No tienes permisos para subir comprobantes.' };
  }

  const expenseId = parseText(formData.get('expense_id'));
  if (!expenseId) {
    return { status: 'error', message: 'No encontramos el gasto para asociar el comprobante.' };
  }

  const fileEntry = formData.get('receipt_file');
  const file = fileEntry instanceof File ? fileEntry : null;
  if (!file) {
    return { status: 'error', message: 'Selecciona un archivo de comprobante.' };
  }
  const fileValidation = validateReceiptFile(file);
  if (!fileValidation.ok) {
    return { status: 'error', message: fileValidation.message };
  }

  const { data: expense } = await supabase
    .from('financial_expenses')
    .select('id, event_id, quote_id, receipt_storage_bucket, receipt_storage_path, receipt_metadata')
    .eq('id', expenseId)
    .maybeSingle();

  if (!expense) {
    return { status: 'error', message: 'El gasto no existe o no está disponible.' };
  }

  const storagePath = buildFinanceReceiptStoragePath(expenseId, file.name);
  const upload = await supabase.storage.from(financeReceiptUploadConfig.bucket).upload(storagePath, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });

  if (upload.error) {
    return { status: 'error', message: `No pudimos subir el comprobante (${upload.error.message}).` };
  }

  const nextReceiptMetadata = {
    ...((expense.receipt_metadata as Record<string, unknown> | null) ?? {}),
    uploadedAt: new Date().toISOString(),
    uploadedBy: session.user.id,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size || null,
    originalFileName: file.name || null,
    source: 'finance_expense_upload',
  };

  const { error: updateError } = await supabase
    .from('financial_expenses')
    .update({
      receipt_file_name: file.name || (storagePath.split('/').at(-1) ?? null),
      receipt_storage_bucket: financeReceiptUploadConfig.bucket,
      receipt_storage_path: storagePath,
      receipt_metadata: nextReceiptMetadata,
      updated_by: session.user.id,
    })
    .eq('id', expenseId);

  if (updateError) {
    return { status: 'error', message: `Subimos el archivo, pero no pudimos asociarlo (${updateError.code ?? 'error'}).` };
  }

  await supabase.from('financial_change_logs').insert({
    entity_type: 'expense',
    quote_id: expense.quote_id ?? null,
    settings_id: null,
    change_kind: 'expense_receipt_uploaded',
    summary_payload: {
      expenseId,
      bucket: financeReceiptUploadConfig.bucket,
      path: storagePath,
      fileName: file.name || null,
      sizeBytes: file.size || null,
      mimeType: file.type || null,
    },
    changed_by: session.user.id,
  });

  revalidatePath('/finanzas');
  if (expense.event_id) {
    revalidatePath(`/eventos/${expense.event_id}` as Route);
  }

  return { status: 'success', message: 'Comprobante subido y asociado al gasto.' };
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
