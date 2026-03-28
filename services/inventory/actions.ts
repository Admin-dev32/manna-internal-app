'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';

import { requireActiveSession } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getEventById } from '@/services/events/queries';
import type { InventoryItemRecord } from '@/types/inventory';

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

async function revalidateInventoryPaths(eventId?: string) {
  revalidatePath('/inventario' as Route);
  if (eventId) {
    revalidatePath('/eventos' as Route);
    revalidatePath(`/eventos/${eventId}` as Route);
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
    quantity_used: number | null;
  } | null) ?? null;
}

export async function createInventoryItemAction(formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;

  const name = String(formData.get('name') ?? '').trim();
  const category = normalizeOptionalString(formData.get('category'));
  const unit = String(formData.get('unit') ?? '').trim();
  const currentStock = normalizeNonNegativeNumber(formData.get('current_stock'));
  const minimumStockInput = normalizeOptionalString(formData.get('minimum_stock'));
  const minimumStock = minimumStockInput == null ? null : normalizeNonNegativeNumber(minimumStockInput);
  const note = normalizeOptionalString(formData.get('note'));
  const isActive = String(formData.get('is_active') ?? 'true') === 'true';

  if (!name || !unit || currentStock == null || minimumStockInput != null && minimumStock == null) {
    return;
  }

  await supabase.from('inventory_items').insert({
    name,
    category,
    unit,
    current_stock: currentStock,
    minimum_stock: minimumStock,
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

  const existingItem = await getInventoryItemById(itemId);
  if (!existingItem) return;

  const name = String(formData.get('name') ?? '').trim();
  const category = normalizeOptionalString(formData.get('category'));
  const unit = String(formData.get('unit') ?? '').trim();
  const currentStock = normalizeNonNegativeNumber(formData.get('current_stock'));
  const minimumStockInput = normalizeOptionalString(formData.get('minimum_stock'));
  const minimumStock = minimumStockInput == null ? null : normalizeNonNegativeNumber(minimumStockInput);
  const note = normalizeOptionalString(formData.get('note'));
  const isActive = String(formData.get('is_active') ?? 'true') === 'true';

  if (!name || !unit || currentStock == null || minimumStockInput != null && minimumStock == null) {
    return;
  }

  await supabase
    .from('inventory_items')
    .update({
      name,
      category,
      unit,
      current_stock: currentStock,
      minimum_stock: minimumStock,
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

  const event = await getEventById(eventId);
  if (!event) return;

  const inventoryItemId = String(formData.get('inventory_item_id') ?? '').trim();
  const quantityRequired = normalizeNonNegativeNumber(formData.get('quantity_required'));
  const quantityUsedInput = normalizeOptionalString(formData.get('quantity_used'));
  const quantityUsed = quantityUsedInput == null ? null : normalizeNonNegativeNumber(quantityUsedInput);
  const note = normalizeOptionalString(formData.get('note'));

  if (!inventoryItemId || quantityRequired == null || quantityUsedInput != null && quantityUsed == null) {
    return;
  }

  const item = await getInventoryItemById(inventoryItemId);
  if (!item || !item.is_active) {
    return;
  }

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
        quantity_used: quantityUsed,
        note,
      })
      .eq('id', existingRequirement.id);
  } else {
    await supabase.from('event_inventory_requirements').insert({
      event_id: eventId,
      inventory_item_id: inventoryItemId,
      quantity_required: quantityRequired,
      quantity_used: quantityUsed,
      note,
    });
  }

  await revalidateInventoryPaths(event.id);
}

export async function updateEventInventoryRequirementAction(eventId: string, requirementId: string, formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;

  const event = await getEventById(eventId);
  const existingRequirement = await getEventInventoryRequirementById(eventId, requirementId);
  if (!event || !existingRequirement) return;

  const inventoryItemId = String(formData.get('inventory_item_id') ?? '').trim();
  const quantityRequired = normalizeNonNegativeNumber(formData.get('quantity_required'));
  const quantityUsedInput = normalizeOptionalString(formData.get('quantity_used'));
  const quantityUsed = quantityUsedInput == null ? null : normalizeNonNegativeNumber(quantityUsedInput);
  const note = normalizeOptionalString(formData.get('note'));

  if (!inventoryItemId || quantityRequired == null || quantityUsedInput != null && quantityUsed == null) {
    return;
  }

  const item = await getInventoryItemById(inventoryItemId);
  if (!item || !item.is_active) {
    return;
  }

  await supabase
    .from('event_inventory_requirements')
    .update({
      inventory_item_id: inventoryItemId,
      quantity_required: quantityRequired,
      quantity_used: quantityUsed,
      note,
    })
    .eq('id', requirementId)
    .eq('event_id', eventId);

  await revalidateInventoryPaths(event.id);
}

export async function removeEventInventoryRequirementAction(eventId: string, requirementId: string) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;

  const event = await getEventById(eventId);
  const existingRequirement = await getEventInventoryRequirementById(eventId, requirementId);
  if (!event || !existingRequirement) return;

  await supabase.from('event_inventory_requirements').delete().eq('id', requirementId).eq('event_id', eventId);

  await revalidateInventoryPaths(event.id);
}
