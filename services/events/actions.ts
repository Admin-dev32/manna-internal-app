'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  EVENT_ASSIGNMENT_ROLE_LABELS,
  EVENT_ASSIGNMENT_STATUS_LABELS,
  EVENT_STATUS_LABELS,
  EVENT_STATUS_TRANSITIONS,
  EVENT_TASK_PRIORITY_LABELS,
  EVENT_TASK_STATUS_LABELS,
} from '@/config/events';
import { requireActiveSession } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getPreEventReadyState } from '@/lib/events/readiness';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getEventById, getEventByPreEventId } from '@/services/events/queries';
import { buildEventCalendarPayload, validateEventCalendarRequirements } from '@/services/events/calendar';
import type { EventCalendarSyncFormState } from '@/services/events/calendar-form-state';
import {
  createGoogleCalendarFingerprint,
  findGoogleCalendarEventByFingerprint,
  findGoogleCalendarEventByHeuristic,
  upsertGoogleCalendarEvent,
} from '@/services/google-calendar/client';
import { getClientById } from '@/services/clients/queries';
import { getPreEventById } from '@/services/pre-events/queries';
import {
  EVENT_ASSIGNMENT_ROLES,
  EVENT_ASSIGNMENT_STATUSES,
  EVENT_TASK_PRIORITIES,
  EVENT_TASK_STATUSES,
} from '@/types/events';
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
  revalidatePath('/tareas' as Route);
}

async function getAssignableProfileSummary(profileId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('profiles').select('id, full_name, is_active').eq('id', profileId).maybeSingle();

  return (data as { id: string; full_name: string | null; is_active: boolean } | null) ?? null;
}

async function getEventStaffAssignmentById(eventId: string, assignmentId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('event_staff_assignments')
    .select('id, event_id, profile_id, assignment_role, assignment_status, note')
    .eq('id', assignmentId)
    .eq('event_id', eventId)
    .maybeSingle();

  return (data as {
    id: string;
    event_id: string;
    profile_id: string;
    assignment_role: (typeof EVENT_ASSIGNMENT_ROLES)[number];
    assignment_status: (typeof EVENT_ASSIGNMENT_STATUSES)[number];
    note: string | null;
  } | null) ?? null;
}

async function getEventStaffAssignmentForProfile(eventId: string, profileId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('event_staff_assignments')
    .select('id, event_id, profile_id')
    .eq('event_id', eventId)
    .eq('profile_id', profileId)
    .maybeSingle();

  return (data as { id: string; event_id: string; profile_id: string } | null) ?? null;
}

async function getEventTaskById(eventId: string, taskId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('event_tasks')
    .select('*')
    .eq('id', taskId)
    .eq('event_id', eventId)
    .maybeSingle();

  return (data as {
    id: string;
    event_id: string;
    assigned_profile_id: string;
    title: string;
    priority: (typeof EVENT_TASK_PRIORITIES)[number];
    status: (typeof EVENT_TASK_STATUSES)[number];
  } | null) ?? null;
}

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
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
    return;
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

