import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getClientById } from '@/services/clients/queries';
import { getQuoteFinancialSummary } from '@/services/finance/queries';
import { getLeadById } from '@/services/leads/queries';
import { getEventInventorySectionData } from '@/services/inventory/queries';
import { getEventBarMasterTemplatePanelData } from '@/services/bar-master-templates/queries';
import { getPreEventById } from '@/services/pre-events/queries';
import { getEventOperationalTemplatePanelData } from '@/services/operational-templates/queries';
import { getRecurringTaskRulesByEventId } from '@/services/tasks/recurring';
import type { EventCalendarSyncRecord } from '@/types/calendar';
import type { ClientRecord } from '@/types/clients';
import type { EmployeeEventReportRecord, EmployeeReportEvidenceRecord } from '@/types/employees';
import { EVENT_ASSIGNMENT_ROLES, EVENT_TASK_PRIORITIES } from '@/types/events';
import type {
  EventChecklistItemRecord,
  EventChecklistProgress,
  EventRecord,
  EventStaffAssignmentRecord,
  EventStatus,
  EventTaskRecord,
} from '@/types/events';
import type { LeadProfileOption } from '@/types/leads';
import type {
  BarMasterTemplateApplicationRecord,
  BarMasterTemplateRecord,
  EventInventoryCloseoutStateRecord,
  EventInventoryExecutionStateRecord,
  EventInventoryRequirementRecord,
  InventoryAvailabilitySummary,
  InventoryItemRecord,
  InventoryStockMovementView,
} from '@/types/inventory';
import type { QuoteRecord } from '@/types/quotes';
import type { EventOperationalTemplateApplicationRecord } from '@/types/operational-templates';

export type EventOperationalHubStatus = 'pendiente' | 'listo_para_operar' | 'en_preparacion' | 'en_servicio' | 'cerrado' | 'con_incidencias';

export interface EventOperationalSignal {
  key: string;
  level: 'info' | 'warning' | 'critical' | 'success';
  message: string;
}

async function getProfilesMap(ids: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || ids.length === 0) return {} as Record<string, LeadProfileOption>;

  const uniqueIds = [...new Set(ids)];
  const { data } = await supabase.from('profiles').select('id, full_name, role, is_active').in('id', uniqueIds);

  return Object.fromEntries((data ?? []).map((profile) => [profile.id, profile as LeadProfileOption])) as Record<string, LeadProfileOption>;
}

async function getQuoteRecordById(quoteId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle();
  return (data as QuoteRecord | null) ?? null;
}

function computeChecklistProgress(items: EventChecklistItemRecord[]): EventChecklistProgress {
  const completed = items.filter((item) => item.is_completed).length;
  const total = items.length;

  return {
    total,
    completed,
    pending: Math.max(total - completed, 0),
  };
}

export async function getEventById(eventId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
  return (data as EventRecord | null) ?? null;
}


export async function getEventByQuoteId(quoteId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('events').select('*').eq('source_quote_id', quoteId).maybeSingle();
  return (data as EventRecord | null) ?? null;
}

export async function getEventByPreEventId(preEventId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('events').select('*').eq('source_pre_event_id', preEventId).maybeSingle();
  return (data as EventRecord | null) ?? null;
}

export async function getEventCalendarSyncByEventId(eventId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('event_calendar_syncs')
    .select('*')
    .eq('source_record_type', 'event')
    .eq('source_record_id', eventId)
    .maybeSingle();

  return (data as EventCalendarSyncRecord | null) ?? null;
}

export async function getEventChecklistItems(eventId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as EventChecklistItemRecord[];

  const { data } = await supabase
    .from('event_checklist_items')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true });

  return (data ?? []) as EventChecklistItemRecord[];
}

const EVENT_ASSIGNMENT_ROLE_SORT_ORDER = Object.fromEntries(EVENT_ASSIGNMENT_ROLES.map((role, index) => [role, index])) as Record<
  (typeof EVENT_ASSIGNMENT_ROLES)[number],
  number
>;
const EVENT_TASK_PRIORITY_SORT_ORDER = Object.fromEntries(EVENT_TASK_PRIORITIES.map((priority, index) => [priority, index])) as Record<
  (typeof EVENT_TASK_PRIORITIES)[number],
  number
>;

