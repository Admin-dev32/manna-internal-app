'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';

import { EVENT_ASSIGNMENT_ROLE_LABELS } from '@/config/events';
import { requireActiveSession, requirePermission } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getEventById, getEventStaffAssignments } from '@/services/events/queries';
import { getInventoryItemByIdForTemplates } from '@/services/operational-templates/internal';
import {
  EVENT_ASSIGNMENT_ROLES,
  EVENT_TASK_PRIORITIES,
  EVENT_TASK_STATUSES,
} from '@/types/events';
import type {
  OperationalTemplateChecklistItemRecord,
  OperationalTemplateMaterialItemRecord,
  OperationalTemplateRecord,
  OperationalTemplateTaskItemRecord,
} from '@/types/operational-templates';

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function normalizeNonNegativeInteger(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  const numericValue = Number(normalized);
  if (!Number.isInteger(numericValue) || numericValue < 0) return null;
  return numericValue;
}

function normalizePositiveNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return numericValue;
}

async function revalidateTemplatePaths(eventId?: string, preEventId?: string) {
  revalidatePath('/configuracion' as Route);
  revalidatePath('/configuracion/plantillas-operativas' as Route);
  revalidatePath('/dashboard' as Route);
  revalidatePath('/notificaciones' as Route);
  revalidatePath('/tareas' as Route);
  revalidatePath('/inventario' as Route);

  if (eventId) {
    revalidatePath('/eventos' as Route);
    revalidatePath(`/eventos/${eventId}` as Route);
  }

  if (preEventId) {
    revalidatePath('/reservas' as Route);
    revalidatePath(`/reservas/${preEventId}` as Route);
  }
}

async function getOperationalTemplateById(templateId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('operational_templates').select('*').eq('id', templateId).maybeSingle();
  return (data as OperationalTemplateRecord | null) ?? null;
}

async function getOperationalTemplateChecklistItemById(templateId: string, itemId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('operational_template_checklist_items')
    .select('*')
    .eq('id', itemId)
    .eq('template_id', templateId)
    .maybeSingle();

  return (data as OperationalTemplateChecklistItemRecord | null) ?? null;
}

async function getOperationalTemplateTaskItemById(templateId: string, itemId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('operational_template_task_items')
    .select('*')
    .eq('id', itemId)
    .eq('template_id', templateId)
    .maybeSingle();

  return (data as OperationalTemplateTaskItemRecord | null) ?? null;
}

async function getOperationalTemplateMaterialItemById(templateId: string, itemId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('operational_template_material_items')
    .select('*')
    .eq('id', itemId)
    .eq('template_id', templateId)
    .maybeSingle();

  return (data as OperationalTemplateMaterialItemRecord | null) ?? null;
}

async function getTemplateChildren(templateId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      checklistItems: [] as OperationalTemplateChecklistItemRecord[],
      taskItems: [] as OperationalTemplateTaskItemRecord[],
      materialItems: [] as OperationalTemplateMaterialItemRecord[],
    };
  }

  const [{ data: checklistData }, { data: taskData }, { data: materialData }] = await Promise.all([
    supabase.from('operational_template_checklist_items').select('*').eq('template_id', templateId).order('sort_order', { ascending: true }),
    supabase.from('operational_template_task_items').select('*').eq('template_id', templateId).order('sort_order', { ascending: true }),
    supabase.from('operational_template_material_items').select('*').eq('template_id', templateId).order('sort_order', { ascending: true }),
  ]);

  return {
    checklistItems: (checklistData ?? []) as OperationalTemplateChecklistItemRecord[],
    taskItems: (taskData ?? []) as OperationalTemplateTaskItemRecord[],
    materialItems: (materialData ?? []) as OperationalTemplateMaterialItemRecord[],
  };
}

function buildDueAt(eventDate: string, eventTime: string, dueHoursBeforeEvent: number | null) {
  if (dueHoursBeforeEvent == null) return null;

  const eventDateTime = new Date(`${eventDate}T${eventTime}:00`);
  eventDateTime.setHours(eventDateTime.getHours() - dueHoursBeforeEvent);
  return eventDateTime.toISOString();
}

export async function createOperationalTemplateAction(formData: FormData) {
  await requirePermission('settings.view');
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;

  const name = String(formData.get('name') ?? '').trim();
  const eventType = normalizeOptionalString(formData.get('event_type'));
  const note = normalizeOptionalString(formData.get('note'));
  const isActive = String(formData.get('is_active') ?? 'true') === 'true';

  if (!name) return;

  await supabase.from('operational_templates').insert({
    name,
    event_type: eventType,
    note,
    is_active: isActive,
    created_by: session.user.id,
    updated_by: session.user.id,
  });

  await revalidateTemplatePaths();
}

