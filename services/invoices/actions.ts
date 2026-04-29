'use server';

import { randomUUID } from 'node:crypto';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';

import { getSafeEmailErrorMessage, sendTransactionalEmail } from '@/services/email/provider';
import { getFinanceInvoiceById } from '@/services/invoices/queries';
import { composeInvoicePurposeEmail, resolveInvoiceEmailPurpose, resolveInvoiceEmailRecipient } from '@/services/invoices/email-send';

import { requireActiveSession } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { validateRecordManualInvoicePaymentInput, type RecordManualInvoicePaymentInput } from '@/lib/finance/invoice-payments';
import { canDeleteDraftManualInvoice, canVoidManualInvoice, validateVoidReason } from '@/lib/finance/manual-invoice-dependencies';
import { validateCreateManualInvoiceInput } from '@/lib/finance/manual-invoices';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { InvoiceFormState } from '@/services/invoices/form-state';
import { getClientByLeadId } from '@/services/clients/queries';
import { getLeadById } from '@/services/leads/queries';
import { getEventByQuoteId } from '@/services/events/queries';
import { getPreEventByQuoteId } from '@/services/pre-events/queries';
import type { CreateManualInvoiceInput, InvoiceEmailDeliveryStatus, SendInvoiceEmailInput } from '@/types/invoices';

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

function buildManualInvoiceNumber() {
  return buildInvoiceNumber(randomUUID());
}

async function loadManualInvoiceDependencies(invoice: { id: string; source_type: string; source_id: string | null; pre_event_id: string | null; event_id: string | null; quote_id: string | null }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const [{ count: invoicePaymentsCount }, { count: invoiceEmailDeliveriesCount }, { count: journalLinesCount }, { data: journalEntriesData }] = await Promise.all([
    supabase.from('invoice_payments').select('id', { count: 'exact', head: true }).eq('invoice_id', invoice.id),
    supabase.from('invoice_email_deliveries').select('id', { count: 'exact', head: true }).eq('invoice_id', invoice.id),
    supabase
      .from('journal_entry_lines')
      .select('id, journal_entries!inner(status)', { count: 'exact', head: true })
      .eq('entity_type', 'invoice')
      .eq('entity_id', invoice.id),
    supabase.from('journal_entries').select('id, status, source_type, source_id'),
  ]);

  const invoiceId = invoice.id;
  const relatedSourceIds = new Set<string>([invoiceId]);
  if (invoice.source_id) relatedSourceIds.add(invoice.source_id);
  if (invoice.pre_event_id) relatedSourceIds.add(invoice.pre_event_id);
  if (invoice.event_id) relatedSourceIds.add(invoice.event_id);
  if (invoice.quote_id) relatedSourceIds.add(invoice.quote_id);
  const journalEntries = (journalEntriesData ?? []).filter((entry) => relatedSourceIds.has(String(entry.source_id)));
  const postedJournalRefsCount = journalEntries.filter((entry) => entry.status === 'posted').length;

  let paymentLinksCount: number | null = null;
  if (invoice.pre_event_id) {
    const { count } = await supabase
      .from('payment_links')
      .select('id', { count: 'exact', head: true })
      .eq('source_record_type', 'pre_event')
      .eq('source_record_id', invoice.pre_event_id);
    paymentLinksCount = count ?? 0;
  }

  return {
    invoicePaymentsCount: invoicePaymentsCount ?? 0,
    invoiceEmailDeliveriesCount: invoiceEmailDeliveriesCount ?? 0,
    paymentLinksCount,
    journalEntriesCount: journalEntries.length,
    journalLinesCount: journalLinesCount ?? 0,
    postedJournalRefsCount,
  };
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
    source_type: 'quote',
    source_id: quote.id,
    manual_title: null,
    manual_description: null,
    manual_customer_name: null,
    manual_customer_email: null,
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

export async function createManualInvoiceAction(input: CreateManualInvoiceInput): Promise<InvoiceFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  if (!hasPermission(session.user, 'finance.invoices.manage')) {
    return { status: 'error', message: 'No tienes permisos para crear invoices manuales.' };
  }

  const validated = validateCreateManualInvoiceInput(input);
  if (!validated.ok) {
    return { status: 'error', message: validated.message };
  }

  const payload = validated.value;
  const linkedClient = payload.clientId
    ? await supabase.from('clients').select('id, full_name, email, phone').eq('id', payload.clientId).maybeSingle()
    : { data: null };

  if (payload.clientId && !linkedClient.data) {
    return { status: 'error', message: 'clientId no corresponde a un cliente existente.' };
  }

  const customerSnapshot = linkedClient.data
    ? {
        source: 'client',
        id: linkedClient.data.id,
        name: linkedClient.data.full_name,
        email: linkedClient.data.email,
        phone: linkedClient.data.phone,
        company: null,
      }
    : {
        source: 'manual',
        id: null,
        name: payload.manualCustomerName,
        email: payload.manualCustomerEmail,
        phone: null,
        company: null,
      };

  const eventSnapshot = {
    source: 'manual',
    pre_event: null,
    event: null,
  };

  const financialSnapshot = {
    source: 'manual',
    subtotal: payload.subtotal,
    discount_amount: payload.discountAmount,
    total_amount: payload.totalAmount,
    deposit_amount: payload.depositAmount,
    balance_due: payload.balanceDue,
  };

  let invoiceNumber = buildManualInvoiceNumber();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await supabase.from('invoices').insert({
      quote_id: null,
      source_type: 'manual',
      source_id: null,
      manual_title: payload.manualTitle,
      manual_description: payload.manualDescription,
      manual_customer_name: payload.manualCustomerName,
      manual_customer_email: payload.manualCustomerEmail,
      client_id: payload.clientId,
      pre_event_id: null,
      event_id: null,
      invoice_number: invoiceNumber,
      status: 'issued',
      currency: 'usd',
      subtotal: payload.subtotal,
      discount_amount: payload.discountAmount,
      total_amount: payload.totalAmount,
      deposit_amount: payload.depositAmount,
      balance_due: payload.balanceDue,
      issued_at: new Date().toISOString(),
      due_at: payload.dueAtIso,
      notes: payload.notes,
      internal_notes: null,
      customer_snapshot: customerSnapshot,
      event_snapshot: eventSnapshot,
      financial_snapshot: financialSnapshot,
      created_by: session.user.id,
      updated_by: session.user.id,
    });

    if (!error) {
      revalidatePath('/finanzas' as Route);
      return { status: 'success', message: `Invoice manual creado correctamente (${invoiceNumber}).` };
    }

    if (error.code === '23505' && attempt < 2) {
      invoiceNumber = buildManualInvoiceNumber();
      continue;
    }

    return { status: 'error', message: `No pudimos crear el invoice manual (${error.code ?? 'error-desconocido'}).` };
  }

  return { status: 'error', message: 'No pudimos generar un número de invoice único. Intenta nuevamente.' };
}

