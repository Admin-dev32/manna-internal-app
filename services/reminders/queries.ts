import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LEAD_STALE_AFTER_DAYS, REMINDER_UPCOMING_WINDOW_DAYS } from '@/config/reminders';
import { getMentionNotificationsForCurrentUser } from '@/services/internal-communication/queries';
import type { ClientRecord } from '@/types/clients';
import type { EventChecklistItemRecord, EventRecord, EventStaffAssignmentRecord, EventTaskRecord } from '@/types/events';
import type { EventInventoryRequirementRecord } from '@/types/inventory';
import type { LeadProfileOption, LeadRecord } from '@/types/leads';
import type { PreEventRecord } from '@/types/pre-events';
import type { ReminderArea, ReminderCenterData, ReminderItem, ReminderSeverity, ReminderSummary, ReminderTiming } from '@/types/reminders';

const OPEN_LEAD_STATUSES = new Set(['nuevo', 'contactado', 'seguimiento', 'calificado']);
const ACTIVE_EVENT_STATUSES = new Set(['pendiente', 'confirmado', 'en_preparacion']);
const TIMING_SORT_ORDER: Record<ReminderTiming, number> = {
  overdue: 0,
  today: 1,
  incomplete: 2,
  upcoming: 3,
};
const SEVERITY_SORT_ORDER: Record<ReminderSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};
const MENTION_ENTITY_LABELS = {
  lead: 'Lead',
  quote: 'Cotización',
  client: 'Cliente',
  pre_event: 'Reserva',
  event: 'Evento',
  event_task: 'Tarea',
} as const;

function startOfDay(date = new Date()) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function endOfDay(date = new Date()) {
  const normalized = new Date(date);
  normalized.setHours(23, 59, 59, 999);
  return normalized;
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isBeforeToday(value: string | null | undefined, now = new Date()) {
  const parsed = parseDate(value);
  if (!parsed) return false;
  return parsed.getTime() < startOfDay(now).getTime();
}

function isToday(value: string | null | undefined, now = new Date()) {
  const parsed = parseDate(value);
  if (!parsed) return false;
  return parsed.getTime() >= startOfDay(now).getTime() && parsed.getTime() <= endOfDay(now).getTime();
}

function differenceInDaysFromToday(value: string | null | undefined, now = new Date()) {
  const parsed = parseDateOnly(value);
  if (!parsed) return null;

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(parsed).getTime() - startOfDay(now).getTime()) / msPerDay);
}

function buildSummary(items: ReminderItem[]): ReminderSummary {
  return {
    total: items.length,
    overdue: items.filter((item) => item.timing === 'overdue').length,
    today: items.filter((item) => item.timing === 'today').length,
    upcoming: items.filter((item) => item.timing === 'upcoming').length,
    incomplete: items.filter((item) => item.timing === 'incomplete').length,
    critical: items.filter((item) => item.severity === 'critical').length,
    byArea: {
      lead: items.filter((item) => item.area === 'lead').length,
      task: items.filter((item) => item.area === 'task').length,
      pre_event: items.filter((item) => item.area === 'pre_event').length,
      event: items.filter((item) => item.area === 'event').length,
      communication: items.filter((item) => item.area === 'communication').length,
    },
  };
}

function sortReminderItems(items: ReminderItem[]) {
  return [...items].sort((left, right) => {
    const timingDiff = TIMING_SORT_ORDER[left.timing] - TIMING_SORT_ORDER[right.timing];
    if (timingDiff !== 0) return timingDiff;

    const severityDiff = SEVERITY_SORT_ORDER[left.severity] - SEVERITY_SORT_ORDER[right.severity];
    if (severityDiff !== 0) return severityDiff;

    if (left.dueAt && right.dueAt) return left.dueAt.localeCompare(right.dueAt);
    if (left.dueAt) return -1;
    if (right.dueAt) return 1;

    return left.title.localeCompare(right.title, 'es');
  });
}

async function getProfilesMap(ids: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || ids.length === 0) return {} as Record<string, LeadProfileOption>;

  const uniqueIds = [...new Set(ids)];
  const { data } = await supabase.from('profiles').select('id, full_name, role, is_active').in('id', uniqueIds);

  return Object.fromEntries(((data ?? []) as LeadProfileOption[]).map((profile) => [profile.id, profile])) as Record<string, LeadProfileOption>;
}

