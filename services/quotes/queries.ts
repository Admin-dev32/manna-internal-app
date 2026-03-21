import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getClientByLeadId } from '@/services/clients/queries';
import { getLeadById } from '@/services/leads/queries';
import { getPreEventByQuoteId } from '@/services/pre-events/queries';
import type { LeadProfileOption } from '@/types/leads';
import type { QuoteLeadSummary, QuoteRecord } from '@/types/quotes';

async function getProfilesMap(ids: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || ids.length === 0) return {} as Record<string, LeadProfileOption>;

  const uniqueIds = [...new Set(ids)];
  const { data } = await supabase.from('profiles').select('id, full_name, role, is_active').in('id', uniqueIds);

  return Object.fromEntries((data ?? []).map((profile) => [profile.id, profile as LeadProfileOption])) as Record<string, LeadProfileOption>;
}

async function getLeadSummaries(ids: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || ids.length === 0) return {} as Record<string, QuoteLeadSummary>;

  const uniqueIds = [...new Set(ids)];
  const { data } = await supabase.from('leads').select('id, full_name, status, quoted_total').in('id', uniqueIds);

  return Object.fromEntries((data ?? []).map((lead) => [lead.id, lead as QuoteLeadSummary])) as Record<string, QuoteLeadSummary>;
}

export async function getQuotesByLeadId(leadId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as QuoteRecord[];

  const { data } = await supabase.from('quotes').select('*').eq('lead_id', leadId).order('created_at', { ascending: false });
  return (data ?? []) as QuoteRecord[];
}

export async function getQuoteById(quoteId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle();
  return (data as QuoteRecord | null) ?? null;
}

export async function getQuoteCreatePageData(leadId: string) {
  const [lead, quotes] = await Promise.all([getLeadById(leadId), getQuotesByLeadId(leadId)]);

  if (!lead) {
    notFound();
  }

  return { lead, quotes };
}

export async function getQuoteEditPageData(quoteId: string) {
  const quote = await getQuoteById(quoteId);
  if (!quote) {
    notFound();
  }

  const lead = await getLeadById(quote.lead_id);
  if (!lead) {
    notFound();
  }

  return { quote, lead };
}

export async function getQuoteDetailPageData(quoteId: string) {
  const quote = await getQuoteById(quoteId);
  if (!quote) {
    notFound();
  }

  const [leadMap, profileMap] = await Promise.all([
    getLeadSummaries([quote.lead_id]),
    getProfilesMap([quote.created_by, quote.updated_by]),
  ]);

  const lead = leadMap[quote.lead_id];
  if (!lead) {
    notFound();
  }

  const [client, preEvent] = await Promise.all([getClientByLeadId(quote.lead_id), getPreEventByQuoteId(quote.id)]);

  return {
    quote,
    lead,
    client,
    preEvent,
    profileMap,
  };
}

export async function getQuotesOverviewPageData() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      quotes: [] as QuoteRecord[],
      leads: {} as Record<string, QuoteLeadSummary>,
      profiles: {} as Record<string, LeadProfileOption>,
    };
  }

  const { data } = await supabase.from('quotes').select('*').order('created_at', { ascending: false }).limit(25);
  const quotes = (data ?? []) as QuoteRecord[];

  const [leads, profiles] = await Promise.all([
    getLeadSummaries(quotes.map((quote) => quote.lead_id)),
    getProfilesMap(quotes.flatMap((quote) => [quote.created_by, quote.updated_by])),
  ]);

  return { quotes, leads, profiles };
}
