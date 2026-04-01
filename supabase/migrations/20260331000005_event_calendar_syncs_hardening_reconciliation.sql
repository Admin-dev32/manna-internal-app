-- Hardening de Google Calendar: reconciliación y ownership pre_event -> event.

alter table if exists public.event_calendar_syncs
  drop constraint if exists event_calendar_syncs_sync_status_check;

alter table if exists public.event_calendar_syncs
  add constraint event_calendar_syncs_sync_status_check
  check (sync_status in ('pending', 'synced', 'reconciled', 'error', 'stale'));

alter table if exists public.event_calendar_syncs
  add column if not exists sync_origin text not null default 'direct'
    check (sync_origin in ('direct', 'reconciled', 'inherited'));

alter table if exists public.event_calendar_syncs
  add column if not exists ownership_note text;

alter table if exists public.event_calendar_syncs
  add column if not exists superseded_by_source_record_type text
    check (superseded_by_source_record_type in ('event', 'pre_event'));

alter table if exists public.event_calendar_syncs
  add column if not exists superseded_by_source_record_id uuid;

drop index if exists event_calendar_syncs_external_event_unique_idx;
create unique index if not exists event_calendar_syncs_external_event_unique_idx
  on public.event_calendar_syncs (external_event_id)
  where external_event_id is not null and sync_status <> 'stale';
