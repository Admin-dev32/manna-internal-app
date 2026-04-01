import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { LeadProfileOption } from '@/types/leads';
import type {
  BarMasterTemplateApplicationRecord,
  BarMasterTemplateItemRecord,
  BarMasterTemplateRecord,
} from '@/types/inventory';

async function getProfilesMap(ids: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || ids.length === 0) return {} as Record<string, LeadProfileOption>;

  const uniqueIds = [...new Set(ids)];
  const { data } = await supabase.from('profiles').select('id, full_name, role, is_active').in('id', uniqueIds);

  return Object.fromEntries((data ?? []).map((profile) => [profile.id, profile as LeadProfileOption])) as Record<string, LeadProfileOption>;
}

export async function getBarMasterTemplates() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as BarMasterTemplateRecord[];

  const { data } = await supabase.from('bar_master_templates').select('*').order('is_active', { ascending: false }).order('name', { ascending: true });
  return (data ?? []) as BarMasterTemplateRecord[];
}

export async function getBarMasterTemplateItems() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as BarMasterTemplateItemRecord[];

  const { data } = await supabase
    .from('bar_master_template_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  return (data ?? []) as BarMasterTemplateItemRecord[];
}

export async function getBarMasterTemplateApplicationsByEventId(eventId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as BarMasterTemplateApplicationRecord[];

  const { data } = await supabase
    .from('event_bar_master_template_applications')
    .select('*')
    .eq('event_id', eventId)
    .order('applied_at', { ascending: false })
    .limit(10);

  return (data ?? []) as BarMasterTemplateApplicationRecord[];
}

export async function getBarMasterTemplatesPageData() {
  const [templates, items] = await Promise.all([getBarMasterTemplates(), getBarMasterTemplateItems()]);
  const profiles = await getProfilesMap(templates.flatMap((template) => [template.created_by, template.updated_by]));

  return {
    templates,
    items,
    profiles,
  };
}

export async function getEventBarMasterTemplatePanelData(eventId: string) {
  const [templates, items, applications] = await Promise.all([
    getBarMasterTemplates(),
    getBarMasterTemplateItems(),
    getBarMasterTemplateApplicationsByEventId(eventId),
  ]);

  const profiles = await getProfilesMap(applications.map((application) => application.applied_by));

  return {
    templates: templates.filter((template) => template.is_active),
    items,
    applications,
    profiles,
  };
}
