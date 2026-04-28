import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ClientRecord } from '@/types/clients';
import type { EventRecord } from '@/types/events';
import type { InvoiceEmailDeliveryRecord, InvoiceRecord } from '@/types/invoices';
import type { PaymentLinkRecord } from '@/types/payments';
import type { PreEventRecord } from '@/types/pre-events';
import type { QuoteRecord } from '@/types/quotes';
import { computeFinanceInvoiceAgingSummary, type InvoiceAgingInput } from '@/services/invoices/aging';

export async function getInvoicesByQuoteId(quoteId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as InvoiceRecord[];

  const { data } = await supabase.from('invoices').select('*').eq('quote_id', quoteId).order('created_at', { ascending: false });
  return (data ?? []) as InvoiceRecord[];
}

export async function getLatestInvoiceByQuoteId(quoteId: string) {
  const invoices = await getInvoicesByQuoteId(quoteId);
  return invoices[0] ?? null;
}

export async function getInvoiceEmailDeliveriesByInvoiceId(invoiceId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as InvoiceEmailDeliveryRecord[];

  const { data } = await supabase
    .from('invoice_email_deliveries')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: false })
    .limit(25);

  return (data ?? []) as InvoiceEmailDeliveryRecord[];
}

export interface FinanceInvoiceListFilters {
  status?: InvoiceRecord['status'] | 'all';
  limit?: number;
}

export interface FinanceInvoiceListItem {
  id: string;
  invoice_number: string;
  status: InvoiceRecord['status'];
  total_amount: number | string;
  deposit_amount: number | string | null;
  balance_due: number | string | null;
  issued_at: string | null;
  due_at: string | null;
  quote_id: string | null;
  pre_event_id: string | null;
  event_id: string | null;
  client_id: string | null;
  client_full_name: string | null;
  client_email: string | null;
  source_label: 'Quote' | 'Pre-event' | 'Event' | 'Manual';
}

function getInvoiceSourceLabel(sourceType: InvoiceRecord['source_type']): FinanceInvoiceListItem['source_label'] {
  if (sourceType === 'pre_event') return 'Pre-event';
  if (sourceType === 'event') return 'Event';
  if (sourceType === 'manual') return 'Manual';
  return 'Quote';
}

export async function getFinanceInvoices(filters: FinanceInvoiceListFilters = {}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as FinanceInvoiceListItem[];

  const safeLimit = Number.isFinite(filters.limit) ? Math.min(Math.max(Math.trunc(filters.limit ?? 60), 1), 200) : 60;
  let invoicesQuery = supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(safeLimit);

  if (filters.status && filters.status !== 'all') {
    invoicesQuery = invoicesQuery.eq('status', filters.status);
  }

  const { data } = await invoicesQuery;
  const invoices = (data ?? []) as InvoiceRecord[];
  if (invoices.length === 0) return [] as FinanceInvoiceListItem[];

  const clientIds = [...new Set(invoices.map((invoice) => invoice.client_id).filter(Boolean))] as string[];
  const clientsData = clientIds.length > 0
    ? await supabase.from('clients').select('id, full_name, email').in('id', clientIds)
    : { data: [] as Array<Pick<ClientRecord, 'id' | 'full_name' | 'email'>> };

  const clientById = Object.fromEntries(
    (((clientsData.data ?? []) as Array<Pick<ClientRecord, 'id' | 'full_name' | 'email'>>).map((client) => [client.id, client])),
  ) as Record<string, Pick<ClientRecord, 'id' | 'full_name' | 'email'>>;

  return invoices.map((invoice) => {
    const client = invoice.client_id ? clientById[invoice.client_id] : null;
    return {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      total_amount: invoice.total_amount,
      deposit_amount: invoice.deposit_amount,
      balance_due: invoice.balance_due,
      issued_at: invoice.issued_at,
      due_at: invoice.due_at,
      quote_id: invoice.quote_id,
      pre_event_id: invoice.pre_event_id,
      event_id: invoice.event_id,
      client_id: invoice.client_id,
      client_full_name: client?.full_name ?? null,
      client_email: client?.email ?? null,
      source_label: getInvoiceSourceLabel(invoice.source_type),
    } satisfies FinanceInvoiceListItem;
  });
}

