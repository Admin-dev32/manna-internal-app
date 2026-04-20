import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { InternalTicketRecord, InternalTicketView } from '@/types/internal-tickets';

async function getProfileNames(profileIds: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || profileIds.length === 0) return {} as Record<string, string | null>;

  const uniqueIds = [...new Set(profileIds)];
  const { data } = await supabase.from('profiles').select('id, full_name').in('id', uniqueIds);
  return Object.fromEntries(((data ?? []) as Array<{ id: string; full_name: string | null }>).map((row) => [row.id, row.full_name])) as Record<string, string | null>;
}

async function getEventLabels(eventIds: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || eventIds.length === 0) return {} as Record<string, string>;

  const uniqueIds = [...new Set(eventIds)];
  const { data } = await supabase.from('events').select('id, event_type, event_date').in('id', uniqueIds);
  return Object.fromEntries(
    ((data ?? []) as Array<{ id: string; event_type: string | null; event_date: string }>).map((event) => [event.id, `${event.event_type ?? 'Evento'} · ${event.event_date}`]),
  ) as Record<string, string>;
}

function hydrateTickets(rows: InternalTicketRecord[], profileNames: Record<string, string | null>, eventLabels: Record<string, string>): InternalTicketView[] {
  return rows.map((ticket) => ({
    ...ticket,
    created_by_name: profileNames[ticket.created_by] ?? null,
    assigned_to_name: ticket.assigned_to ? (profileNames[ticket.assigned_to] ?? null) : null,
    closed_by_name: ticket.closed_by ? (profileNames[ticket.closed_by] ?? null) : null,
    event_label: ticket.event_id ? (eventLabels[ticket.event_id] ?? null) : null,
  }));
}

export async function getMyInternalTickets(profileId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as InternalTicketView[];

  const { data } = await supabase
    .from('internal_tickets')
    .select('*')
    .eq('created_by', profileId)
    .order('created_at', { ascending: false })
    .limit(24);

  const tickets = (data ?? []) as InternalTicketRecord[];
  const profileIds = tickets.flatMap((ticket) => [ticket.created_by, ticket.assigned_to, ticket.closed_by]).filter((value): value is string => Boolean(value));
  const eventIds = tickets.map((ticket) => ticket.event_id).filter((value): value is string => Boolean(value));
  const [profileNames, eventLabels] = await Promise.all([getProfileNames(profileIds), getEventLabels(eventIds)]);

  return hydrateTickets(tickets, profileNames, eventLabels);
}

export async function getMainOfficeTickets(filters?: { status?: string }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as InternalTicketView[];

  let query = supabase.from('internal_tickets').select('*').order('created_at', { ascending: false }).limit(120);
  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  const { data } = await query;
  const tickets = (data ?? []) as InternalTicketRecord[];
  const profileIds = tickets.flatMap((ticket) => [ticket.created_by, ticket.assigned_to, ticket.closed_by]).filter((value): value is string => Boolean(value));
  const eventIds = tickets.map((ticket) => ticket.event_id).filter((value): value is string => Boolean(value));
  const [profileNames, eventLabels] = await Promise.all([getProfileNames(profileIds), getEventLabels(eventIds)]);

  return hydrateTickets(tickets, profileNames, eventLabels);
}
