import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { EventRecord } from '@/types/events';
import type { LeadProfileOption } from '@/types/leads';
import type {
  EventInventoryCloseoutStateRecord,
  EventInventoryExecutionStateRecord,
  EventInventoryRequirementRecord,
  InventoryAvailabilitySummary,
  InventoryItemRecord,
  InventoryStockMovementRecord,
  InventoryStockMovementView,
} from '@/types/inventory';

const ACTIVE_EVENT_STATUSES = new Set(['pendiente', 'confirmado', 'en_preparacion']);

async function getProfilesMap(ids: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || ids.length === 0) return {} as Record<string, LeadProfileOption>;

  const uniqueIds = [...new Set(ids)];
  const { data } = await supabase.from('profiles').select('id, full_name, role, is_active').in('id', uniqueIds);

  return Object.fromEntries((data ?? []).map((profile) => [profile.id, profile as LeadProfileOption])) as Record<string, LeadProfileOption>;
}

function calculateAvailabilityMaps({
  items,
  requirements,
  eventsById,
  excludeEventId,
}: {
  items: InventoryItemRecord[];
  requirements: EventInventoryRequirementRecord[];
  eventsById: Record<string, Pick<EventRecord, 'id' | 'status'>>;
  excludeEventId?: string;
}) {
  const reservedByItemId = requirements.reduce(
    (accumulator, requirement) => {
      const event = eventsById[requirement.event_id];
      if (!event || !ACTIVE_EVENT_STATUSES.has(event.status)) {
        return accumulator;
      }

      if (excludeEventId && requirement.event_id === excludeEventId) {
        return accumulator;
      }

      accumulator[requirement.inventory_item_id] = (accumulator[requirement.inventory_item_id] ?? 0) + Number(requirement.quantity_required ?? 0);
      return accumulator;
    },
    {} as Record<string, number>,
  );

  return Object.fromEntries(
    items.map((item) => {
      const currentStock = Number(item.current_stock ?? 0);
      const reservedStock = Number(reservedByItemId[item.id] ?? 0);
      const minimumStock = item.minimum_stock == null ? null : Number(item.minimum_stock);
      const availableStock = currentStock - reservedStock;

      return [
        item.id,
        {
          currentStock,
          reservedStock,
          availableStock,
          isLowStock: minimumStock != null ? currentStock <= minimumStock : false,
        } satisfies InventoryAvailabilitySummary,
      ];
    }),
  ) as Record<string, InventoryAvailabilitySummary>;
}

export async function getInventoryItems() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as InventoryItemRecord[];

  const { data } = await supabase.from('inventory_items').select('*').order('is_active', { ascending: false }).order('name', { ascending: true });
  return (data ?? []) as InventoryItemRecord[];
}

export async function getEventInventoryRequirements(eventId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as EventInventoryRequirementRecord[];

  const { data } = await supabase
    .from('event_inventory_requirements')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  return (data ?? []) as EventInventoryRequirementRecord[];
}

export async function getEventInventoryExecutionState(requirementIds: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || requirementIds.length === 0) return [] as EventInventoryExecutionStateRecord[];

  const uniqueIds = [...new Set(requirementIds)];
  const { data } = await supabase
    .from('event_inventory_execution_state')
    .select('*')
    .in('event_inventory_requirement_id', uniqueIds);

  return (data ?? []) as EventInventoryExecutionStateRecord[];
}

export async function getEventInventoryCloseoutState(requirementIds: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || requirementIds.length === 0) return [] as EventInventoryCloseoutStateRecord[];

  const uniqueIds = [...new Set(requirementIds)];
  const { data } = await supabase
    .from('event_inventory_closeout_state')
    .select('*')
    .in('event_inventory_requirement_id', uniqueIds);

  return (data ?? []) as EventInventoryCloseoutStateRecord[];
}

