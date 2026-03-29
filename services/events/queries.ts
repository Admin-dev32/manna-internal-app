import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getClientById } from '@/services/clients/queries';
import { getQuoteFinancialSummary } from '@/services/finance/queries';
import { getLeadById } from '@/services/leads/queries';
import { getEventInventorySectionData } from '@/services/inventory/queries';
import { getPreEventById } from '@/services/pre-events/queries';
import { getEventOperationalTemplatePanelData } from '@/services/operational-templates/queries';
import type { ClientRecord } from '@/types/clients';
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
import type { EventInventoryRequirementRecord, InventoryAvailabilitySummary, InventoryItemRecord } from '@/types/inventory';
import type { QuoteRecord } from '@/types/quotes';
import type { EventOperationalTemplateApplicationRecord } from '@/types/operational-templates';

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

export async function getEventByPreEventId(preEventId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('events').select('*').eq('source_pre_event_id', preEventId).maybeSingle();
  return (data as EventRecord | null) ?? null;
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

  const [client, lead, preEvent, quote, checklistItems, assignments, tasks, inventorySection, templateSection, assignableProfiles, financeSummary] = await Promise.all([
    getClientById(currentEvent.client_id),
    currentEvent.lead_id ? getLeadById(currentEvent.lead_id) : Promise.resolve(null),
    getPreEventById(currentEvent.source_pre_event_id),
    getQuoteRecordById(currentEvent.source_quote_id),
    getEventChecklistItems(currentEvent.id),
    getEventStaffAssignments(currentEvent.id),
    getEventTasks(currentEvent.id),
    getEventInventorySectionData(currentEvent.id),
    getEventOperationalTemplatePanelData(currentEvent),
    getAssignableProfiles(),
    getQuoteFinancialSummary(currentEvent.source_quote_id),
  ]);

  if (!client || !preEvent || !quote) {
    notFound();
    return;
  }

  const profiles = await getProfilesMap([
    currentEvent.created_by,
    currentEvent.updated_by,
    ...assignments.map((assignment) => assignment.profile_id),
    ...assignments.map((assignment) => assignment.created_by),
    ...assignments.map((assignment) => assignment.updated_by),
    ...tasks.map((task) => task.assigned_profile_id),
    ...tasks.map((task) => task.created_by),
    ...tasks.map((task) => task.updated_by),
    ...inventorySection.inventoryItems.map((item) => item.created_by),
    ...inventorySection.inventoryItems.map((item) => item.updated_by),
  ]);

  const assignedProfileIds = new Set(assignments.map((assignment) => assignment.profile_id));
  const availableProfiles = assignableProfiles.filter((profile) => !assignedProfileIds.has(profile.id));

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
    inventoryItems: inventorySection.inventoryItems as InventoryItemRecord[],
    inventoryRequirements: inventorySection.requirements as EventInventoryRequirementRecord[],
    inventoryAvailabilityByItem: inventorySection.availabilityByItem as Record<string, InventoryAvailabilitySummary>,
    applicableOperationalTemplates: templateSection.applicableTemplates,
    operationalTemplateApplications: templateSection.applications as EventOperationalTemplateApplicationRecord[],
    operationalTemplateProfiles: templateSection.profiles,
    assignableProfiles: availableProfiles,
    profiles,
    financeSummary,
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
