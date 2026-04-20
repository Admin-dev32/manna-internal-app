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

function normalizePositiveInteger(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  const numericValue = Number(normalized);
  if (!Number.isInteger(numericValue) || numericValue <= 0) return null;
  return numericValue;
}

function normalizePositiveNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return numericValue;
}

function normalizeTemplateItemType(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  if (normalized === 'ingrediente' || normalized === 'herramienta' || normalized === 'apoyo') {
    return normalized;
  }

  return 'apoyo';
}

function applyRoundStep(value: number, step: number | null) {
  if (!step || step <= 0) return value;
  return Math.ceil(value / step) * step;
}

function computeScaledQuantity(params: {
  quantityRequired: number;
  baseServings: number | null;
  roundingStep: number | null;
  guestCount: number | null;
}) {
  const { quantityRequired, baseServings, roundingStep, guestCount } = params;
  if (!baseServings || !guestCount || guestCount <= 0) {
    return Number(quantityRequired);
  }
  const scaled = Number(quantityRequired) * (Number(guestCount) / Number(baseServings));
  return applyRoundStep(scaled, roundingStep);
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

async function getBarMasterTemplateApplicationById(eventId: string, applicationId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('event_bar_master_template_applications')
    .select('*')
    .eq('id', applicationId)
    .eq('event_id', eventId)
    .maybeSingle();
  return data as { id: string; event_id: string; approval_status: 'not_approved' | 'approved' } | null;
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
  const prepGuide = normalizeOptionalString(formData.get('prep_guide'));
  const executionGuide = normalizeOptionalString(formData.get('execution_guide'));
  const checklistGuidance = normalizeOptionalString(formData.get('checklist_guidance'));
  const enforceInventoryLinks = String(formData.get('enforce_inventory_links') ?? 'true') === 'true';
  const isActive = String(formData.get('is_active') ?? 'true') === 'true';

  if (!name || !slug) return;

  await supabase.from('bar_master_templates').insert({
    name,
    slug,
    service_category: serviceCategory,
    description,
    note,
    prep_guide: prepGuide,
    execution_guide: executionGuide,
    checklist_guidance: checklistGuidance,
    enforce_inventory_links: enforceInventoryLinks,
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
  const prepGuide = normalizeOptionalString(formData.get('prep_guide'));
  const executionGuide = normalizeOptionalString(formData.get('execution_guide'));
  const checklistGuidance = normalizeOptionalString(formData.get('checklist_guidance'));
  const enforceInventoryLinks = String(formData.get('enforce_inventory_links') ?? (template.enforce_inventory_links ? 'true' : 'false')) === 'true';
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
      prep_guide: prepGuide,
      execution_guide: executionGuide,
      checklist_guidance: checklistGuidance,
      enforce_inventory_links: enforceInventoryLinks,
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
  const itemType = normalizeTemplateItemType(formData.get('item_type'));
  const itemName = String(formData.get('item_name') ?? '').trim();
  const unit = normalizeOptionalString(formData.get('unit'));
  const quantityRequired = normalizeNonNegativeNumber(formData.get('quantity_required'));
  const baseServings = normalizePositiveInteger(formData.get('base_servings'));
  const scaleRoundingStep = normalizePositiveNumber(formData.get('scale_rounding_step'));
  const isOptional = String(formData.get('is_optional') ?? 'false') === 'true';
  const note = normalizeOptionalString(formData.get('note'));
  const sortOrder = normalizeNonNegativeInteger(formData.get('sort_order')) ?? 100;
  const isActive = String(formData.get('is_active') ?? 'true') === 'true';

  if (!itemName || quantityRequired == null) return;
  if (template.enforce_inventory_links && !inventoryItemId) return;

  await supabase.from('bar_master_template_items').insert({
    template_id: templateId,
    inventory_item_id: inventoryItemId,
    item_type: itemType,
    item_name: itemName,
    unit,
    quantity_required: quantityRequired,
    base_servings: baseServings,
    scale_rounding_step: scaleRoundingStep,
    is_optional: isOptional,
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
  const template = await getBarMasterTemplateById(templateId);
  if (!template) return;

  const inventoryItemId = normalizeOptionalString(formData.get('inventory_item_id'));
  const itemType = normalizeTemplateItemType(formData.get('item_type'));
  const itemName = String(formData.get('item_name') ?? '').trim();
  const unit = normalizeOptionalString(formData.get('unit'));
  const quantityRequired = normalizeNonNegativeNumber(formData.get('quantity_required'));
  const baseServings = normalizePositiveInteger(formData.get('base_servings'));
  const scaleRoundingStep = normalizePositiveNumber(formData.get('scale_rounding_step'));
  const isOptional = String(formData.get('is_optional') ?? 'false') === 'true';
  const note = normalizeOptionalString(formData.get('note'));
  const sortOrder = normalizeNonNegativeInteger(formData.get('sort_order')) ?? 100;
  const isActive = String(formData.get('is_active') ?? 'true') === 'true';

  if (!itemName || quantityRequired == null) return;
  if (template.enforce_inventory_links && !inventoryItemId) return;

  await supabase
    .from('bar_master_template_items')
    .update({
      inventory_item_id: inventoryItemId,
      item_type: itemType,
      item_name: itemName,
      unit,
      quantity_required: quantityRequired,
      base_servings: baseServings,
      scale_rounding_step: scaleRoundingStep,
      is_optional: isOptional,
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
  let linkedItemsCount = 0;
  let scaledItemsCount = 0;
  const omittedItemNames: string[] = [];

  for (const templateItem of templateItems) {
    if (!templateItem.inventory_item_id) {
      skippedWithoutInventoryLink += 1;
      omittedItemNames.push(`${templateItem.item_type}:${templateItem.item_name}`);
      continue;
    }
    linkedItemsCount += 1;

    const scaledQuantity = computeScaledQuantity({
      quantityRequired: Number(templateItem.quantity_required ?? 0),
      baseServings: templateItem.base_servings ?? null,
      roundingStep: templateItem.scale_rounding_step ?? null,
      guestCount: event.guest_count ?? null,
    });
    if (templateItem.base_servings && event.guest_count) {
      scaledItemsCount += 1;
    }

    const existing = existingByInventoryItemId.get(templateItem.inventory_item_id);
    if (existing) {
      await supabase
        .from('event_inventory_requirements')
        .update({
          quantity_required: Number(existing.quantity_required ?? 0) + Number(scaledQuantity ?? 0),
          note: [
            existing.note,
            `BAR_TEMPLATE:${template.name} · ${templateItem.item_type}:${templateItem.item_name} · ESCALA:${event.guest_count ?? 'base'}@${templateItem.base_servings ?? 'na'}`,
          ].filter(Boolean).join(' | '),
          source_type: 'template',
          source_template_id: templateId,
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
      quantity_required: scaledQuantity,
      quantity_counted: null,
      quantity_used: null,
      prep_status: 'pendiente',
      prep_notes: null,
      checked_by: null,
      checked_at: null,
      source_type: 'template',
      source_template_id: templateId,
      note: `BAR_TEMPLATE:${template.name} · ${templateItem.item_type}:${templateItem.item_name} · ESCALA:${event.guest_count ?? 'base'}@${templateItem.base_servings ?? 'na'}`,
      updated_by: session.user.id,
    });
    insertedCount += 1;
  }

  await supabase.from('event_bar_master_template_applications').insert({
    event_id: eventId,
    template_id: templateId,
    applied_by: session.user.id,
    approval_status: 'not_approved',
    approved_by: null,
    approved_at: null,
    approval_note: null,
    result_summary: {
      total_template_items: templateItems.length,
      guest_count_used: event.guest_count ?? null,
      linked_items_count: linkedItemsCount,
      scaled_items_count: scaledItemsCount,
      inserted_count: insertedCount,
      updated_count: updatedCount,
      skipped_without_inventory_link: skippedWithoutInventoryLink,
      omitted_items: omittedItemNames.slice(0, 20),
      applied_template_name: template.name,
    },
  });

  await revalidateTemplatePaths(eventId);
}

export async function updateBarMasterTemplateApplicationApprovalAction(eventId: string, applicationId: string, formData: FormData) {
  const session = await requireActiveSession();
  if (!session.user) return;
  if (!hasPermission(session.user, 'inventory.prepare') && !hasPermission(session.user, 'inventory.manage') && !hasPermission(session.user, 'inventory.templates.manage')) {
    return;
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const application = await getBarMasterTemplateApplicationById(eventId, applicationId);
  if (!application) return;

  const nextStatus = String(formData.get('approval_status') ?? 'not_approved');
  if (nextStatus !== 'approved' && nextStatus !== 'not_approved') return;

  const approvalNote = normalizeOptionalString(formData.get('approval_note'));
  const nowIso = new Date().toISOString();

  await supabase
    .from('event_bar_master_template_applications')
    .update({
      approval_status: nextStatus,
      approved_by: nextStatus === 'approved' ? session.user.id : null,
      approved_at: nextStatus === 'approved' ? nowIso : null,
      approval_note: approvalNote,
    })
    .eq('id', application.id)
    .eq('event_id', eventId);

  await revalidateTemplatePaths(eventId);
}
