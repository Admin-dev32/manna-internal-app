import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ClientRecord } from '@/types/clients';
import { EVENT_TASK_PRIORITIES } from '@/types/events';
import type { EventRecord, EventTaskRecord } from '@/types/events';
import type { LeadProfileOption } from '@/types/leads';

async function getProfilesMap(ids: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || ids.length === 0) return {} as Record<string, LeadProfileOption>;

  const uniqueIds = [...new Set(ids)];
  const { data } = await supabase.from('profiles').select('id, full_name, role, is_active').in('id', uniqueIds);

  return Object.fromEntries((data ?? []).map((profile) => [profile.id, profile as LeadProfileOption])) as Record<string, LeadProfileOption>;
}

const EVENT_TASK_PRIORITY_SORT_ORDER = Object.fromEntries(EVENT_TASK_PRIORITIES.map((priority, index) => [priority, index])) as Record<(typeof EVENT_TASK_PRIORITIES)[number], number>;

export async function getTasksOverviewPageData() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      tasks: [] as EventTaskRecord[],
      events: {} as Record<string, EventRecord>,
      clients: {} as Record<string, ClientRecord>,
      profiles: {} as Record<string, LeadProfileOption>,
    };
  }

  const { data } = await supabase
    .from('tasks_catalog')
    .select('*')
    .eq('source_type', 'event')
    .order('status', { ascending: true })
    .order('priority', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(80);

  const tasks = ((data ?? []) as EventTaskRecord[]).sort((left, right) => {
    if (left.status === 'completada' && right.status !== 'completada') return 1;
    if (left.status !== 'completada' && right.status === 'completada') return -1;

    const priorityDiff = EVENT_TASK_PRIORITY_SORT_ORDER[right.priority] - EVENT_TASK_PRIORITY_SORT_ORDER[left.priority];
    if (priorityDiff !== 0) return priorityDiff;

    if (left.due_at && right.due_at) return left.due_at.localeCompare(right.due_at);
    if (left.due_at) return -1;
    if (right.due_at) return 1;

    return right.updated_at.localeCompare(left.updated_at);
  });
  if (tasks.length === 0) {
    return {
      tasks,
      events: {} as Record<string, EventRecord>,
      clients: {} as Record<string, ClientRecord>,
      profiles: {} as Record<string, LeadProfileOption>,
    };
  }

  const eventIds = [...new Set(tasks.map((task) => task.event_id))];
  const [{ data: eventsData }, profiles] = await Promise.all([
    supabase.from('events').select('*').in('id', eventIds),
    getProfilesMap([
      ...tasks.map((task) => task.assigned_profile_id),
      ...tasks.map((task) => task.created_by),
      ...tasks.map((task) => task.updated_by),
    ]),
  ]);

  const events = Object.fromEntries(((eventsData ?? []) as EventRecord[]).map((event) => [event.id, event])) as Record<string, EventRecord>;
  const clientIds = [...new Set(Object.values(events).map((event) => event.client_id))];
  const { data: clientsData } = await supabase.from('clients').select('*').in('id', clientIds);

  return {
    tasks,
    events,
    clients: Object.fromEntries(((clientsData ?? []) as ClientRecord[]).map((client) => [client.id, client])) as Record<string, ClientRecord>,
    profiles,
  };
}
