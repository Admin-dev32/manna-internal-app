import type { LeadLanguage, LeadPriority, LeadStatus, LeadViewMode } from '@/types/leads';

export const leadStatusOptions: Array<{ value: LeadStatus; label: string }> = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'contactado', label: 'Contactado' },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'calificado', label: 'Calificado' },
  { value: 'ganado', label: 'Ganado' },
  { value: 'perdido', label: 'Perdido' },
];

export const leadPriorityOptions: Array<{ value: LeadPriority; label: string }> = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

export const leadLanguageOptions: Array<{ value: LeadLanguage; label: string }> = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
];

export const leadSourceOptions = [
  'Instagram',
  'WhatsApp',
  'Sitio web',
  'Referido',
  'Llamada',
  'Email',
  'Evento',
  'Otro',
] as const;

export const leadEventTypeOptions = ['Boda', 'Corporativo', 'Cumpleaños', 'Festival', 'Activación', 'Otro'] as const;

export const leadServiceOptions = [
  'Mini Pancake Bar',
  'Tostiloco Bar',
  'Maruchan Bar',
  'Esquites Bar',
  'Manna Snack Bar — La Clásica',
  'Chocolate Fountain',
  'Servicio con 2 barras',
] as const;

export const leadStatusLabels = Object.fromEntries(leadStatusOptions.map((option) => [option.value, option.label])) as Record<LeadStatus, string>;
export const leadPriorityLabels = Object.fromEntries(leadPriorityOptions.map((option) => [option.value, option.label])) as Record<LeadPriority, string>;

export const leadViewOptions: Array<{ value: LeadViewMode; label: string; available: boolean }> = [
  { value: 'table', label: 'Tabla', available: true },
  { value: 'kanban', label: 'Kanban', available: false },
  { value: 'calendar', label: 'Calendario', available: false },
  { value: 'cards', label: 'Cards', available: false },
];
