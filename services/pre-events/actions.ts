'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireActiveSession } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createCentralPaymentLink, getInternalPaymentsConfig } from '@/services/payments/internal-api';
import { getClientById } from '@/services/clients/queries';
import { buildPreEventCalendarPayload, validatePreEventCalendarRequirements } from '@/services/pre-events/calendar';
import type { PreEventCalendarSyncFormState } from '@/services/pre-events/calendar-form-state';
import { getLatestPaymentLinkBySourceAndMode } from '@/services/payments/queries';
import { getQuoteById } from '@/services/quotes/queries';
import { getPreEventById } from '@/services/pre-events/queries';
import type { PreEventFormState } from '@/services/pre-events/form-state';
import type { PreEventPaymentLinkFormState } from '@/services/pre-events/payment-link-form-state';
import { buildPaymentLinkPayload, getPreEventPaymentLinkPayloadSource, getResponsePaymentLinkData, validatePaymentLinkPayloadSource } from '@/services/pre-events/payment-links';
import {
  createGoogleCalendarFingerprint,
  findGoogleCalendarEventByFingerprint,
  findGoogleCalendarEventByHeuristic,
  upsertGoogleCalendarEvent,
} from '@/services/google-calendar/client';
import { getEventByPreEventId } from '@/services/events/queries';
import type { PaymentMode } from '@/types/payments';
import type { PreEventStatus } from '@/types/pre-events';

function parseOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function parseOptionalInteger(value: FormDataEntryValue | null) {
  const normalized = parseOptionalString(value);
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function sanitizePreEventPayload(formData: FormData, actorId: string) {
  return {
    data: {
      confirmed_date: parseOptionalString(formData.get('confirmed_date')),
      confirmed_time: parseOptionalString(formData.get('confirmed_time')),
      location: parseOptionalString(formData.get('location')),
      event_type: parseOptionalString(formData.get('event_type')),
      booked_service: parseOptionalString(formData.get('booked_service')),
      confirmed_guests: parseOptionalInteger(formData.get('confirmed_guests')),
      initial_operations_notes: parseOptionalString(formData.get('initial_operations_notes')),
      status: (parseOptionalString(formData.get('status')) ?? 'pendiente') as PreEventStatus,
      updated_by: actorId,
    },
  } as const;
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

export async function createPreEventAction(
  clientId: string,
  leadId: string | null,
  quoteId: string,
  _previousState: PreEventFormState,
  formData: FormData,
): Promise<PreEventFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const payload = sanitizePreEventPayload(formData, session.user.id);
  const { data, error } = await supabase
    .from('pre_events')
    .insert({
      client_id: clientId,
      lead_id: leadId,
      source_quote_id: quoteId,
      ...payload.data,
      created_by: session.user.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { status: 'error', message: 'No pudimos crear la reserva operativa inicial.' };
  }

  if (leadId) {
    await insertLeadActivity(leadId, session.user.id, 'Pre-evento creado', 'Se generó una reserva operativa inicial a partir de la venta cerrada.');
  }

  revalidatePath(`/clientes/${clientId}` as Route);
  revalidatePath(`/cotizaciones/${quoteId}` as Route);
  redirect(`/reservas/${data.id}` as Route);
}

export async function updatePreEventAction(preEventId: string, leadId: string | null, clientId: string, quoteId: string, _previousState: PreEventFormState, formData: FormData): Promise<PreEventFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const payload = sanitizePreEventPayload(formData, session.user.id);
  const { error } = await supabase.from('pre_events').update(payload.data).eq('id', preEventId);

  if (error) {
    return { status: 'error', message: 'No pudimos guardar los cambios del pre-evento.' };
  }

  if (leadId) {
    await insertLeadActivity(leadId, session.user.id, 'Pre-evento actualizado', `Estado actual: ${payload.data.status}.`);
  }

  revalidatePath(`/clientes/${clientId}` as Route);
  revalidatePath(`/cotizaciones/${quoteId}` as Route);
  revalidatePath(`/reservas/${preEventId}` as Route);
  redirect(`/reservas/${preEventId}` as Route);
}

export async function quickUpdatePreEventAction(
  preEventId: string,
  leadId: string | null,
  clientId: string,
  quoteId: string,
  _previousState: PreEventFormState,
  formData: FormData,
): Promise<PreEventFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const data: Record<string, string | number | null> = {
    updated_by: session.user.id,
  };

  if (formData.has('status')) {
    data.status = (parseOptionalString(formData.get('status')) ?? 'pendiente') as PreEventStatus;
  }
  if (formData.has('confirmed_date')) {
    data.confirmed_date = parseOptionalString(formData.get('confirmed_date'));
  }
  if (formData.has('confirmed_time')) {
    data.confirmed_time = parseOptionalString(formData.get('confirmed_time'));
  }
  if (formData.has('location')) {
    data.location = parseOptionalString(formData.get('location'));
  }
  if (formData.has('confirmed_guests')) {
    data.confirmed_guests = parseOptionalInteger(formData.get('confirmed_guests'));
  }

  const { error } = await supabase.from('pre_events').update(data).eq('id', preEventId);

  if (error) {
    return { status: 'error', message: 'No pudimos guardar la actualización rápida.' };
  }

  if (leadId) {
    await insertLeadActivity(leadId, session.user.id, 'Pre-evento actualizado rápidamente', `Estado: ${String(data.status ?? 'sin cambio')}.`);
  }

  revalidatePath('/reservas' as Route);
  revalidatePath(`/reservas/${preEventId}` as Route);
  revalidatePath(`/clientes/${clientId}` as Route);
  revalidatePath(`/cotizaciones/${quoteId}` as Route);

  return { status: 'success', message: 'Reserva actualizada.' };
}