export async function syncEventToGoogleCalendarAction(
  eventId: string,
  _previousState: EventCalendarSyncFormState,
  _formData: FormData,
): Promise<EventCalendarSyncFormState> {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.user) {
    return { status: 'error', message: 'No fue posible abrir la conexión con Supabase.' };
  }

  const event = await getEventById(eventId);
  if (!event) {
    return { status: 'error', message: 'No encontramos el evento solicitado.' };
  }

  const [client, existingSync] = await Promise.all([
    getClientById(event.client_id),
    supabase
      .from('event_calendar_syncs')
      .select('*')
      .eq('source_record_type', 'event')
      .eq('source_record_id', event.id)
      .neq('sync_status', 'stale')
      .maybeSingle(),
  ]);

  if (!client) {
    return { status: 'error', message: 'No encontramos el cliente asociado al evento.' };
  }

  const missing = validateEventCalendarRequirements(event, client);
  if (missing.length > 0) {
    return {
      status: 'error',
      message: `No se puede sincronizar en Google Calendar. Falta: ${missing.join(', ')}.`,
    };
  }

  try {
    const payload = buildEventCalendarPayload(event, client);
    const eventFingerprint = createGoogleCalendarFingerprint('event', event.id);
    const preEventFingerprint = createGoogleCalendarFingerprint('pre_event', event.source_pre_event_id);
    let externalEventId = (existingSync.data as { external_event_id?: string | null } | null)?.external_event_id ?? null;
    let externalEventUrl = (existingSync.data as { external_event_url?: string | null } | null)?.external_event_url ?? null;
    let syncOrigin: 'direct' | 'reconciled' | 'inherited' = 'direct';
    let ownershipNote: string | null = null;

    if (!externalEventId) {
      const { data: preEventSync } = await supabase
        .from('event_calendar_syncs')
        .select('*')
        .eq('source_record_type', 'pre_event')
        .eq('source_record_id', event.source_pre_event_id)
        .neq('sync_status', 'stale')
        .maybeSingle();

      const preEventSyncData = preEventSync as { id: string; external_event_id?: string | null; external_event_url?: string | null } | null;
      if (preEventSyncData?.external_event_id) {
        externalEventId = preEventSyncData.external_event_id;
        externalEventUrl = preEventSyncData.external_event_url ?? null;
        syncOrigin = 'inherited';
        ownershipNote = 'Vínculo heredado desde Reserva para evitar duplicados.';

        await supabase
          .from('event_calendar_syncs')
          .update({
            sync_status: 'stale',
            ownership_note: `Ownership transferido a Event #${event.id.slice(0, 8)}.`,
            superseded_by_source_record_type: 'event',
            superseded_by_source_record_id: event.id,
            synced_by: session.user.id,
            synced_at: new Date().toISOString(),
          })
          .eq('id', preEventSyncData.id);
      }
    }

    if (!externalEventId) {
      const fingerprintMatch = await findGoogleCalendarEventByFingerprint(eventFingerprint);
      if (fingerprintMatch?.externalEventId) {
        externalEventId = fingerprintMatch.externalEventId;
        externalEventUrl = fingerprintMatch.externalEventUrl;
        syncOrigin = 'reconciled';
        ownershipNote = 'Reconciliado por huella fuerte event.';
      }
    }

    if (!externalEventId) {
      const preEventFingerprintMatch = await findGoogleCalendarEventByFingerprint(preEventFingerprint);
      if (preEventFingerprintMatch?.externalEventId) {
        externalEventId = preEventFingerprintMatch.externalEventId;
        externalEventUrl = preEventFingerprintMatch.externalEventUrl;
        syncOrigin = 'inherited';
        ownershipNote = 'Reconciliado reutilizando huella fuerte de Reserva origen.';
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

    const syncResult = await upsertGoogleCalendarEvent(payload, eventFingerprint, externalEventId);

    const { error } = await supabase.from('event_calendar_syncs').upsert(
      {
        source_record_type: 'event',
        source_record_id: event.id,
        provider: 'google_calendar',
        external_event_id: syncResult.externalEventId,
        external_event_url: syncResult.externalEventUrl ?? externalEventUrl,
        sync_status: syncOrigin === 'direct' ? 'synced' : 'reconciled',
        sync_origin: syncOrigin,
        ownership_note: ownershipNote,
        superseded_by_source_record_type: null,
        superseded_by_source_record_id: null,
        last_error: null,
        synced_by: session.user.id,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'source_record_type,source_record_id' },
    );

    if (error) {
      return { status: 'error', message: 'Se sincronizó en Google Calendar, pero no pudimos guardar la trazabilidad interna.' };
    }

    await revalidateEventPaths(event.id);
    return {
      status: 'success',
      message:
        syncOrigin === 'inherited'
          ? 'Evento actualizado en Google Calendar reutilizando ownership desde Reserva.'
          : syncOrigin === 'reconciled'
            ? 'Evento reconciliado y actualizado correctamente en Google Calendar.'
            : existingSync.data?.external_event_id
              ? 'Evento actualizado correctamente en Google Calendar.'
              : 'Evento sincronizado correctamente en Google Calendar.',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'No fue posible sincronizar el evento en Google Calendar.';
    await supabase.from('event_calendar_syncs').upsert({
      source_record_type: 'event',
      source_record_id: event.id,
      provider: 'google_calendar',
      external_event_id: (existingSync.data as { external_event_id?: string | null } | null)?.external_event_id ?? null,
      external_event_url: (existingSync.data as { external_event_url?: string | null } | null)?.external_event_url ?? null,
      sync_status: 'error',
      sync_origin: (existingSync.data as { sync_origin?: 'direct' | 'reconciled' | 'inherited' } | null)?.sync_origin ?? 'direct',
      ownership_note: (existingSync.data as { ownership_note?: string | null } | null)?.ownership_note ?? null,
      last_error: errorMessage,
      synced_by: session.user.id,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'source_record_type,source_record_id' });

    await revalidateEventPaths(event.id);
    return { status: 'error', message: `Error de sincronización: ${errorMessage}` };
  }
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

export async function createEventStaffAssignmentAction(eventId: string, formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return;
  }

  const event = await getEventById(eventId);
  if (!event) {
    return;
  }

  const profileId = String(formData.get('profile_id') ?? '').trim();
  const assignmentRole = String(formData.get('assignment_role') ?? 'general');
  const assignmentStatus = String(formData.get('assignment_status') ?? 'pendiente');
  const note = String(formData.get('note') ?? '').trim();

  if (!profileId) {
    return;
  }

  if (!EVENT_ASSIGNMENT_ROLES.includes(assignmentRole as (typeof EVENT_ASSIGNMENT_ROLES)[number])) {
    return;
  }

  if (!EVENT_ASSIGNMENT_STATUSES.includes(assignmentStatus as (typeof EVENT_ASSIGNMENT_STATUSES)[number])) {
    return;
  }

  const profile = await getAssignableProfileSummary(profileId);
  if (!profile || !profile.is_active) {
    return;
  }

  const { data: existingAssignment } = await supabase
    .from('event_staff_assignments')
    .select('id')
    .eq('event_id', eventId)
    .eq('profile_id', profileId)
    .maybeSingle();

  if (existingAssignment) {
    await supabase
      .from('event_staff_assignments')
      .update({
        assignment_role: assignmentRole,
        assignment_status: assignmentStatus,
        note: note || null,
        updated_by: session.user.id,
      })
      .eq('id', existingAssignment.id);
  } else {
    await supabase.from('event_staff_assignments').insert({
      event_id: eventId,
      profile_id: profileId,
      assignment_role: assignmentRole,
      assignment_status: assignmentStatus,
      note: note || null,
      created_by: session.user.id,
      updated_by: session.user.id,
    });
  }

  if (event.lead_id) {
    await insertLeadActivity(
      event.lead_id,
      session.user.id,
      'Asignación de personal actualizada',
      `${existingAssignment ? 'Se actualizó' : 'Se agregó'} ${profile.full_name ?? 'un responsable interno'} al evento #${event.id.slice(0, 8)} con rol ${EVENT_ASSIGNMENT_ROLE_LABELS[assignmentRole as keyof typeof EVENT_ASSIGNMENT_ROLE_LABELS]} y estado ${EVENT_ASSIGNMENT_STATUS_LABELS[assignmentStatus as keyof typeof EVENT_ASSIGNMENT_STATUS_LABELS]}.`,
    );
  }

  await revalidateEventPaths(eventId);
}

export async function updateEventStaffAssignmentAction(eventId: string, assignmentId: string, formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return;
  }

  const assignmentRole = String(formData.get('assignment_role') ?? 'general');
  const assignmentStatus = String(formData.get('assignment_status') ?? 'pendiente');
  const note = String(formData.get('note') ?? '').trim();
  const event = await getEventById(eventId);

  if (!event) {
    return;
  }

  if (!EVENT_ASSIGNMENT_ROLES.includes(assignmentRole as (typeof EVENT_ASSIGNMENT_ROLES)[number])) {
    return;
  }

  if (!EVENT_ASSIGNMENT_STATUSES.includes(assignmentStatus as (typeof EVENT_ASSIGNMENT_STATUSES)[number])) {
    return;
  }

  const existingAssignment = await getEventStaffAssignmentById(eventId, assignmentId);
  if (!existingAssignment) {
    return;
  }

  await supabase
    .from('event_staff_assignments')
    .update({
      assignment_role: assignmentRole,
      assignment_status: assignmentStatus,
      note: note || null,
      updated_by: session.user.id,
    })
    .eq('id', assignmentId)
    .eq('event_id', eventId);

  if (event.lead_id) {
    const profile = await getAssignableProfileSummary(existingAssignment.profile_id);

    await insertLeadActivity(
      event.lead_id,
      session.user.id,
      'Asignación de personal modificada',
      `Se actualizó ${profile?.full_name ?? 'una asignación'} del evento #${event.id.slice(0, 8)} a rol ${EVENT_ASSIGNMENT_ROLE_LABELS[assignmentRole as keyof typeof EVENT_ASSIGNMENT_ROLE_LABELS]} y estado ${EVENT_ASSIGNMENT_STATUS_LABELS[assignmentStatus as keyof typeof EVENT_ASSIGNMENT_STATUS_LABELS]}.`,
    );
  }

  await revalidateEventPaths(eventId);
}

export async function removeEventStaffAssignmentAction(eventId: string, assignmentId: string) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return;
  }

  const event = await getEventById(eventId);
  if (!event) {
    return;
  }

  const existingAssignment = await getEventStaffAssignmentById(eventId, assignmentId);
  if (!existingAssignment) {
    return;
  }

  await supabase.from('event_staff_assignments').delete().eq('id', assignmentId).eq('event_id', eventId);

  if (event.lead_id) {
    const profile = await getAssignableProfileSummary(existingAssignment.profile_id);

    await insertLeadActivity(
      event.lead_id,
      session.user.id,
      'Asignación de personal removida',
      `Se removió ${profile?.full_name ?? 'una asignación'} del evento #${event.id.slice(0, 8)}.`,
    );
  }

  await revalidateEventPaths(eventId);
}