export async function updateOperationalTemplateAction(templateId: string, formData: FormData) {
  await requirePermission('settings.view');
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;

  const template = await getOperationalTemplateById(templateId);
  if (!template) return;

  const name = String(formData.get('name') ?? '').trim();
  const eventType = normalizeOptionalString(formData.get('event_type'));
  const note = normalizeOptionalString(formData.get('note'));
  const isActive = String(formData.get('is_active') ?? 'true') === 'true';

  if (!name) return;

  await supabase
    .from('operational_templates')
    .update({
      name,
      event_type: eventType,
      note,
      is_active: isActive,
      updated_by: session.user.id,
    })
    .eq('id', templateId);

  await revalidateTemplatePaths();
}

export async function createOperationalTemplateChecklistItemAction(templateId: string, formData: FormData) {
  await requirePermission('settings.view');
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const template = await getOperationalTemplateById(templateId);
  if (!template) return;

  const label = String(formData.get('label') ?? '').trim();
  const description = normalizeOptionalString(formData.get('description'));
  const sortOrder = normalizeNonNegativeInteger(formData.get('sort_order')) ?? 100;

  if (!label) return;

  await supabase.from('operational_template_checklist_items').insert({
    template_id: templateId,
    label,
    description,
    sort_order: sortOrder,
  });

  await revalidateTemplatePaths();
}

export async function updateOperationalTemplateChecklistItemAction(templateId: string, itemId: string, formData: FormData) {
  await requirePermission('settings.view');
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const item = await getOperationalTemplateChecklistItemById(templateId, itemId);
  if (!item) return;

  const label = String(formData.get('label') ?? '').trim();
  const description = normalizeOptionalString(formData.get('description'));
  const sortOrder = normalizeNonNegativeInteger(formData.get('sort_order')) ?? 100;

  if (!label) return;

  await supabase
    .from('operational_template_checklist_items')
    .update({
      label,
      description,
      sort_order: sortOrder,
    })
    .eq('id', itemId)
    .eq('template_id', templateId);

  await revalidateTemplatePaths();
}

export async function removeOperationalTemplateChecklistItemAction(templateId: string, itemId: string) {
  await requirePermission('settings.view');
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const item = await getOperationalTemplateChecklistItemById(templateId, itemId);
  if (!item) return;

  await supabase.from('operational_template_checklist_items').delete().eq('id', itemId).eq('template_id', templateId);
  await revalidateTemplatePaths();
}

export async function createOperationalTemplateTaskItemAction(templateId: string, formData: FormData) {
  await requirePermission('settings.view');
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const template = await getOperationalTemplateById(templateId);
  if (!template) return;

  const title = String(formData.get('title') ?? '').trim();
  const description = normalizeOptionalString(formData.get('description'));
  const priority = String(formData.get('priority') ?? 'media');
  const defaultStatus = String(formData.get('default_status') ?? 'pendiente');
  const assignmentRoleHint = normalizeOptionalString(formData.get('assignment_role_hint'));
  const dueHoursBeforeEvent = normalizeNonNegativeInteger(formData.get('due_hours_before_event'));
  const internalNote = normalizeOptionalString(formData.get('internal_note'));
  const sortOrder = normalizeNonNegativeInteger(formData.get('sort_order')) ?? 100;

  if (!title) return;
  if (!EVENT_TASK_PRIORITIES.includes(priority as (typeof EVENT_TASK_PRIORITIES)[number])) return;
  if (!EVENT_TASK_STATUSES.includes(defaultStatus as (typeof EVENT_TASK_STATUSES)[number])) return;
  if (assignmentRoleHint && !EVENT_ASSIGNMENT_ROLES.includes(assignmentRoleHint as (typeof EVENT_ASSIGNMENT_ROLES)[number])) return;

  await supabase.from('operational_template_task_items').insert({
    template_id: templateId,
    title,
    description,
    priority,
    default_status: defaultStatus,
    assignment_role_hint: assignmentRoleHint,
    due_hours_before_event: dueHoursBeforeEvent,
    internal_note: internalNote,
    sort_order: sortOrder,
  });

  await revalidateTemplatePaths();
}