async function getClientsMap(ids: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || ids.length === 0) return {} as Record<string, ClientRecord>;

  const uniqueIds = [...new Set(ids)];
  const { data } = await supabase.from('clients').select('*').in('id', uniqueIds);

  return Object.fromEntries(((data ?? []) as ClientRecord[]).map((client) => [client.id, client])) as Record<string, ClientRecord>;
}

function createReminder({
  channel = 'reminder',
  id,
  area,
  timing,
  severity,
  title,
  description,
  entityLabel,
  href,
  dueAt = null,
  responsibleLabel = null,
  tags = [],
  mentionNotificationId,
  isRead,
}: Omit<ReminderItem, 'dueAt' | 'responsibleLabel' | 'tags' | 'channel'> & Pick<ReminderItem, 'href'> & Partial<Pick<ReminderItem, 'dueAt' | 'responsibleLabel' | 'tags' | 'channel' | 'mentionNotificationId' | 'isRead'>>) {
  return { id, channel, area, timing, severity, title, description, entityLabel, href, dueAt, responsibleLabel, tags, mentionNotificationId, isRead } satisfies ReminderItem;
}

function buildLeadReminders(leads: LeadRecord[], profiles: Record<string, LeadProfileOption>) {
  const now = new Date();

  return leads.flatMap((lead) => {
    if (!OPEN_LEAD_STATUSES.has(lead.status)) return [];

    const responsible = lead.responsible_profile_id ? profiles[lead.responsible_profile_id] : null;
    const responsibleLabel = responsible?.full_name ?? null;
    const reminders: ReminderItem[] = [];

    if (lead.follow_up_at && isBeforeToday(lead.follow_up_at, now)) {
      reminders.push(
        createReminder({
          id: `lead-overdue-${lead.id}`,
          area: 'lead',
          timing: 'overdue',
          severity: ['alta', 'urgente'].includes(lead.priority) ? 'critical' : 'high',
          title: `Follow-up vencido con ${lead.full_name}`,
          description: `El seguimiento programado ya venció y el lead sigue abierto en ${lead.status}.`,
          entityLabel: lead.full_name,
          href: `/leads/${lead.id}`,
          dueAt: lead.follow_up_at,
          responsibleLabel,
          tags: [lead.status, lead.priority, lead.next_action],
        }),
      );
    } else if (lead.follow_up_at && isToday(lead.follow_up_at, now)) {
      reminders.push(
        createReminder({
          id: `lead-today-${lead.id}`,
          area: 'lead',
          timing: 'today',
          severity: ['alta', 'urgente'].includes(lead.priority) ? 'high' : 'medium',
          title: `Follow-up para hoy con ${lead.full_name}`,
          description: `Hay una siguiente acción pendiente para hoy y conviene no perder continuidad comercial.`,
          entityLabel: lead.full_name,
          href: `/leads/${lead.id}`,
          dueAt: lead.follow_up_at,
          responsibleLabel,
          tags: [lead.status, lead.priority, lead.next_action],
        }),
      );
    } else if (!lead.follow_up_at) {
      const lastTouch = parseDate(lead.last_interaction_at) ?? parseDate(lead.updated_at) ?? parseDate(lead.created_at);
      const staleDays = lastTouch ? Math.floor((startOfDay(now).getTime() - startOfDay(lastTouch).getTime()) / (24 * 60 * 60 * 1000)) : 0;

      if (staleDays >= LEAD_STALE_AFTER_DAYS) {
        reminders.push(
          createReminder({
            id: `lead-missing-followup-${lead.id}`,
            area: 'lead',
            timing: 'incomplete',
            severity: ['alta', 'urgente'].includes(lead.priority) ? 'high' : 'medium',
            title: `Lead abierto sin seguimiento activo`,
            description: `${lead.full_name} sigue abierto y no tiene próximo follow-up programado desde hace ${staleDays} día${staleDays === 1 ? '' : 's'}.`,
            entityLabel: lead.full_name,
            href: `/leads/${lead.id}`,
            dueAt: null,
            responsibleLabel,
            tags: [lead.status, lead.priority, lead.next_action],
          }),
        );
      }
    }

    return reminders;
  });
}

