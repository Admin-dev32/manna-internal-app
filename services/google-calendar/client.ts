import { createSign } from 'node:crypto';

import type { GoogleCalendarEventPayload, GoogleCalendarFingerprint } from '@/types/calendar';

interface GoogleCalendarConfig {
  clientEmail: string;
  privateKey: string;
  calendarId: string;
  timezone: string;
}

interface GoogleCalendarApiEvent {
  id?: string;
  htmlLink?: string;
  summary?: string;
  location?: string;
  start?: { dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}

function base64UrlEncode(input: string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function getGoogleCalendarConfig(): GoogleCalendarConfig {
  const clientEmail = process.env.GOOGLE_CALENDAR_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.GOOGLE_CALENDAR_PRIVATE_KEY?.trim();
  const calendarId = process.env.GOOGLE_CALENDAR_CALENDAR_ID?.trim();
  const timezone = process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() ?? 'America/Mexico_City';

  if (!clientEmail || !privateKeyRaw || !calendarId) {
    throw new Error('Configura GOOGLE_CALENDAR_CLIENT_EMAIL, GOOGLE_CALENDAR_PRIVATE_KEY y GOOGLE_CALENDAR_CALENDAR_ID para sincronizar.');
  }

  return {
    clientEmail,
    privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
    calendarId,
    timezone,
  };
}

async function getGoogleAccessToken(config: GoogleCalendarConfig) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: config.clientEmail,
    scope: 'https://www.googleapis.com/auth/calendar.events',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const unsignedJwt = `${encodedHeader}.${encodedClaims}`;

  const signer = createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer.sign(config.privateKey, 'base64url');
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const data = (await response.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? 'No fue posible autenticar contra Google Calendar.');
  }

  return data.access_token;
}

function toPrivateExtendedProperties(fingerprint: GoogleCalendarFingerprint) {
  return {
    manna_provider_origin: fingerprint.providerOrigin,
    manna_provider: fingerprint.provider,
    manna_source_record_type: fingerprint.sourceRecordType,
    manna_source_record_id: fingerprint.sourceRecordId,
  };
}

function buildGoogleEventBody(payload: GoogleCalendarEventPayload, fingerprint: GoogleCalendarFingerprint) {
  return {
    summary: payload.summary,
    description: payload.description,
    location: payload.location,
    start: {
      dateTime: payload.startDateTime,
      timeZone: payload.timeZone,
    },
    end: {
      dateTime: payload.endDateTime,
      timeZone: payload.timeZone,
    },
    extendedProperties: {
      private: toPrivateExtendedProperties(fingerprint),
    },
  };
}

async function listCalendarEventsWithQuery(accessToken: string, config: GoogleCalendarConfig, params: Record<string, string | string[]>) {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, item));
      continue;
    }

    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = (await response.json()) as { items?: GoogleCalendarApiEvent[]; error?: { message?: string }; message?: string };
  if (!response.ok) {
    throw new Error(data.error?.message ?? data.message ?? 'No fue posible consultar eventos de Google Calendar.');
  }

  return data.items ?? [];
}

export async function findGoogleCalendarEventByFingerprint(fingerprint: GoogleCalendarFingerprint) {
  const config = getGoogleCalendarConfig();
  const accessToken = await getGoogleAccessToken(config);
  const params = {
    singleEvents: 'true',
    maxResults: '5',
    privateExtendedProperty: [
      `manna_provider_origin=${fingerprint.providerOrigin}`,
      `manna_provider=${fingerprint.provider}`,
      `manna_source_record_type=${fingerprint.sourceRecordType}`,
      `manna_source_record_id=${fingerprint.sourceRecordId}`,
    ],
  };

  const items = await listCalendarEventsWithQuery(accessToken, config, params);
  const match = items.find((item) => item.id);
  if (!match?.id) return null;

  return {
    externalEventId: match.id,
    externalEventUrl: match.htmlLink ?? null,
  };
}

export async function findGoogleCalendarEventByHeuristic(payload: GoogleCalendarEventPayload) {
  const config = getGoogleCalendarConfig();
  const accessToken = await getGoogleAccessToken(config);
  const start = new Date(payload.startDateTime);
  const end = new Date(start.getTime() + 90 * 60_000);

  const items = await listCalendarEventsWithQuery(accessToken, config, {
    singleEvents: 'true',
    maxResults: '25',
    timeMin: new Date(start.getTime() - 60 * 60_000).toISOString(),
    timeMax: end.toISOString(),
    q: payload.summary.slice(0, 80),
  });

  const normalizedSummary = payload.summary.trim().toLowerCase();
  const normalizedLocation = payload.location.trim().toLowerCase();
  const normalizedStart = payload.startDateTime.slice(0, 16);

  const strictMatch = items.find((item) => {
    const itemSummary = String(item.summary ?? '').trim().toLowerCase();
    const itemLocation = String(item.location ?? '').trim().toLowerCase();
    const itemStart = String(item.start?.dateTime ?? '').slice(0, 16);
    return itemSummary === normalizedSummary && itemLocation === normalizedLocation && itemStart === normalizedStart;
  });

  if (!strictMatch?.id) return null;
  return {
    externalEventId: strictMatch.id,
    externalEventUrl: strictMatch.htmlLink ?? null,
  };
}

export async function upsertGoogleCalendarEvent(
  payload: GoogleCalendarEventPayload,
  fingerprint: GoogleCalendarFingerprint,
  externalEventId?: string | null,
) {
  const config = getGoogleCalendarConfig();
  const accessToken = await getGoogleAccessToken(config);
  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`;
  const method = externalEventId ? 'PATCH' : 'POST';
  const endpoint = externalEventId ? `${baseUrl}/${encodeURIComponent(externalEventId)}` : baseUrl;

  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildGoogleEventBody(payload, fingerprint)),
  });

  const data = (await response.json()) as { id?: string; htmlLink?: string; message?: string; error?: { message?: string } };
  if (!response.ok || !data.id) {
    throw new Error(data.error?.message ?? data.message ?? 'Google Calendar devolvió un error al sincronizar.');
  }

  return {
    externalEventId: data.id,
    externalEventUrl: data.htmlLink ?? null,
    provider: 'google_calendar' as const,
    timezone: config.timezone,
  };
}

export function getGoogleCalendarTimezone() {
  return process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() ?? 'America/Mexico_City';
}

export function createGoogleCalendarFingerprint(sourceRecordType: 'event' | 'pre_event', sourceRecordId: string): GoogleCalendarFingerprint {
  return {
    sourceRecordType,
    sourceRecordId,
    providerOrigin: 'manna_internal_app',
    provider: 'google_calendar',
  };
}