export async function updateOperationalTemplateTaskItemAction(templateId: string, itemId: string, formData: FormData) {
  await requirePermission('settings.view');
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const item = await getOperationalTemplateTaskItemById(templateId, itemId);
  if (!item) return;

  const title = String(formData.get('title') ?? '').trim();
  const description = normalizeOptionalString(formData.get('description'));
  const priority = String(formData.get('priority') ?? item.priority);
  const defaultStatus = String(formData.get('default_status') ?? item.default_status);
  const assignmentRoleHint = normalizeOptionalString(formData.get('assignment_role_hint'));
  const dueHoursBeforeEvent = normalizeNonNegativeInteger(formData.get('due_hours_before_event'));
  const internalNote = normalizeOptionalString(formData.get('internal_note'));
  const sortOrder = normalizeNonNegativeInteger(formData.get('sort_order')) ?? 100;

  if (!title) return;
  if (!EVENT_TASK_PRIORITIES.includes(priority as (typeof EVENT_TASK_PRIORITIES)[number])) return;
  if (!EVENT_TASK_STATUSES.includes(defaultStatus as (typeof EVENT_TASK_STATUSES)[number])) return;
  if (assignmentRoleHint && !EVENT_ASSIGNMENT_ROLES.includes(assignmentRoleHint as (typeof EVENT_ASSIGNMENT_ROLES)[number])) return;

  await supabase
    .from('operational_template_task_items')
    .update({
      title,
      description,
      priority,
      default_status: defaultStatus,
      assignment_role_hint: assignmentRoleHint,
      due_hours_before_event: dueHoursBeforeEvent,
      internal_note: internalNote,
      sort_order: sortOrder,
    })
    .eq('id', itemId)
    .eq('template_id', templateId);

  await revalidateTemplatePaths();
}

export async function removeOperationalTemplateTaskItemAction(templateId: string, itemId: string) {
  await requirePermission('settings.view');
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const item = await getOperationalTemplateTaskItemById(templateId, itemId);
  if (!item) return;

  await supabase.from('operational_template_task_items').delete().eq('id', itemId).eq('template_id', templateId);
  await revalidateTemplatePaths();
}

export async function createOperationalTemplateMaterialItemAction(templateId: string, formData: FormData) {
  await requirePermission('settings.view');
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const template = await getOperationalTemplateById(templateId);
  if (!template) return;

  const inventoryItemId = String(formData.get('inventory_item_id') ?? '').trim();
  const quantityRequired = normalizePositiveNumber(formData.get('quantity_required'));
  const note = normalizeOptionalString(formData.get('note'));
  const sortOrder = normalizeNonNegativeInteger(formData.get('sort_order')) ?? 100;

  if (!inventoryItemId || quantityRequired == null) return;

  const inventoryItem = await getInventoryItemByIdForTemplates(inventoryItemId);
  if (!inventoryItem || !inventoryItem.is_active) return;

  await supabase.from('operational_template_material_items').upsert({
    template_id: templateId,
    inventory_item_id: inventoryItemId,
    quantity_required: quantityRequired,
    note,
    sort_order: sortOrder,
  }, { onConflict: 'template_id,inventory_item_id' });

  await revalidateTemplatePaths();
}

export async function updateOperationalTemplateMaterialItemAction(templateId: string, itemId: string, formData: FormData) {
  await requirePermission('settings.view');
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const item = await getOperationalTemplateMaterialItemById(templateId, itemId);
  if (!item) return;

  const inventoryItemId = String(formData.get('inventory_item_id') ?? '').trim();
  const quantityRequired = normalizePositiveNumber(formData.get('quantity_required'));
  const note = normalizeOptionalString(formData.get('note'));
  const sortOrder = normalizeNonNegativeInteger(formData.get('sort_order')) ?? 100;

  if (!inventoryItemId || quantityRequired == null) return;

  const inventoryItem = await getInventoryItemByIdForTemplates(inventoryItemId);
  if (!inventoryItem || !inventoryItem.is_active) return;

  await supabase
    .from('operational_template_material_items')
    .update({
      inventory_item_id: inventoryItemId,
      quantity_required: quantityRequired,
      note,
      sort_order: sortOrder,
    })
    .eq('id', itemId)
    .eq('template_id', templateId);

  await revalidateTemplatePaths();
}

export async function removeOperationalTemplateMaterialItemAction(templateId: string, itemId: string) {
  await requirePermission('settings.view');
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const item = await getOperationalTemplateMaterialItemById(templateId, itemId);
  if (!item) return;

  await supabase.from('operational_template_material_items').delete().eq('id', itemId).eq('template_id', templateId);
  await revalidateTemplatePaths();
}

function normalizeKey(value: string) {
  return value.trim().toLocaleLowerCase('es-MX');
}