function buildTaskReminders({
  tasks,
  eventsById,
  clientsById,
  profiles,
}: {
  tasks: EventTaskRecord[];
  eventsById: Record<string, EventRecord>;
  clientsById: Record<string, ClientRecord>;
  profiles: Record<string, LeadProfileOption>;
}) {
  const now = new Date();

  return tasks.flatMap((task) => {
    if (task.status === 'completada') return [];

    const event = eventsById[task.event_id];
    if (!event) return [];

    const client = clientsById[event.client_id];
    const responsibleLabel = profiles[task.assigned_profile_id]?.full_name ?? null;
    const tags = [task.priority, task.status, client?.full_name ?? 'Evento'].filter(Boolean);
    const titleBase = task.status === 'bloqueada' ? `Tarea bloqueada: ${task.title}` : task.title;

    if (task.due_at && isBeforeToday(task.due_at, now)) {
      return [
        createReminder({
          id: `task-overdue-${task.id}`,
          area: 'task',
          timing: 'overdue',
          severity: task.priority === 'urgente' || task.status === 'bloqueada' ? 'critical' : 'high',
          title: titleBase,
          description: `La tarea ya venció y sigue ${task.status === 'bloqueada' ? 'bloqueada' : 'pendiente'} para el evento ${event.event_type ?? 'sin tipo'}.`,
          entityLabel: event.event_type ?? client?.full_name ?? 'Evento',
          href: `/eventos/${event.id}`,
          dueAt: task.due_at,
          responsibleLabel,
          tags,
        }),
      ];
    }

    if (task.due_at && isToday(task.due_at, now)) {
      return [
        createReminder({
          id: `task-today-${task.id}`,
          area: 'task',
          timing: 'today',
          severity: task.priority === 'urgente' || task.status === 'bloqueada' ? 'high' : 'medium',
          title: titleBase,
          description: `La tarea vence hoy para el evento ${event.event_type ?? 'sin tipo'} y necesita seguimiento operativo.`,
          entityLabel: event.event_type ?? client?.full_name ?? 'Evento',
          href: `/eventos/${event.id}`,
          dueAt: task.due_at,
          responsibleLabel,
          tags,
        }),
      ];
    }

    if (task.status === 'bloqueada') {
      return [
        createReminder({
          id: `task-blocked-${task.id}`,
          area: 'task',
          timing: 'incomplete',
          severity: task.priority === 'urgente' ? 'high' : 'medium',
          title: titleBase,
          description: `La tarea está bloqueada y conviene destrabarla antes de que afecte el evento ${event.event_type ?? 'sin tipo'}.`,
          entityLabel: event.event_type ?? client?.full_name ?? 'Evento',
          href: `/eventos/${event.id}`,
          dueAt: task.due_at,
          responsibleLabel,
          tags,
        }),
      ];
    }

    if (task.priority === 'urgente') {
      return [
        createReminder({
          id: `task-urgent-${task.id}`,
          area: 'task',
          timing: 'upcoming',
          severity: 'medium',
          title: `Tarea urgente pendiente: ${task.title}`,
          description: `Hay una tarea marcada como urgente que sigue abierta para el evento ${event.event_type ?? 'sin tipo'}.`,
          entityLabel: event.event_type ?? client?.full_name ?? 'Evento',
          href: `/eventos/${event.id}`,
          dueAt: task.due_at,
          responsibleLabel,
          tags,
        }),
      ];
    }

    return [];
  });
}

