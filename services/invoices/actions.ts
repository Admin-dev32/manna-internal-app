'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';

import { requireActiveSession } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { InvoiceFormState } from '@/services/invoices/form-state';
import { getClientByLeadId } from '@/services/clients/queries';
import { getLeadById } from '@/services/leads/queries';
import { getEventByQuoteId } from '@/services/events/queries';
import { getPreEventByQuoteId } from '@/services/pre-events/queries';

function parseOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  const parsed = parseOptionalString(value);
  if (!parsed) return null;

  const date = new Date(parsed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toMoney(value: number | string | null) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

function buildInvoiceNumber(quoteId: string) {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = quoteId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `INV-${ymd}-${suffix}`;
}

export async function issueInvoiceFromQuoteAction(
  quoteId: string,
  _previousState: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  if (!hasPermission(session.user, 'finance.invoices.manage')) {
    return { status: 'error', message: 'No tienes permisos para emitir invoices.' };
  }

  const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle();
  if (!quote) {
    return { status: 'error', message: 'No encontramos la cotización asociada.' };
  }

  if (quote.status !== 'aceptada') {
    return { status: 'error', message: 'Solo puedes emitir invoice cuando la cotización está aceptada.' };
  }

  const { data: existingInvoice } = await supabase.from('invoices').select('id, invoice_number').eq('quote_id', quoteId).maybeSingle();
  if (existingInvoice) {
    return {
      status: 'success',
      message: `La cotización ya tiene un invoice emitido (${existingInvoice.invoice_number}).`,
    };
  }

  const [lead, client, preEvent, event, financialSheet] = await Promise.all([
    getLeadById(quote.lead_id),
    getClientByLeadId(quote.lead_id),
    getPreEventByQuoteId(quoteId),
    getEventByQuoteId(quoteId),
    supabase.from('quote_financial_sheets').select('*').eq('quote_id', quoteId).maybeSingle(),
  ]);

  if (!lead) {
    return { status: 'error', message: 'No encontramos el lead relacionado para construir el snapshot del invoice.' };
  }

  const subtotal = toMoney(quote.subtotal);
  const discountAmount = toMoney(quote.discount_amount);
  const totalAmount = toMoney(quote.total_amount);
  const depositAmount = quote.expected_deposit === null ? null : toMoney(quote.expected_deposit);
  const balanceDue = quote.estimated_balance === null ? null : toMoney(quote.estimated_balance);

  const customerSnapshot = {
    source: client ? 'client' : 'lead',
    id: client?.id ?? lead.id,
    name: client?.full_name ?? lead.full_name,
    email: client?.email ?? lead.email,
    phone: client?.phone ?? lead.phone,
    company: null,
  };

  const eventSnapshot = {
    lead_tentative_date: lead.tentative_event_date,
    lead_tentative_time: lead.tentative_event_time,
    lead_tentative_location: lead.location,
    lead_service_interest: lead.service_interest,
    lead_guest_count: lead.guest_count,
    pre_event: preEvent
      ? {
          id: preEvent.id,
          confirmed_date: preEvent.confirmed_date,
          confirmed_time: preEvent.confirmed_time,
          location: preEvent.location,
          event_type: preEvent.event_type,
          booked_service: preEvent.booked_service,
          confirmed_guests: preEvent.confirmed_guests,
        }
      : null,
    event: event
      ? {
          id: event.id,
          event_date: event.event_date,
          event_time: event.event_time,
          location: event.location,
          booked_service: event.booked_service,
          guest_count: event.guest_count,
          status: event.status,
        }
      : null,
  };

  const financialSnapshot = {
    quote: {
      id: quote.id,
      status: quote.status,
      subtotal,
      discount_type: quote.discount_type,
      discount_value: quote.discount_value,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      deposit_type: quote.deposit_type,
      deposit_value: quote.deposit_value,
      expected_deposit: depositAmount,
      estimated_balance: balanceDue,
      promotion_note: quote.promotion_note,
      notes: quote.notes,
      sent_at: quote.sent_at,
    },
    quote_financial_sheet: financialSheet.data
      ? {
          id: financialSheet.data.id,
          gross_revenue: financialSheet.data.gross_revenue,
          tax_reserve_percentage: financialSheet.data.tax_reserve_percentage,
          sales_commission_percentage: financialSheet.data.sales_commission_percentage,
        }
      : null,
  };

  const dueAt = parseOptionalDate(formData.get('due_at'));
  const notes = parseOptionalString(formData.get('notes'));
  const internalNotes = parseOptionalString(formData.get('internal_notes'));
  const invoiceNumber = buildInvoiceNumber(quote.id);

  const { error } = await supabase.from('invoices').insert({
    quote_id: quote.id,
    client_id: client?.id ?? null,
    pre_event_id: preEvent?.id ?? null,
    event_id: event?.id ?? null,
    invoice_number: invoiceNumber,
    status: 'issued',
    currency: 'usd',
    subtotal,
    discount_amount: discountAmount,
    total_amount: totalAmount,
    deposit_amount: depositAmount,
    balance_due: balanceDue,
    issued_at: new Date().toISOString(),
    due_at: dueAt,
    notes,
    internal_notes: internalNotes,
    customer_snapshot: customerSnapshot,
    event_snapshot: eventSnapshot,
    financial_snapshot: financialSnapshot,
    created_by: session.user.id,
    updated_by: session.user.id,
  });

  if (error) {
    if (error.code === '23505') {
      return { status: 'error', message: 'Ya existe un invoice para esta cotización.' };
    }

    return { status: 'error', message: `No pudimos emitir el invoice (${error.code ?? 'error-desconocido'}).` };
  }

  await supabase.from('financial_change_logs').insert({
    entity_type: 'invoice',
    quote_id: quote.id,
    settings_id: financialSheet.data?.defaults_source_settings_id ?? null,
    change_kind: 'invoice_issued',
    summary_payload: {
      invoiceNumber,
      totalAmount,
      dueAt,
      snapshotSource: {
        customer: customerSnapshot.source,
        hasPreEvent: Boolean(preEvent),
        hasEvent: Boolean(event),
      },
    },
    changed_by: session.user.id,
  });

  revalidatePath(`/cotizaciones/${quote.id}` as Route);
  revalidatePath('/cotizaciones' as Route);
  return { status: 'success', message: `Invoice emitido correctamente (${invoiceNumber}).` };
}
