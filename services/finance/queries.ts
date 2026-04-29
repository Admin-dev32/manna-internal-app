import { calculateFinancialSummary } from '@/lib/finance/calculations';
import { resolveExpenseCategorySummaryLabel } from '@/lib/finance/expense-categories';
import { buildFinanceExpenseEventSearchText } from '@/lib/finance/expense-event-search';
import { getPaymentStatus, type PaymentStatusResult } from '@/lib/finance/payment-status';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ClientRecord } from '@/types/clients';
import type { EventRecord, EventFinanceSnapshot } from '@/types/events';
import type {
  ChartOfAccountRecord,
  FinanceAccountMappingRecord,
  ContractorPayoutRecord,
  EditableFinancialExpense,
  FinanceExpenseEventSearchOption,
  FinancialSettingsExpenseRecord,
  FinancialExpenseCategoryRecord,
  FinancialSettingsRecord,
  FinancialChangeLogRecord,
  JournalEntryLineRecord,
  JournalEntryRecord,
  JournalEntrySourceType,
  JournalEntryStatus,
  JournalEntryWithLines,
  QuoteFinancialExpenseRecord,
  QuoteFinancialSheetDraft,
  QuoteFinancialSheetRecord,
  FinancialExpenseRecord,
  FinancialExpenseScope,
  FinancialExpenseStatus,
} from '@/types/finance';
import type { InvoiceRecord } from '@/types/invoices';
import type { PaymentLinkRecord } from '@/types/payments';
import type { PreEventRecord } from '@/types/pre-events';
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

function asNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface JournalEntryFilters {
  dateFrom?: string | null;
  dateTo?: string | null;
  status?: JournalEntryStatus | 'all';
  sourceType?: JournalEntrySourceType | 'all';
  accountId?: string | null;
  limit?: number;
}

export async function getJournalEntries(filters: JournalEntryFilters = {}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as JournalEntryRecord[];

  const safeLimit = Number.isFinite(filters.limit) ? Math.min(Math.max(Math.trunc(filters.limit ?? 120), 1), 500) : 120;

  let journalEntryIdsByAccount: string[] | null = null;
  if (filters.accountId) {
    const { data: linesData } = await supabase
      .from('journal_entry_lines')
      .select('journal_entry_id')
      .eq('account_id', filters.accountId)
      .limit(2000);

    journalEntryIdsByAccount = [...new Set(((linesData ?? []) as Array<Pick<JournalEntryLineRecord, 'journal_entry_id'>>).map((line) => line.journal_entry_id))];
    if (journalEntryIdsByAccount.length === 0) return [] as JournalEntryRecord[];
  }

  let query = supabase.from('journal_entries').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(safeLimit);

  if (filters.dateFrom) query = query.gte('entry_date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('entry_date', filters.dateTo);
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.sourceType && filters.sourceType !== 'all') query = query.eq('source_type', filters.sourceType);
  if (journalEntryIdsByAccount) query = query.in('id', journalEntryIdsByAccount);

  const { data } = await query;
  return (data ?? []) as JournalEntryRecord[];
}

export async function getJournalEntryById(id: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null as JournalEntryWithLines | null;

  const [{ data: entryData }, { data: linesData }] = await Promise.all([
    supabase.from('journal_entries').select('*').eq('id', id).maybeSingle(),
    supabase.from('journal_entry_lines').select('*').eq('journal_entry_id', id).order('created_at', { ascending: true }),
  ]);

  const entry = (entryData as JournalEntryRecord | null) ?? null;
  if (!entry) return null;

  return {
    entry,
    lines: (linesData ?? []) as JournalEntryLineRecord[],
  } satisfies JournalEntryWithLines;
}

export async function getChartOfAccounts() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as ChartOfAccountRecord[];

  const { data } = await supabase.from('chart_of_accounts').select('*').order('code', { ascending: true });
  return (data ?? []) as ChartOfAccountRecord[];
}

