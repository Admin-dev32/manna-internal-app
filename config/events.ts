import type { EventChecklistKey, EventStatus } from '@/types/events';

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
