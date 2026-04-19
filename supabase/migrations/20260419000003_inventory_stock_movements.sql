-- Inventory Movements / Stock Ledger v1

create table if not exists public.inventory_stock_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  movement_type text not null,
  quantity_delta numeric(12, 2) not null,
  reference_type text,
  reference_id uuid,
  event_id uuid references public.events (id) on delete set null,
  event_inventory_requirement_id uuid references public.event_inventory_requirements (id) on delete set null,
  closeout_state_id uuid references public.event_inventory_closeout_state (id) on delete set null,
  origin_key text,
  note text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  is_posted boolean not null default true,
  balance_after numeric(12, 2)
);

alter table public.inventory_stock_movements
  drop constraint if exists inventory_stock_movements_type_check;

alter table public.inventory_stock_movements
  add constraint inventory_stock_movements_type_check
  check (movement_type in ('purchase_restock', 'manual_adjustment', 'returned_from_event', 'waste_loss'));

alter table public.inventory_stock_movements
  drop constraint if exists inventory_stock_movements_delta_non_zero_check;

alter table public.inventory_stock_movements
  add constraint inventory_stock_movements_delta_non_zero_check
  check (quantity_delta <> 0);

create unique index if not exists inventory_stock_movements_origin_key_key
  on public.inventory_stock_movements (origin_key)
  where origin_key is not null;

create index if not exists inventory_stock_movements_item_created_idx
  on public.inventory_stock_movements (inventory_item_id, created_at desc);

create index if not exists inventory_stock_movements_event_created_idx
  on public.inventory_stock_movements (event_id, created_at desc);

create index if not exists inventory_stock_movements_type_created_idx
  on public.inventory_stock_movements (movement_type, created_at desc);

alter table public.inventory_stock_movements enable row level security;

grant select, insert on public.inventory_stock_movements to authenticated;

drop policy if exists "Authenticated users can read inventory stock movements" on public.inventory_stock_movements;
create policy "Authenticated users can read inventory stock movements"
on public.inventory_stock_movements
for select
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('inventory.view')
);

drop policy if exists "Authenticated users can create inventory stock movements" on public.inventory_stock_movements;
create policy "Authenticated users can create inventory stock movements"
on public.inventory_stock_movements
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('inventory.manage')
  and created_by = auth.uid()
);

comment on table public.inventory_stock_movements is 'Ledger de movimientos de stock con trazabilidad por origen operativo.';
comment on column public.inventory_stock_movements.quantity_delta is 'Delta signed del stock: positivo suma, negativo resta.';
comment on column public.inventory_stock_movements.origin_key is 'Clave de idempotencia para prevenir publicaciones duplicadas del mismo origen.';
comment on column public.inventory_stock_movements.balance_after is 'Snapshot del stock del ítem después de aplicar el movimiento.';
