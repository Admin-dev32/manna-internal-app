'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { EVENT_STATUS_LABELS, EVENT_STATUS_TRANSITIONS } from '@/config/events';
import { getPreEventReadyState } from '@/lib/events/readiness';
import { requireActiveSession } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getEventById, getEventByPreEventId } from '@/services/events/queries';
import { getPreEventById } from '@/services/pre-events/queries';
import type { EventChecklistItemRecord, EventStatus } from '@/types/events';

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

async function revalidateEventPaths(eventId: string) {
  revalidatePath('/eventos' as Route);
  revalidatePath(`/eventos/${eventId}` as Route);
}

export async function createEventFromPreEventAction(preEventId: string) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return;
  }

  const preEvent = await getPreEventById(preEventId);
  if (!preEvent) {
    redirect('/reservas' as Route);
    return;
  }
  const targetPreEvent = preEvent;

  const existingEvent = await getEventByPreEventId(targetPreEvent.id);
  if (existingEvent) {
    redirect(`/eventos/${existingEvent.id}` as Route);
  }

  const readyState = getPreEventReadyState(targetPreEvent);
  if (!readyState.isReady) {
    redirect(`/reservas/${targetPreEvent.id}` as Route);
    return;
  }

  const eventDate = targetPreEvent.confirmed_date;
  const eventTime = targetPreEvent.confirmed_time;
  const bookedService = targetPreEvent.booked_service;

  if (!eventDate || !eventTime || !bookedService) {
    redirect(`/reservas/${targetPreEvent.id}` as Route);
    return;
  }

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      client_id: targetPreEvent.client_id,
      lead_id: targetPreEvent.lead_id,
      source_quote_id: targetPreEvent.source_quote_id,
      source_pre_event_id: targetPreEvent.id,
      event_date: eventDate,
      event_time: eventTime,
      location: targetPreEvent.location,
      event_type: targetPreEvent.event_type,
      booked_service: bookedService,
      guest_count: targetPreEvent.confirmed_guests,
      operational_notes: targetPreEvent.initial_operations_notes,
      status: 'pendiente',
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select('id')
    .single();

  if (error || !event) {
    redirect(`/reservas/${targetPreEvent.id}` as Route);
    return;
  }

  if (targetPreEvent.lead_id) {
    await insertLeadActivity(
      targetPreEvent.lead_id,
      session.user.id,
      'Reserva convertida a evento',
      `La reserva operativa se convirtió en evento real #${event.id.slice(0, 8)}.`,
    );
    await insertLeadActivity(
      targetPreEvent.lead_id,
      session.user.id,
      'Evento creado',
      `Se creó un evento real a partir de la reserva #${targetPreEvent.id.slice(0, 8)}.`,
    );
  }

  revalidatePath(`/reservas/${targetPreEvent.id}` as Route);
  revalidatePath(`/cotizaciones/${targetPreEvent.source_quote_id}` as Route);
  await revalidateEventPaths(event.id);

  redirect(`/eventos/${event.id}` as Route);
}

export async function updateEventStatusAction(eventId: string, nextStatus: EventStatus) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return;
  }

  const event = await getEventById(eventId);
  if (!event) {
    return;
  }

  const allowedTransitions = EVENT_STATUS_TRANSITIONS[event.status];
  if (!allowedTransitions.includes(nextStatus)) {
    return;
  }

  await supabase
    .from('events')
    .update({
      status: nextStatus,
      updated_by: session.user.id,
    })
    .eq('id', eventId);

  if (event.lead_id) {
    await insertLeadActivity(
      event.lead_id,
      session.user.id,
      'Estado operativo del evento actualizado',
      `El evento #${event.id.slice(0, 8)} pasó de ${EVENT_STATUS_LABELS[event.status]} a ${EVENT_STATUS_LABELS[nextStatus]}.`,
    );
  }

  await revalidateEventPaths(eventId);
}

export async function updateEventOperationalNotesAction(eventId: string, formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return;
  }

  const notes = String(formData.get('operational_notes') ?? '').trim();
  const event = await getEventById(eventId);
  if (!event) {
    return;
  }

  await supabase
    .from('events')
    .update({
      operational_notes: notes || null,
      updated_by: session.user.id,
    })
    .eq('id', eventId);

  if (event.lead_id) {
    await insertLeadActivity(
      event.lead_id,
      session.user.id,
      'Notas operativas del evento actualizadas',
      notes ? `Se actualizaron notas operativas del evento #${event.id.slice(0, 8)}.` : `Se limpiaron notas operativas del evento #${event.id.slice(0, 8)}.`,
    );
  }

  await revalidateEventPaths(eventId);
}

export async function toggleEventChecklistItemAction(eventId: string, checklistItemId: string, nextCompleted: boolean) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return;
  }

  const event = await getEventById(eventId);
  if (!event) {
    return;
  }

  const { data: checklistItem } = await supabase
    .from('event_checklist_items')
    .select('*')
    .eq('id', checklistItemId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (!checklistItem) {
    return;
  }

  await supabase
    .from('event_checklist_items')
    .update({
      is_completed: nextCompleted,
      completed_at: nextCompleted ? new Date().toISOString() : null,
      updated_by: session.user.id,
    })
    .eq('id', checklistItemId);

  if (event.lead_id) {
    const item = checklistItem as EventChecklistItemRecord;
    await insertLeadActivity(
      event.lead_id,
      session.user.id,
      'Checklist operativa del evento actualizada',
      `${nextCompleted ? 'Se marcó como completado' : 'Se reabrió'} el ítem "${item.label}" del evento #${event.id.slice(0, 8)}.`,
    );
  }

  await revalidateEventPaths(eventId);
}
