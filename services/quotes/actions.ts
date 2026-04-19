'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireActiveSession } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getClientByLeadId } from '@/services/clients/queries';
import { getLeadById } from '@/services/leads/queries';
import { getSafeEmailErrorMessage, sendTransactionalEmail } from '@/services/email/provider';
import { createCentralPaymentLink, getInternalPaymentsConfig, getInternalPaymentsErrorMessage } from '@/services/payments/internal-api';
import { getLatestPaymentLinkBySourceAndMode, getPaymentLinksBySource } from '@/services/payments/queries';
import type { PreEventPaymentLinkFormState } from '@/services/pre-events/payment-link-form-state';
import { getPreEventByQuoteId } from '@/services/pre-events/queries';
import { composeQuotePurposeEmail } from '@/services/quotes/email-composition';
import { buildPaymentLinkPayload, getQuotePaymentLinkPayloadSource, getResponsePaymentLinkData, validatePaymentLinkPayloadSource } from '@/services/pre-events/payment-links';
import { buildQuoteEmailDraft, validateQuoteEmailDraftRequirements } from '@/services/quotes/email-template';
import type { QuoteEmailFormState } from '@/services/quotes/email-form-state';
import type { QuoteFormState } from '@/services/quotes/form-state';
import type { QuoteManualDeliveryFormState } from '@/services/quotes/manual-delivery-form-state';
import { getQuoteCommercialPaymentMode } from '@/services/quotes/payment-mode';
import type { EmailTemplatePurpose } from '@/types/email-templates';
import type { PaymentMode } from '@/types/payments';
import type { QuoteDepositType, QuoteDiscountType, QuoteStatus } from '@/types/quotes';
import type { PostgrestError } from '@supabase/supabase-js';

function parseOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const normalized = parseOptionalString(value);
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalDateTime(value: FormDataEntryValue | null) {
  const normalized = parseOptionalString(value);
  if (!normalized) return null;

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function clampMoney(value: number) {
  return Math.round(Math.max(value, 0) * 100) / 100;
}

function normalizeDiscountType(value: FormDataEntryValue | null): QuoteDiscountType {
  return String(value ?? 'fixed') === 'percentage' ? 'percentage' : 'fixed';
}

function normalizeDepositType(value: FormDataEntryValue | null): QuoteDepositType {
  return String(value ?? 'fixed') === 'percentage' ? 'percentage' : 'fixed';
}

function sanitizeQuotePayload(formData: FormData, actorId: string) {
  const status = (parseOptionalString(formData.get('status')) ?? 'borrador') as QuoteStatus;
  const subtotal = parseOptionalNumber(formData.get('subtotal'));
  const discountType = normalizeDiscountType(formData.get('discount_type'));
  const discountValue = parseOptionalNumber(formData.get('discount_value')) ?? 0;
  const depositType = normalizeDepositType(formData.get('deposit_type'));
  const depositValue = parseOptionalNumber(formData.get('deposit_value')) ?? 0;

  if (subtotal === null || subtotal < 0) {
    return { error: 'El subtotal es obligatorio.' } as const;
  }

  if (discountValue < 0) {
    return { error: 'El valor de descuento no puede ser negativo.' } as const;
  }

  if (depositValue < 0) {
    return { error: 'El valor de depósito no puede ser negativo.' } as const;
  }

  const rawDiscountAmount = discountType === 'percentage' ? (subtotal * discountValue) / 100 : discountValue;
  const discountAmount = clampMoney(Math.min(rawDiscountAmount, subtotal));
  const totalAmount = clampMoney(subtotal - discountAmount);

  const rawExpectedDeposit = depositType === 'percentage' ? (totalAmount * depositValue) / 100 : depositValue;
  const expectedDeposit = clampMoney(Math.min(rawExpectedDeposit, totalAmount));
  const estimatedBalance = clampMoney(totalAmount - expectedDeposit);

  return {
    data: {
      status,
      subtotal: clampMoney(subtotal),
      discount_type: discountType,
      discount_value: discountValue,
      discount_amount: discountAmount,
      promotion_note: parseOptionalString(formData.get('promotion_note')),
      total_amount: totalAmount,
      deposit_type: depositType,
      deposit_value: depositValue,
      expected_deposit: expectedDeposit,
      estimated_balance: estimatedBalance,
      notes: parseOptionalString(formData.get('notes')),
      sent_at: parseOptionalDateTime(formData.get('sent_at')),
      updated_by: actorId,
    },
  } as const;
}

function isMissingQuoteMathColumnError(error: PostgrestError | null) {
  if (!error) return false;
  return error.code === '42703' || error.message.toLocaleLowerCase('es-MX').includes('column');
}

function toUserFriendlyQuoteCreateError(error: PostgrestError | null) {
  if (!error) return 'No pudimos crear la cotización. Intenta de nuevo.';

  if (error.code === '23503') {
    return 'No pudimos crear la cotización porque el lead asociado no existe o ya no está disponible.';
  }

  if (error.code === '42501') {
    return 'No tienes permisos suficientes para crear esta cotización.';
  }

  if (isMissingQuoteMathColumnError(error)) {
    return 'No pudimos crear la cotización porque la base de datos no está actualizada. Aplica las migraciones pendientes.';
  }

  return `No pudimos crear la cotización (${error.code ?? 'error-desconocido'}). Intenta de nuevo.`;
}

async function insertLeadActivity(leadId: string, actorId: string, summary: string, details: string | null) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    activity_type: 'actualizado',
    summary,
    details,
    created_by: actorId,
  });
}

