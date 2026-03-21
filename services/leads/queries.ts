import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionContext } from '@/services/auth/session';
import type { LeadActivityRecord, LeadProfileOption, LeadRecord } from '@/types/leads';

interface LeadSummary {
  total: number;
  pendientes: number;
  seguimientoHoy: number;
  altaPrioridad: number;
}

function startOfTodayIso() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

async function getProfilesMap(ids: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || ids.length === 0) return {} as Record<string, LeadProfileOption>;

  const uniqueIds = [...new Set(ids)];
  const { data } = await supabase.from('profiles').select('id, full_name, role, is_active').in('id', uniqueIds);

  return Object.fromEntries((data ?? []).map((profile) => [profile.id, profile as LeadProfileOption])) as Record<string, LeadProfileOption>;
}

export async function getLeadsPageData() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      leads: [] as LeadRecord[],
      summary: { total: 0, pendientes: 0, seguimientoHoy: 0, altaPrioridad: 0 } satisfies LeadSummary,
      profiles: {} as Record<string, LeadProfileOption>,
    };
  }

  const { data } = await supabase
    .from('leads')
    .select('*')
    .order('follow_up_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  const leads = (data ?? []) as LeadRecord[];
  const profiles = await getProfilesMap(
    leads.flatMap((lead) => [lead.responsible_profile_id, lead.created_by, lead.updated_by].filter(Boolean) as string[]),
  );

  const today = startOfTodayIso();

  return {
    leads,
    profiles,
    summary: {
      total: leads.length,
      pendientes: leads.filter((lead) => !['ganado', 'perdido'].includes(lead.status)).length,
      seguimientoHoy: leads.filter((lead) => Boolean(lead.follow_up_at) && (lead.follow_up_at as string) >= today).length,
      altaPrioridad: leads.filter((lead) => ['alta', 'urgente'].includes(lead.priority)).length,
    } satisfies LeadSummary,
  };
}

export async function getLeadById(leadId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();
  return (data as LeadRecord | null) ?? null;
}

export async function getLeadDetailPageData(leadId: string) {
  const [lead, activities, profiles] = await Promise.all([
    getLeadById(leadId),
    getLeadActivities(leadId),
    getAssignableProfiles(),
  ]);

  if (!lead) {
    notFound();
  }

  const profileIds = [lead.responsible_profile_id, lead.created_by, lead.updated_by, ...activities.map((item) => item.created_by)]
    .filter(Boolean) as string[];

  const profileMap = await getProfilesMap([...profileIds, ...profiles.map((profile) => profile.id)]);

  return {
    lead,
    activities,
    profiles,
    profileMap,
  };
}

export async function getLeadActivities(leadId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as LeadActivityRecord[];

  const { data } = await supabase
    .from('lead_activities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  return (data ?? []) as LeadActivityRecord[];
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

export async function getLeadFormPageData(leadId?: string) {
  const [session, profiles, lead] = await Promise.all([
    getSessionContext(),
    getAssignableProfiles(),
    leadId ? getLeadById(leadId) : Promise.resolve(null),
  ]);

  if (leadId && !lead) {
    notFound();
  }

  return {
    session,
    profiles,
    lead,
  };
}
