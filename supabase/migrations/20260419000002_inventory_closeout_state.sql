-- Inventory Event Operations Phase 2C - closeout post-evento ligero 1:1 por requirement.

create table if not exists public.event_inventory_closeout_state (
  id uuid primary key default gen_random_uuid(),
  event_inventory_requirement_id uuid not null unique references public.event_inventory_requirements (id) on delete cascade,
  leftover_quantity numeric(12, 2) not null default 0,
  returned_quantity numeric(12, 2) not null default 0,
  waste_quantity numeric(12, 2) not null default 0,
  closeout_status text not null default 'pending',
  closed_by uuid references public.profiles (id) on delete set null,
  closed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.event_inventory_closeout_state
  drop constraint if exists event_inventory_closeout_state_leftover_quantity_check;

alter table public.event_inventory_closeout_state
  add constraint event_inventory_closeout_state_leftover_quantity_check
  check (leftover_quantity >= 0);

alter table public.event_inventory_closeout_state
  drop constraint if exists event_inventory_closeout_state_returned_quantity_check;

alter table public.event_inventory_closeout_state
  add constraint event_inventory_closeout_state_returned_quantity_check
  check (returned_quantity >= 0);

alter table public.event_inventory_closeout_state
  drop constraint if exists event_inventory_closeout_state_waste_quantity_check;

alter table public.event_inventory_closeout_state
  add constraint event_inventory_closeout_state_waste_quantity_check
  check (waste_quantity >= 0);

alter table public.event_inventory_closeout_state
  drop constraint if exists event_inventory_closeout_state_returned_leq_leftover_check;

alter table public.event_inventory_closeout_state
  add constraint event_inventory_closeout_state_returned_leq_leftover_check
  check (returned_quantity <= leftover_quantity);

alter table public.event_inventory_closeout_state
  drop constraint if exists event_inventory_closeout_state_waste_leq_leftover_check;

alter table public.event_inventory_closeout_state
  add constraint event_inventory_closeout_state_waste_leq_leftover_check
  check (waste_quantity <= leftover_quantity);

alter table public.event_inventory_closeout_state
  drop constraint if exists event_inventory_closeout_state_split_leq_leftover_check;

alter table public.event_inventory_closeout_state
  add constraint event_inventory_closeout_state_split_leq_leftover_check
  check (returned_quantity + waste_quantity <= leftover_quantity);

alter table public.event_inventory_closeout_state
  drop constraint if exists event_inventory_closeout_state_status_check;

alter table public.event_inventory_closeout_state
  add constraint event_inventory_closeout_state_status_check
  check (closeout_status in ('pending', 'submitted', 'approved', 'reopened'));

create index if not exists event_inventory_closeout_state_requirement_idx
  on public.event_inventory_closeout_state (event_inventory_requirement_id);

create index if not exists event_inventory_closeout_state_status_idx
  on public.event_inventory_closeout_state (closeout_status, updated_at desc);

create or replace function public.touch_event_inventory_closeout_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_event_inventory_closeout_state_updated on public.event_inventory_closeout_state;
create trigger on_event_inventory_closeout_state_updated
before update on public.event_inventory_closeout_state
for each row execute procedure public.touch_event_inventory_closeout_state_updated_at();

create or replace function public.seed_event_inventory_closeout_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.event_inventory_closeout_state (event_inventory_requirement_id)
  values (new.id)
  on conflict (event_inventory_requirement_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_event_inventory_requirement_seed_closeout_state on public.event_inventory_requirements;
create trigger on_event_inventory_requirement_seed_closeout_state
after insert on public.event_inventory_requirements
for each row execute procedure public.seed_event_inventory_closeout_state();

insert into public.event_inventory_closeout_state (event_inventory_requirement_id)
select req.id
from public.event_inventory_requirements req
left join public.event_inventory_closeout_state closeout
  on closeout.event_inventory_requirement_id = req.id
where closeout.id is null;

alter table public.event_inventory_closeout_state enable row level security;

grant select, insert, update, delete on public.event_inventory_closeout_state to authenticated;

drop policy if exists "Authenticated users can read inventory closeout state" on public.event_inventory_closeout_state;
create policy "Authenticated users can read inventory closeout state"
on public.event_inventory_closeout_state
for select
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('inventory.view')
);

drop policy if exists "Authenticated users can create inventory closeout state" on public.event_inventory_closeout_state;
create policy "Authenticated users can create inventory closeout state"
on public.event_inventory_closeout_state
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

drop policy if exists "Authenticated users can update inventory closeout state" on public.event_inventory_closeout_state;
create policy "Authenticated users can update inventory closeout state"
on public.event_inventory_closeout_state
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

drop policy if exists "Authenticated users can delete inventory closeout state" on public.event_inventory_closeout_state;
create policy "Authenticated users can delete inventory closeout state"
on public.event_inventory_closeout_state
for delete
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('inventory.manage')
);

comment on table public.event_inventory_closeout_state is 'Cierre post-evento ligero 1:1 sobre requirements para sobrante, retorno y merma.';
comment on column public.event_inventory_closeout_state.leftover_quantity is 'Cantidad sobrante al cierre del evento.';
comment on column public.event_inventory_closeout_state.returned_quantity is 'Cantidad de sobrante devuelta al inventario.';
comment on column public.event_inventory_closeout_state.waste_quantity is 'Cantidad de sobrante no recuperable (merma/pérdida).';
