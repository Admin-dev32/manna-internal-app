import type {
  EmployeeReportStage,
  TeamLeaderQcCheckpointKey,
  TeamLeaderQcCheckpointLogActionKind,
  TeamLeaderComplianceStatus,
  TeamLeaderBonusRecommendationStatus,
  TeamLeaderBonusFinalDecisionStatus,
  TeamLeaderQcCheckpointStatus,
} from '@/types/employees';
import type { EventAssignmentRole } from '@/types/events';

export const EMPLOYEE_REPORT_STAGE_LABELS: Record<EmployeeReportStage, string> = {
  llegada: 'Llegada',
  montaje_en_proceso: 'Montaje en proceso',
  barra_terminada: 'Barra terminada',
  servicio_en_accion: 'Servicio en acción',
  cierre_area_limpia: 'Cierre con área limpia',
  inventario_guardado: 'Inventario / equipo guardado',
  actualizacion_general: 'Actualización general',
};

export const EMPLOYEE_ROLE_PROJECTION_MXN: Record<EventAssignmentRole, number> = {
  supervisor: 1400,
  team_leader: 1250,
  assistant: 900,
  lider: 1200,
  apoyo: 900,
  setup: 850,
  general: 800,
};

export const EMPLOYEE_UNAVAILABLE_NOTICE_MIN_DAYS = 5;

export const TEAM_LEADER_QC_CHECKPOINT_SEQUENCE: TeamLeaderQcCheckpointKey[] = [
  'arrival_at_event',
  'setup_ready',
  'mid_service',
  'post_service_pre_clean',
  'post_cleaning',
  'final_closeout_inventory',
];

export const TEAM_LEADER_QC_CHECKPOINT_LABELS: Record<TeamLeaderQcCheckpointKey, string> = {
  arrival_at_event: 'Llegada al evento',
  setup_ready: 'Setup listo',
  mid_service: 'Servicio a mitad del tiempo',
  post_service_pre_clean: 'Post-servicio (antes de limpiar)',
  post_cleaning: 'Post-limpieza',
  final_closeout_inventory: 'Cierre / inventario final',
};

export const TEAM_LEADER_QC_CHECKPOINT_STATUS_LABELS: Record<TeamLeaderQcCheckpointStatus, string> = {
  pending: 'Pendiente',
  submitted: 'Enviado',
  approved: 'Aprobado',
  observed: 'Observado',
};

export const TEAM_LEADER_QC_CHECKPOINT_LOG_ACTION_LABELS: Record<TeamLeaderQcCheckpointLogActionKind, string> = {
  submitted: 'Enviado',
  observed: 'Observado por supervisor',
  resubmitted: 'Reenviado (recaptura)',
  approved: 'Aprobado por supervisor',
  returned_to_submitted: 'Regresado a enviado',
};

export const TEAM_LEADER_QC_CHECKPOINT_TO_REPORT_STAGE: Record<TeamLeaderQcCheckpointKey, EmployeeReportStage> = {
  arrival_at_event: 'llegada',
  setup_ready: 'barra_terminada',
  mid_service: 'servicio_en_accion',
  post_service_pre_clean: 'actualizacion_general',
  post_cleaning: 'cierre_area_limpia',
  final_closeout_inventory: 'inventario_guardado',
};

export const TEAM_LEADER_COMPLIANCE_STATUS_LABELS: Record<TeamLeaderComplianceStatus, string> = {
  conforme: 'Conforme',
  con_observaciones: 'Con observaciones',
  no_conforme: 'No conforme',
};

export const TEAM_LEADER_BONUS_RECOMMENDATION_LABELS: Record<TeamLeaderBonusRecommendationStatus, string> = {
  recommended: 'Recomendado',
  not_recommended: 'No recomendado',
  pending: 'Pendiente',
};

export const TEAM_LEADER_BONUS_FINAL_DECISION_LABELS: Record<TeamLeaderBonusFinalDecisionStatus, string> = {
  pending: 'Pendiente decisión',
  approved: 'Bonus liberado',
  rejected: 'Bonus no liberado',
};
