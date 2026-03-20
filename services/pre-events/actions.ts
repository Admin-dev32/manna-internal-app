'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireActiveSession } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { PreEventFormState } from '@/services/pre-events/form-state';
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
