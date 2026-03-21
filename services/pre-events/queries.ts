import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getClientById, getClientByLeadId } from '@/services/clients/queries';
import { getLeadById } from '@/services/leads/queries';
import type { ClientRecord } from '@/types/clients';
import type { LeadProfileOption } from '@/types/leads';
import type { PreEventRecord } from '@/types/pre-events';
import type { QuoteRecord } from '@/types/quotes';

async function getProfilesMap(ids: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || ids.length === 0) return {} as Record<string, LeadProfileOption>;

  const uniqueIds = [...new Set(ids)];
  const { data } = await supabase.from('profiles').select('id, full_name, role, is_active').in('id', uniqueIds);

  return Object.fromEntries((data ?? []).map((profile) => [profile.id, profile as LeadProfileOption])) as Record<string, LeadProfileOption>;
}

export async function getPreEventByQuoteId(quoteId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('pre_events').select('*').eq('source_quote_id', quoteId).maybeSingle();
  return (data as PreEventRecord | null) ?? null;
}

export async function getPreEventByClientId(clientId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('pre_events').select('*').eq('client_id', clientId).maybeSingle();
  return (data as PreEventRecord | null) ?? null;
}

export async function getPreEventById(preEventId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('pre_events').select('*').eq('id', preEventId).maybeSingle();
  return (data as PreEventRecord | null) ?? null;
}

async function getQuoteRecordById(quoteId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle();
  return (data as QuoteRecord | null) ?? null;
}

export async function getPreEventCreatePageDataFromQuote(quoteId: string) {
  const quote = await getQuoteRecordById(quoteId);
  if (!quote || quote.status !== 'aceptada') {
    notFound();
  }

  const [client, lead, existingPreEvent] = await Promise.all([
    getClientByLeadId(quote.lead_id),
    getLeadById(quote.lead_id),
    getPreEventByQuoteId(quoteId),
  ]);

  if (!client || !lead) {
    notFound();
  }

  return { client, lead, quote, existingPreEvent };
}

export async function getPreEventEditPageData(preEventId: string) {
  const preEvent = await getPreEventById(preEventId);
  if (!preEvent) {
    notFound();
  }

  const [client, lead, quote] = await Promise.all([
    getClientById(preEvent.client_id),
    preEvent.lead_id ? getLeadById(preEvent.lead_id) : Promise.resolve(null),
    getQuoteRecordById(preEvent.source_quote_id),
  ]);

  if (!client || !quote) {
    notFound();
  }

  return { client, lead, preEvent, quote };
}

export async function getPreEventDetailPageData(preEventId: string) {
  const preEvent = await getPreEventById(preEventId);
  if (!preEvent) {
    notFound();
  }

  const [client, lead, quote, profiles] = await Promise.all([
    getClientById(preEvent.client_id),
    preEvent.lead_id ? getLeadById(preEvent.lead_id) : Promise.resolve(null),
    getQuoteRecordById(preEvent.source_quote_id),
    getProfilesMap([preEvent.created_by, preEvent.updated_by]),
  ]);

  if (!client || !quote) {
    notFound();
  }

  return { client, lead, preEvent, profiles, quote };
}

export async function getPreEventsOverviewPageData() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      preEvents: [] as PreEventRecord[],
      clients: {} as Record<string, ClientRecord>,
      quotes: {} as Record<string, Pick<QuoteRecord, 'id' | 'status'>>,
    };
  }

  const { data } = await supabase.from('pre_events').select('*').order('updated_at', { ascending: false }).limit(25);
  const preEvents = (data ?? []) as PreEventRecord[];

  if (preEvents.length === 0) {
    return {
      preEvents,
      clients: {} as Record<string, ClientRecord>,
      quotes: {} as Record<string, Pick<QuoteRecord, 'id' | 'status'>>,
    };
  }

  const clientIds = [...new Set(preEvents.map((preEvent) => preEvent.client_id))];
  const quoteIds = [...new Set(preEvents.map((preEvent) => preEvent.source_quote_id))];

  const [{ data: clientsData }, { data: quotesData }] = await Promise.all([
    supabase.from('clients').select('*').in('id', clientIds),
    supabase.from('quotes').select('id, status').in('id', quoteIds),
  ]);

  return {
    preEvents,
    clients: Object.fromEntries(((clientsData ?? []) as ClientRecord[]).map((client) => [client.id, client])),
    quotes: Object.fromEntries(
      (((quotesData ?? []) as Array<Pick<QuoteRecord, 'id' | 'status'>>).map((quote) => [quote.id, quote])),
    ) as Record<string, Pick<QuoteRecord, 'id' | 'status'>>,
  };
}
