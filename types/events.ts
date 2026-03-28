export const EVENT_STATUSES = ['pendiente', 'confirmado', 'en_preparacion', 'completado', 'cancelado'] as const;
export const EVENT_CHECKLIST_KEYS = [
  'ubicacion_confirmada',
  'hora_confirmada',
  'invitados_confirmados',
  'servicio_confirmado',
  'setup_revisado',
] as const;
export const EVENT_ASSIGNMENT_ROLES = ['lider', 'apoyo', 'setup', 'general'] as const;
export const EVENT_ASSIGNMENT_STATUSES = ['pendiente', 'confirmado'] as const;
export const EVENT_TASK_STATUSES = ['pendiente', 'en_progreso', 'completada', 'bloqueada'] as const;
export const EVENT_TASK_PRIORITIES = ['baja', 'media', 'alta', 'urgente'] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];
export type EventChecklistKey = (typeof EVENT_CHECKLIST_KEYS)[number];
export type EventAssignmentRole = (typeof EVENT_ASSIGNMENT_ROLES)[number];
export type EventAssignmentStatus = (typeof EVENT_ASSIGNMENT_STATUSES)[number];
export type EventTaskStatus = (typeof EVENT_TASK_STATUSES)[number];
export type EventTaskPriority = (typeof EVENT_TASK_PRIORITIES)[number];

export interface EventRecord {
  id: string;
  client_id: string;
  lead_id: string | null;
  source_quote_id: string;
  source_pre_event_id: string;
  event_date: string;
  event_time: string;
  location: string | null;
  event_type: string | null;
  booked_service: string;
  guest_count: number | null;
  operational_notes: string | null;
  status: EventStatus;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventFinanceSnapshot {
  grossRevenue: number;
  taxReserve: number;
  salesCommission: number;
  totalExtraExpenses: number;
  netProfit: number;
}

export interface EventChecklistItemRecord {
  id: string;
  event_id: string;
  item_key: EventChecklistKey | string;
  label: string;
  description: string | null;
  is_completed: boolean;
  sort_order: number;
  completed_at: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventChecklistProgress {
  total: number;
  completed: number;
  pending: number;
}

export interface EventStaffAssignmentRecord {
  id: string;
  event_id: string;
  profile_id: string;
  assignment_role: EventAssignmentRole;
  assignment_status: EventAssignmentStatus;
  note: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventTaskRecord {
  id: string;
  event_id: string;
  assigned_profile_id: string;
  title: string;
  description: string | null;
  priority: EventTaskPriority;
  status: EventTaskStatus;
  due_at: string | null;
  internal_note: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}