export async function recordManualInvoicePaymentAction(invoiceId: string, input: RecordManualInvoicePaymentInput): Promise<InvoiceFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const hasPaymentsManage = (session.user.permissions as string[]).includes('finance.payments.manage');
  if (!hasPermission(session.user, 'finance.invoices.manage') && !hasPaymentsManage) {
    return { status: 'error', message: 'No tienes permisos para registrar pagos de invoice.' };
  }

  const { data: invoice } = await supabase.from('invoices').select('id, invoice_number').eq('id', invoiceId).maybeSingle();
  if (!invoice) {
    return { status: 'error', message: 'No encontramos el invoice solicitado.' };
  }

  const validated = validateRecordManualInvoicePaymentInput(input);
  if (!validated.ok) {
    return { status: 'error', message: validated.message };
  }

  const prepared = validated.value;

  const { error } = await supabase.from('invoice_payments').insert({
    invoice_id: invoice.id,
    amount: prepared.amount,
    payment_date: prepared.paymentDate,
    payment_method: prepared.paymentMethod,
    provider: null,
    provider_payment_id: null,
    reference: prepared.reference,
    source_type: 'manual',
    status: 'succeeded',
    fee_amount: prepared.feeAmount,
    deposited_to_account_id: prepared.depositedToAccountId,
    notes: prepared.notes,
    created_by: session.user.id,
  });

  if (error) {
    return { status: 'error', message: `No pudimos registrar el pago (${error.code ?? 'error-desconocido'}).` };
  }

  // Intentional in Phase 9C:
  // invoice status/balance synchronization will be handled in a dedicated follow-up phase
  // after canonical payment semantics are fully integrated across reports and UI.
  revalidatePath('/finanzas' as Route);
  return { status: 'success', message: `Pago manual registrado para ${invoice.invoice_number}.` };
}

