-- Inventory Event Operations Phase 2B - execution state ligera 1:1 por requirement.

create table if not exists public.event_inventory_execution_state (
  id uuid primary key default gen_random_uuid(),
  event_inventory_requirement_id uuid not null unique references public.event_inventory_requirements (id) on delete cascade,
  shopping_status text not null default 'pending',
  shopping_updated_at timestamptz,
  shopping_updated_by uuid references public.profiles (id) on delete set null,
  picking_status text not null default 'pending',
  picking_updated_at timestamptz,
  picking_updated_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.event_inventory_execution_state
  drop constraint if exists event_inventory_execution_state_shopping_status_check;

alter table public.event_inventory_execution_state
  add constraint event_inventory_execution_state_shopping_status_check
  check (shopping_status in ('pending', 'bought'));

alter table public.event_inventory_execution_state
  drop constraint if exists event_inventory_execution_state_picking_status_check;

alter table public.event_inventory_execution_state
  add constraint event_inventory_execution_state_picking_status_check
  check (picking_status in ('pending', 'pulled'));

create index if not exists event_inventory_execution_state_requirement_idx
  on public.event_inventory_execution_state (event_inventory_requirement_id);

create index if not exists event_inventory_execution_state_shopping_idx
  on public.event_inventory_execution_state (shopping_status, shopping_updated_at desc);

create index if not exists event_inventory_execution_state_picking_idx
  on public.event_inventory_execution_state (picking_status, picking_updated_at desc);

create or replace function public.touch_event_inventory_execution_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_event_inventory_execution_state_updated on public.event_inventory_execution_state;
create trigger on_event_inventory_execution_state_updated
before update on public.event_inventory_execution_state
for each row execute procedure public.touch_event_inventory_execution_state_updated_at();

create or replace function public.seed_event_inventory_execution_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.event_inventory_execution_state (event_inventory_requirement_id)
  values (new.id)
  on conflict (event_inventory_requirement_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_event_inventory_requirement_seed_execution_state on public.event_inventory_requirements;
create trigger on_event_inventory_requirement_seed_execution_state
after insert on public.event_inventory_requirements
for each row execute procedure public.seed_event_inventory_execution_state();

insert into public.event_inventory_execution_state (event_inventory_requirement_id)
select req.id
from public.event_inventory_requirements req
left join public.event_inventory_execution_state exec
  on exec.event_inventory_requirement_id = req.id
where exec.id is null;

alter table public.event_inventory_execution_state enable row level security;

grant select, insert, update, delete on public.event_inventory_execution_state to authenticated;

drop policy if exists "Authenticated users can read inventory execution state" on public.event_inventory_execution_state;
create policy "Authenticated users can read inventory execution state"
on public.event_inventory_execution_state
for select
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('inventory.view')
);

drop policy if exists "Authenticated users can create inventory execution state" on public.event_inventory_execution_state;
create policy "Authenticated users can create inventory execution state"
on public.event_inventory_execution_state
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and (
    public.current_user_has_permission('inventory.prepare')
    or public.current_user_has_permission('inventory.manage')
  )
);

drop policy if exists "Authenticated users can update inventory execution state" on public.event_inventory_execution_state;
create policy "Authenticated users can update inventory execution state"
on public.event_inventory_execution_state
for update
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and (
    public.current_user_has_permission('inventory.prepare')
    or public.current_user_has_permission('inventory.manage')
  )
)
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and (
    public.current_user_has_permission('inventory.prepare')
    or public.current_user_has_permission('inventory.manage')
  )
);

drop policy if exists "Authenticated users can delete inventory execution state" on public.event_inventory_execution_state;
create policy "Authenticated users can delete inventory execution state"
on public.event_inventory_execution_state
for delete
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('inventory.manage')
);

comment on table public.event_inventory_execution_state is 'Estado operativo ligero 1:1 sobre event_inventory_requirements para compras/surtido.';
comment on column public.event_inventory_execution_state.shopping_status is 'Estado de ejecución de compra derivado del shopping list del evento.';
comment on column public.event_inventory_execution_state.picking_status is 'Estado de ejecución de surtido derivado de la lista de bodega del evento.';