function buildPreEventReminders(preEvents: PreEventRecord[], clientsById: Record<string, ClientRecord>) {
  const reminders: ReminderItem[] = [];
  const now = new Date();

  for (const preEvent of preEvents) {
    const client = clientsById[preEvent.client_id];
    const dateDiff = differenceInDaysFromToday(preEvent.confirmed_date, now);
    const entityLabel = client?.full_name ?? `Reserva #${preEvent.id.slice(0, 8)}`;

    if (dateDiff != null && dateDiff < 0) {
      reminders.push(
        createReminder({
          id: `pre-event-overdue-${preEvent.id}`,
          area: 'pre_event',
          timing: 'overdue',
          severity: 'high',
          title: `Reserva vencida sin cerrar`,
          description: `La reserva de ${entityLabel} ya pasó de fecha y todavía sigue en ${preEvent.status}.`,
          entityLabel,
          href: `/reservas/${preEvent.id}`,
          dueAt: preEvent.confirmed_date ? `${preEvent.confirmed_date}T00:00:00` : null,
          tags: [preEvent.status, preEvent.booked_service ?? 'Sin servicio'],
        }),
      );
    } else if (dateDiff === 0) {
      reminders.push(
        createReminder({
          id: `pre-event-today-${preEvent.id}`,
          area: 'pre_event',
          timing: 'today',
          severity: 'high',
          title: `Reserva programada para hoy`,
          description: `${entityLabel} tiene reserva confirmada para hoy y conviene revisar preparación y conversión a evento si aplica.`,
          entityLabel,
          href: `/reservas/${preEvent.id}`,
          dueAt: preEvent.confirmed_date ? `${preEvent.confirmed_date}T00:00:00` : null,
          tags: [preEvent.status, preEvent.booked_service ?? 'Sin servicio'],
        }),
      );
    } else if (dateDiff != null && dateDiff > 0 && dateDiff <= REMINDER_UPCOMING_WINDOW_DAYS) {
      reminders.push(
        createReminder({
          id: `pre-event-upcoming-${preEvent.id}`,
          area: 'pre_event',
          timing: 'upcoming',
          severity: dateDiff <= 2 ? 'high' : 'medium',
          title: `Reserva próxima`,
          description: `${entityLabel} llega en ${dateDiff} día${dateDiff === 1 ? '' : 's'} y debería tener validación operativa mínima.`,
          entityLabel,
          href: `/reservas/${preEvent.id}`,
          dueAt: preEvent.confirmed_date ? `${preEvent.confirmed_date}T00:00:00` : null,
          tags: [preEvent.status, preEvent.booked_service ?? 'Sin servicio'],
        }),
      );
    }

    const missingFields = [
      !preEvent.confirmed_date ? 'Fecha' : null,
      !preEvent.confirmed_time ? 'Hora' : null,
      !preEvent.location ? 'Ubicación' : null,
      !preEvent.booked_service ? 'Servicio' : null,
      preEvent.confirmed_guests == null ? 'Invitados' : null,
    ].filter(Boolean) as string[];

    if (missingFields.length > 0) {
      reminders.push(
        createReminder({
          id: `pre-event-incomplete-${preEvent.id}`,
          area: 'pre_event',
          timing: 'incomplete',
          severity: dateDiff != null && dateDiff <= 2 ? 'high' : 'medium',
          title: `Reserva con datos incompletos`,
          description: `${entityLabel} todavía necesita completar: ${missingFields.join(', ')}.`,
          entityLabel,
          href: `/reservas/${preEvent.id}`,
          dueAt: preEvent.confirmed_date ? `${preEvent.confirmed_date}T00:00:00` : null,
          tags: [preEvent.status, ...missingFields],
        }),
      );
    }
  }

  return reminders;
}