async function ensureQuotePaymentLinkForEmail({
  quoteId,
  actorId,
  paymentMode,
  payloadSource,
}: {
  quoteId: string;
  actorId: string;
  paymentMode: PaymentMode;
  payloadSource: ReturnType<typeof getQuotePaymentLinkPayloadSource>;
}) {
  const existingLink = await getLatestPaymentLinkBySourceAndMode('quote', quoteId, paymentMode);
  if (existingLink?.external_url) {
    return { link: existingLink, status: 'existing' as const };
  }

  const { source, system, timezone } = await getInternalPaymentsConfig();
  const payload = buildPaymentLinkPayload({
    mode: paymentMode,
    source,
    system,
    timezone,
    payloadSource,
  });

  const response = await createCentralPaymentLink(payload);
  const { externalId, externalUrl } = getResponsePaymentLinkData(response);
  if (!externalUrl) {
    throw new Error('La API central respondió sin URL de pago. Revisa el contrato de respuesta del endpoint /api/internal/payment-link.');
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error('No fue posible abrir la conexión con Supabase para guardar el payment link.');
  }

  const { data: inserted, error } = await supabase
    .from('payment_links')
    .insert({
      source_record_type: 'quote',
      source_record_id: quoteId,
      payment_mode: paymentMode,
      currency: 'usd',
      total_event_amount: payload.metadata.totalEventAmount,
      amount_to_charge: payload.metadata.amountToCharge,
      balance_due: payload.metadata.balanceDue,
      external_provider: 'stripe_api',
      external_payment_link_id: externalId,
      external_url: externalUrl,
      request_payload: payload,
      response_payload: response,
      created_by: actorId,
    })
    .select('*')
    .single();

  if (error || !inserted) {
    throw new Error('Se creó el link en API central, pero no pudimos guardarlo internamente.');
  }

  return { link: inserted, status: 'auto_generated' as const };
}

async function syncLeadQuotedTotal(leadId: string, actorId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const { data } = await supabase
    .from('quotes')
    .select('total_amount, status, updated_at')
    .eq('lead_id', leadId)
    .order('updated_at', { ascending: false });

  const quotes = data ?? [];
  const preferredQuote =
    quotes.find((quote) => ['borrador', 'enviada', 'aceptada', 'vencida'].includes(String(quote.status))) ?? quotes[0] ?? null;

  await supabase
    .from('leads')
    .update({
      quoted_total: preferredQuote?.total_amount ?? null,
      updated_by: actorId,
      last_interaction_at: new Date().toISOString(),
    })
    .eq('id', leadId);
}

