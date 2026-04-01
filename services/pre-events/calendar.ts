import type { GoogleCalendarEventPayload } from '@/types/calendar';
import type { ClientRecord } from '@/types/clients';
import type { PreEventRecord } from '@/types/pre-events';

import { getGoogleCalendarTimezone } from '@/services/google-calendar/client';

function normalizeOptionalString(value: string | null | undefined) {
  return String(value ?? '').trim();
}

function addMinutesToDateTime(dateTimeLocal: string, minutes: number) {
  const date = new Date(dateTimeLocal);
  return new Date(date.getTime() + minutes * 60_000);
}

export function buildPreEventCalendarPayload(preEvent: PreEventRecord, client: ClientRecord): GoogleCalendarEventPayload {
  const timezone = getGoogleCalendarTimezone();
  const startDateTime = `${preEvent.confirmed_date}T${String(preEvent.confirmed_time).slice(0, 5)}:00`;
  const durationMinutes = Number(process.env.GOOGLE_CALENDAR_DEFAULT_DURATION_MINUTES ?? 120);
  const safeDuration = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 120;
  const endDateTime = addMinutesToDateTime(startDateTime, safeDuration).toISOString().slice(0, 19);

  const summary = `${preEvent.event_type ?? 'Reserva'} · ${client.full_name}`;
  const description = [
    `Cliente: ${client.full_name}`,
    `Servicio: ${preEvent.booked_service}`,
    `Invitados: ${preEvent.confirmed_guests ?? 'Por confirmar'}`,
    `Reserva origen: ${preEvent.id}`,
    `Cotización origen: ${preEvent.source_quote_id}`,
    preEvent.initial_operations_notes ? `Notas operativas: ${preEvent.initial_operations_notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    summary,
    description,
    location: normalizeOptionalString(preEvent.location),
    startDateTime,
    endDateTime,
    timeZone: timezone,
  };
}

export function validatePreEventCalendarRequirements(preEvent: PreEventRecord, client: ClientRecord) {
  const missing: string[] = [];
  if (!preEvent.confirmed_date) missing.push('Fecha confirmada');
  if (!preEvent.confirmed_time) missing.push('Hora confirmada');
  if (!normalizeOptionalString(preEvent.booked_service)) missing.push('Servicio contratado');
  if (!normalizeOptionalString(client.full_name)) missing.push('Nombre del cliente');
  if (!normalizeOptionalString(preEvent.location)) missing.push('Ubicación del evento');

  return missing;
}
