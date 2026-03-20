import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getClientById, getClientByLeadId } from '@/services/clients/queries';
import { getLeadById } from '@/services/leads/queries';
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
