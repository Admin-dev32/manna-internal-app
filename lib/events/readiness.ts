import type { PreEventRecord } from '@/types/pre-events';

export interface PreEventReadyState {
  isReady: boolean;
  missingItems: string[];
}

export function getPreEventReadyState(preEvent: PreEventRecord): PreEventReadyState {
  const missingItems: string[] = [];

  if (!preEvent.client_id) missingItems.push('Cliente ligado');
  if (!preEvent.source_quote_id) missingItems.push('Cotización origen');
  if (!preEvent.confirmed_date) missingItems.push('Fecha confirmada');
  if (!preEvent.confirmed_time) missingItems.push('Hora confirmada');
  if (!preEvent.booked_service) missingItems.push('Servicio contratado');

  return {
    isReady: missingItems.length === 0,
    missingItems,
  };
}
