-- Inventario mínimo y materiales por evento.
-- Base preparada para crecer después a movimientos, consumo real y costos ligados.

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  unit text not null,
  current_stock numeric(12, 2) not null default 0 check (current_stock >= 0),
  minimum_stock numeric(12, 2) check (minimum_stock is null or minimum_stock >= 0),
  note text,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.inventory_items is 'Catálogo mínimo de materiales e insumos internos.';
comment on column public.inventory_items.current_stock is 'Stock editable directo en esta iteración base, sin movimientos avanzados.';
comment on column public.inventory_items.minimum_stock is 'Umbral opcional para alertas visuales de stock bajo.';

create index if not exists inventory_items_active_idx on public.inventory_items (is_active, name);
create index if not exists inventory_items_category_idx on public.inventory_items (category);

create table if not exists public.event_inventory_requirements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  quantity_required numeric(12, 2) not null default 0 check (quantity_required >= 0),
  quantity_used numeric(12, 2) check (quantity_used is null or quantity_used >= 0),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint event_inventory_requirements_unique unique (event_id, inventory_item_id)
);

comment on table public.event_inventory_requirements is 'Materiales e insumos ligados a cada evento con cantidades requeridas y usadas.';
comment on column public.event_inventory_requirements.quantity_required is 'Cantidad planeada para cubrir el evento.';
comment on column public.event_inventory_requirements.quantity_used is 'Cantidad realmente usada o consumida cuando ya se conozca.';

create index if not exists event_inventory_requirements_event_idx on public.event_inventory_requirements (event_id, inventory_item_id);
create index if not exists event_inventory_requirements_item_idx on public.event_inventory_requirements (inventory_item_id, event_id);

create or replace function public.touch_inventory_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.touch_event_inventory_requirements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_inventory_items_updated on public.inventory_items;
create trigger on_inventory_items_updated
before update on public.inventory_items
for each row execute procedure public.touch_inventory_items_updated_at();

drop trigger if exists on_event_inventory_requirements_updated on public.event_inventory_requirements;
create trigger on_event_inventory_requirements_updated
before update on public.event_inventory_requirements
for each row execute procedure public.touch_event_inventory_requirements_updated_at();

alter table public.inventory_items enable row level security;
alter table public.event_inventory_requirements enable row level security;

grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert, update, delete on public.event_inventory_requirements to authenticated;

drop policy if exists "Authenticated users can read inventory items" on public.inventory_items;
create policy "Authenticated users can read inventory items"
on public.inventory_items
for select
to authenticated
using (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can create inventory items" on public.inventory_items;
create policy "Authenticated users can create inventory items"
on public.inventory_items
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists "Authenticated users can update inventory items" on public.inventory_items;
create policy "Authenticated users can update inventory items"
on public.inventory_items
for update
to authenticated
using (auth.uid() is not null and public.current_user_is_active())
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and updated_by = auth.uid()
);

drop policy if exists "Authenticated users can delete inventory items" on public.inventory_items;
create policy "Authenticated users can delete inventory items"
on public.inventory_items
for delete
to authenticated
using (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can read event inventory requirements" on public.event_inventory_requirements;
create policy "Authenticated users can read event inventory requirements"
on public.event_inventory_requirements
for select
to authenticated
using (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can create event inventory requirements" on public.event_inventory_requirements;
create policy "Authenticated users can create event inventory requirements"
on public.event_inventory_requirements
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and exists (
    select 1
    from public.inventory_items item
    where item.id = inventory_item_id
      and item.is_active = true
  )
);

drop policy if exists "Authenticated users can update event inventory requirements" on public.event_inventory_requirements;
create policy "Authenticated users can update event inventory requirements"
on public.event_inventory_requirements
for update
to authenticated
using (auth.uid() is not null and public.current_user_is_active())
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and exists (
    select 1
    from public.inventory_items item
    where item.id = inventory_item_id
      and item.is_active = true
  )
);

drop policy if exists "Authenticated users can delete event inventory requirements" on public.event_inventory_requirements;
create policy "Authenticated users can delete event inventory requirements"
on public.event_inventory_requirements
for delete
to authenticated
using (auth.uid() is not null and public.current_user_is_active());