export interface FinanceInvoiceDetail {
  invoice: InvoiceRecord;
  client: Pick<ClientRecord, 'id' | 'full_name' | 'email'> | null;
  quote: Pick<QuoteRecord, 'id' | 'status' | 'total_amount' | 'expected_deposit' | 'estimated_balance'> | null;
  preEvent: Pick<PreEventRecord, 'id' | 'status' | 'confirmed_date' | 'event_type'> | null;
  event: Pick<EventRecord, 'id' | 'status' | 'event_date' | 'event_type'> | null;
  paymentLinks: Array<
    Pick<PaymentLinkRecord, 'id' | 'source_record_type' | 'payment_mode' | 'external_url' | 'amount_to_charge' | 'balance_due' | 'created_at'>
  >;
  source_label: FinanceInvoiceListItem['source_label'];
}

export async function getFinanceInvoiceById(invoiceId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null as FinanceInvoiceDetail | null;

  const { data: invoiceData } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
  const invoice = (invoiceData as InvoiceRecord | null) ?? null;
  if (!invoice) return null;

  const [clientRes, quoteRes, preEventRes, eventRes, quoteLinksRes, preEventLinksRes] = await Promise.all([
    invoice.client_id
      ? supabase.from('clients').select('id, full_name, email').eq('id', invoice.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    invoice.quote_id
      ? supabase.from('quotes').select('id, status, total_amount, expected_deposit, estimated_balance').eq('id', invoice.quote_id).maybeSingle()
      : Promise.resolve({ data: null }),
    invoice.pre_event_id
      ? supabase.from('pre_events').select('id, status, confirmed_date, event_type').eq('id', invoice.pre_event_id).maybeSingle()
      : Promise.resolve({ data: null }),
    invoice.event_id
      ? supabase.from('events').select('id, status, event_date, event_type').eq('id', invoice.event_id).maybeSingle()
      : Promise.resolve({ data: null }),
    invoice.quote_id
      ? supabase
          .from('payment_links')
          .select('id, source_record_type, payment_mode, external_url, amount_to_charge, balance_due, created_at')
          .eq('source_record_type', 'quote')
          .eq('source_record_id', invoice.quote_id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    invoice.pre_event_id
      ? supabase
          .from('payment_links')
          .select('id, source_record_type, payment_mode, external_url, amount_to_charge, balance_due, created_at')
          .eq('source_record_type', 'pre_event')
          .eq('source_record_id', invoice.pre_event_id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const paymentLinks = [...((quoteLinksRes.data ?? []) as FinanceInvoiceDetail['paymentLinks']), ...((preEventLinksRes.data ?? []) as FinanceInvoiceDetail['paymentLinks'])]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  return {
    invoice,
    client: (clientRes.data as FinanceInvoiceDetail['client']) ?? null,
    quote: (quoteRes.data as FinanceInvoiceDetail['quote']) ?? null,
    preEvent: (preEventRes.data as FinanceInvoiceDetail['preEvent']) ?? null,
    event: (eventRes.data as FinanceInvoiceDetail['event']) ?? null,
    paymentLinks,
    source_label: getInvoiceSourceLabel(invoice.source_type),
  };
}


export async function getFinanceInvoiceAgingSummary() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return computeFinanceInvoiceAgingSummary([]);
  }

  const { data } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, balance_due, due_at, client_id')
    .order('created_at', { ascending: false })
    .limit(2000);

  const invoices = (data ?? []) as Array<
    Pick<InvoiceRecord, 'id' | 'invoice_number' | 'status' | 'balance_due' | 'due_at' | 'client_id'>
  >;

  const clientIds = [...new Set(invoices.map((invoice) => invoice.client_id).filter(Boolean))] as string[];
  const clientsData = clientIds.length > 0
    ? await supabase.from('clients').select('id, full_name').in('id', clientIds)
    : { data: [] as Array<Pick<ClientRecord, 'id' | 'full_name'>> };

  const clientById = Object.fromEntries(
    (((clientsData.data ?? []) as Array<Pick<ClientRecord, 'id' | 'full_name'>>).map((client) => [client.id, client])),
  ) as Record<string, Pick<ClientRecord, 'id' | 'full_name'>>;

  const agingInputs: InvoiceAgingInput[] = invoices.map((invoice) => ({
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    status: invoice.status,
    balance_due: invoice.balance_due,
    due_at: invoice.due_at,
    client_full_name: invoice.client_id ? (clientById[invoice.client_id]?.full_name ?? null) : null,
  }));

  return computeFinanceInvoiceAgingSummary(agingInputs);
}
