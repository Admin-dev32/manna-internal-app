'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';

import { requireActiveSession, requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getEventById } from '@/services/events/queries';
import type { BarMasterTemplateItemRecord, BarMasterTemplateRecord } from '@/types/inventory';

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function slugifyTemplateName(value: string) {
  return value
    .toLocaleLowerCase('es-MX')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeNonNegativeNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  const numericValue = Number(normalized || '0');
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return numericValue;
}

function normalizeNonNegativeInteger(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  const numericValue = Number(normalized);
  if (!Number.isInteger(numericValue) || numericValue < 0) return null;
  return numericValue;
}

async function revalidateTemplatePaths(eventId?: string) {
  revalidatePath('/configuracion' as Route);
  revalidatePath('/configuracion/listas-maestras-inventario' as Route);
  revalidatePath('/inventario' as Route);

  if (eventId) {
    revalidatePath('/eventos' as Route);
    revalidatePath(`/eventos/${eventId}` as Route);
  }
}

async function getBarMasterTemplateById(templateId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('bar_master_templates').select('*').eq('id', templateId).maybeSingle();
  return (data as BarMasterTemplateRecord | null) ?? null;
}

async function getBarMasterTemplateItemById(templateId: string, itemId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('bar_master_template_items')
    .select('*')
    .eq('id', itemId)
    .eq('template_id', templateId)
    .maybeSingle();

  return (data as BarMasterTemplateItemRecord | null) ?? null;
}

export async function createBarMasterTemplateAction(formData: FormData) {
  await requirePermission('inventory.templates.manage');
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;

  const name = String(formData.get('name') ?? '').trim();
  const slug = slugifyTemplateName(String(formData.get('slug') ?? name));
  const serviceCategory = normalizeOptionalString(formData.get('service_category'));
  const description = normalizeOptionalString(formData.get('description'));
  const note = normalizeOptionalString(formData.get('note'));
  const isActive = String(formData.get('is_active') ?? 'true') === 'true';

  if (!name || !slug) return;

  await supabase.from('bar_master_templates').insert({
    name,
    slug,
    service_category: serviceCategory,
    description,
    note,
    is_active: isActive,
    created_by: session.user.id,
    updated_by: session.user.id,
  });

  await revalidateTemplatePaths();
}

export async function updateBarMasterTemplateAction(templateId: string, formData: FormData) {
  await requirePermission('inventory.templates.manage');
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;

  const template = await getBarMasterTemplateById(templateId);
  if (!template) return;

  const name = String(formData.get('name') ?? '').trim();
  const slug = slugifyTemplateName(String(formData.get('slug') ?? name));
  const serviceCategory = normalizeOptionalString(formData.get('service_category'));
  const description = normalizeOptionalString(formData.get('description'));
  const note = normalizeOptionalString(formData.get('note'));
  const isActive = String(formData.get('is_active') ?? 'true') === 'true';

  if (!name || !slug) return;

  await supabase
    .from('bar_master_templates')
    .update({
      name,
      slug,
      service_category: serviceCategory,
      description,
      note,
      is_active: isActive,
      updated_by: session.user.id,
    })
    .eq('id', templateId);

  await revalidateTemplatePaths();
}

export async function createBarMasterTemplateItemAction(templateId: string, formData: FormData) {
  await requirePermission('inventory.templates.manage');
  const supabase = await createSupabaseServerClient();

  if (!supabase) return;
  const template = await getBarMasterTemplateById(templateId);
  if (!template) return;

  const inventoryItemId = normalizeOptionalString(formData.get('inventory_item_id'));
  const itemName = String(formData.get('item_name') ?? '').trim();
  const unit = normalizeOptionalString(formData.get('unit'));
  const quantityRequired = normalizeNonNegativeNumber(formData.get('quantity_required'));
  const note = normalizeOptionalString(formData.get('note'));
  const sortOrder = normalizeNonNegativeInteger(formData.get('sort_order')) ?? 100;
  const isActive = String(formData.get('is_active') ?? 'true') === 'true';

  if (!itemName || quantityRequired == null) return;

  await supabase.from('bar_master_template_items').insert({
    template_id: templateId,
    inventory_item_id: inventoryItemId,
    item_name: itemName,
    unit,
    quantity_required: quantityRequired,
    note,
    sort_order: sortOrder,
    is_active: isActive,
  });

  await revalidateTemplatePaths();
}

