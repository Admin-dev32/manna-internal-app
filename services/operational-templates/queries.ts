import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getInventoryItems } from '@/services/inventory/queries';
import type { EventRecord } from '@/types/events';
import type { InventoryItemRecord } from '@/types/inventory';
import type { LeadProfileOption } from '@/types/leads';
import type {
  EventOperationalTemplateApplicationRecord,
  OperationalTemplateChecklistItemRecord,
  OperationalTemplateMaterialItemRecord,
  OperationalTemplateRecord,
  OperationalTemplateTaskItemRecord,
} from '@/types/operational-templates';

async function getProfilesMap(ids: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || ids.length === 0) return {} as Record<string, LeadProfileOption>;

  const uniqueIds = [...new Set(ids)];
  const { data } = await supabase.from('profiles').select('id, full_name, role, is_active').in('id', uniqueIds);

  return Object.fromEntries((data ?? []).map((profile) => [profile.id, profile as LeadProfileOption])) as Record<string, LeadProfileOption>;
}

export async function getOperationalTemplates() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as OperationalTemplateRecord[];

  const { data } = await supabase
    .from('operational_templates')
    .select('*')
    .order('is_active', { ascending: false })
    .order('name', { ascending: true });

  return (data ?? []) as OperationalTemplateRecord[];
}

export async function getOperationalTemplateChecklistItems() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as OperationalTemplateChecklistItemRecord[];

  const { data } = await supabase
    .from('operational_template_checklist_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  return (data ?? []) as OperationalTemplateChecklistItemRecord[];
}

export async function getOperationalTemplateTaskItems() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as OperationalTemplateTaskItemRecord[];

  const { data } = await supabase
    .from('operational_template_task_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  return (data ?? []) as OperationalTemplateTaskItemRecord[];
}

export async function getOperationalTemplateMaterialItems() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as OperationalTemplateMaterialItemRecord[];

  const { data } = await supabase
    .from('operational_template_material_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  return (data ?? []) as OperationalTemplateMaterialItemRecord[];
}

export async function getOperationalTemplateApplicationsForEvent(eventId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as EventOperationalTemplateApplicationRecord[];

  const { data } = await supabase
    .from('event_operational_template_applications')
    .select('*')
    .eq('event_id', eventId)
    .order('applied_at', { ascending: false })
    .limit(10);

  return (data ?? []) as EventOperationalTemplateApplicationRecord[];
}

function normalizeEventType(value: string | null | undefined) {
  return String(value ?? '').trim().toLocaleLowerCase('es-MX');
}

export async function getApplicableOperationalTemplates(eventType: string | null | undefined) {
  const [templates, checklistItems, taskItems, materialItems] = await Promise.all([
    getOperationalTemplates(),
    getOperationalTemplateChecklistItems(),
    getOperationalTemplateTaskItems(),
    getOperationalTemplateMaterialItems(),
  ]);

  const normalizedEventType = normalizeEventType(eventType);

  return templates
    .filter((template) => template.is_active && (!template.event_type || normalizeEventType(template.event_type) === normalizedEventType))
    .sort((left, right) => {
      const leftExact = left.event_type && normalizeEventType(left.event_type) === normalizedEventType ? 0 : 1;
      const rightExact = right.event_type && normalizeEventType(right.event_type) === normalizedEventType ? 0 : 1;
      if (leftExact !== rightExact) return leftExact - rightExact;
      return left.name.localeCompare(right.name, 'es');
    })
    .map((template) => ({
      template,
      checklistItems: checklistItems.filter((item) => item.template_id === template.id),
      taskItems: taskItems.filter((item) => item.template_id === template.id),
      materialItems: materialItems.filter((item) => item.template_id === template.id),
    }));
}

export async function getOperationalTemplatesPageData() {
  const [templates, checklistItems, taskItems, materialItems, inventoryItems] = await Promise.all([
    getOperationalTemplates(),
    getOperationalTemplateChecklistItems(),
    getOperationalTemplateTaskItems(),
    getOperationalTemplateMaterialItems(),
    getInventoryItems(),
  ]);

  const profiles = await getProfilesMap(
    templates.flatMap((template) => [template.created_by, template.updated_by]),
  );

  return {
    templates,
    checklistItems,
    taskItems,
    materialItems,
    inventoryItems: inventoryItems.filter((item) => item.is_active) as InventoryItemRecord[],
    profiles,
  };
}

export async function getEventOperationalTemplatePanelData(event: Pick<EventRecord, 'id' | 'event_type'>) {
  const [applicableTemplates, applications] = await Promise.all([
    getApplicableOperationalTemplates(event.event_type),
    getOperationalTemplateApplicationsForEvent(event.id),
  ]);

  const profiles = await getProfilesMap(applications.map((application) => application.applied_by));

  return {
    applicableTemplates,
    applications,
    profiles,
  };
}
