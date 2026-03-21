import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getClientById } from '@/services/clients/queries';
import { getQuoteFinancialSummary } from '@/services/finance/queries';
import { getLeadById } from '@/services/leads/queries';
import { getPreEventById } from '@/services/pre-events/queries';
import type { ClientRecord } from '@/types/clients';
import type { EventRecord } from '@/types/events';
import type { LeadProfileOption } from '@/types/leads';
import type { QuoteRecord } from '@/types/quotes';

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

export async function getEventDetailPageData(eventId: string) {
  const event = await getEventById(eventId);
  if (!event) {
    notFound();
  }

  const [client, lead, preEvent, quote, profiles, financeSummary] = await Promise.all([
    getClientById(event.client_id),
    event.lead_id ? getLeadById(event.lead_id) : Promise.resolve(null),
    getPreEventById(event.source_pre_event_id),
    getQuoteRecordById(event.source_quote_id),
    getProfilesMap([event.created_by, event.updated_by]),
    getQuoteFinancialSummary(event.source_quote_id),
  ]);

  if (!client || !preEvent || !quote) {
    notFound();
  }

  return { event, client, lead, preEvent, quote, profiles, financeSummary };
}

export async function getEventsOverviewPageData() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      events: [] as EventRecord[],
      clients: {} as Record<string, ClientRecord>,
      quotes: {} as Record<string, Pick<QuoteRecord, 'id' | 'status'>>,
    };
  }

  const { data } = await supabase.from('events').select('*').order('event_date', { ascending: true }).limit(25);
  const events = (data ?? []) as EventRecord[];

  if (events.length === 0) {
    return {
      events,
      clients: {} as Record<string, ClientRecord>,
      quotes: {} as Record<string, Pick<QuoteRecord, 'id' | 'status'>>,
    };
  }

  const clientIds = [...new Set(events.map((event) => event.client_id))];
  const quoteIds = [...new Set(events.map((event) => event.source_quote_id))];

  const [{ data: clientsData }, { data: quotesData }] = await Promise.all([
    supabase.from('clients').select('*').in('id', clientIds),
    supabase.from('quotes').select('id, status').in('id', quoteIds),
  ]);

  return {
    events,
    clients: Object.fromEntries(((clientsData ?? []) as ClientRecord[]).map((client) => [client.id, client])),
    quotes: Object.fromEntries((((quotesData ?? []) as Array<Pick<QuoteRecord, 'id' | 'status'>>).map((quote) => [quote.id, quote]))) as Record<
      string,
      Pick<QuoteRecord, 'id' | 'status'>
    >,
  };
}
