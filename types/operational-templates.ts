import type { EventAssignmentRole, EventTaskPriority, EventTaskStatus } from '@/types/events';

export interface OperationalTemplateRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  service_category: string | null;
  event_type: string | null;
  note: string | null;
  is_active: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface OperationalTemplateChecklistItemRecord {
  id: string;
  template_id: string;
  label: string;
  description: string | null;
  is_required: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OperationalTemplateTaskItemRecord {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  suggested_priority: EventTaskPriority;
  suggested_phase: string | null;
  suggested_role: EventAssignmentRole | null;
  priority: EventTaskPriority;
  default_status: EventTaskStatus;
  assignment_role_hint: EventAssignmentRole | null;
  due_hours_before_event: number | null;
  internal_note: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OperationalTemplateMaterialItemRecord {
  id: string;
  template_id: string;
  name: string;
  material_type: string | null;
  note: string | null;
  pending_definition: boolean;
  unknowns: string | null;
  inventory_item_id: string | null;
  quantity_required: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface EventOperationalTemplateApplicationRecord {
  id: string;
  event_id: string;
  operational_template_id: string;
  applied_by: string;
  created_checklist_count: number;
  created_task_count: number;
  created_material_count: number;
  skipped_task_count: number;
  applied_at: string;
}
