-- Sincronización manual de eventos con Google Calendar desde la app interna.

create table if not exists public.event_calendar_syncs (
  id uuid primary key default gen_random_uuid(),
  source_record_type text not null check (source_record_type in ('event', 'pre_event')),
  source_record_id uuid not null,
  provider text not null check (provider in ('google_calendar')),
  external_event_id text,
  external_event_url text,
  sync_status text not null check (sync_status in ('pending', 'synced', 'reconciled', 'error', 'stale')) default 'pending',
  sync_origin text not null check (sync_origin in ('direct', 'reconciled', 'inherited')) default 'direct',
  ownership_note text,
  superseded_by_source_record_type text check (superseded_by_source_record_type in ('event', 'pre_event')),
  superseded_by_source_record_id uuid,
  last_error text,
  synced_by uuid not null references public.profiles (id) on delete restrict,
  synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists event_calendar_syncs_source_unique_idx on public.event_calendar_syncs (source_record_type, source_record_id);
create unique index if not exists event_calendar_syncs_external_event_unique_idx on public.event_calendar_syncs (external_event_id) where external_event_id is not null and sync_status <> 'stale';

create index if not exists event_calendar_syncs_status_idx on public.event_calendar_syncs (sync_status, updated_at desc);

create or replace function public.touch_event_calendar_syncs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_event_calendar_syncs_updated on public.event_calendar_syncs;
create trigger on_event_calendar_syncs_updated
before update on public.event_calendar_syncs
for each row execute procedure public.touch_event_calendar_syncs_updated_at();

alter table public.event_calendar_syncs enable row level security;

grant select, insert, update on public.event_calendar_syncs to authenticated;

drop policy if exists "Authenticated users can read event calendar syncs" on public.event_calendar_syncs;
create policy "Authenticated users can read event calendar syncs"
on public.event_calendar_syncs
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Authenticated users can create event calendar syncs" on public.event_calendar_syncs;
create policy "Authenticated users can create event calendar syncs"
on public.event_calendar_syncs
for insert
to authenticated
with check (
  auth.uid() is not null
  and synced_by = auth.uid()
);

drop policy if exists "Authenticated users can update event calendar syncs" on public.event_calendar_syncs;
create policy "Authenticated users can update event calendar syncs"
on public.event_calendar_syncs
for update
to authenticated
using (auth.uid() is not null)
with check (
  auth.uid() is not null
  and synced_by = auth.uid()
);
