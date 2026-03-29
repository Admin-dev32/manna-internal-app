export interface InventoryItemRecord {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  current_stock: number;
  minimum_stock: number | null;
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
