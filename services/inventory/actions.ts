'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';

import { requireActiveSession } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getEventById } from '@/services/events/queries';
import type { InventoryItemRecord, EventInventoryPrepStatus } from '@/types/inventory';

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function normalizeNonNegativeNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  const numericValue = Number(normalized || '0');
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return numericValue;
}

function normalizePrepStatus(value: FormDataEntryValue | null): EventInventoryPrepStatus {
  const normalized = String(value ?? '').trim();
  if (normalized === 'pendiente' || normalized === 'contado' || normalized === 'faltante' || normalized === 'listo') {
    return normalized;
  }

  return 'pendiente';
}

function derivePrepStatus(quantityRequired: number, quantityCounted: number | null, requestedStatus: EventInventoryPrepStatus) {
  if (requestedStatus === 'pendiente') return 'pendiente' as EventInventoryPrepStatus;

  const counted = quantityCounted ?? 0;
  if (counted <= 0) return 'pendiente';
  if (counted < quantityRequired) return 'faltante';
  if (counted === quantityRequired) return requestedStatus === 'listo' ? 'listo' : 'contado';
  return 'listo';
}

async function revalidateInventoryPaths(eventId?: string) {
  revalidatePath('/inventario' as Route);
  if (eventId) {
    revalidatePath('/eventos' as Route);
    revalidatePath(`/eventos/${eventId}` as Route);
    revalidatePath('/notificaciones' as Route);
  }
}

async function getInventoryItemById(itemId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('inventory_items').select('*').eq('id', itemId).maybeSingle();
  return (data as InventoryItemRecord | null) ?? null;
}

async function getEventInventoryRequirementById(eventId: string, requirementId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('event_inventory_requirements')
    .select('*')
    .eq('id', requirementId)
    .eq('event_id', eventId)
    .maybeSingle();

  return (data as {
    id: string;
    event_id: string;
    inventory_item_id: string;
    quantity_required: number;
    quantity_counted: number | null;
    prep_status: EventInventoryPrepStatus;
  } | null) ?? null;
}

export async function createInventoryItemAction(formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;
  if (!hasPermission(session.user, 'inventory.manage')) return;

  const name = String(formData.get('name') ?? '').trim();
  const code = normalizeOptionalString(formData.get('code'));
  const category = normalizeOptionalString(formData.get('category'));
  const usageBars = normalizeOptionalString(formData.get('usage_bars'));
  const unit = String(formData.get('unit') ?? '').trim();
  const currentStock = normalizeNonNegativeNumber(formData.get('current_stock'));
  const minimumStockInput = normalizeOptionalString(formData.get('minimum_stock'));
  const minimumStock = minimumStockInput == null ? null : normalizeNonNegativeNumber(minimumStockInput);
  const idealStockInput = normalizeOptionalString(formData.get('ideal_stock'));
  const idealStock = idealStockInput == null ? null : normalizeNonNegativeNumber(idealStockInput);
  const storageLocation = normalizeOptionalString(formData.get('storage_location'));
  const storageBox = normalizeOptionalString(formData.get('storage_box'));
  const note = normalizeOptionalString(formData.get('note'));
  const isActive = String(formData.get('is_active') ?? 'true') === 'true';

  if (!name || !unit || currentStock == null || minimumStockInput != null && minimumStock == null || idealStockInput != null && idealStock == null) {
    return;
  }

  await supabase.from('inventory_items').insert({
    code,
    name,
    category,
    usage_bars: usageBars,
    unit,
    current_stock: currentStock,
    minimum_stock: minimumStock,
    ideal_stock: idealStock,
    storage_location: storageLocation,
    storage_box: storageBox,
    note,
    is_active: isActive,
    created_by: session.user.id,
    updated_by: session.user.id,
  });

  await revalidateInventoryPaths();
}

export async function updateInventoryItemAction(itemId: string, formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;
  if (!hasPermission(session.user, 'inventory.manage')) return;

  const existingItem = await getInventoryItemById(itemId);
  if (!existingItem) return;

  const name = String(formData.get('name') ?? '').trim();
  const code = normalizeOptionalString(formData.get('code'));
  const category = normalizeOptionalString(formData.get('category'));
  const usageBars = normalizeOptionalString(formData.get('usage_bars'));
  const unit = String(formData.get('unit') ?? '').trim();
  const currentStock = normalizeNonNegativeNumber(formData.get('current_stock'));
  const minimumStockInput = normalizeOptionalString(formData.get('minimum_stock'));
  const minimumStock = minimumStockInput == null ? null : normalizeNonNegativeNumber(minimumStockInput);
  const idealStockInput = normalizeOptionalString(formData.get('ideal_stock'));
  const idealStock = idealStockInput == null ? null : normalizeNonNegativeNumber(idealStockInput);
  const storageLocation = normalizeOptionalString(formData.get('storage_location'));
  const storageBox = normalizeOptionalString(formData.get('storage_box'));
  const note = normalizeOptionalString(formData.get('note'));
  const isActive = String(formData.get('is_active') ?? 'true') === 'true';

  if (!name || !unit || currentStock == null || minimumStockInput != null && minimumStock == null || idealStockInput != null && idealStock == null) {
    return;
  }

  await supabase
    .from('inventory_items')
    .update({
      name,
      code,
      category,
      usage_bars: usageBars,
      unit,
      current_stock: currentStock,
      minimum_stock: minimumStock,
      ideal_stock: idealStock,
      storage_location: storageLocation,
      storage_box: storageBox,
      note,
      is_active: isActive,
      updated_by: session.user.id,
    })
    .eq('id', itemId);

  await revalidateInventoryPaths();
}

