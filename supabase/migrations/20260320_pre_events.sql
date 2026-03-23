-- Base mínima de pre-evento / reserva operativa inicial.
-- No sustituye todavía al módulo completo de Eventos.

create table if not exists public.pre_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  source_quote_id uuid not null unique references public.quotes (id) on delete restrict,
  confirmed_date date,
  confirmed_time time,
  location text,
  event_type text,
  booked_service text,
  confirmed_guests integer check (confirmed_guests is null or confirmed_guests >= 0),
  initial_operations_notes text,
  status text not null default 'pendiente' check (status in ('pendiente', 'confirmado', 'en_preparacion')),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.pre_events is 'Reserva operativa inicial creada a partir de una venta cerrada.';
comment on column public.pre_events.source_quote_id is 'Cotización aceptada que origina la reserva inicial.';

create index if not exists pre_events_client_idx on public.pre_events (client_id);
create index if not exists pre_events_status_idx on public.pre_events (status);
create index if not exists pre_events_confirmed_date_idx on public.pre_events (confirmed_date);

create or replace function public.touch_pre_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_pre_events_updated on public.pre_events;
create trigger on_pre_events_updated
before update on public.pre_events
for each row execute procedure public.touch_pre_events_updated_at();

alter table public.pre_events enable row level security;

grant select, insert, update on public.pre_events to authenticated;

drop policy if exists "Authenticated users can read pre-events" on public.pre_events;
create policy "Authenticated users can read pre-events"
on public.pre_events
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Authenticated users can create pre-events" on public.pre_events;
create policy "Authenticated users can create pre-events"
on public.pre_events
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists "Authenticated users can update pre-events" on public.pre_events;
create policy "Authenticated users can update pre-events"
on public.pre_events
for update
to authenticated
using (auth.uid() is not null)
with check (
  auth.uid() is not null
  and updated_by = auth.uid()
);