export async function getActiveChartOfAccounts() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as ChartOfAccountRecord[];

  const { data } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('active', true)
    .order('code', { ascending: true });

  return (data ?? []) as ChartOfAccountRecord[];
}

export async function getFinanceAccountMappings() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as FinanceAccountMappingRecord[];

  const { data } = await supabase.from('finance_account_mappings').select('*').order('mapping_key', { ascending: true });
  return (data ?? []) as FinanceAccountMappingRecord[];
}

export interface FinancialExpenseCategoryWithAccount extends FinancialExpenseCategoryRecord {
  default_account: Pick<ChartOfAccountRecord, 'id' | 'code' | 'name' | 'account_type' | 'normal_balance' | 'active'> | null;
}

export async function getExpenseCategoriesWithAccounts() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as FinancialExpenseCategoryWithAccount[];

  const { data: categoriesData } = await supabase
    .from('financial_expense_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  const categories = (categoriesData ?? []) as FinancialExpenseCategoryRecord[];
  if (categories.length === 0) return [] as FinancialExpenseCategoryWithAccount[];

  const accountIds = [...new Set(categories.map((category) => category.default_account_id).filter(Boolean))] as string[];
  const { data: accountsData } = accountIds.length > 0
    ? await supabase
        .from('chart_of_accounts')
        .select('id, code, name, account_type, normal_balance, active')
        .in('id', accountIds)
    : { data: [] };

  const accountById = Object.fromEntries(
    (((accountsData ?? []) as Array<Pick<ChartOfAccountRecord, 'id' | 'code' | 'name' | 'account_type' | 'normal_balance' | 'active'>>).map((account) => [account.id, account])),
  ) as Record<string, Pick<ChartOfAccountRecord, 'id' | 'code' | 'name' | 'account_type' | 'normal_balance' | 'active'>>;

  return categories.map((category) => ({
    ...category,
    default_account: category.default_account_id ? accountById[category.default_account_id] ?? null : null,
  }));
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

export async function searchFinanceExpenseEvents(query: string, limit = 60) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as FinanceExpenseEventSearchOption[];

  const normalizedLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 120) : 60;
  const eventsQuery = supabase
    .from('events')
    .select('id, client_id, source_pre_event_id, event_date, event_type, location, status')
    .order('event_date', { ascending: false })
    .limit(normalizedLimit);

  const { data: eventsData } = await eventsQuery;
  const events = (eventsData ?? []) as Array<Pick<EventRecord, 'id' | 'client_id' | 'source_pre_event_id' | 'event_date' | 'event_type' | 'location' | 'status'>>;
  if (events.length === 0) return [] as FinanceExpenseEventSearchOption[];

  const clientIds = [...new Set(events.map((event) => event.client_id).filter(Boolean))];
  const preEventIds = [...new Set(events.map((event) => event.source_pre_event_id).filter(Boolean))];

  const [{ data: clientsData }, { data: preEventsData }] = await Promise.all([
    clientIds.length > 0 ? supabase.from('clients').select('id, full_name, email').in('id', clientIds) : Promise.resolve({ data: [] }),
    preEventIds.length > 0 ? supabase.from('pre_events').select('id, status').in('id', preEventIds) : Promise.resolve({ data: [] }),
  ]);

  const clientById = Object.fromEntries(((clientsData ?? []) as Array<Pick<ClientRecord, 'id' | 'full_name' | 'email'>>).map((client) => [client.id, client]));
  const preEventById = Object.fromEntries(((preEventsData ?? []) as Array<Pick<PreEventRecord, 'id' | 'status'>>).map((preEvent) => [preEvent.id, preEvent]));

  const mapped = events.map((event) => {
    const client = clientById[event.client_id];
    const preEvent = event.source_pre_event_id ? preEventById[event.source_pre_event_id] : null;
    const shortEventId = event.id.slice(0, 8);
    const shortPreEventId = event.source_pre_event_id ? event.source_pre_event_id.slice(0, 8) : null;
    const labelParts = [
      event.event_type ?? 'Evento',
      event.event_date ?? 'sin fecha',
      client?.full_name ?? 'cliente no ligado',
      `#${shortEventId}`,
      shortPreEventId ? `reserva #${shortPreEventId}` : null,
    ].filter(Boolean);

    return {
      event_id: event.id,
      event_date: event.event_date ?? null,
      event_type: event.event_type ?? null,
      location: event.location ?? null,
      client_name: client?.full_name ?? null,
      client_email: client?.email ?? null,
      pre_event_id: event.source_pre_event_id ?? null,
      pre_event_status: preEvent?.status ?? null,
      event_status: event.status ?? null,
      label: labelParts.join(' · '),
      search_text: buildFinanceExpenseEventSearchText([
        event.id,
        event.event_type,
        event.event_date,
        event.location,
        client?.full_name,
        client?.email,
        event.source_pre_event_id,
        preEvent?.status,
        event.status,
      ]),
    } satisfies FinanceExpenseEventSearchOption;
  });

  const normalizedQuery = buildFinanceExpenseEventSearchText([query]);
  if (!normalizedQuery) return mapped;
  return mapped.filter((option) => option.search_text.includes(normalizedQuery));
}

