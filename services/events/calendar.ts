import type { ClientRecord } from '@/types/clients';
import type { GoogleCalendarEventPayload } from '@/types/calendar';
import type { EventRecord } from '@/types/events';

import { getGoogleCalendarTimezone } from '@/services/google-calendar/client';

function normalizeOptionalString(value: string | null | undefined) {
  return String(value ?? '').trim();
}

function addMinutesToDateTime(dateTimeLocal: string, minutes: number) {
  const date = new Date(dateTimeLocal);
  return new Date(date.getTime() + minutes * 60_000);
}

export function buildEventCalendarPayload(event: EventRecord, client: ClientRecord): GoogleCalendarEventPayload {
  const timezone = getGoogleCalendarTimezone();
  const startDateTime = `${event.event_date}T${String(event.event_time).slice(0, 5)}:00`;
  const durationMinutes = Number(process.env.GOOGLE_CALENDAR_DEFAULT_DURATION_MINUTES ?? 120);
  const safeDuration = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 120;
  const endDateTime = addMinutesToDateTime(startDateTime, safeDuration).toISOString().slice(0, 19);

  const summary = `${event.event_type ?? 'Evento'} · ${client.full_name}`;
  const description = [
    `Cliente: ${client.full_name}`,
    `Servicio: ${event.booked_service}`,
    `Invitados: ${event.guest_count ?? 'Por confirmar'}`,
    `Reserva origen: ${event.source_pre_event_id}`,
    `Cotización origen: ${event.source_quote_id}`,
    event.operational_notes ? `Notas operativas: ${event.operational_notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    summary,
    description,
    location: normalizeOptionalString(event.location),
    startDateTime,
    endDateTime,
    timeZone: timezone,
  };
}

export function validateEventCalendarRequirements(event: EventRecord, client: ClientRecord) {
  const missing: string[] = [];
  if (!event.event_date) missing.push('Fecha del evento');
  if (!event.event_time) missing.push('Hora del evento');
  if (!normalizeOptionalString(event.booked_service)) missing.push('Servicio contratado');
  if (!normalizeOptionalString(client.full_name)) missing.push('Nombre del cliente');
  if (!normalizeOptionalString(event.location)) missing.push('Ubicación del evento');

  return missing;
}
