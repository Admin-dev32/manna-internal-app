-- Event operations core.
-- Extiende eventos para operación diaria real con estados operativos y checklist persistente.

alter table public.events drop constraint if exists events_status_check;

update public.events
set status = case status
  when 'programado' then 'pendiente'
  when 'en_operacion' then 'en_preparacion'
  else status
end;

alter table public.events
  alter column status set default 'pendiente';

alter table public.events
  add constraint events_status_check check (status in ('pendiente', 'confirmado', 'en_preparacion', 'completado', 'cancelado'));

comment on column public.events.operational_notes is 'Notas internas operativas separadas del contexto comercial original.';
comment on column public.events.status is 'Estado operativo del evento: pendiente, confirmado, en_preparacion, completado o cancelado.';

create table if not exists public.event_checklist_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  item_key text not null,
  label text not null,
  description text,
  is_completed boolean not null default false,
  sort_order integer not null default 0,
  completed_at timestamptz,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint event_checklist_items_unique unique (event_id, item_key)
);

comment on table public.event_checklist_items is 'Checklist operativa mínima por evento para preparación real.';
comment on column public.event_checklist_items.item_key is 'Clave estable para permitir crecer a checklist más rica después.';

create index if not exists event_checklist_items_event_idx on public.event_checklist_items (event_id, sort_order);
create index if not exists event_checklist_items_completed_idx on public.event_checklist_items (event_id, is_completed);

create or replace function public.touch_event_checklist_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.normalize_event_checklist_completion()
returns trigger
language plpgsql
as $$
begin
  if new.is_completed then
    new.completed_at = coalesce(new.completed_at, timezone('utc', now()));
  else
    new.completed_at = null;
  end if;

  return new;
end;
$$;

create or replace function public.seed_default_event_checklist_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.event_checklist_items (event_id, item_key, label, description, sort_order, updated_by)
  values
    (new.id, 'ubicacion_confirmada', 'Ubicación confirmada', 'La dirección y acceso operativo ya fueron validados.', 10, new.updated_by),
    (new.id, 'hora_confirmada', 'Hora confirmada', 'Horario final confirmado con cliente para setup y servicio.', 20, new.updated_by),
    (new.id, 'invitados_confirmados', 'Invitados confirmados', 'Cantidad definitiva de invitados confirmada para operación.', 30, new.updated_by),
    (new.id, 'servicio_confirmado', 'Servicio confirmado', 'Servicio contratado y alcance operativo confirmados.', 40, new.updated_by),
    (new.id, 'setup_revisado', 'Notas de setup revisadas', 'Las notas de montaje y operación ya fueron revisadas.', 50, new.updated_by)
  on conflict (event_id, item_key) do nothing;

  return new;
end;
$$;

insert into public.event_checklist_items (event_id, item_key, label, description, sort_order, updated_by)
select
  e.id,
  template.item_key,
  template.label,
  template.description,
  template.sort_order,
  e.updated_by
from public.events e
cross join (
  values
    ('ubicacion_confirmada', 'Ubicación confirmada', 'La dirección y acceso operativo ya fueron validados.', 10),
    ('hora_confirmada', 'Hora confirmada', 'Horario final confirmado con cliente para setup y servicio.', 20),
    ('invitados_confirmados', 'Invitados confirmados', 'Cantidad definitiva de invitados confirmada para operación.', 30),
    ('servicio_confirmado', 'Servicio confirmado', 'Servicio contratado y alcance operativo confirmados.', 40),
    ('setup_revisado', 'Notas de setup revisadas', 'Las notas de montaje y operación ya fueron revisadas.', 50)
) as template(item_key, label, description, sort_order)
on conflict (event_id, item_key) do nothing;

drop trigger if exists on_event_checklist_items_updated on public.event_checklist_items;
create trigger on_event_checklist_items_updated
before update on public.event_checklist_items
for each row execute procedure public.touch_event_checklist_updated_at();

drop trigger if exists on_event_checklist_items_completion_normalized on public.event_checklist_items;
create trigger on_event_checklist_items_completion_normalized
before insert or update on public.event_checklist_items
for each row execute procedure public.normalize_event_checklist_completion();

drop trigger if exists on_event_created_seed_checklist on public.events;
create trigger on_event_created_seed_checklist
after insert on public.events
for each row execute procedure public.seed_default_event_checklist_items();

alter table public.event_checklist_items enable row level security;

grant select, insert, update on public.event_checklist_items to authenticated;

drop policy if exists "Authenticated users can read event checklist" on public.event_checklist_items;
create policy "Authenticated users can read event checklist"
on public.event_checklist_items
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Authenticated users can create event checklist" on public.event_checklist_items;
create policy "Authenticated users can create event checklist"
on public.event_checklist_items
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "Authenticated users can update event checklist" on public.event_checklist_items;
create policy "Authenticated users can update event checklist"
on public.event_checklist_items
for update
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);