export async function getFinancialExpenseCategories() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as FinancialExpenseCategoryRecord[];

  const { data } = await supabase
    .from('financial_expense_categories')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  return (data ?? []) as FinancialExpenseCategoryRecord[];
}

export async function getFinancialExpenses(filters: FinanceExpensesFilters = {}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      expenses: [] as FinancialExpenseRecord[],
      eventOptions: [] as Array<{ id: string; label: string }>,
      eventSearchOptions: [] as FinanceExpenseEventSearchOption[],
      categories: [] as FinancialExpenseCategoryRecord[],
    };
  }

  let query = supabase
    .from('financial_expenses')
    .select(`
      *,
      category_ref:financial_expense_categories!financial_expenses_category_id_fkey(
        id,
        name,
        slug,
        report_group,
        tax_sensitive,
        requires_receipt
      )
    `)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(120);

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
  const expenses = ((data ?? []) as Array<FinancialExpenseRecord & { category_ref?: Partial<FinancialExpenseCategoryRecord> | null }>).map((expense) => ({
    ...expense,
    category_name: expense.category_ref?.name ?? null,
    category_slug: expense.category_ref?.slug ?? null,
    category_report_group: expense.category_ref?.report_group ?? null,
    category_tax_sensitive: expense.category_ref?.tax_sensitive ?? null,
    category_requires_receipt: expense.category_ref?.requires_receipt ?? null,
  }));
  const expensesWithSignedReceipts = await Promise.all(
    expenses.map(async (expense) => {
      if (!expense.receipt_storage_bucket || !expense.receipt_storage_path) return expense;
      const signed = await supabase.storage.from(expense.receipt_storage_bucket).createSignedUrl(expense.receipt_storage_path, 60 * 60 * 8);
      return {
        ...expense,
        receipt_signed_url: signed.data?.signedUrl ?? null,
      } satisfies FinancialExpenseRecord;
    }),
  );

  const categories = await getFinancialExpenseCategories();
  const eventIds = [...new Set(expensesWithSignedReceipts.map((expense) => expense.event_id).filter(Boolean))] as string[];
  if (eventIds.length === 0) {
    return {
      expenses: expensesWithSignedReceipts,
      eventOptions: [] as Array<{ id: string; label: string }>,
      eventSearchOptions: await searchFinanceExpenseEvents('', 80),
      categories,
    };
  }

  const { data: eventsData } = await supabase.from('events').select('id, event_type, event_date').in('id', eventIds);
  const eventOptions = (eventsData ?? []).map((event) => ({
    id: String(event.id),
    label: `${event.event_type ?? 'Evento'} · ${event.event_date ?? 'sin fecha'} · #${String(event.id).slice(0, 8)}`,
  }));

  return {
    expenses: expensesWithSignedReceipts,
    eventOptions,
    eventSearchOptions: await searchFinanceExpenseEvents('', 80),
    categories,
  };
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

  const expenses = (data ?? []) as FinancialExpenseRecord[];
  return Promise.all(
    expenses.map(async (expense) => {
      if (!expense.receipt_storage_bucket || !expense.receipt_storage_path) return expense;
      const signed = await supabase.storage.from(expense.receipt_storage_bucket).createSignedUrl(expense.receipt_storage_path, 60 * 60 * 8);
      return {
        ...expense,
        receipt_signed_url: signed.data?.signedUrl ?? null,
      } satisfies FinancialExpenseRecord;
    }),
  );
}

