import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { LeadProfileOption } from '@/types/leads';
import type { ClientRecord } from '@/types/clients';

async function getProfilesMap(ids: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || ids.length === 0) return {} as Record<string, LeadProfileOption>;

  const uniqueIds = [...new Set(ids)];
  const { data } = await supabase.from('profiles').select('id, full_name, role, is_active').in('id', uniqueIds);

  return Object.fromEntries((data ?? []).map((profile) => [profile.id, profile as LeadProfileOption])) as Record<string, LeadProfileOption>;
}

export async function getClientByLeadId(leadId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('clients').select('*').eq('lead_id', leadId).maybeSingle();
  return (data as ClientRecord | null) ?? null;
}

export async function getClientById(clientId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
  return (data as ClientRecord | null) ?? null;
}

export async function getClientDetailPageData(clientId: string) {
  const client = await getClientById(clientId);
  if (!client) {
    notFound();
  }

  const profileMap = await getProfilesMap([client.created_by, client.updated_by]);

  return { client, profileMap };
}
