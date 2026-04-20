import type { EventAssignmentRole, EventAssignmentStatus, EventChecklistItemRecord, EventRecord } from '@/types/events';
import type { EventInventoryCloseoutStateRecord, EventInventoryExecutionStateRecord, EventInventoryRequirementRecord, InventoryItemRecord } from '@/types/inventory';

export type EmployeeReportStage =
  | 'llegada'
  | 'montaje_en_proceso'
  | 'barra_terminada'
  | 'servicio_en_accion'
  | 'cierre_area_limpia'
  | 'inventario_guardado'
  | 'actualizacion_general';

export type EmployeeReportReviewStatus = 'pendiente_revision' | 'en_revision' | 'aprobado' | 'observado' | 'requiere_correccion' | 'bonus_liberado';
export type EmployeeAvailabilityStatus = 'unavailable_reported' | 'withdrawn';

export interface EmployeeAssignedEvent {
  event: EventRecord;
  assignmentId: string;
  assignmentRole: EventAssignmentRole;
  assignmentStatus: EventAssignmentStatus;
  assignmentNote: string | null;
}

export interface TeamLeaderExecutionRequirement {
  requirement: EventInventoryRequirementRecord;
  item: InventoryItemRecord | null;
  executionState: EventInventoryExecutionStateRecord | null;
  closeoutState: EventInventoryCloseoutStateRecord | null;
  quantityToBuy: number;
  quantityToPull: number;
}

export interface TeamLeaderExecutionContext {
  assignmentId: string;
  event: EventRecord;
  handoffStatus: 'draft' | 'ready_for_handoff' | 'handed_off';
  handoffNote: string | null;
  shoppingList: TeamLeaderExecutionRequirement[];
  pickingList: TeamLeaderExecutionRequirement[];
  checklistItems: EventChecklistItemRecord[];
}

export interface AssistantLightContext {
  assignmentId: string;
  event: EventRecord;
  eventStatusLabel: string;
  teamLeaderName: string | null;
  teamLeaderAssignmentId: string | null;
  handoffStatus: 'draft' | 'ready_for_handoff' | 'handed_off';
  checklistItems: EventChecklistItemRecord[];
  shoppingList: TeamLeaderExecutionRequirement[];
  pickingList: TeamLeaderExecutionRequirement[];
}

export interface EmployeeEventReportRecord {
  id: string;
  event_id: string;
  assignment_id: string;
  reporter_profile_id: string;
  report_stage: EmployeeReportStage;
  status_update: string | null;
  service_notes: string | null;
  evidence_urls: string[];
  review_status: EmployeeReportReviewStatus;
  review_notes: string | null;
  bonus_amount: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  correction_requested_at: string | null;
  bonus_released_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeReportEvidenceRecord {
  id: string;
  report_id: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string;
  is_discarded: boolean;
  discarded_by: string | null;
  discarded_at: string | null;
  discard_reason: string | null;
  created_at: string;
}