export interface ContractorPayoutReadModel extends ContractorPayoutRecord {
  profile_full_name: string | null;
  profile_email: string | null;
  event_type: string | null;
  event_date: string | null;
  assignment_role: string | null;
  assignment_status: string | null;
}

function mapContractorPayoutReadModel(record: Record<string, unknown>): ContractorPayoutReadModel {
  const profile = (record.profile as Record<string, unknown> | null) ?? null;
  const event = (record.event as Record<string, unknown> | null) ?? null;
  const assignment = (record.assignment as Record<string, unknown> | null) ?? null;

  return {
    ...(record as unknown as ContractorPayoutRecord),
    profile_full_name: (profile?.full_name as string | null) ?? null,
    profile_email: (profile?.email as string | null) ?? null,
    event_type: (event?.event_type as string | null) ?? null,
    event_date: (event?.event_date as string | null) ?? null,
    assignment_role: (assignment?.assignment_role as string | null) ?? null,
    assignment_status: (assignment?.assignment_status as string | null) ?? null,
  };
}

export async function getContractorPayoutsByEventId(eventId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as ContractorPayoutReadModel[];

  const { data, error } = await supabase
    .from('contractor_payouts')
    .select(
      `
      *,
      profile:profiles!contractor_payouts_profile_id_fkey(full_name, email),
      event:events!contractor_payouts_event_id_fkey(event_type, event_date),
      assignment:event_staff_assignments!contractor_payouts_assignment_id_fkey(assignment_role, assignment_status)
    `,
    )
    .eq('event_id', eventId)
    .order('payout_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(120);

  if (error) return [] as ContractorPayoutReadModel[];
  return (data ?? []).map((row) => mapContractorPayoutReadModel(row as Record<string, unknown>));
}

export async function getContractorPayoutsByProfileId(profileId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as ContractorPayoutReadModel[];

  const { data, error } = await supabase
    .from('contractor_payouts')
    .select(
      `
      *,
      profile:profiles!contractor_payouts_profile_id_fkey(full_name, email),
      event:events!contractor_payouts_event_id_fkey(event_type, event_date),
      assignment:event_staff_assignments!contractor_payouts_assignment_id_fkey(assignment_role, assignment_status)
    `,
    )
    .eq('profile_id', profileId)
    .order('payout_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(120);

  if (error) return [] as ContractorPayoutReadModel[];
  return (data ?? []).map((row) => mapContractorPayoutReadModel(row as Record<string, unknown>));
}

export async function getRecentContractorPayouts(limit = 30) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as ContractorPayoutReadModel[];

  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 120) : 30;

  const { data, error } = await supabase
    .from('contractor_payouts')
    .select(
      `
      *,
      profile:profiles!contractor_payouts_profile_id_fkey(full_name, email),
      event:events!contractor_payouts_event_id_fkey(event_type, event_date),
      assignment:event_staff_assignments!contractor_payouts_assignment_id_fkey(assignment_role, assignment_status)
    `,
    )
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) return [] as ContractorPayoutReadModel[];
  return (data ?? []).map((row) => mapContractorPayoutReadModel(row as Record<string, unknown>));
}