function buildEventReminders({
  events,
  clientsById,
  checklistItems,
  assignments,
  inventoryRequirements,
}: {
  events: EventRecord[];
  clientsById: Record<string, ClientRecord>;
  checklistItems: EventChecklistItemRecord[];
  assignments: EventStaffAssignmentRecord[];
  inventoryRequirements: EventInventoryRequirementRecord[];
}) {
  const reminders: ReminderItem[] = [];
  const now = new Date();
  const checklistPendingByEvent = checklistItems.reduce(
    (accumulator, item) => {
      if (!item.is_completed) {
        accumulator[item.event_id] = (accumulator[item.event_id] ?? 0) + 1;
      }
      return accumulator;
    },
    {} as Record<string, number>,
  );
  const assignmentCountByEvent = assignments.reduce(
    (accumulator, assignment) => {
      accumulator[assignment.event_id] = (accumulator[assignment.event_id] ?? 0) + 1;
      return accumulator;
    },
    {} as Record<string, number>,
  );
  const inventoryCountByEvent = inventoryRequirements.reduce(
    (accumulator, item) => {
      accumulator[item.event_id] = (accumulator[item.event_id] ?? 0) + 1;
      return accumulator;
    },
    {} as Record<string, number>,
  );
  const inventoryPendingPrepByEvent = inventoryRequirements.reduce(
    (accumulator, item) => {
      if (item.prep_status === 'pendiente' || item.prep_status === 'faltante') {
        accumulator[item.event_id] = (accumulator[item.event_id] ?? 0) + 1;
      }
      return accumulator;
    },
    {} as Record<string, number>,
  );
  const inventoryMissingByEvent = inventoryRequirements.reduce(
    (accumulator, item) => {
      const missing = Math.max(Number(item.quantity_required ?? 0) - Number(item.quantity_counted ?? 0), 0);
      if (missing > 0) {
        accumulator[item.event_id] = (accumulator[item.event_id] ?? 0) + 1;
      }
      return accumulator;
    },
    {} as Record<string, number>,
  );

  for (const event of events) {
    if (!ACTIVE_EVENT_STATUSES.has(event.status)) continue;

    const client = clientsById[event.client_id];
    const dateDiff = differenceInDaysFromToday(event.event_date, now);
    const entityLabel = event.event_type ?? client?.full_name ?? `Evento #${event.id.slice(0, 8)}`;
    const dueAt = `${event.event_date}T${event.event_time || '00:00'}:00`;

    if (dateDiff != null && dateDiff < 0) {
      reminders.push(
        createReminder({
          id: `event-overdue-${event.id}`,
          area: 'event',
          timing: 'overdue',
          severity: 'critical',
          title: `Evento vencido con estado activo`,
          description: `${entityLabel} ya pasó de fecha pero todavía sigue en ${event.status}.`,
          entityLabel,
          href: `/eventos/${event.id}`,
          dueAt,
          tags: [event.status, client?.full_name ?? 'Cliente'],
        }),
      );
    } else if (dateDiff === 0) {
      reminders.push(
        createReminder({
          id: `event-today-${event.id}`,
          area: 'event',
          timing: 'today',
          severity: 'critical',
          title: `Evento programado para hoy`,
          description: `${entityLabel} requiere seguimiento operativo hoy.`,
          entityLabel,
          href: `/eventos/${event.id}`,
          dueAt,
          tags: [event.status, client?.full_name ?? 'Cliente'],
        }),
      );
    } else if (dateDiff != null && dateDiff > 0 && dateDiff <= REMINDER_UPCOMING_WINDOW_DAYS) {
      reminders.push(
        createReminder({
          id: `event-upcoming-${event.id}`,
          area: 'event',
          timing: 'upcoming',
          severity: dateDiff <= 2 ? 'high' : 'medium',
          title: `Evento próximo`,
          description: `${entityLabel} ocurre en ${dateDiff} día${dateDiff === 1 ? '' : 's'} y ya debería estar encaminado en operación.`,
          entityLabel,
          href: `/eventos/${event.id}`,
          dueAt,
          tags: [event.status, client?.full_name ?? 'Cliente'],
        }),
      );
    }

    const missingReasons = [
      !event.location ? 'Ubicación' : null,
      !event.event_type ? 'Tipo de evento' : null,
      event.guest_count == null ? 'Invitados' : null,
      (checklistPendingByEvent[event.id] ?? 0) > 0 ? `Checklist pendiente (${checklistPendingByEvent[event.id]})` : null,
      (assignmentCountByEvent[event.id] ?? 0) === 0 ? 'Sin staff asignado' : null,
      (inventoryCountByEvent[event.id] ?? 0) === 0 ? 'Sin materiales ligados' : null,
      (inventoryPendingPrepByEvent[event.id] ?? 0) > 0 ? `Materiales pendientes/faltantes (${inventoryPendingPrepByEvent[event.id]})` : null,
      (inventoryMissingByEvent[event.id] ?? 0) > 0 ? `Conteo incompleto de materiales (${inventoryMissingByEvent[event.id]})` : null,
    ].filter(Boolean) as string[];

    if (missingReasons.length > 0) {
      reminders.push(
        createReminder({
          id: `event-incomplete-${event.id}`,
          area: 'event',
          timing: 'incomplete',
          severity: dateDiff != null && dateDiff <= 1 ? 'critical' : dateDiff != null && dateDiff <= REMINDER_UPCOMING_WINDOW_DAYS ? 'high' : 'medium',
          title: `Evento con preparación incompleta`,
          description: `${entityLabel} todavía requiere atención en: ${missingReasons.join(', ')}.`,
          entityLabel,
          href: `/eventos/${event.id}`,
          dueAt,
          tags: [event.status, ...missingReasons],
        }),
      );
    }
  }

  return reminders;
}