async function updateLeadCommercialState(leadId: string, actorId: string, nextStatus: 'ganado' | 'seguimiento') {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  await supabase
    .from('leads')
    .update({
      status: nextStatus,
      updated_by: actorId,
      last_interaction_at: new Date().toISOString(),
    })
    .eq('id', leadId);
}

export async function createQuoteAction(leadId: string, _previousState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const payload = sanitizeQuotePayload(formData, session.user.id);
  if ('error' in payload) {
    return { status: 'error', message: payload.error };
  }

  const primaryInsert = await supabase
    .from('quotes')
    .insert({
      lead_id: leadId,
      ...payload.data,
      created_by: session.user.id,
    })
    .select('id, total_amount, status')
    .single();

  let data = primaryInsert.data;
  let error = primaryInsert.error;

  if (!data && isMissingQuoteMathColumnError(error)) {
    const legacyPayload = {
      status: payload.data.status,
      subtotal: payload.data.subtotal,
      discount_amount: payload.data.discount_amount,
      promotion_note: payload.data.promotion_note,
      total_amount: payload.data.total_amount,
      expected_deposit: payload.data.expected_deposit,
      estimated_balance: payload.data.estimated_balance,
      notes: payload.data.notes,
      sent_at: payload.data.sent_at,
      updated_by: payload.data.updated_by,
    };

    const legacyInsert = await supabase
      .from('quotes')
      .insert({
        lead_id: leadId,
        ...legacyPayload,
        created_by: session.user.id,
      })
      .select('id, total_amount, status')
      .single();

    data = legacyInsert.data;
    error = legacyInsert.error;
  }

  if (error || !data) {
    return { status: 'error', message: toUserFriendlyQuoteCreateError(error) };
  }

  await syncLeadQuotedTotal(leadId, session.user.id);
  await insertLeadActivity(
    leadId,
    session.user.id,
    'Cotización creada',
    `Estado: ${data.status} · Total: $${Number(data.total_amount).toFixed(2)}`,
  );

  revalidatePath(`/leads/${leadId}` as Route);
  revalidatePath('/cotizaciones');
  redirect(`/cotizaciones/${data.id}` as Route);
}

export async function updateQuoteAction(quoteId: string, leadId: string, _previousState: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const payload = sanitizeQuotePayload(formData, session.user.id);
  if ('error' in payload) {
    return { status: 'error', message: payload.error };
  }

  const { error } = await supabase.from('quotes').update(payload.data).eq('id', quoteId);

  if (error) {
    return { status: 'error', message: 'No pudimos guardar los cambios de la cotización.' };
  }

  await syncLeadQuotedTotal(leadId, session.user.id);
  await insertLeadActivity(
    leadId,
    session.user.id,
    'Cotización actualizada',
    `Estado: ${payload.data.status} · Total: $${Number(payload.data.total_amount).toFixed(2)}`,
  );

  revalidatePath(`/leads/${leadId}` as Route);
  revalidatePath(`/cotizaciones/${quoteId}` as Route);
  revalidatePath('/cotizaciones');
  redirect(`/cotizaciones/${quoteId}` as Route);
}

export async function acceptQuoteAction(quoteId: string, leadId: string) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return;
  }

  await supabase
    .from('quotes')
    .update({
      status: 'aceptada',
      updated_by: session.user.id,
    })
    .eq('id', quoteId);

  await updateLeadCommercialState(leadId, session.user.id, 'ganado');
  await syncLeadQuotedTotal(leadId, session.user.id);
  await insertLeadActivity(leadId, session.user.id, 'Cotización aceptada', 'La propuesta comercial fue marcada como aceptada y el lead avanzó a ganado.');

  revalidatePath(`/leads/${leadId}` as Route);
  revalidatePath(`/cotizaciones/${quoteId}` as Route);
  revalidatePath('/cotizaciones');
}