export interface FinanceOverviewEventProfitRow {
  eventId: string;
  clientName: string;
  eventDate: string;
  expectedIncome: number;
  knownPaid: number;
  projectedExpenses: number;
  actualExpenses: number;
  estimatedProfit: number;
  paymentStatus: PaymentStatusResult;
}

export interface FinanceOverviewReservationPipelineRow {
  preEventId: string;
  clientName: string;
  reservationDate: string | null;
  eventDate: string | null;
  totalExpected: number | null;
  amountDue: number | null;
  paymentStatus: PaymentStatusResult;
}

export interface FinanceOverviewData {
  expectedIncome: number;
  knownPaidIncome: number;
  pendingBalance: number;
  projectedExpenses: number;
  actualApprovedExpenses: number;
  projectedProfit: number;
  knownProfit: number;
  eventsProfitability: FinanceOverviewEventProfitRow[];
  reservationsPipeline: FinanceOverviewReservationPipelineRow[];
  expenseSummaryByCategory: Array<{ category: string; totalApprovedAmount: number }>;
}

export async function getFinanceOverviewData(): Promise<FinanceOverviewData> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      expectedIncome: 0,
      knownPaidIncome: 0,
      pendingBalance: 0,
      projectedExpenses: 0,
      actualApprovedExpenses: 0,
      projectedProfit: 0,
      knownProfit: 0,
      eventsProfitability: [],
      reservationsPipeline: [],
      expenseSummaryByCategory: [],
    };
  }

  const [{ data: eventsData }, { data: preEventsData }] = await Promise.all([
    // Intentionally limited to a recent overview window for performance/reversibility in Phase 4,
    // not a full historical finance report yet.
    supabase.from('events').select('*').order('event_date', { ascending: false }).limit(80),
    supabase.from('pre_events').select('*').order('updated_at', { ascending: false }).limit(80),
  ]);

  const events = (eventsData ?? []) as EventRecord[];
  const preEvents = (preEventsData ?? []) as PreEventRecord[];

  const preEventIds = [...new Set([...events.map((event) => event.source_pre_event_id), ...preEvents.map((preEvent) => preEvent.id)])];
  const quoteIds = [...new Set([...events.map((event) => event.source_quote_id), ...preEvents.map((preEvent) => preEvent.source_quote_id)])];
  const eventIds = [...new Set(events.map((event) => event.id))];
  const clientIds = [...new Set([...events.map((event) => event.client_id), ...preEvents.map((preEvent) => preEvent.client_id)])];

  const [quotesRes, clientsRes, invoicesRes, paymentLinksRes, sheetsRes, actualExpensesRes] = await Promise.all([
    supabase.from('quotes').select('id, status, total_amount, expected_deposit, estimated_balance').in('id', quoteIds),
    supabase.from('clients').select('*').in('id', clientIds),
    supabase.from('invoices').select('*').in('quote_id', quoteIds).order('created_at', { ascending: false }),
    supabase.from('payment_links').select('*').eq('source_record_type', 'pre_event').in('source_record_id', preEventIds).order('created_at', { ascending: false }),
    supabase.from('quote_financial_sheets').select('*').in('quote_id', quoteIds),
    supabase.from('financial_expenses').select('*').eq('status', 'approved').in('event_id', eventIds),
  ]);

  const sheets = (sheetsRes.data ?? []) as QuoteFinancialSheetRecord[];
  const sheetIds = sheets.map((item) => item.id);
  const quoteExpensesRes = sheetIds.length > 0
    ? await supabase.from('quote_financial_expenses').select('*').in('sheet_id', sheetIds)
    : { data: [] };

  const quotes = (quotesRes.data ?? []) as Array<Pick<QuoteRecord, 'id' | 'status' | 'total_amount' | 'expected_deposit' | 'estimated_balance'>>;
  const clients = (clientsRes.data ?? []) as ClientRecord[];
  const invoices = (invoicesRes.data ?? []) as InvoiceRecord[];
  const paymentLinks = (paymentLinksRes.data ?? []) as PaymentLinkRecord[];
  const quoteExpenses = (quoteExpensesRes.data ?? []) as QuoteFinancialExpenseRecord[];
  const actualApprovedExpenses = (actualExpensesRes.data ?? []) as FinancialExpenseRecord[];
  const controlledCategoryIds = [...new Set(actualApprovedExpenses.map((expense) => expense.category_id).filter(Boolean))] as string[];
  const controlledCategoriesRes = controlledCategoryIds.length > 0
    ? await supabase
        .from('financial_expense_categories')
        .select('id, name')
        .in('id', controlledCategoryIds)
    : { data: [] };
  const controlledCategoryNameById = Object.fromEntries(
    (((controlledCategoriesRes.data ?? []) as Array<Pick<FinancialExpenseCategoryRecord, 'id' | 'name'>>).map((category) => [category.id, category.name])),
  ) as Record<string, string>;

  const quoteById = Object.fromEntries(quotes.map((quote) => [quote.id, quote])) as Record<string, (typeof quotes)[number]>;
  const preEventById = Object.fromEntries(preEvents.map((preEvent) => [preEvent.id, preEvent])) as Record<string, PreEventRecord>;
  const clientById = Object.fromEntries(clients.map((client) => [client.id, client])) as Record<string, ClientRecord>;

  const latestInvoiceByQuoteId = invoices.reduce<Record<string, InvoiceRecord | null>>((acc, invoice) => {
    if (!invoice.quote_id) return acc;
    if (!acc[invoice.quote_id]) acc[invoice.quote_id] = invoice;
    return acc;
  }, {});

  const paymentLinksByPreEventId = paymentLinks.reduce<Record<string, PaymentLinkRecord[]>>((acc, link) => {
    if (!acc[link.source_record_id]) acc[link.source_record_id] = [];
    acc[link.source_record_id].push(link);
    return acc;
  }, {});

  const sheetByQuoteId = Object.fromEntries(sheets.map((sheet) => [sheet.quote_id, sheet])) as Record<string, QuoteFinancialSheetRecord>;
  const quoteExpensesBySheetId = quoteExpenses.reduce<Record<string, QuoteFinancialExpenseRecord[]>>((acc, expense) => {
    if (!acc[expense.sheet_id]) acc[expense.sheet_id] = [];
    acc[expense.sheet_id].push(expense);
    return acc;
  }, {});

  const projectedExpenseByQuoteId = quoteIds.reduce<Record<string, number>>((acc, quoteId) => {
    const sheet = sheetByQuoteId[quoteId];
    if (!sheet) {
      acc[quoteId] = 0;
      return acc;
    }

    const summary = calculateFinancialSummary({
      grossRevenue: sheet.gross_revenue,
      taxReservePercentage: sheet.tax_reserve_percentage,
      salesCommissionPercentage: sheet.sales_commission_percentage,
      expenses: (quoteExpensesBySheetId[sheet.id] ?? []).map(mapSettingsExpenseToEditable),
    });

    acc[quoteId] = summary.totalExtraExpenses;
    return acc;
  }, {});

  const actualExpenseByEventId = actualApprovedExpenses.reduce<Record<string, number>>((acc, expense) => {
    if (!expense.event_id) return acc;
    acc[expense.event_id] = (acc[expense.event_id] ?? 0) + asNumber(expense.amount);
    return acc;
  }, {});

  const expenseSummaryByCategory = Object.entries(
    actualApprovedExpenses.reduce<Record<string, number>>((acc, expense) => {
      const key = resolveExpenseCategorySummaryLabel({
        categoryId: expense.category_id,
        controlledCategoryName: expense.category_id ? controlledCategoryNameById[expense.category_id] ?? null : null,
        legacyCategory: expense.category,
      });
      acc[key] = (acc[key] ?? 0) + asNumber(expense.amount);
      return acc;
    }, {}),
  ).map(([category, totalApprovedAmount]) => ({ category, totalApprovedAmount }));

  const eventsProfitability = events.map<FinanceOverviewEventProfitRow>((event) => {
    const quote = quoteById[event.source_quote_id];
    const preEvent = preEventById[event.source_pre_event_id];
    const paymentStatus = getPaymentStatus({
      eventStatus: event.status,
      preEventStatus: preEvent?.status,
      quoteTotalAmount: quote?.total_amount ?? null,
      expectedDeposit: quote?.expected_deposit ?? null,
      estimatedBalance: quote?.estimated_balance ?? null,
      invoices: latestInvoiceByQuoteId[event.source_quote_id] ? [latestInvoiceByQuoteId[event.source_quote_id]!] : [],
      paymentLinks: paymentLinksByPreEventId[event.source_pre_event_id] ?? [],
    });

    const expectedIncome = asNumber(quote?.total_amount ?? null);
    const knownPaid = paymentStatus.amountPaid ?? 0;
    const projectedExpenses = projectedExpenseByQuoteId[event.source_quote_id] ?? 0;
    const actualExpenses = actualExpenseByEventId[event.id] ?? 0;

    return {
      eventId: event.id,
      clientName: clientById[event.client_id]?.full_name ?? 'Cliente interno',
      eventDate: event.event_date,
      expectedIncome,
      knownPaid,
      projectedExpenses,
      actualExpenses,
      estimatedProfit: knownPaid - actualExpenses,
      paymentStatus,
    };
  });

  const eventsByPreEventId = Object.fromEntries(events.map((event) => [event.source_pre_event_id, event])) as Record<string, EventRecord>;
  const reservationsPipeline = preEvents.map<FinanceOverviewReservationPipelineRow>((preEvent) => {
    const quote = quoteById[preEvent.source_quote_id];
    const linkedEvent = eventsByPreEventId[preEvent.id] ?? null;
    const paymentStatus = getPaymentStatus({
      preEventStatus: preEvent.status,
      eventStatus: linkedEvent?.status ?? null,
      quoteTotalAmount: quote?.total_amount ?? null,
      expectedDeposit: quote?.expected_deposit ?? null,
      estimatedBalance: quote?.estimated_balance ?? null,
      invoices: latestInvoiceByQuoteId[preEvent.source_quote_id] ? [latestInvoiceByQuoteId[preEvent.source_quote_id]!] : [],
      paymentLinks: paymentLinksByPreEventId[preEvent.id] ?? [],
    });

    return {
      preEventId: preEvent.id,
      clientName: clientById[preEvent.client_id]?.full_name ?? 'Cliente interno',
      reservationDate: preEvent.confirmed_date,
      eventDate: linkedEvent?.event_date ?? null,
      totalExpected: paymentStatus.totalExpected,
      amountDue: paymentStatus.amountDue,
      paymentStatus,
    };
  });

  const expectedIncome = eventsProfitability.reduce((sum, row) => sum + row.expectedIncome, 0);
  const knownPaidIncome = eventsProfitability.reduce((sum, row) => sum + row.knownPaid, 0);
  const pendingBalance = Math.max(expectedIncome - knownPaidIncome, 0);
  const projectedExpenses = eventsProfitability.reduce((sum, row) => sum + row.projectedExpenses, 0);
  const actualApprovedExpensesTotal = actualApprovedExpenses.reduce((sum, expense) => sum + asNumber(expense.amount), 0);
  const projectedProfit = expectedIncome - projectedExpenses;
  const knownProfit = knownPaidIncome - actualApprovedExpensesTotal;

  return {
    expectedIncome,
    knownPaidIncome,
    pendingBalance,
    projectedExpenses,
    actualApprovedExpenses: actualApprovedExpensesTotal,
    projectedProfit,
    knownProfit,
    eventsProfitability,
    reservationsPipeline,
    expenseSummaryByCategory,
  };
}
