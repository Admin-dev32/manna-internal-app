import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { EventRecord } from '@/types/events';
import type { LeadProfileOption } from '@/types/leads';
import type { EventInventoryRequirementRecord, InventoryAvailabilitySummary, InventoryItemRecord } from '@/types/inventory';

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
  const profiles = await getProfilesMap(items.flatMap((item) => [item.created_by, item.updated_by]));

  return {
    items,
    requirements,
    availabilityByItem: calculateAvailabilityMaps({ items, requirements, eventsById }),
    profiles,
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
    availabilityByItem,
  };
}