export async function applyOperationalTemplateToEventAction(eventId: string, templateId: string, preEventId?: string) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;
  const actorId = session.user.id;

  const event = await getEventById(eventId);
  const template = await getOperationalTemplateById(templateId);
  if (!event || !template || !template.is_active) return;

  const [{ checklistItems, taskItems, materialItems }, staffAssignments] = await Promise.all([
    getTemplateChildren(templateId),
    getEventStaffAssignments(eventId),
  ]);

  const [
    { data: existingChecklistData },
    { data: existingTaskData },
    { data: existingMaterialData },
  ] = await Promise.all([
    supabase.from('event_checklist_items').select('id, item_key, label').eq('event_id', eventId),
    supabase.from('event_tasks').select('id, title').eq('event_id', eventId),
    supabase.from('event_inventory_requirements').select('id, inventory_item_id').eq('event_id', eventId),
  ]);

  const existingChecklistKeys = new Set((existingChecklistData ?? []).map((item) => String(item.item_key ?? '')));
  const existingChecklistLabels = new Set((existingChecklistData ?? []).map((item) => normalizeKey(String(item.label ?? ''))));
  const existingTaskTitles = new Set((existingTaskData ?? []).map((item) => normalizeKey(String(item.title ?? ''))));
  const existingMaterialIds = new Set((existingMaterialData ?? []).map((item) => String(item.inventory_item_id)));

  const checklistPayload = checklistItems
    .filter((item) => !existingChecklistKeys.has(`template:${item.id}`) && !existingChecklistLabels.has(normalizeKey(item.label)))
    .map((item) => ({
      event_id: eventId,
      item_key: `template:${item.id}`,
      label: item.label,
      description: item.description,
      sort_order: item.sort_order,
      updated_by: actorId,
    }));

  if (checklistPayload.length > 0) {
    await supabase.from('event_checklist_items').insert(checklistPayload);
  }

  const sortedAssignments = [...staffAssignments].sort((left, right) => {
    if (left.assignment_status === 'confirmado' && right.assignment_status !== 'confirmado') return -1;
    if (left.assignment_status !== 'confirmado' && right.assignment_status === 'confirmado') return 1;
    return left.created_at.localeCompare(right.created_at);
  });

  const taskPayload = [] as Array<Record<string, unknown>>;
  let skippedTaskCount = 0;

  for (const item of taskItems) {
    if (existingTaskTitles.has(normalizeKey(item.title))) {
      continue;
    }

    const selectedAssignment =
      (item.assignment_role_hint
        ? sortedAssignments.find((assignment) => assignment.assignment_role === item.assignment_role_hint)
        : null) ??
      sortedAssignments[0];

    if (!selectedAssignment) {
      skippedTaskCount += 1;
      continue;
    }

    taskPayload.push({
      event_id: eventId,
      assigned_profile_id: selectedAssignment.profile_id,
      title: item.title,
      description: item.description,
      priority: item.priority,
      status: item.default_status,
      due_at: buildDueAt(event.event_date, event.event_time, item.due_hours_before_event),
      internal_note: item.internal_note
        ? `${item.internal_note}${item.assignment_role_hint ? ` · Rol sugerido: ${EVENT_ASSIGNMENT_ROLE_LABELS[item.assignment_role_hint]}` : ''}`
        : item.assignment_role_hint
          ? `Rol sugerido: ${EVENT_ASSIGNMENT_ROLE_LABELS[item.assignment_role_hint]}`
          : null,
      created_by: actorId,
      updated_by: actorId,
    });
  }

  if (taskPayload.length > 0) {
    await supabase.from('event_tasks').insert(taskPayload);
  }

  const materialPayload = materialItems
    .filter((item) => !existingMaterialIds.has(item.inventory_item_id))
    .map((item) => ({
      event_id: eventId,
      inventory_item_id: item.inventory_item_id,
      quantity_required: item.quantity_required,
      quantity_used: null,
      note: item.note,
    }));

  if (materialPayload.length > 0) {
    await supabase.from('event_inventory_requirements').insert(materialPayload);
  }

  await supabase.from('event_operational_template_applications').insert({
    event_id: eventId,
    operational_template_id: templateId,
    applied_by: actorId,
    created_checklist_count: checklistPayload.length,
    created_task_count: taskPayload.length,
    created_material_count: materialPayload.length,
    skipped_task_count: skippedTaskCount,
  });

  const noteSummary = [
    `Plantilla aplicada: ${template.name}.`,
    checklistPayload.length > 0 ? `Checklist creados: ${checklistPayload.length}.` : 'Checklist sin cambios.',
    taskPayload.length > 0 ? `Tareas creadas: ${taskPayload.length}.` : 'Tareas sin cambios.',
    materialPayload.length > 0 ? `Materiales creados: ${materialPayload.length}.` : 'Materiales sin cambios.',
    skippedTaskCount > 0 ? `Tareas omitidas por falta de staff: ${skippedTaskCount}.` : null,
  ].filter(Boolean).join(' ');

  await supabase
    .from('events')
    .update({
      operational_notes: event.operational_notes ? `${event.operational_notes}\n\n${noteSummary}` : noteSummary,
      updated_by: actorId,
    })
    .eq('id', eventId);

  await revalidateTemplatePaths(eventId, preEventId);
}