export async function getRecentInventoryStockMovements(params?: { eventId?: string; limit?: number }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as InventoryStockMovementView[];

  const limit = Math.max(Math.min(params?.limit ?? 20, 100), 1);
  let query = supabase
    .from('inventory_stock_movements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params?.eventId) {
    query = query.eq('event_id', params.eventId);
  }

  const { data } = await query;
  const movements = (data ?? []) as InventoryStockMovementRecord[];
  if (movements.length === 0) return [] as InventoryStockMovementView[];

  const itemIds = [...new Set(movements.map((movement) => movement.inventory_item_id))];
  const eventIds = [...new Set(movements.map((movement) => movement.event_id).filter((value): value is string => Boolean(value)))];

  const [{ data: itemsData }, { data: eventsData }] = await Promise.all([
    itemIds.length > 0
      ? supabase.from('inventory_items').select('id, name, unit').in('id', itemIds)
      : Promise.resolve({ data: [] }),
    eventIds.length > 0
      ? supabase.from('events').select('id, event_type, event_date').in('id', eventIds)
      : Promise.resolve({ data: [] }),
  ]);

  const itemMap = Object.fromEntries(((itemsData ?? []) as Array<{ id: string; name: string; unit: string }>).map((item) => [item.id, item]));
  const eventMap = Object.fromEntries(
    ((eventsData ?? []) as Array<{ id: string; event_type: string | null; event_date: string }>).map((event) => [event.id, event]),
  );

  return movements.map((movement) => {
    const item = itemMap[movement.inventory_item_id];
    const event = movement.event_id ? eventMap[movement.event_id] : null;

    return {
      ...movement,
      inventory_item_name: item?.name ?? 'Material',
      inventory_item_unit: item?.unit ?? 'u',
      event_label: event ? `${event.event_type ?? 'Evento'} · ${event.event_date}` : null,
    } satisfies InventoryStockMovementView;
  });
}

async function getEventsMapForRequirementIds(eventIds: string[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || eventIds.length === 0) return {} as Record<string, Pick<EventRecord, 'id' | 'status'>>;

  const uniqueIds = [...new Set(eventIds)];
  const { data } = await supabase.from('events').select('id, status').in('id', uniqueIds);

  return Object.fromEntries(((data ?? []) as Array<Pick<EventRecord, 'id' | 'status'>>).map((event) => [event.id, event])) as Record<string, Pick<EventRecord, 'id' | 'status'>>;
}

export async function getInventoryOverviewPageData() {
  const [items, requirements] = await Promise.all([getInventoryItems(), getAllInventoryRequirements()]);
  const eventsById = await getEventsMapForRequirementIds(requirements.map((requirement) => requirement.event_id));
  const recentMovements = await getRecentInventoryStockMovements({ limit: 40 });
  const profiles = await getProfilesMap([
    ...items.flatMap((item) => [item.created_by, item.updated_by]),
    ...recentMovements.map((movement) => movement.created_by),
    ...recentMovements.map((movement) => movement.approved_by),
  ].filter((value): value is string => Boolean(value)));

  return {
    items,
    requirements,
    availabilityByItem: calculateAvailabilityMaps({ items, requirements, eventsById }),
    profiles,
    recentMovements,
  };
}

export async function getAllInventoryRequirements() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as EventInventoryRequirementRecord[];

  const { data } = await supabase.from('event_inventory_requirements').select('*');
  return (data ?? []) as EventInventoryRequirementRecord[];
}

export async function getEventInventorySectionData(eventId: string) {
  const [items, requirements, allRequirements] = await Promise.all([
    getInventoryItems(),
    getEventInventoryRequirements(eventId),
    getAllInventoryRequirements(),
  ]);
  const [executionState, closeoutState] = await Promise.all([
    getEventInventoryExecutionState(requirements.map((requirement) => requirement.id)),
    getEventInventoryCloseoutState(requirements.map((requirement) => requirement.id)),
  ]);
  const recentMovements = await getRecentInventoryStockMovements({ eventId, limit: 30 });

  const linkedItemIds = new Set(requirements.map((requirement) => requirement.inventory_item_id));
  const eventItems = items.filter((item) => item.is_active || linkedItemIds.has(item.id));
  const eventsById = await getEventsMapForRequirementIds(allRequirements.map((requirement) => requirement.event_id));
  const availabilityByItem = calculateAvailabilityMaps({
    items,
    requirements: allRequirements,
    eventsById,
    excludeEventId: eventId,
  });

  return {
    inventoryItems: eventItems,
    requirements,
    executionStateByRequirement: Object.fromEntries(
      executionState.map((state) => [state.event_inventory_requirement_id, state]),
    ) as Record<string, EventInventoryExecutionStateRecord>,
    closeoutStateByRequirement: Object.fromEntries(
      closeoutState.map((state) => [state.event_inventory_requirement_id, state]),
    ) as Record<string, EventInventoryCloseoutStateRecord>,
    availabilityByItem,
    recentMovements,
  };
}