export async function createPreEventPaymentLinkAction(
  preEventId: string,
  _previousState: PreEventPaymentLinkFormState,
  formData: FormData,
): Promise<PreEventPaymentLinkFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const selectedMode = String(formData.get('payment_mode') ?? 'deposit');
  const paymentMode: PaymentMode = selectedMode === 'full' ? 'full' : 'deposit';
  const existingLink = await getLatestPaymentLinkBySourceAndMode('pre_event', preEventId, paymentMode);
  if (existingLink?.external_url) {
    return {
      status: 'success',
      message: `Ya existe un payment link (${paymentMode === 'deposit' ? 'depósito' : 'pago completo'}) para esta reserva. Reutiliza el link ya generado.`,
    };
  }

  const preEvent = await getPreEventById(preEventId);
  if (!preEvent) {
    return { status: 'error', message: 'No encontramos la reserva solicitada.' };
  }

  const [client, quote] = await Promise.all([getClientById(preEvent.client_id), getQuoteById(preEvent.source_quote_id)]);
  if (!client || !quote) {
    return { status: 'error', message: 'No se pudo cargar el cliente o la cotización origen para generar el cobro.' };
  }

  const payloadSource = getPreEventPaymentLinkPayloadSource(preEvent, client, quote);
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
      source_record_type: 'pre_event',
      source_record_id: preEvent.id,
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

    revalidatePath(`/reservas/${preEvent.id}` as Route);
    revalidatePath('/reservas' as Route);

    return { status: 'success', message: 'Payment link creado y guardado correctamente.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No fue posible crear el payment link con la API central.';
    return { status: 'error', message };
  }
}

