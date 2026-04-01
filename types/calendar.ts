export interface EventCalendarSyncRecord {
  id: string;
  source_record_type: 'event' | 'pre_event';
  source_record_id: string;
  provider: 'google_calendar';
  external_event_id: string | null;
  external_event_url: string | null;
  sync_status: 'pending' | 'synced' | 'reconciled' | 'error' | 'stale';
  sync_origin: 'direct' | 'reconciled' | 'inherited';
  ownership_note: string | null;
  superseded_by_source_record_type: 'event' | 'pre_event' | null;
  superseded_by_source_record_id: string | null;
  last_error: string | null;
  synced_by: string;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoogleCalendarFingerprint {
  sourceRecordType: 'event' | 'pre_event';
  sourceRecordId: string;
  providerOrigin: 'manna_internal_app';
  provider: 'google_calendar';
}

export interface GoogleCalendarEventPayload {
  summary: string;
  description: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
}