export async function rejectQuoteAction(quoteId: string, leadId: string) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return;
  }

  await supabase
    .from('quotes')
    .update({
      status: 'rechazada',
      updated_by: session.user.id,
    })
    .eq('id', quoteId);

  await updateLeadCommercialState(leadId, session.user.id, 'seguimiento');
  await syncLeadQuotedTotal(leadId, session.user.id);
  await insertLeadActivity(leadId, session.user.id, 'Cotización rechazada', 'La propuesta fue rechazada y el lead quedó abierto en seguimiento para una posible nueva oferta.');

  revalidatePath(`/leads/${leadId}` as Route);
  revalidatePath(`/cotizaciones/${quoteId}` as Route);
  revalidatePath('/cotizaciones');
}

export async function createQuotePaymentLinkAction(
  quoteId: string,
  _previousState: PreEventPaymentLinkFormState,
  formData: FormData,
): Promise<PreEventPaymentLinkFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle();
  if (!quote) {
    return { status: 'error', message: 'No encontramos la cotización solicitada.' };
  }

  const [lead, client, preEvent] = await Promise.all([
    getLeadById(quote.lead_id),
    getClientByLeadId(quote.lead_id),
    getPreEventByQuoteId(quote.id),
  ]);
  if (!lead) {
    return { status: 'error', message: 'No encontramos el lead asociado a la cotización.' };
  }

  const selectedMode = String(formData.get('payment_mode') ?? 'deposit');
  const paymentMode: PaymentMode = selectedMode === 'full' ? 'full' : 'deposit';
  const existingLink = await getLatestPaymentLinkBySourceAndMode('quote', quote.id, paymentMode);
  if (existingLink?.external_url) {
    return {
      status: 'success',
      message: `Ya existe un payment link (${paymentMode === 'deposit' ? 'depósito' : 'pago completo'}) para esta cotización. Reutiliza el link existente.`,
    };
  }
  const payloadSource = getQuotePaymentLinkPayloadSource({
    quote,
    lead,
    client,
    preEvent,
  });
  const missing = validatePaymentLinkPayloadSource(payloadSource);
  if (missing.length > 0) {
    return {
      status: 'error',
      message: `No se puede generar el payment link. Falta corregir: ${missing.join(', ')}.`,
    };
  }

  try {
    const { source, system, timezone } = await getInternalPaymentsConfig();
    const payload = buildPaymentLinkPayload({
      mode: paymentMode,
      source,
      system,
      timezone,
      payloadSource,
    });

    const response = await createCentralPaymentLink(payload);
    const { externalId, externalUrl } = getResponsePaymentLinkData(response);
    if (!externalUrl) {
      return {
        status: 'error',
        message: 'La API central respondió sin URL de pago. Revisa el contrato de respuesta del endpoint /api/internal/payment-link.',
      };
    }

    const { error } = await supabase.from('payment_links').insert({
      source_record_type: 'quote',
      source_record_id: quote.id,
      payment_mode: paymentMode,
      currency: 'usd',
      total_event_amount: payload.metadata.totalEventAmount,
      amount_to_charge: payload.metadata.amountToCharge,
      balance_due: payload.metadata.balanceDue,
      external_provider: 'stripe_api',
      external_payment_link_id: externalId,
      external_url: externalUrl,
      request_payload: payload,
      response_payload: response,
      created_by: session.user.id,
    });

    if (error) {
      return { status: 'error', message: 'Se creó el link en API central, pero no pudimos guardarlo internamente.' };
    }

    revalidatePath(`/cotizaciones/${quote.id}` as Route);
    revalidatePath('/cotizaciones' as Route);
    if (preEvent) {
      revalidatePath(`/reservas/${preEvent.id}` as Route);
    }

    return { status: 'success', message: 'Payment link creado y guardado correctamente.' };
  } catch (error) {
    const message = getInternalPaymentsErrorMessage(error);
    return { status: 'error', message };
  }
}

