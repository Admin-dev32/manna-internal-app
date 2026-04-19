export const EVENT_INVENTORY_PREP_STATUSES = ['pendiente', 'contado', 'faltante', 'listo'] as const;

export type EventInventoryPrepStatus = (typeof EVENT_INVENTORY_PREP_STATUSES)[number];

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
