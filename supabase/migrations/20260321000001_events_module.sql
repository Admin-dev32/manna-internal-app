-- Evento real mínimo creado desde una reserva/pre-evento listo.
-- Reutiliza cotización origen y contexto financiero existente sin duplicar hojas financieras.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  lead_id uuid references public.leads (id) on delete set null,
  source_quote_id uuid not null references public.quotes (id) on delete restrict,
  source_pre_event_id uuid not null unique references public.pre_events (id) on delete restrict,
  event_date date not null,
  event_time text not null,
  location text,
  event_type text,
  booked_service text not null,
  guest_count integer check (guest_count is null or guest_count >= 0),
  operational_notes text,
  status text not null default 'programado' check (status in ('programado', 'en_operacion', 'completado', 'cancelado')),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.events is 'Evento real derivado desde una reserva lista para operación.';
comment on column public.events.source_pre_event_id is 'Reserva origen usada para evitar duplicación de eventos.';

create index if not exists events_client_idx on public.events (client_id);
create index if not exists events_quote_idx on public.events (source_quote_id);
create index if not exists events_event_date_idx on public.events (event_date, event_time);
create index if not exists events_status_idx on public.events (status);

create or replace function public.touch_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_events_updated on public.events;
create trigger on_events_updated
before update on public.events
for each row execute procedure public.touch_events_updated_at();

alter table public.events enable row level security;

grant select, insert, update on public.events to authenticated;

drop policy if exists "Authenticated users can read events" on public.events;
create policy "Authenticated users can read events"
on public.events
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Authenticated users can create events" on public.events;
create policy "Authenticated users can create events"
on public.events
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists "Authenticated users can update events" on public.events;
create policy "Authenticated users can update events"
on public.events
for update
to authenticated
using (auth.uid() is not null)
with check (
  auth.uid() is not null
  and updated_by = auth.uid()
);
