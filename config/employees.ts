import type { EmployeeReportStage } from '@/types/employees';
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
