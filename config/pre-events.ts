import type { PreEventStatus } from '@/types/pre-events';

export const preEventStatusOptions: Array<{ value: PreEventStatus; label: string }> = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'en_preparacion', label: 'En preparación' },
];

export const preEventStatusLabels = Object.fromEntries(preEventStatusOptions.map((option) => [option.value, option.label])) as Record<PreEventStatus, string>;