export async function syncPreEventToGoogleCalendarAction(
  preEventId: string,
  _previousState: PreEventCalendarSyncFormState,
  _formData: FormData,
): Promise<PreEventCalendarSyncFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const preEvent = await getPreEventById(preEventId);
  if (!preEvent) {
    return { status: 'error', message: 'No encontramos la reserva solicitada.' };
  }

  const [client, existingSync] = await Promise.all([
    getClientById(preEvent.client_id),
    supabase
      .from('event_calendar_syncs')
      .select('*')
      .eq('source_record_type', 'pre_event')
      .eq('source_record_id', preEvent.id)
      .neq('sync_status', 'stale')
      .maybeSingle(),
  ]);

  if (!client) {
    return { status: 'error', message: 'No encontramos el cliente asociado a la reserva.' };
  }

  const missing = validatePreEventCalendarRequirements(preEvent, client);
  if (missing.length > 0) {
    return {
      status: 'error',
      message: `No se puede sincronizar en Google Calendar. Falta: ${missing.join(', ')}.`,
    };
  }

  const existingSyncData = existingSync.data as { external_event_id?: string | null; external_event_url?: string | null } | null;

  try {
    const payload = buildPreEventCalendarPayload(preEvent, client);
    const linkedEvent = await getEventByPreEventId(preEvent.id);
    const linkedEventSync = linkedEvent
      ? await supabase
          .from('event_calendar_syncs')
          .select('*')
          .eq('source_record_type', 'event')
          .eq('source_record_id', linkedEvent.id)
          .neq('sync_status', 'stale')
          .maybeSingle()
      : { data: null };

    if (linkedEvent || linkedEventSync.data?.external_event_id) {
      return {
        status: 'error',
        message: 'Esta reserva ya tiene un Event asociado. El ownership final de Google Calendar debe operarse desde Evento.',
      };
    }

    const fingerprint = createGoogleCalendarFingerprint('pre_event', preEvent.id);
    let externalEventId = existingSyncData?.external_event_id ?? null;
    let externalEventUrl = existingSyncData?.external_event_url ?? null;
    let syncOrigin: 'direct' | 'reconciled' | 'inherited' = 'direct';
    let ownershipNote: string | null = null;

    if (!externalEventId) {
      const fingerprintMatch = await findGoogleCalendarEventByFingerprint(fingerprint);
      if (fingerprintMatch?.externalEventId) {
        externalEventId = fingerprintMatch.externalEventId;
        externalEventUrl = fingerprintMatch.externalEventUrl;
        syncOrigin = 'reconciled';
        ownershipNote = 'Reconciliado por huella fuerte de Reserva.';
      }
    }

    if (!externalEventId) {
      const heuristicMatch = await findGoogleCalendarEventByHeuristic(payload);
      if (heuristicMatch?.externalEventId) {
        externalEventId = heuristicMatch.externalEventId;
        externalEventUrl = heuristicMatch.externalEventUrl;
        syncOrigin = 'reconciled';
        ownershipNote = 'Reconciliado por heurística conservadora.';
      }
    }

    const calendarEvent = await upsertGoogleCalendarEvent(payload, fingerprint, externalEventId);

    const { error } = await supabase.from('event_calendar_syncs').upsert(
      {
        source_record_type: 'pre_event',
        source_record_id: preEvent.id,
        provider: 'google_calendar',
        external_event_id: calendarEvent.externalEventId,
        external_event_url: calendarEvent.externalEventUrl ?? externalEventUrl,
        sync_status: syncOrigin === 'direct' ? 'synced' : 'reconciled',
        sync_origin: syncOrigin,
        ownership_note: ownershipNote,
        superseded_by_source_record_type: null,
        superseded_by_source_record_id: null,
        last_error: null,
        synced_by: session.user.id,
        synced_at: new Date().toISOString(),
      },
      {
        onConflict: 'source_record_type,source_record_id',
      },
    );

    if (error) {
      return { status: 'error', message: 'Se sincronizó en Google Calendar, pero no pudimos guardar la trazabilidad interna.' };
    }

    revalidatePath(`/reservas/${preEvent.id}` as Route);
    revalidatePath('/reservas' as Route);
    return {
      status: 'success',
      message:
        syncOrigin === 'reconciled'
          ? 'Reserva reconciliada y actualizada en Google Calendar.'
          : 'Reserva sincronizada correctamente con Google Calendar.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No pudimos sincronizar la reserva con Google Calendar.';
    await supabase.from('event_calendar_syncs').upsert(
      {
        source_record_type: 'pre_event',
        source_record_id: preEvent.id,
        provider: 'google_calendar',
        sync_status: 'error',
        sync_origin: (existingSync.data as { sync_origin?: 'direct' | 'reconciled' | 'inherited' } | null)?.sync_origin ?? 'direct',
        ownership_note: (existingSync.data as { ownership_note?: string | null } | null)?.ownership_note ?? null,
        last_error: message,
        synced_by: session.user.id,
        synced_at: new Date().toISOString(),
      },
      {
        onConflict: 'source_record_type,source_record_id',
      },
    );

    revalidatePath(`/reservas/${preEvent.id}` as Route);
    return { status: 'error', message };
  }
}
