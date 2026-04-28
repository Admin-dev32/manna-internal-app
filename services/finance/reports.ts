import { resolveExpenseCategorySummaryLabel } from '@/lib/finance/expense-categories';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ClientRecord } from '@/types/clients';
import type { EventRecord } from '@/types/events';
import type { ContractorPayoutRecord, FinancialExpenseCategoryRecord, FinancialExpenseRecord } from '@/types/finance';
import type { InvoiceRecord } from '@/types/invoices';

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isWithinDateRange(value: string | null | undefined, from: string | null, to: string | null) {
  if (!value) return false;
  const day = value.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export interface FinanceReportsFilters {
  dateFrom?: string | null;
  dateTo?: string | null;
  eventId?: string | null;
  clientId?: string | null;
  category?: string | null;
  vendor?: string | null;
  invoiceStatus?: InvoiceRecord['status'] | null;
  expenseStatus?: FinancialExpenseRecord['status'] | null;
  payoutStatus?: ContractorPayoutRecord['status'] | null;
}

export interface FinanceReportRevenueRow {
  invoice_id: string;
  client_id: string | null;
  client_name: string;
  event_id: string | null;
  event_label: string;
  invoice_status: InvoiceRecord['status'];
  total_amount: number;
  balance_due: number;
  issued_at: string | null;
}

export interface FinanceReportExpenseRow {
  expense_id: string;
  event_id: string | null;
  event_label: string;
  category_label: string;
  vendor_name: string;
  status: FinancialExpenseRecord['status'];
  amount: number;
  expense_date: string;
}

export interface FinanceReportPayoutRow {
  payout_id: string;
  event_id: string | null;
  event_label: string;
  status: ContractorPayoutRecord['status'];
  amount: number;
  payout_date: string | null;
}

export interface FinanceReportsData {
  filtersApplied: {
    dateFrom: string | null;
    dateTo: string | null;
  };
  revenueRows: FinanceReportRevenueRow[];
  expenseRows: FinanceReportExpenseRow[];
  payoutRows: FinanceReportPayoutRow[];
}

export interface ComputedFinanceReports {
  revenueSignal: number;
  outstandingBalance: number;
  approvedExpenses: number;
  recordedExpenses: number;
  contractorPaid: number;
  estimatedNet: number;
  spendingByCategory: Array<{ category: string; total: number }>;
  spendingByEvent: Array<{ eventLabel: string; total: number }>;
  spendingByVendor: Array<{ vendor: string; total: number }>;
  revenueByClient: Array<{ clientName: string; total: number; balanceDue: number }>;
  revenueByEvent: Array<{ eventLabel: string; total: number; balanceDue: number }>;
  eventProfitability: Array<{ eventLabel: string; revenue: number; expenses: number; payouts: number; estimatedNet: number }>;
  contractorPayoutSummary: Array<{ status: string; total: number }>;
}

export function computeFinanceReports(rows: FinanceReportsData, filters: FinanceReportsFilters): ComputedFinanceReports {
  const revenueRowsForKpis = rows.revenueRows.filter((row) => row.invoice_status !== 'draft' && row.invoice_status !== 'void');
  const revenueRows = rows.revenueRows.filter((row) => {
    if (filters.clientId && row.client_id !== filters.clientId) return false;
    if (filters.eventId && row.event_id !== filters.eventId) return false;
    if (filters.invoiceStatus && row.invoice_status !== filters.invoiceStatus) return false;
    return true;
  });
  const filteredRevenueRowsForKpis = revenueRowsForKpis.filter((row) => {
    if (filters.clientId && row.client_id !== filters.clientId) return false;
    if (filters.eventId && row.event_id !== filters.eventId) return false;
    if (filters.invoiceStatus && row.invoice_status !== filters.invoiceStatus) return false;
    return true;
  });

  const expenseRows = rows.expenseRows.filter((row) => {
    if (filters.eventId && row.event_id !== filters.eventId) return false;
    if (filters.category && row.category_label !== filters.category) return false;
    if (filters.vendor && row.vendor_name !== filters.vendor) return false;
    if (filters.expenseStatus && row.status !== filters.expenseStatus) return false;
    return true;
  });

  const payoutRows = rows.payoutRows.filter((row) => {
    if (filters.eventId && row.event_id !== filters.eventId) return false;
    if (filters.payoutStatus && row.status !== filters.payoutStatus) return false;
    return true;
  });

  const revenueSignal = filteredRevenueRowsForKpis.reduce((sum, row) => sum + row.total_amount, 0);
  const outstandingBalance = filteredRevenueRowsForKpis.reduce((sum, row) => sum + row.balance_due, 0);
  const approvedExpenses = expenseRows.filter((row) => row.status === 'approved').reduce((sum, row) => sum + row.amount, 0);
  const recordedExpenses = expenseRows.reduce((sum, row) => sum + row.amount, 0);
  const contractorPaid = payoutRows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.amount, 0);

  function toSortedTotals(items: Array<{ key: string; amount: number }>) {
    return Object.entries(
      items.reduce<Record<string, number>>((acc, item) => {
        acc[item.key] = (acc[item.key] ?? 0) + item.amount;
        return acc;
      }, {}),
    )
      .map(([key, total]) => ({ key, total }))
      .sort((a, b) => b.total - a.total);
  }

  const spendingByCategory = toSortedTotals(expenseRows.filter((row) => row.status === 'approved').map((row) => ({ key: row.category_label, amount: row.amount }))).map(
    (item) => ({ category: item.key, total: item.total }),
  );
  const spendingByEvent = toSortedTotals(expenseRows.filter((row) => row.status === 'approved').map((row) => ({ key: row.event_label, amount: row.amount }))).map(
    (item) => ({ eventLabel: item.key, total: item.total }),
  );
  const spendingByVendor = toSortedTotals(
    expenseRows.filter((row) => row.status === 'approved').map((row) => ({ key: row.vendor_name || 'Unknown Vendor', amount: row.amount })),
  ).map((item) => ({ vendor: item.key, total: item.total }));

  const revenueByClient = toSortedTotals(revenueRows.map((row) => ({ key: row.client_name, amount: row.total_amount }))).map((item) => ({
    clientName: item.key,
    total: item.total,
    balanceDue: revenueRows.filter((row) => row.client_name === item.key).reduce((sum, row) => sum + row.balance_due, 0),
  }));
  const revenueByEvent = toSortedTotals(revenueRows.map((row) => ({ key: row.event_label, amount: row.total_amount }))).map((item) => ({
    eventLabel: item.key,
    total: item.total,
    balanceDue: revenueRows.filter((row) => row.event_label === item.key).reduce((sum, row) => sum + row.balance_due, 0),
  }));

  const eventKeys = [...new Set([...revenueRows.map((row) => row.event_label), ...expenseRows.map((row) => row.event_label), ...payoutRows.map((row) => row.event_label)])];
  const eventProfitability = eventKeys
    .map((eventLabel) => {
      const revenue = revenueRows.filter((row) => row.event_label === eventLabel).reduce((sum, row) => sum + row.total_amount, 0);
      const expenses = expenseRows
        .filter((row) => row.event_label === eventLabel && row.status === 'approved')
        .reduce((sum, row) => sum + row.amount, 0);
      const payouts = payoutRows.filter((row) => row.event_label === eventLabel && row.status === 'paid').reduce((sum, row) => sum + row.amount, 0);
      return {
        eventLabel,
        revenue,
        expenses,
        payouts,
        estimatedNet: revenue - expenses - payouts,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const contractorPayoutSummary = toSortedTotals(payoutRows.map((row) => ({ key: row.status, amount: row.amount }))).map((item) => ({
    status: item.key,
    total: item.total,
  }));

  return {
    revenueSignal,
    outstandingBalance,
    approvedExpenses,
    recordedExpenses,
    contractorPaid,
    estimatedNet: revenueSignal - approvedExpenses - contractorPaid,
    spendingByCategory,
    spendingByEvent,
    spendingByVendor,
    revenueByClient,
    revenueByEvent,
    eventProfitability,
    contractorPayoutSummary,
  };
}

export async function getFinanceReportsData(filters: FinanceReportsFilters = {}): Promise<FinanceReportsData> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      filtersApplied: {
        dateFrom: filters.dateFrom?.trim() || null,
        dateTo: filters.dateTo?.trim() || null,
      },
      revenueRows: [],
      expenseRows: [],
      payoutRows: [],
    };
  }

  const dateFrom = filters.dateFrom?.trim() || null;
  const dateTo = filters.dateTo?.trim() || null;

  const [invoicesRes, expensesRes, payoutsRes, eventsRes, categoriesRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, client_id, event_id, status, total_amount, balance_due, issued_at, created_at')
      .neq('status', 'void')
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('financial_expenses')
      .select('id, event_id, category, category_id, amount, status, expense_date, vendor_name')
      .order('expense_date', { ascending: false })
      .limit(4000),
    supabase
      .from('contractor_payouts')
      .select('id, event_id, status, amount, payout_date, created_at')
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('events')
      .select('id, client_id, event_date, event_type')
      .order('event_date', { ascending: false })
      .limit(2000),
    supabase.from('financial_expense_categories').select('id, name'),
  ]);

  const invoices = (invoicesRes.data ?? []) as Array<
    Pick<InvoiceRecord, 'id' | 'client_id' | 'event_id' | 'status' | 'total_amount' | 'balance_due' | 'issued_at' | 'created_at'>
  >;
  const expenses = (expensesRes.data ?? []) as Array<
    Pick<FinancialExpenseRecord, 'id' | 'event_id' | 'category' | 'category_id' | 'amount' | 'status' | 'expense_date' | 'vendor_name'>
  >;
  const payouts = (payoutsRes.data ?? []) as Array<
    Pick<ContractorPayoutRecord, 'id' | 'event_id' | 'status' | 'amount' | 'payout_date' | 'created_at'>
  >;
  const events = (eventsRes.data ?? []) as Array<Pick<EventRecord, 'id' | 'client_id' | 'event_date' | 'event_type'>>;
  const categoryNameById = Object.fromEntries(((categoriesRes.data ?? []) as Array<Pick<FinancialExpenseCategoryRecord, 'id' | 'name'>>).map((item) => [item.id, item.name]));

  const clientIds = [...new Set([...invoices.map((invoice) => invoice.client_id), ...events.map((event) => event.client_id)].filter(Boolean))] as string[];
  const clientsRes = clientIds.length > 0 ? await supabase.from('clients').select('id, full_name').in('id', clientIds) : { data: [] };
  const clientNameById = Object.fromEntries(((clientsRes.data ?? []) as Array<Pick<ClientRecord, 'id' | 'full_name'>>).map((item) => [item.id, item.full_name ?? 'Client']));
  const eventById = Object.fromEntries(events.map((event) => [event.id, event]));

  const revenueRows = invoices
    .filter((invoice) => isWithinDateRange(invoice.issued_at ?? invoice.created_at, dateFrom, dateTo))
    .map((invoice) => {
      const linkedEvent = invoice.event_id ? eventById[invoice.event_id] : null;
      return {
        invoice_id: invoice.id,
        client_id: invoice.client_id,
        client_name: invoice.client_id ? clientNameById[invoice.client_id] ?? 'Client' : 'Client',
        event_id: invoice.event_id,
        event_label: linkedEvent ? `${linkedEvent.event_type ?? 'Evento'} · ${linkedEvent.event_date ?? 'sin fecha'} · #${linkedEvent.id.slice(0, 8)}` : 'Unlinked Event',
        invoice_status: invoice.status,
        total_amount: toNumber(invoice.total_amount),
        balance_due: toNumber(invoice.balance_due),
        issued_at: invoice.issued_at,
      } satisfies FinanceReportRevenueRow;
    });

  const expenseRows = expenses
    .filter((expense) => isWithinDateRange(expense.expense_date, dateFrom, dateTo))
    .map((expense) => {
      const linkedEvent = expense.event_id ? eventById[expense.event_id] : null;
      return {
        expense_id: expense.id,
        event_id: expense.event_id,
        event_label: linkedEvent ? `${linkedEvent.event_type ?? 'Evento'} · ${linkedEvent.event_date ?? 'sin fecha'} · #${linkedEvent.id.slice(0, 8)}` : 'General / Unlinked',
        category_label: resolveExpenseCategorySummaryLabel({
          categoryId: expense.category_id,
          controlledCategoryName: expense.category_id ? categoryNameById[expense.category_id] ?? null : null,
          legacyCategory: expense.category,
        }),
        vendor_name: String(expense.vendor_name ?? '').trim() || 'Unknown Vendor',
        status: expense.status,
        amount: toNumber(expense.amount),
        expense_date: expense.expense_date,
      } satisfies FinanceReportExpenseRow;
    });

  const payoutRows = payouts
    .filter((payout) => isWithinDateRange(payout.payout_date ?? payout.created_at, dateFrom, dateTo))
    .map((payout) => {
      const linkedEvent = payout.event_id ? eventById[payout.event_id] : null;
      return {
        payout_id: payout.id,
        event_id: payout.event_id,
        event_label: linkedEvent ? `${linkedEvent.event_type ?? 'Evento'} · ${linkedEvent.event_date ?? 'sin fecha'} · #${linkedEvent.id.slice(0, 8)}` : 'General / Unlinked',
        status: payout.status,
        amount: toNumber(payout.amount),
        payout_date: payout.payout_date,
      } satisfies FinanceReportPayoutRow;
    });

  return {
    filtersApplied: { dateFrom, dateTo },
    revenueRows,
    expenseRows,
    payoutRows,
  };
}
