alter table public.inventory_items
  add column if not exists code text,
  add column if not exists usage_bars text,
  add column if not exists ideal_stock numeric(12, 2),
  add column if not exists storage_location text,
  add column if not exists storage_box text;

alter table public.inventory_items
  drop constraint if exists inventory_items_ideal_stock_check;

alter table public.inventory_items
  add constraint inventory_items_ideal_stock_check
  check (ideal_stock is null or ideal_stock >= 0);

create index if not exists inventory_items_code_idx on public.inventory_items (code);
create index if not exists inventory_items_storage_idx on public.inventory_items (storage_location, storage_box);

comment on column public.inventory_items.code is 'Código operativo interno del insumo/material.';
comment on column public.inventory_items.usage_bars is 'Barras/servicios donde se utiliza el ítem (texto operativo).';
comment on column public.inventory_items.ideal_stock is 'Stock ideal objetivo para operación normal.';
comment on column public.inventory_items.storage_location is 'Ubicación de storage principal (bodega, rack, cuarto, etc).';
comment on column public.inventory_items.storage_box is 'Caja/bin/contendor físico donde se guarda el ítem.';
