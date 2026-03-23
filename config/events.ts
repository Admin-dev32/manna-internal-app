import type {
  EventAssignmentRole,
  EventAssignmentStatus,
  EventChecklistKey,
  EventStatus,
  EventTaskPriority,
  EventTaskStatus,
} from '@/types/events';

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  en_preparacion: 'En preparación',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

export const EVENT_STATUS_DESCRIPTIONS: Record<EventStatus, string> = {
  pendiente: 'Evento creado, pero aún requiere validaciones operativas básicas.',
  confirmado: 'Evento confirmado y listo para plan de preparación.',
  en_preparacion: 'El equipo ya está ejecutando preparación operativa del evento.',
  completado: 'El evento terminó y quedó cerrado operativamente.',
  cancelado: 'El evento fue cancelado y ya no debe avanzar en operación.',
};

export const EVENT_STATUS_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  pendiente: ['confirmado', 'cancelado'],
  confirmado: ['en_preparacion', 'cancelado'],
  en_preparacion: ['completado', 'cancelado'],
  completado: [],
  cancelado: [],
};

export interface EventChecklistTemplateItem {
  key: EventChecklistKey;
  label: string;
  description: string;
  sortOrder: number;
}

export const EVENT_CHECKLIST_TEMPLATE: EventChecklistTemplateItem[] = [
  {
    key: 'ubicacion_confirmada',
    label: 'Ubicación confirmada',
    description: 'La dirección, acceso o punto exacto de montaje ya fue validado.',
    sortOrder: 10,
  },
  {
    key: 'hora_confirmada',
    label: 'Hora confirmada',
    description: 'Horario definitivo confirmado con el cliente para setup y servicio.',
    sortOrder: 20,
  },
  {
    key: 'invitados_confirmados',
    label: 'Invitados confirmados',
    description: 'Cantidad de invitados validada para operación y servicio.',
    sortOrder: 30,
  },
  {
    key: 'servicio_confirmado',
    label: 'Servicio confirmado',
    description: 'Servicio contratado y alcance operativo confirmados.',
    sortOrder: 40,
  },
  {
    key: 'setup_revisado',
    label: 'Notas de setup revisadas',
    description: 'Las notas operativas ya fueron revisadas por operación.',
    sortOrder: 50,
  },
];

export const EVENT_ASSIGNMENT_ROLE_LABELS: Record<EventAssignmentRole, string> = {
  lider: 'Líder',
  apoyo: 'Apoyo',
  setup: 'Setup',
  general: 'General',
};

export const EVENT_ASSIGNMENT_STATUS_LABELS: Record<EventAssignmentStatus, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
};

export const EVENT_TASK_STATUS_LABELS: Record<EventTaskStatus, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
  bloqueada: 'Bloqueada',
};

export const EVENT_TASK_PRIORITY_LABELS: Record<EventTaskPriority, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};