export async function updateManualInvoiceAction(invoiceId: string, input: CreateManualInvoiceInput): Promise<InvoiceFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  if (!hasPermission(session.user, 'finance.invoices.manage')) return { status: 'error', message: 'No tienes permisos para editar invoices manuales.' };

  const { data: invoice } = await supabase.from('invoices').select('id, source_type, status').eq('id', invoiceId).maybeSingle();
  if (!invoice || invoice.source_type !== 'manual') return { status: 'error', message: 'Solo puedes editar invoices manuales existentes.' };
  if (invoice.status !== 'draft') return { status: 'error', message: 'Solo puedes editar invoices manuales en estado draft.' };

  const validated = validateCreateManualInvoiceInput(input);
  if (!validated.ok) return { status: 'error', message: validated.message };

  const payload = validated.value;
  const { error } = await supabase
    .from('invoices')
    .update({
      client_id: payload.clientId,
      manual_title: payload.manualTitle,
      manual_description: payload.manualDescription,
      manual_customer_name: payload.manualCustomerName,
      manual_customer_email: payload.manualCustomerEmail,
      subtotal: payload.subtotal,
      discount_amount: payload.discountAmount,
      total_amount: payload.totalAmount,
      deposit_amount: payload.depositAmount,
      balance_due: payload.balanceDue,
      due_at: payload.dueAtIso,
      notes: payload.notes,
      updated_by: session.user.id,
    })
    .eq('id', invoiceId)
    .eq('source_type', 'manual')
    .eq('status', 'draft');

  if (error) return { status: 'error', message: `No pudimos actualizar el invoice manual (${error.code ?? 'error-desconocido'}).` };
  revalidatePath('/finanzas' as Route);
  return { status: 'success', message: 'Invoice manual actualizado correctamente.' };
}

export async function voidInvoiceAction(invoiceId: string, reason: string): Promise<InvoiceFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  if (!hasPermission(session.user, 'finance.invoices.manage')) return { status: 'error', message: 'No tienes permisos para anular invoices.' };

  const reasonValidation = validateVoidReason(reason);
  if (!reasonValidation.ok) return { status: 'error', message: reasonValidation.message };

  const { data: invoice } = await supabase.from('invoices').select('id, source_type, source_id, pre_event_id, event_id, quote_id, status').eq('id', invoiceId).maybeSingle();
  if (!invoice || invoice.source_type !== 'manual') return { status: 'error', message: 'Solo puedes anular invoices manuales existentes.' };
  if (invoice.status === 'void') return { status: 'success', message: 'El invoice ya se encuentra anulado.' };

  const dependencies = await loadManualInvoiceDependencies(invoice);
  if (!dependencies) return { status: 'error', message: 'No fue posible validar dependencias del invoice.' };
  const allowed = canVoidManualInvoice(dependencies);
  if (!allowed.ok) return { status: 'error', message: allowed.message };

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'void', void_reason: reasonValidation.value, voided_at: new Date().toISOString(), voided_by: session.user.id, updated_by: session.user.id })
    .eq('id', invoiceId);
  if (error) return { status: 'error', message: `No pudimos anular el invoice (${error.code ?? 'error-desconocido'}).` };
  revalidatePath('/finanzas/invoices' as Route);
  return { status: 'success', message: 'Invoice anulado correctamente.' };
}

export async function deleteDraftInvoiceAction(invoiceId: string): Promise<InvoiceFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  if (!hasPermission(session.user, 'finance.invoices.manage')) return { status: 'error', message: 'No tienes permisos para eliminar invoices draft.' };

  const { data: invoice } = await supabase.from('invoices').select('id, source_type, source_id, pre_event_id, event_id, quote_id, status').eq('id', invoiceId).maybeSingle();
  if (!invoice || invoice.source_type !== 'manual') return { status: 'error', message: 'Solo puedes eliminar invoices manuales existentes.' };
  if (invoice.status !== 'draft') return { status: 'error', message: 'Solo puedes eliminar invoices manuales en estado draft.' };

  const dependencies = await loadManualInvoiceDependencies(invoice);
  if (!dependencies) return { status: 'error', message: 'No fue posible validar dependencias del invoice.' };
  const allowed = canDeleteDraftManualInvoice(dependencies);
  if (!allowed.ok) return { status: 'error', message: allowed.message };

  const { error } = await supabase.from('invoices').delete().eq('id', invoiceId).eq('status', 'draft').eq('source_type', 'manual');
  if (error) return { status: 'error', message: `No pudimos eliminar el invoice (${error.code ?? 'error-desconocido'}).` };
  revalidatePath('/finanzas' as Route);
  return { status: 'success', message: 'Invoice draft eliminado correctamente.' };
}