export async function getRemindersCenterData(): Promise<ReminderCenterData> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const items = [] as ReminderItem[];
    return {
      generatedAt: new Date().toISOString(),
      items,
      topItems: items,
      summary: buildSummary(items),
    };
  }

  const [
    { data: leadsData },
    { data: tasksData },
    { data: eventsData },
    { data: preEventsData },
    { data: checklistData },
    { data: assignmentsData },
    { data: inventoryRequirementsData },
  ] = await Promise.all([
    supabase.from('leads').select('*').order('updated_at', { ascending: false }).limit(120),
    supabase.from('tasks_catalog').select('*').eq('source_type', 'event').order('updated_at', { ascending: false }).limit(160),
    supabase.from('events').select('*').order('event_date', { ascending: true }).limit(120),
    supabase.from('pre_events').select('*').order('confirmed_date', { ascending: true, nullsFirst: false }).limit(120),
    supabase.from('event_checklist_items').select('*'),
    supabase.from('event_staff_assignments').select('*'),
    supabase.from('event_inventory_requirements').select('*'),
  ]);

  const leads = (leadsData ?? []) as LeadRecord[];
  const tasks = (tasksData ?? []) as EventTaskRecord[];
  const events = (eventsData ?? []) as EventRecord[];
  const preEvents = (preEventsData ?? []) as PreEventRecord[];
  const checklistItems = (checklistData ?? []) as EventChecklistItemRecord[];
  const assignments = (assignmentsData ?? []) as EventStaffAssignmentRecord[];
  const inventoryRequirements = (inventoryRequirementsData ?? []) as EventInventoryRequirementRecord[];

  const eventIds = [...new Set(tasks.map((task) => task.event_id).concat(events.map((event) => event.id)))];
  const relevantEvents = events.filter((event) => eventIds.includes(event.id));
  const clientIds = [
    ...new Set(preEvents.map((item) => item.client_id).concat(relevantEvents.map((item) => item.client_id))),
  ];
  const profileIds = [
    ...new Set(
      leads.map((lead) => lead.responsible_profile_id).filter(Boolean)
        .concat(tasks.map((task) => task.assigned_profile_id))
        .filter(Boolean) as string[],
    ),
  ];

  const [clientsById, profiles, mentionNotifications] = await Promise.all([
    getClientsMap(clientIds),
    getProfilesMap(profileIds),
    getMentionNotificationsForCurrentUser(40, false),
  ]);
  const eventsById = Object.fromEntries(events.map((event) => [event.id, event])) as Record<string, EventRecord>;

  const items = sortReminderItems([
    ...buildLeadReminders(leads, profiles),
    ...buildTaskReminders({ tasks, eventsById, clientsById, profiles }),
    ...buildPreEventReminders(preEvents, clientsById),
    ...buildEventReminders({ events, clientsById, checklistItems, assignments, inventoryRequirements }),
    ...mentionNotifications.map((notification) => createReminder({
      id: `mention-${notification.id}`,
      channel: 'mention',
      area: 'communication',
      timing: 'today',
      severity: 'medium',
      title: `Te mencionaron en ${MENTION_ENTITY_LABELS[notification.entity_type]}`,
      description: 'Revisa el comentario y responde si hace falta para mantener coordinación del equipo.',
      entityLabel: `${MENTION_ENTITY_LABELS[notification.entity_type]} #${notification.entity_id.slice(0, 8)}`,
      href: notification.href,
      dueAt: notification.created_at,
      responsibleLabel: null,
      tags: ['@mención', MENTION_ENTITY_LABELS[notification.entity_type]],
      mentionNotificationId: notification.id,
      isRead: notification.is_read,
    })),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    items,
    topItems: items.slice(0, 8),
    summary: buildSummary(items),
  };
}
