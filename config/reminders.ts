import type { ReminderArea, ReminderSeverity, ReminderTiming } from '@/types/reminders';

export const REMINDER_AREA_LABELS: Record<ReminderArea, string> = {
  lead: 'Lead',
  task: 'Tarea',
  pre_event: 'Reserva',
  event: 'Evento',
  communication: 'Comunicación',
};

export const REMINDER_TIMING_LABELS: Record<ReminderTiming, string> = {
  overdue: 'Vencido',
  today: 'Hoy',
  upcoming: 'Próximo',
  incomplete: 'Incompleto',
};

export const REMINDER_SEVERITY_LABELS: Record<ReminderSeverity, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
};

export const REMINDER_UPCOMING_WINDOW_DAYS = 7;
export const LEAD_STALE_AFTER_DAYS = 3;
