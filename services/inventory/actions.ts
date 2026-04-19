'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';

import { requireActiveSession } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getEventById } from '@/services/events/queries';
import type {
  EventInventoryCloseoutStatus,
  EventInventoryPickingStatus,
  EventInventoryPrepStatus,
  EventInventoryShoppingStatus,
  InventoryItemRecord,
  InventoryStockMovementRecord,
  InventoryStockMovementType,
} from '@/types/inventory';

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

function normalizeSignedNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue) || numericValue === 0) {
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

function normalizeShoppingStatus(value: string): EventInventoryShoppingStatus | null {
  return value === 'pending' || value === 'bought' ? value : null;
}

function normalizePickingStatus(value: string): EventInventoryPickingStatus | null {
  return value === 'pending' || value === 'pulled' ? value : null;
}

function normalizeCloseoutStatus(value: string): EventInventoryCloseoutStatus | null {
  return value === 'pending' || value === 'submitted' || value === 'approved' || value === 'reopened' ? value : null;
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

async function getCloseoutStateByRequirementId(requirementId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('event_inventory_closeout_state')
    .select('*')
    .eq('event_inventory_requirement_id', requirementId)
    .maybeSingle();

  return (data as {
    id: string;
    event_inventory_requirement_id: string;
    returned_quantity: number;
    waste_quantity: number;
    closeout_status: EventInventoryCloseoutStatus;
  } | null) ?? null;
}

async function getMovementByOriginKey(originKey: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('inventory_stock_movements')
    .select('*')
    .eq('origin_key', originKey)
    .maybeSingle();

  return (data as InventoryStockMovementRecord | null) ?? null;
}

async function createInventoryStockMovement(params: {
  inventoryItemId: string;
  movementType: InventoryStockMovementType;
  quantityDelta: number;
  createdBy: string;
  approvedBy?: string;
  eventId?: string | null;
  eventInventoryRequirementId?: string | null;
  closeoutStateId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  originKey?: string | null;
  note?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  if (!Number.isFinite(params.quantityDelta) || params.quantityDelta === 0) return null;

  if (params.originKey) {
    const existing = await getMovementByOriginKey(params.originKey);
    if (existing) return existing;
  }

  const { data: stockRow } = await supabase
    .from('inventory_items')
    .select('current_stock')
    .eq('id', params.inventoryItemId)
    .maybeSingle();

  const currentStock = Number(stockRow?.current_stock ?? 0);
  const nextStock = Number((currentStock + params.quantityDelta).toFixed(2));
  if (nextStock < 0) return null;

  const { data: inserted, error } = await supabase
    .from('inventory_stock_movements')
    .insert({
      inventory_item_id: params.inventoryItemId,
      movement_type: params.movementType,
      quantity_delta: params.quantityDelta,
      reference_type: params.referenceType ?? null,
      reference_id: params.referenceId ?? null,
      event_id: params.eventId ?? null,
      event_inventory_requirement_id: params.eventInventoryRequirementId ?? null,
      closeout_state_id: params.closeoutStateId ?? null,
      origin_key: params.originKey ?? null,
      note: params.note ?? null,
      created_by: params.createdBy,
      approved_by: params.approvedBy ?? null,
      approved_at: params.approvedBy ? new Date().toISOString() : null,
      is_posted: true,
    })
    .select('*')
    .maybeSingle();

  if (error || !inserted) return null;

  await supabase
    .from('inventory_items')
    .update({
      current_stock: nextStock,
      updated_by: params.createdBy,
    })
    .eq('id', params.inventoryItemId);

  await supabase
    .from('inventory_stock_movements')
    .update({
      balance_after: nextStock,
    })
    .eq('id', inserted.id);

  return {
    ...(inserted as InventoryStockMovementRecord),
    balance_after: nextStock,
  } satisfies InventoryStockMovementRecord;
}

async function publishCloseoutMovements(params: {
  requirementId: string;
  eventId: string;
  reviewerUserId: string;
}) {
  const requirement = await getEventInventoryRequirementById(params.eventId, params.requirementId);
  if (!requirement) return;

  const closeoutState = await getCloseoutStateByRequirementId(params.requirementId);
  if (!closeoutState || closeoutState.closeout_status !== 'approved') return;

  const returnedQuantity = Number(closeoutState.returned_quantity ?? 0);
  const wasteQuantity = Number(closeoutState.waste_quantity ?? 0);

  if (returnedQuantity > 0) {
    await createInventoryStockMovement({
      inventoryItemId: requirement.inventory_item_id,
      movementType: 'returned_from_event',
      quantityDelta: Number(returnedQuantity.toFixed(2)),
      createdBy: params.reviewerUserId,
      approvedBy: params.reviewerUserId,
      eventId: params.eventId,
      eventInventoryRequirementId: params.requirementId,
      closeoutStateId: closeoutState.id,
      referenceType: 'event_inventory_closeout',
      referenceId: closeoutState.id,
      originKey: `closeout:${closeoutState.id}:returned`,
      note: 'Publicado automáticamente al aprobar closeout.',
    });
  }

  if (wasteQuantity > 0) {
    await createInventoryStockMovement({
      inventoryItemId: requirement.inventory_item_id,
      movementType: 'waste_loss',
      quantityDelta: Number((-Math.abs(wasteQuantity)).toFixed(2)),
      createdBy: params.reviewerUserId,
      approvedBy: params.reviewerUserId,
      eventId: params.eventId,
      eventInventoryRequirementId: params.requirementId,
      closeoutStateId: closeoutState.id,
      referenceType: 'event_inventory_closeout',
      referenceId: closeoutState.id,
      originKey: `closeout:${closeoutState.id}:waste`,
      note: 'Publicado automáticamente al aprobar closeout.',
    });
  }
}

export async function createInventoryRestockAction(formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;
  if (!hasPermission(session.user, 'inventory.manage')) return;

  const inventoryItemId = String(formData.get('inventory_item_id') ?? '').trim();
  const quantity = normalizeNonNegativeNumber(formData.get('quantity'));
  const note = normalizeOptionalString(formData.get('note'));

  if (!inventoryItemId || quantity == null || quantity <= 0) {
    return;
  }

  const item = await getInventoryItemById(inventoryItemId);
  if (!item || !item.is_active) return;

  await createInventoryStockMovement({
    inventoryItemId,
    movementType: 'purchase_restock',
    quantityDelta: Number(quantity.toFixed(2)),
    createdBy: session.user.id,
    approvedBy: session.user.id,
    referenceType: 'inventory_manual_restock',
    referenceId: null,
    note: note ?? 'Restock manual desde inventario maestro.',
  });

  await revalidateInventoryPaths();
}

export async function createInventoryManualAdjustmentAction(formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;
  if (!hasPermission(session.user, 'inventory.manage')) return;

  const inventoryItemId = String(formData.get('inventory_item_id') ?? '').trim();
  const quantityDelta = normalizeSignedNumber(formData.get('quantity_delta'));
  const note = normalizeOptionalString(formData.get('note'));

  if (!inventoryItemId || quantityDelta == null || !note) {
    return;
  }

  const item = await getInventoryItemById(inventoryItemId);
  if (!item) return;

  await createInventoryStockMovement({
    inventoryItemId,
    movementType: 'manual_adjustment',
    quantityDelta: Number(quantityDelta.toFixed(2)),
    createdBy: session.user.id,
    approvedBy: session.user.id,
    referenceType: 'inventory_manual_adjustment',
    referenceId: null,
    note,
  });

  await revalidateInventoryPaths();
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

export async function updateEventInventoryExecutionStateAction(
  eventId: string,
  requirementId: string,
  track: 'shopping' | 'picking',
  nextStatus: string,
) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;
  if (!hasPermission(session.user, 'inventory.prepare') && !hasPermission(session.user, 'inventory.manage')) return;

  const event = await getEventById(eventId);
  const requirement = await getEventInventoryRequirementById(eventId, requirementId);
  if (!event || !requirement) return;

  const nowIso = new Date().toISOString();
  const shoppingStatus = track === 'shopping' ? normalizeShoppingStatus(nextStatus) : null;
  const pickingStatus = track === 'picking' ? normalizePickingStatus(nextStatus) : null;
  if ((track === 'shopping' && !shoppingStatus) || (track === 'picking' && !pickingStatus)) return;

  const { data: existingState } = await supabase
    .from('event_inventory_execution_state')
    .select('*')
    .eq('event_inventory_requirement_id', requirementId)
    .maybeSingle();

  if (!existingState) {
    await supabase.from('event_inventory_execution_state').insert({
      event_inventory_requirement_id: requirementId,
      shopping_status: shoppingStatus ?? 'pending',
      shopping_updated_at: track === 'shopping' ? nowIso : null,
      shopping_updated_by: track === 'shopping' ? session.user.id : null,
      picking_status: pickingStatus ?? 'pending',
      picking_updated_at: track === 'picking' ? nowIso : null,
      picking_updated_by: track === 'picking' ? session.user.id : null,
    });
  } else {
    if (track === 'shopping') {
      await supabase
        .from('event_inventory_execution_state')
        .update({
          shopping_status: shoppingStatus,
          shopping_updated_at: nowIso,
          shopping_updated_by: session.user.id,
        })
        .eq('event_inventory_requirement_id', requirementId);
    } else {
      await supabase
        .from('event_inventory_execution_state')
        .update({
          picking_status: pickingStatus,
          picking_updated_at: nowIso,
          picking_updated_by: session.user.id,
        })
        .eq('event_inventory_requirement_id', requirementId);
    }
  }

  await revalidateInventoryPaths(event.id);
}

export async function submitEventInventoryCloseoutAction(eventId: string, requirementId: string, formData: FormData) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;
  if (!hasPermission(session.user, 'inventory.prepare') && !hasPermission(session.user, 'inventory.manage')) return;

  const event = await getEventById(eventId);
  const requirement = await getEventInventoryRequirementById(eventId, requirementId);
  if (!event || !requirement) return;

  const quantityUsedInput = normalizeOptionalString(formData.get('quantity_used'));
  const quantityUsed = quantityUsedInput == null ? null : normalizeNonNegativeNumber(quantityUsedInput);
  const leftoverInput = normalizeOptionalString(formData.get('leftover_quantity'));
  const returnedInput = normalizeOptionalString(formData.get('returned_quantity'));
  const wasteInput = normalizeOptionalString(formData.get('waste_quantity'));
  const note = normalizeOptionalString(formData.get('closeout_note'));
  const leftoverQuantity = normalizeNonNegativeNumber(leftoverInput);
  const returnedQuantity = normalizeNonNegativeNumber(returnedInput);
  const wasteQuantity = normalizeNonNegativeNumber(wasteInput);

  if (
    quantityUsedInput != null && quantityUsed == null ||
    leftoverQuantity == null ||
    returnedQuantity == null ||
    wasteQuantity == null ||
    returnedQuantity > leftoverQuantity ||
    wasteQuantity > leftoverQuantity ||
    returnedQuantity + wasteQuantity > leftoverQuantity
  ) {
    return;
  }

  const nowIso = new Date().toISOString();

  if (quantityUsed != null) {
    await supabase
      .from('event_inventory_requirements')
      .update({
        quantity_used: quantityUsed,
        updated_by: session.user.id,
      })
      .eq('id', requirementId)
      .eq('event_id', eventId);
  }

  const payload = {
    event_inventory_requirement_id: requirementId,
    leftover_quantity: leftoverQuantity,
    returned_quantity: returnedQuantity,
    waste_quantity: wasteQuantity,
    closeout_status: 'submitted' as EventInventoryCloseoutStatus,
    closed_by: session.user.id,
    closed_at: nowIso,
    note,
  };

  await supabase
    .from('event_inventory_closeout_state')
    .upsert(payload, { onConflict: 'event_inventory_requirement_id' });

  await revalidateInventoryPaths(event.id);
}

export async function reviewEventInventoryCloseoutAction(
  eventId: string,
  requirementId: string,
  nextStatus: 'approved' | 'reopened',
) {
  const session = await requireActiveSession();
  const supabase = await createSupabaseServerClient();

  if (!supabase || !session.user) return;
  if (!hasPermission(session.user, 'inventory.manage')) return;

  const event = await getEventById(eventId);
  const requirement = await getEventInventoryRequirementById(eventId, requirementId);
  const closeoutStatus = normalizeCloseoutStatus(nextStatus);
  if (!event || !requirement || !closeoutStatus || (closeoutStatus !== 'approved' && closeoutStatus !== 'reopened')) return;

  const nowIso = new Date().toISOString();

  await supabase
    .from('event_inventory_closeout_state')
    .upsert(
      {
        event_inventory_requirement_id: requirementId,
        closeout_status: closeoutStatus,
        reviewed_by: session.user.id,
        reviewed_at: nowIso,
      },
      { onConflict: 'event_inventory_requirement_id' },
    );

  if (closeoutStatus === 'approved') {
    await publishCloseoutMovements({
      requirementId,
      eventId: event.id,
      reviewerUserId: session.user.id,
    });
  }

  await revalidateInventoryPaths(event.id);
}