export async function getEventStaffAssignments(eventId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as EventStaffAssignmentRecord[];

  const { data } = await supabase
    .from('event_staff_assignments')
    .select('*')
    .eq('event_id', eventId)
    .order('assignment_role', { ascending: true })
    .order('created_at', { ascending: true });

  return ((data ?? []) as EventStaffAssignmentRecord[]).sort((left, right) => {
    const roleDiff = EVENT_ASSIGNMENT_ROLE_SORT_ORDER[left.assignment_role] - EVENT_ASSIGNMENT_ROLE_SORT_ORDER[right.assignment_role];
    if (roleDiff !== 0) {
      return roleDiff;
    }

    return left.created_at.localeCompare(right.created_at);
  });
}

export async function getEventTasks(eventId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as EventTaskRecord[];

  const { data } = await supabase
    .from('event_tasks')
    .select('*')
    .eq('event_id', eventId)
    .order('status', { ascending: true })
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  return ((data ?? []) as EventTaskRecord[]).sort((left, right) => {
    if (left.status === 'completada' && right.status !== 'completada') {
      return 1;
    }

    if (left.status !== 'completada' && right.status === 'completada') {
      return -1;
    }

    const priorityDiff = EVENT_TASK_PRIORITY_SORT_ORDER[right.priority] - EVENT_TASK_PRIORITY_SORT_ORDER[left.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    if (left.due_at && right.due_at) {
      return left.due_at.localeCompare(right.due_at);
    }

    if (left.due_at) {
      return -1;
    }

    if (right.due_at) {
      return 1;
    }

    return left.created_at.localeCompare(right.created_at);
  });
}

export async function getAssignableProfiles() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as LeadProfileOption[];

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active')
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  return (data ?? []) as LeadProfileOption[];
}