export async function createEventInventoryRequirementAction(eventId: string, formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;
  if (!hasPermission(session.user, 'inventory.prepare') && !hasPermission(session.user, 'inventory.manage')) return;

  const event = await getEventById(eventId);
  if (!event) return;

  const inventoryItemId = String(formData.get('inventory_item_id') ?? '').trim();
  const quantityRequired = normalizeNonNegativeNumber(formData.get('quantity_required'));
  const quantityCountedInput = normalizeOptionalString(formData.get('quantity_counted'));
  const quantityCounted = quantityCountedInput == null ? null : normalizeNonNegativeNumber(quantityCountedInput);
  const quantityUsedInput = normalizeOptionalString(formData.get('quantity_used'));
  const quantityUsed = quantityUsedInput == null ? null : normalizeNonNegativeNumber(quantityUsedInput);
  const note = normalizeOptionalString(formData.get('note'));
  const prepNotes = normalizeOptionalString(formData.get('prep_notes'));
  const requestedPrepStatus = normalizePrepStatus(formData.get('prep_status'));

  if (!inventoryItemId || quantityRequired == null || quantityUsedInput != null && quantityUsed == null || quantityCountedInput != null && quantityCounted == null) {
    return;
  }

  const item = await getInventoryItemById(inventoryItemId);
  if (!item || !item.is_active) {
    return;
  }

  const prepStatus = derivePrepStatus(quantityRequired, quantityCounted, requestedPrepStatus);
  const nowIso = new Date().toISOString();
  const checkedAt = quantityCounted != null ? nowIso : null;

  const { data: existingRequirement } = await supabase
    .from('event_inventory_requirements')
    .select('id')
    .eq('event_id', eventId)
    .eq('inventory_item_id', inventoryItemId)
    .maybeSingle();

  if (existingRequirement) {
    await supabase
      .from('event_inventory_requirements')
      .update({
        quantity_required: quantityRequired,
        quantity_counted: quantityCounted,
        quantity_used: quantityUsed,
        prep_status: prepStatus,
        prep_notes: prepNotes,
        note,
        checked_by: quantityCounted != null ? session.user.id : null,
        checked_at: checkedAt,
        updated_by: session.user.id,
      })
      .eq('id', existingRequirement.id);
  } else {
    await supabase.from('event_inventory_requirements').insert({
      event_id: eventId,
      inventory_item_id: inventoryItemId,
      quantity_required: quantityRequired,
      quantity_counted: quantityCounted,
      quantity_used: quantityUsed,
      prep_status: prepStatus,
      prep_notes: prepNotes,
      note,
      checked_by: quantityCounted != null ? session.user.id : null,
      checked_at: checkedAt,
      source_type: 'manual',
      source_template_id: null,
      updated_by: session.user.id,
    });
  }

  await revalidateInventoryPaths(event.id);
}

export async function updateEventInventoryRequirementAction(eventId: string, requirementId: string, formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;
  if (!hasPermission(session.user, 'inventory.prepare') && !hasPermission(session.user, 'inventory.manage')) return;

  const event = await getEventById(eventId);
  const existingRequirement = await getEventInventoryRequirementById(eventId, requirementId);
  if (!event || !existingRequirement) return;

  const inventoryItemId = String(formData.get('inventory_item_id') ?? '').trim();
  const quantityRequired = normalizeNonNegativeNumber(formData.get('quantity_required'));
  const quantityCountedInput = normalizeOptionalString(formData.get('quantity_counted'));
  const quantityCounted = quantityCountedInput == null ? null : normalizeNonNegativeNumber(quantityCountedInput);
  const quantityUsedInput = normalizeOptionalString(formData.get('quantity_used'));
  const quantityUsed = quantityUsedInput == null ? null : normalizeNonNegativeNumber(quantityUsedInput);
  const note = normalizeOptionalString(formData.get('note'));
  const prepNotes = normalizeOptionalString(formData.get('prep_notes'));
  const requestedPrepStatus = normalizePrepStatus(formData.get('prep_status'));

  if (!inventoryItemId || quantityRequired == null || quantityUsedInput != null && quantityUsed == null || quantityCountedInput != null && quantityCounted == null) {
    return;
  }

  const item = await getInventoryItemById(inventoryItemId);
  if (!item || !item.is_active) {
    return;
  }

  const prepStatus = derivePrepStatus(quantityRequired, quantityCounted, requestedPrepStatus);

  await supabase
    .from('event_inventory_requirements')
    .update({
      inventory_item_id: inventoryItemId,
      quantity_required: quantityRequired,
      quantity_counted: quantityCounted,
      quantity_used: quantityUsed,
      prep_status: prepStatus,
      prep_notes: prepNotes,
      note,
      checked_by: quantityCounted != null ? session.user.id : null,
      checked_at: quantityCounted != null ? new Date().toISOString() : null,
      updated_by: session.user.id,
    })
    .eq('id', requirementId)
    .eq('event_id', eventId);

  await revalidateInventoryPaths(event.id);
}

export async function removeEventInventoryRequirementAction(eventId: string, requirementId: string) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;
  if (!hasPermission(session.user, 'inventory.prepare') && !hasPermission(session.user, 'inventory.manage')) return;

  const event = await getEventById(eventId);
  const existingRequirement = await getEventInventoryRequirementById(eventId, requirementId);
  if (!event || !existingRequirement) return;

  await supabase.from('event_inventory_requirements').delete().eq('id', requirementId).eq('event_id', eventId);

  await revalidateInventoryPaths(event.id);
}