export async function createEventTaskAction(eventId: string, formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return;
  }

  if (!hasPermission(session.user, 'tasks.manage') || !hasPermission(session.user, 'tasks.assign')) {
    return;
  }

  const event = await getEventById(eventId);
  if (!event) {
    return;
  }

  const assignedProfileId = String(formData.get('assigned_profile_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const description = normalizeOptionalString(formData.get('description'));
  const priority = String(formData.get('priority') ?? 'media');
  const status = String(formData.get('status') ?? 'pendiente');
  const dueAt = normalizeOptionalString(formData.get('due_at'));
  const internalNote = normalizeOptionalString(formData.get('internal_note'));

  if (!assignedProfileId || !title) {
    return;
  }

  if (!EVENT_TASK_PRIORITIES.includes(priority as (typeof EVENT_TASK_PRIORITIES)[number])) {
    return;
  }

  if (!EVENT_TASK_STATUSES.includes(status as (typeof EVENT_TASK_STATUSES)[number])) {
    return;
  }

  const profile = await getAssignableProfileSummary(assignedProfileId);
  const staffAssignment = await getEventStaffAssignmentForProfile(eventId, assignedProfileId);
  if (!profile || !profile.is_active || !staffAssignment) {
    return;
  }

  await supabase.from('event_tasks').insert({
    event_id: eventId,
    assigned_profile_id: assignedProfileId,
    title,
    description,
    priority,
    status,
    due_at: dueAt,
    internal_note: internalNote,
    created_by: session.user.id,
    updated_by: session.user.id,
  });

  if (event.lead_id) {
    await insertLeadActivity(
      event.lead_id,
      session.user.id,
      'Tarea operativa creada',
      `Se creó la tarea "${title}" para ${profile.full_name ?? 'un responsable interno'} con prioridad ${EVENT_TASK_PRIORITY_LABELS[priority as keyof typeof EVENT_TASK_PRIORITY_LABELS]}.`,
    );
  }

  await revalidateEventPaths(eventId);
}

export async function updateEventTaskAction(eventId: string, taskId: string, formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return;
  }

  if (!hasPermission(session.user, 'tasks.manage')) {
    return;
  }

  const event = await getEventById(eventId);
  if (!event) {
    return;
  }

  const existingTask = await getEventTaskById(eventId, taskId);
  if (!existingTask) {
    return;
  }

  const assignedProfileId = String(formData.get('assigned_profile_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const description = normalizeOptionalString(formData.get('description'));
  const priority = String(formData.get('priority') ?? existingTask.priority);
  const status = String(formData.get('status') ?? existingTask.status);
  const dueAt = normalizeOptionalString(formData.get('due_at'));
  const internalNote = normalizeOptionalString(formData.get('internal_note'));

  if (!assignedProfileId || !title) {
    return;
  }

  if (!EVENT_TASK_PRIORITIES.includes(priority as (typeof EVENT_TASK_PRIORITIES)[number])) {
    return;
  }

  if (!EVENT_TASK_STATUSES.includes(status as (typeof EVENT_TASK_STATUSES)[number])) {
    return;
  }

  const profile = await getAssignableProfileSummary(assignedProfileId);
  const staffAssignment = await getEventStaffAssignmentForProfile(eventId, assignedProfileId);
  if (!profile || !profile.is_active || !staffAssignment) {
    return;
  }

  if (assignedProfileId !== existingTask.assigned_profile_id && !hasPermission(session.user, 'tasks.assign')) {
    return;
  }

  if (status !== existingTask.status && !hasPermission(session.user, 'tasks.update_status')) {
    return;
  }

  await supabase
    .from('event_tasks')
    .update({
      assigned_profile_id: assignedProfileId,
      title,
      description,
      priority,
      status,
      due_at: dueAt,
      internal_note: internalNote,
      updated_by: session.user.id,
    })
    .eq('id', taskId)
    .eq('event_id', eventId);

  if (event.lead_id) {
    await insertLeadActivity(
      event.lead_id,
      session.user.id,
      'Tarea operativa actualizada',
      `Se actualizó la tarea "${title}" para ${profile.full_name ?? 'un responsable interno'} con estado ${EVENT_TASK_STATUS_LABELS[status as keyof typeof EVENT_TASK_STATUS_LABELS]}.`,
    );
  }

  await revalidateEventPaths(eventId);
}

export async function updateEventTaskStatusAction(eventId: string, taskId: string, nextStatus: string) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) {
    return;
  }

  if (!hasPermission(session.user, 'tasks.update_status')) {
    return;
  }

  if (!EVENT_TASK_STATUSES.includes(nextStatus as (typeof EVENT_TASK_STATUSES)[number])) {
    return;
  }

  const event = await getEventById(eventId);
  const existingTask = await getEventTaskById(eventId, taskId);
  if (!event || !existingTask) {
    return;
  }

  await supabase
    .from('event_tasks')
    .update({
      status: nextStatus,
      updated_by: session.user.id,
    })
    .eq('id', taskId)
    .eq('event_id', eventId);

  if (event.lead_id) {
    const profile = await getAssignableProfileSummary(existingTask.assigned_profile_id);

    await insertLeadActivity(
      event.lead_id,
      session.user.id,
      'Estado de tarea operativa actualizado',
      `La tarea "${existingTask.title}" de ${profile?.full_name ?? 'un responsable interno'} cambió a ${EVENT_TASK_STATUS_LABELS[nextStatus as keyof typeof EVENT_TASK_STATUS_LABELS]}.`,
    );
  }

  await revalidateEventPaths(eventId);
}