export async function getEventDetailPageData(eventId: string) {
  const event = await getEventById(eventId);
  if (!event) {
    notFound();
    return;
  }
  const currentEvent = event;

  const [client, lead, preEvent, quote, checklistItems, assignments, tasks, recurringTaskRules, inventorySection, barMasterTemplateSection, templateSection, assignableProfiles, financeSummary, calendarSync, employeeReportsRaw, availabilityRowsRaw] = await Promise.all([
    getClientById(currentEvent.client_id),
    currentEvent.lead_id ? getLeadById(currentEvent.lead_id) : Promise.resolve(null),
    getPreEventById(currentEvent.source_pre_event_id),
    getQuoteRecordById(currentEvent.source_quote_id),
    getEventChecklistItems(currentEvent.id),
    getEventStaffAssignments(currentEvent.id),
    getEventTasks(currentEvent.id),
    getRecurringTaskRulesByEventId(currentEvent.id),
    getEventInventorySectionData(currentEvent.id),
    getEventBarMasterTemplatePanelData(currentEvent.id),
    getEventOperationalTemplatePanelData(currentEvent),
    getAssignableProfiles(),
    getQuoteFinancialSummary(currentEvent.source_quote_id),
    getEventCalendarSyncByEventId(currentEvent.id),
    createSupabaseServerClient().then(async (supabase) => {
      if (!supabase) return [] as EmployeeEventReportRecord[];
      const { data } = await supabase
        .from('employee_event_reports')
        .select('*')
        .eq('event_id', currentEvent.id)
        .order('created_at', { ascending: false })
        .limit(40);
      return (data ?? []) as EmployeeEventReportRecord[];
    }),
    createSupabaseServerClient().then(async (supabase) => {
      if (!supabase) return [] as Array<{ profile_id: string; reason: string; created_at: string; availability_status: string }>;
      const { data } = await supabase
        .from('employee_assignment_availability')
        .select('profile_id, reason, created_at, availability_status')
        .eq('event_id', currentEvent.id)
        .order('created_at', { ascending: false });
      return (data ?? []) as Array<{ profile_id: string; reason: string; created_at: string; availability_status: string }>;
    }),
  ]);

  if (!client || !preEvent || !quote) {
    notFound();
    return;
  }

  const profileIds = [
    currentEvent.created_by,
    currentEvent.updated_by,
    ...assignments.map((assignment) => assignment.profile_id),
    ...assignments.map((assignment) => assignment.created_by),
    ...assignments.map((assignment) => assignment.updated_by),
    ...tasks.map((task) => task.assigned_profile_id),
    ...tasks.map((task) => task.created_by),
    ...tasks.map((task) => task.updated_by),
    ...recurringTaskRules.map((rule) => rule.assigned_profile_id),
    ...recurringTaskRules.map((rule) => rule.created_by),
    ...recurringTaskRules.map((rule) => rule.updated_by),
    ...inventorySection.inventoryItems.map((item) => item.created_by),
    ...inventorySection.inventoryItems.map((item) => item.updated_by),
    ...inventorySection.requirements.map((requirement) => requirement.checked_by),
    ...inventorySection.requirements.map((requirement) => requirement.updated_by),
    ...Object.values(inventorySection.executionStateByRequirement).flatMap((state) => [state.shopping_updated_by, state.picking_updated_by]),
    ...Object.values(inventorySection.closeoutStateByRequirement).flatMap((state) => [state.closed_by, state.reviewed_by]),
    ...inventorySection.recentMovements.map((movement) => movement.created_by),
    ...inventorySection.recentMovements.map((movement) => movement.approved_by),
    ...barMasterTemplateSection.applications.map((application) => application.applied_by),
  ].filter((value): value is string => Boolean(value));

  const profiles = await getProfilesMap(profileIds);

  const assignedProfileIds = new Set(assignments.map((assignment) => assignment.profile_id));
  const availableProfiles = assignableProfiles.filter((profile) => !assignedProfileIds.has(profile.id));

  const supabase = await createSupabaseServerClient();
  const reportIds = employeeReportsRaw.map((report) => report.id);
  const evidenceRows = supabase && reportIds.length > 0
    ? await supabase.from('employee_report_evidences').select('*').in('report_id', reportIds).order('created_at', { ascending: false })
    : { data: [] };

  const evidenceByReport = ((evidenceRows.data ?? []) as EmployeeReportEvidenceRecord[]).reduce<
    Record<string, Array<EmployeeReportEvidenceRecord & { signed_url: string | null }>>
  >((acc, row) => {
    if (!acc[row.report_id]) acc[row.report_id] = [];
    acc[row.report_id].push({ ...row, signed_url: null });
    return acc;
  }, {});

  if (supabase) {
    for (const [reportId, rows] of Object.entries(evidenceByReport)) {
      evidenceByReport[reportId] = await Promise.all(
        rows.map(async (row) => {
          const signed = await supabase.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 60 * 60 * 8);
          return { ...row, signed_url: signed.data?.signedUrl ?? null };
        }),
      );
    }
  }

  const unavailableProfileIds = new Set(
    availabilityRowsRaw.filter((item) => item.availability_status === 'unavailable_reported').map((item) => item.profile_id),
  );
  const confirmedAssignments = assignments.filter((assignment) => assignment.assignment_status === 'confirmado').length;
  const pendingAssignments = assignments.length - confirmedAssignments;
  const hasCalendarFinal = Boolean(calendarSync?.external_event_id) && calendarSync?.sync_status !== 'error';
  const pendingReportReviews = employeeReportsRaw.filter((report) => report.review_status !== 'bonus_liberado' && report.review_status !== 'aprobado').length;
  const hasCriticalRisk = unavailableProfileIds.size > 0 || confirmedAssignments === 0 || !hasCalendarFinal;

  let operationalHubStatus: EventOperationalHubStatus = 'pendiente';
  if (currentEvent.status === 'completado' || currentEvent.status === 'cancelado') {
    operationalHubStatus = 'cerrado';
  } else if (hasCriticalRisk) {
    operationalHubStatus = 'con_incidencias';
  } else if (currentEvent.status === 'en_preparacion') {
    operationalHubStatus = 'en_preparacion';
  } else if (currentEvent.status === 'confirmado' && confirmedAssignments > 0 && hasCalendarFinal) {
    operationalHubStatus = 'listo_para_operar';
  } else if (currentEvent.status === 'confirmado' && employeeReportsRaw.length > 0) {
    operationalHubStatus = 'en_servicio';
  }

  const operationalSignals: EventOperationalSignal[] = [
    !hasCalendarFinal
      ? { key: 'calendar_missing', level: 'critical', message: 'Sin calendar sync final activo en Google Calendar.' }
      : { key: 'calendar_ok', level: 'success', message: 'Calendar sync final activo en Google Calendar.' },
    assignments.length === 0
      ? { key: 'staff_none', level: 'critical', message: 'Evento sin staff asignado.' }
      : pendingAssignments > 0
        ? { key: 'staff_pending', level: 'warning', message: `${pendingAssignments} asignaciones pendientes de confirmar.` }
        : { key: 'staff_ok', level: 'success', message: 'Cobertura de staff confirmada.' },
    unavailableProfileIds.size > 0
      ? { key: 'unavailable', level: 'warning', message: `${unavailableProfileIds.size} integrante(s) avisó inasistencia.` }
      : { key: 'unavailable_ok', level: 'info', message: 'Sin avisos de inasistencia registrados.' },
    employeeReportsRaw.length === 0
      ? { key: 'reports_none', level: 'warning', message: 'Aún no hay reportes de ejecución del staff.' }
      : pendingReportReviews > 0
        ? { key: 'reports_review', level: 'info', message: `${pendingReportReviews} reporte(s) pendiente(s) de revisión.` }
        : { key: 'reports_ok', level: 'success', message: 'Reportes recientes revisados o con bonus liberado.' },
  ];

  return {
    event: currentEvent,
    client,
    lead,
    preEvent,
    quote,
    checklistItems,
    checklistProgress: computeChecklistProgress(checklistItems),
    assignments,
    tasks,
    recurringTaskRules,
    inventoryItems: inventorySection.inventoryItems as InventoryItemRecord[],
    inventoryRequirements: inventorySection.requirements as EventInventoryRequirementRecord[],
    inventoryExecutionStateByRequirement: inventorySection.executionStateByRequirement as Record<string, EventInventoryExecutionStateRecord>,
    inventoryCloseoutStateByRequirement: inventorySection.closeoutStateByRequirement as Record<string, EventInventoryCloseoutStateRecord>,
    inventoryAvailabilityByItem: inventorySection.availabilityByItem as Record<string, InventoryAvailabilitySummary>,
    inventoryRecentMovements: inventorySection.recentMovements as InventoryStockMovementView[],
    barMasterTemplates: barMasterTemplateSection.templates as BarMasterTemplateRecord[],
    barMasterTemplateApplications: barMasterTemplateSection.applications as BarMasterTemplateApplicationRecord[],
    applicableOperationalTemplates: templateSection.applicableTemplates,
    operationalTemplateApplications: templateSection.applications as EventOperationalTemplateApplicationRecord[],
    operationalTemplateProfiles: templateSection.profiles,
    assignableProfiles: availableProfiles,
    profiles,
    financeSummary,
    calendarSync,
    operationalHubStatus,
    operationalSignals,
    employeeReports: employeeReportsRaw,
    reportEvidencesByReport: evidenceByReport,
    availabilityRows: availabilityRowsRaw,
  };
}

