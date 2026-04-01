-- Extiende sincronización de Google Calendar para reservas (pre_events) sin romper eventos existentes.

alter table if exists public.event_calendar_syncs
  drop constraint if exists event_calendar_syncs_source_record_type_check;

alter table if exists public.event_calendar_syncs
  add constraint event_calendar_syncs_source_record_type_check
  check (source_record_type in ('event', 'pre_event'));

alter table if exists public.event_calendar_syncs
  drop constraint if exists event_calendar_syncs_source_record_id_fkey;

alter table if exists public.event_calendar_syncs
  drop constraint if exists event_calendar_syncs_source_record_id_key;

create unique index if not exists event_calendar_syncs_source_unique_idx
  on public.event_calendar_syncs (source_record_type, source_record_id);
