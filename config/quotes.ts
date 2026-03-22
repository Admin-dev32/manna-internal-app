import type { QuoteStatus } from '@/types/quotes';

export const quoteStatusOptions: Array<{ value: QuoteStatus; label: string }> = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'enviada', label: 'Enviada' },
  { value: 'aceptada', label: 'Aceptada' },
  { value: 'rechazada', label: 'Rechazada' },
  { value: 'vencida', label: 'Vencida' },
];

export const quoteStatusLabels = Object.fromEntries(quoteStatusOptions.map((option) => [option.value, option.label])) as Record<QuoteStatus, string>;
