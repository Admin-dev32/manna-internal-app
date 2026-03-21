'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getPreEventReadyState } from '@/lib/events/readiness';
import { requireActiveSession } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getEventByPreEventId } from '@/services/events/queries';
import { getPreEventById } from '@/services/pre-events/queries';

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

export async function createEventFromPreEventAction(preEventId: string) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return;
  }

  const preEvent = await getPreEventById(preEventId);
  if (!preEvent) {
    redirect('/reservas' as Route);
  }

  const existingEvent = await getEventByPreEventId(preEvent.id);
  if (existingEvent) {
    redirect(`/eventos/${existingEvent.id}` as Route);
  }

  const readyState = getPreEventReadyState(preEvent);
  if (!readyState.isReady) {
    redirect(`/reservas/${preEvent.id}` as Route);
  }

  const eventDate = preEvent.confirmed_date;
  const eventTime = preEvent.confirmed_time;
  const bookedService = preEvent.booked_service;

  if (!eventDate || !eventTime || !bookedService) {
    redirect(`/reservas/${preEvent.id}` as Route);
  }

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      client_id: preEvent.client_id,
      lead_id: preEvent.lead_id,
      source_quote_id: preEvent.source_quote_id,
      source_pre_event_id: preEvent.id,
      event_date: eventDate,
      event_time: eventTime,
      location: preEvent.location,
      event_type: preEvent.event_type,
      booked_service: bookedService,
      guest_count: preEvent.confirmed_guests,
      operational_notes: preEvent.initial_operations_notes,
      status: 'programado',
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select('id')
    .single();

  if (error || !event) {
    redirect(`/reservas/${preEvent.id}` as Route);
  }

  if (preEvent.lead_id) {
    await insertLeadActivity(
      preEvent.lead_id,
      session.user.id,
      'Reserva convertida a evento',
      `La reserva operativa se convirtió en evento real #${event.id.slice(0, 8)}.`,
    );
    await insertLeadActivity(
      preEvent.lead_id,
      session.user.id,
      'Evento creado',
      `Se creó un evento real a partir de la reserva #${preEvent.id.slice(0, 8)}.`,
    );
  }

  revalidatePath('/eventos' as Route);
  revalidatePath(`/eventos/${event.id}` as Route);
  revalidatePath(`/reservas/${preEvent.id}` as Route);
  revalidatePath(`/cotizaciones/${preEvent.source_quote_id}` as Route);

  redirect(`/eventos/${event.id}` as Route);
}