async function sendQuoteEmailByPurposeAction(quoteId: string, purpose: EmailTemplatePurpose): Promise<QuoteEmailFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle();
  if (!quote) {
    return { status: 'error', message: 'No encontramos la cotización solicitada.' };
  }

  const [lead, client, preEvent, paymentLinks] = await Promise.all([
    getLeadById(quote.lead_id),
    getClientByLeadId(quote.lead_id),
    getPreEventByQuoteId(quote.id),
    getPaymentLinksBySource('quote', quote.id),
  ]);

  if (!lead) {
    return { status: 'error', message: 'No encontramos el lead asociado a la cotización.' };
  }

  const payloadSource = getQuotePaymentLinkPayloadSource({
    quote,
    lead,
    client,
    preEvent,
  });
  const commercialPaymentMode = getQuoteCommercialPaymentMode(quote);
  const paymentDataMissing = validatePaymentLinkPayloadSource(payloadSource);

  let paymentLinkForEmail =
    paymentLinks.find((item) => item.payment_mode === commercialPaymentMode.mode) ??
    null;
  let paymentLinkStatus: 'existing' | 'auto_generated' | 'missing' = paymentLinkForEmail ? 'existing' : 'missing';
  if (!paymentLinkForEmail && paymentDataMissing.length === 0) {
    try {
      const ensured = await ensureQuotePaymentLinkForEmail({
        quoteId: quote.id,
        actorId: session.user.id,
        paymentMode: commercialPaymentMode.mode,
        payloadSource,
      });
      paymentLinkForEmail = ensured.link;
      paymentLinkStatus = ensured.status;
    } catch {
      paymentLinkStatus = 'missing';
    }
  }

  const draft = await buildQuoteEmailDraft({
    quote,
    lead,
    client,
    preEvent,
    paymentLink: paymentLinkForEmail,
    paymentLinkStatus,
    isAutoGeneratedLink: paymentLinkStatus === 'auto_generated',
  });
  const missing = validateQuoteEmailDraftRequirements(draft);
  if (missing.length > 0) {
    return {
      status: 'error',
      message: `No se puede enviar el email. Falta corregir: ${missing.join(', ')}.`,
    };
  }

  const composedEmail = await composeQuotePurposeEmail({
    quote,
    lead,
    client,
    preEvent,
    paymentLink: paymentLinkForEmail,
    paymentLinkStatus,
    isAutoGeneratedLink: paymentLinkStatus === 'auto_generated',
    purpose,
  });

  const effectiveSubject = composedEmail.subject;
  const effectiveHtml = composedEmail.html;
  const effectiveText = composedEmail.text;

  try {
    const sent = await sendTransactionalEmail({
      to: draft.toEmail,
      subject: effectiveSubject,
      html: effectiveHtml,
      text: effectiveText,
    });

    await supabase.from('quote_email_deliveries').insert({
      quote_id: quote.id,
      to_email: draft.toEmail,
      subject: effectiveSubject,
      body_preview: `[${purpose}][${draft.paymentRequest.modeLabel}][${composedEmail.communicationLanguage.language}] ${draft.bodyPreview}`,
      payment_link_id: paymentLinkForEmail?.id ?? null,
      status: 'sent',
      error_message: null,
      provider: sent.provider,
      provider_message_id: sent.providerMessageId,
      sent_by: session.user.id,
      sent_at: new Date().toISOString(),
    });

    revalidatePath(`/cotizaciones/${quote.id}` as Route);
    return {
      status: 'success',
      message: composedEmail.operatorMessage
        ? `Cotización enviada correctamente a ${draft.toEmail}. Nota: ${composedEmail.operatorMessage}`
        : `Cotización enviada correctamente a ${draft.toEmail}.`,
    };
  } catch (error) {
    const message = getSafeEmailErrorMessage(error);
    const fallbackProvider = (process.env.EMAIL_PROVIDER ?? 'resend').trim().toLowerCase() === 'smtp' ? 'smtp' : 'resend';
    await supabase.from('quote_email_deliveries').insert({
      quote_id: quote.id,
      to_email: draft.toEmail,
      subject: effectiveSubject,
      body_preview: `[${purpose}][${draft.paymentRequest.modeLabel}][${composedEmail.communicationLanguage.language}] ${draft.bodyPreview}`,
      payment_link_id: paymentLinkForEmail?.id ?? null,
      status: 'failed',
      error_message: message,
      provider: fallbackProvider,
      provider_message_id: null,
      sent_by: session.user.id,
      sent_at: null,
    });

    revalidatePath(`/cotizaciones/${quote.id}` as Route);
    return { status: 'error', message: `Error al enviar email: ${message}` };
  }
}

