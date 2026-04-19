export const EVENT_INVENTORY_PREP_STATUSES = ['pendiente', 'contado', 'faltante', 'listo'] as const;
export const EVENT_INVENTORY_SHOPPING_STATUSES = ['pending', 'bought'] as const;
export const EVENT_INVENTORY_PICKING_STATUSES = ['pending', 'pulled'] as const;
export const EVENT_INVENTORY_CLOSEOUT_STATUSES = ['pending', 'submitted', 'approved', 'reopened'] as const;

export type EventInventoryPrepStatus = (typeof EVENT_INVENTORY_PREP_STATUSES)[number];
export type EventInventoryShoppingStatus = (typeof EVENT_INVENTORY_SHOPPING_STATUSES)[number];
export type EventInventoryPickingStatus = (typeof EVENT_INVENTORY_PICKING_STATUSES)[number];
export type EventInventoryCloseoutStatus = (typeof EVENT_INVENTORY_CLOSEOUT_STATUSES)[number];

export interface InventoryItemRecord {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  usage_bars: string | null;
  unit: string;
  current_stock: number;
  minimum_stock: number | null;
  ideal_stock: number | null;
  storage_location: string | null;
  storage_box: string | null;
  note: string | null;
  is_active: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventInventoryRequirementRecord {
  id: string;
  event_id: string;
  inventory_item_id: string;
  quantity_required: number;
  quantity_used: number | null;
  quantity_counted: number | null;
  prep_status: EventInventoryPrepStatus;
  prep_notes: string | null;
  checked_by: string | null;
  checked_at: string | null;
  source_type: 'manual' | 'template';
  source_template_id: string | null;
  updated_by: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventInventoryExecutionStateRecord {
  id: string;
  event_inventory_requirement_id: string;
  shopping_status: EventInventoryShoppingStatus;
  shopping_updated_at: string | null;
  shopping_updated_by: string | null;
  picking_status: EventInventoryPickingStatus;
  picking_updated_at: string | null;
  picking_updated_by: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventInventoryCloseoutStateRecord {
  id: string;
  event_inventory_requirement_id: string;
  leftover_quantity: number;
  returned_quantity: number;
  waste_quantity: number;
  closeout_status: EventInventoryCloseoutStatus;
  closed_by: string | null;
  closed_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}


export const INVENTORY_STOCK_MOVEMENT_TYPES = ['purchase_restock', 'manual_adjustment', 'returned_from_event', 'waste_loss'] as const;

export type InventoryStockMovementType = (typeof INVENTORY_STOCK_MOVEMENT_TYPES)[number];

export interface InventoryStockMovementRecord {
  id: string;
  inventory_item_id: string;
  movement_type: InventoryStockMovementType;
  quantity_delta: number;
  reference_type: string | null;
  reference_id: string | null;
  event_id: string | null;
  event_inventory_requirement_id: string | null;
  closeout_state_id: string | null;
  origin_key: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  is_posted: boolean;
  balance_after: number | null;
}

export interface InventoryStockMovementView extends InventoryStockMovementRecord {
  inventory_item_name: string;
  inventory_item_unit: string;
  event_label: string | null;
}
export interface InventoryAvailabilitySummary {
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  isLowStock: boolean;
}

export interface BarMasterTemplateRecord {
  id: string;
  name: string;
  slug: string;
  service_category: string | null;
  description: string | null;
  note: string | null;
  is_active: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface BarMasterTemplateItemRecord {
  id: string;
  template_id: string;
  inventory_item_id: string | null;
  item_name: string;
  unit: string | null;
  quantity_required: number;
  note: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BarMasterTemplateApplicationRecord {
  id: string;
  event_id: string;
  template_id: string;
  applied_by: string;
  applied_at: string;
  note: string | null;
  result_summary: Record<string, unknown>;
}