export async function updateBarMasterTemplateItemAction(templateId: string, itemId: string, formData: FormData) {
  await requirePermission('inventory.templates.manage');
  const supabase = await createSupabaseServerClient();

  if (!supabase) return;
  const item = await getBarMasterTemplateItemById(templateId, itemId);
  if (!item) return;

  const inventoryItemId = normalizeOptionalString(formData.get('inventory_item_id'));
  const itemName = String(formData.get('item_name') ?? '').trim();
  const unit = normalizeOptionalString(formData.get('unit'));
  const quantityRequired = normalizeNonNegativeNumber(formData.get('quantity_required'));
  const note = normalizeOptionalString(formData.get('note'));
  const sortOrder = normalizeNonNegativeInteger(formData.get('sort_order')) ?? 100;
  const isActive = String(formData.get('is_active') ?? 'true') === 'true';

  if (!itemName || quantityRequired == null) return;

  await supabase
    .from('bar_master_template_items')
    .update({
      inventory_item_id: inventoryItemId,
      item_name: itemName,
      unit,
      quantity_required: quantityRequired,
      note,
      sort_order: sortOrder,
      is_active: isActive,
    })
    .eq('id', itemId)
    .eq('template_id', templateId);

  await revalidateTemplatePaths();
}

export async function applyBarMasterTemplateToEventAction(eventId: string, templateId: string) {
  const session = await requireActiveSession();
  if (!session.user) return;

  if (!hasPermission(session.user, 'inventory.templates.manage') && !hasPermission(session.user, 'inventory.prepare') && !hasPermission(session.user, 'inventory.manage')) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const [event, template, templateItemsResult, eventRequirementsResult] = await Promise.all([
    getEventById(eventId),
    getBarMasterTemplateById(templateId),
    supabase.from('bar_master_template_items').select('*').eq('template_id', templateId).eq('is_active', true),
    supabase.from('event_inventory_requirements').select('*').eq('event_id', eventId),
  ]);

  if (!event || !template || !template.is_active) return;

  const templateItems = (templateItemsResult.data ?? []) as BarMasterTemplateItemRecord[];
  const eventRequirements = (eventRequirementsResult.data ?? []) as Array<{ id: string; inventory_item_id: string; quantity_required: number; note: string | null }>;

  const existingByInventoryItemId = new Map(eventRequirements.map((row) => [row.inventory_item_id, row]));

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedWithoutInventoryLink = 0;

  for (const templateItem of templateItems) {
    if (!templateItem.inventory_item_id) {
      skippedWithoutInventoryLink += 1;
      continue;
    }

    const existing = existingByInventoryItemId.get(templateItem.inventory_item_id);
    if (existing) {
      await supabase
        .from('event_inventory_requirements')
        .update({
          quantity_required: Number(existing.quantity_required ?? 0) + Number(templateItem.quantity_required ?? 0),
          note: [existing.note, `BAR_TEMPLATE:${template.name} · ${templateItem.item_name}`].filter(Boolean).join(' | '),
          source_type: 'template',
          updated_by: session.user.id,
        })
        .eq('id', existing.id)
        .eq('event_id', eventId);
      updatedCount += 1;
      continue;
    }

    await supabase.from('event_inventory_requirements').insert({
      event_id: eventId,
      inventory_item_id: templateItem.inventory_item_id,
      quantity_required: templateItem.quantity_required,
      quantity_counted: null,
      quantity_used: null,
      prep_status: 'pendiente',
      prep_notes: null,
      checked_by: null,
      checked_at: null,
      source_type: 'template',
      source_template_id: null,
      note: `BAR_TEMPLATE:${template.name} · ${templateItem.item_name}`,
      updated_by: session.user.id,
    });
    insertedCount += 1;
  }

  await supabase.from('event_bar_master_template_applications').insert({
    event_id: eventId,
    template_id: templateId,
    applied_by: session.user.id,
    result_summary: {
      inserted_count: insertedCount,
      updated_count: updatedCount,
      skipped_without_inventory_link: skippedWithoutInventoryLink,
      applied_template_name: template.name,
    },
  });

  await revalidateTemplatePaths(eventId);
}