export async function sendQuoteEmailAction(
  quoteId: string,
  _previousState: QuoteEmailFormState,
  _formData: FormData,
): Promise<QuoteEmailFormState> {
  return sendQuoteEmailByPurposeAction(quoteId, 'quote_delivery');
}

export async function sendQuoteFollowupEmailAction(
  quoteId: string,
  _previousState: QuoteEmailFormState,
  _formData: FormData,
): Promise<QuoteEmailFormState> {
  return sendQuoteEmailByPurposeAction(quoteId, 'quote_followup');
}

export async function sendQuotePaymentReminderEmailAction(
  quoteId: string,
  _previousState: QuoteEmailFormState,
  _formData: FormData,
): Promise<QuoteEmailFormState> {
  return sendQuoteEmailByPurposeAction(quoteId, 'payment_reminder');
}

export async function registerQuoteManualDeliveryAction(
  quoteId: string,
  _previousState: QuoteManualDeliveryFormState,
  formData: FormData,
): Promise<QuoteManualDeliveryFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle();
  if (!quote) {
    return { status: 'error', message: 'No encontramos la cotización solicitada.' };
  }

  const channelRaw = String(formData.get('channel') ?? 'manual_link');
  const channel = channelRaw === 'whatsapp' || channelRaw === 'sms' ? channelRaw : 'manual_link';
  const paymentMode = String(formData.get('payment_mode') ?? '') === 'full' ? 'full' : 'deposit';
  const linkUrl = String(formData.get('link_url') ?? '').trim();
  const paymentLinkIdRaw = String(formData.get('payment_link_id') ?? '').trim();
  const amountRaw = String(formData.get('amount_to_charge') ?? '').trim();
  const amountToCharge = amountRaw.length > 0 && Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : null;

  if (!linkUrl) {
    return { status: 'error', message: 'No se pudo registrar el canal manual porque falta el link compartido.' };
  }

  if (paymentLinkIdRaw) {
    const { data: link } = await supabase
      .from('payment_links')
      .select('id, source_record_id, source_record_type, payment_mode')
      .eq('id', paymentLinkIdRaw)
      .maybeSingle();

    if (!link || link.source_record_type !== 'quote' || link.source_record_id !== quoteId) {
      return { status: 'error', message: 'El payment link seleccionado no corresponde a esta cotización.' };
    }

    if (link.payment_mode !== paymentMode) {
      return { status: 'error', message: 'El payment mode compartido no coincide con el payment link seleccionado.' };
    }
  }

  const { error } = await supabase.from('quote_manual_deliveries').insert({
    quote_id: quoteId,
    channel,
    payment_mode: paymentMode,
    payment_link_id: paymentLinkIdRaw || null,
    link_url: linkUrl,
    amount_to_charge: amountToCharge,
    executed_by: session.user.id,
  });

  if (error) {
    return { status: 'error', message: 'No fue posible registrar la trazabilidad del canal manual.' };
  }

  revalidatePath(`/cotizaciones/${quoteId}` as Route);
  return { status: 'success', message: `Canal manual registrado (${channel.toUpperCase()}) con ${paymentMode === 'full' ? 'pago completo' : 'depósito'}.` };
}