async function logInvoiceEmailDeliveryAttempt(args: {
  invoiceId: string;
  purpose: 'invoice_delivery' | 'invoice_reminder';
  sentTo: string;
  subject: string;
  provider: string | null;
  providerMessageId: string | null;
  status: InvoiceEmailDeliveryStatus;
  errorMessage: string | null;
  sentBy: string;
  sentAt: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  await supabase.from('invoice_email_deliveries').insert({
    invoice_id: args.invoiceId,
    purpose: args.purpose,
    sent_to: args.sentTo,
    subject: args.subject,
    provider: args.provider,
    provider_message_id: args.providerMessageId,
    status: args.status,
    error_message: args.errorMessage,
    sent_by: args.sentBy,
    sent_at: args.sentAt,
  });
}

export async function sendInvoiceEmailAction(invoiceId: string, input?: SendInvoiceEmailInput): Promise<InvoiceFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  if (!hasPermission(session.user, 'finance.invoices.manage')) {
    return { status: 'error', message: 'No tienes permisos para enviar emails de invoice.' };
  }

  const purpose = resolveInvoiceEmailPurpose(input?.purpose);
  const detail = await getFinanceInvoiceById(invoiceId);
  if (!detail) {
    return { status: 'error', message: 'No encontramos el invoice solicitado.' };
  }

  const recipientResolution = resolveInvoiceEmailRecipient({
    recipientOverride: input?.recipientOverride,
    clientEmail: detail.client?.email ?? null,
    manualCustomerEmail: detail.invoice.manual_customer_email ?? null,
  });

  const defaultSubject = input?.subjectOverride?.trim() || `Invoice ${detail.invoice.invoice_number}`;

  if (!recipientResolution.recipient) {
    await logInvoiceEmailDeliveryAttempt({
      invoiceId: detail.invoice.id,
      purpose,
      sentTo: recipientResolution.source === 'missing' ? 'missing-recipient' : 'invalid-recipient',
      subject: defaultSubject,
      provider: null,
      providerMessageId: null,
      status: 'failed',
      errorMessage: recipientResolution.error ?? 'No hay destinatario válido para envío.',
      sentBy: session.user.id,
      sentAt: null,
    });

    revalidatePath('/finanzas' as Route);
    return { status: 'error', message: recipientResolution.error ?? 'No hay destinatario válido para envío.' };
  }

  const composed = await composeInvoicePurposeEmail({
    detail,
    purpose,
    subjectOverride: input?.subjectOverride,
  });

  try {
    const sent = await sendTransactionalEmail({
      to: recipientResolution.recipient,
      subject: composed.subject,
      html: composed.html,
      text: composed.text || undefined,
    });

    await logInvoiceEmailDeliveryAttempt({
      invoiceId: detail.invoice.id,
      purpose,
      sentTo: recipientResolution.recipient,
      subject: composed.subject,
      provider: sent.provider,
      providerMessageId: sent.providerMessageId,
      status: 'sent',
      errorMessage: null,
      sentBy: session.user.id,
      sentAt: new Date().toISOString(),
    });

    revalidatePath('/finanzas' as Route);
    return { status: 'success', message: `Invoice enviado correctamente a ${recipientResolution.recipient}.` };
  } catch (error) {
    const safeError = getSafeEmailErrorMessage(error);
    const fallbackProvider = (process.env.EMAIL_PROVIDER ?? 'resend').trim().toLowerCase() === 'smtp' ? 'smtp' : 'resend';

    await logInvoiceEmailDeliveryAttempt({
      invoiceId: detail.invoice.id,
      purpose,
      sentTo: recipientResolution.recipient,
      subject: composed.subject,
      provider: fallbackProvider,
      providerMessageId: null,
      status: 'failed',
      errorMessage: safeError,
      sentBy: session.user.id,
      sentAt: null,
    });

    revalidatePath('/finanzas' as Route);
    return { status: 'error', message: `Error al enviar email de invoice: ${safeError}` };
  }
}