export async function getEventsOverviewPageData(filters?: { status?: string; from?: string; to?: string }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      events: [] as EventRecord[],
      clients: {} as Record<string, ClientRecord>,
      quotes: {} as Record<string, Pick<QuoteRecord, 'id' | 'status'>>,
      checklistProgressByEvent: {} as Record<string, EventChecklistProgress>,
    };
  }

  let query = supabase.from('events').select('*').order('event_date', { ascending: true }).order('event_time', { ascending: true }).limit(60);

  if (filters?.status && filters.status !== 'todos') {
    query = query.eq('status', filters.status as EventStatus);
  }

  if (filters?.from) {
    query = query.gte('event_date', filters.from);
  }

  if (filters?.to) {
    query = query.lte('event_date', filters.to);
  }

  const { data } = await query;
  const events = (data ?? []) as EventRecord[];

  if (events.length === 0) {
    return {
      events,
      clients: {} as Record<string, ClientRecord>,
      quotes: {} as Record<string, Pick<QuoteRecord, 'id' | 'status'>>,
      checklistProgressByEvent: {} as Record<string, EventChecklistProgress>,
    };
  }

  const clientIds = [...new Set(events.map((event) => event.client_id))];
  const quoteIds = [...new Set(events.map((event) => event.source_quote_id))];
  const eventIds = [...new Set(events.map((event) => event.id))];

  const [{ data: clientsData }, { data: quotesData }, { data: checklistData }] = await Promise.all([
    supabase.from('clients').select('*').in('id', clientIds),
    supabase.from('quotes').select('id, status').in('id', quoteIds),
    supabase.from('event_checklist_items').select('event_id, is_completed').in('event_id', eventIds),
  ]);

  const checklistProgressByEvent = Object.fromEntries(
    eventIds.map((eventId) => {
      const items = ((checklistData ?? []) as Array<Pick<EventChecklistItemRecord, 'event_id' | 'is_completed'>>).filter((item) => item.event_id === eventId);
      const total = items.length;
      const completed = items.filter((item) => item.is_completed).length;

      return [
        eventId,
        {
          total,
          completed,
          pending: Math.max(total - completed, 0),
        } satisfies EventChecklistProgress,
      ];
    }),
  ) as Record<string, EventChecklistProgress>;

  return {
    events,
    clients: Object.fromEntries(((clientsData ?? []) as ClientRecord[]).map((client) => [client.id, client])),
    quotes: Object.fromEntries((((quotesData ?? []) as Array<Pick<QuoteRecord, 'id' | 'status'>>).map((quote) => [quote.id, quote]))) as Record<
      string,
      Pick<QuoteRecord, 'id' | 'status'>
    >,
    checklistProgressByEvent,
  };
}
