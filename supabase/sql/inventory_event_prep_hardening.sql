-- Hardening operativo de materiales por evento: preparación/conteo sin introducir shopping full.

alter table public.event_inventory_requirements
  add column if not exists quantity_counted numeric(12, 2) check (quantity_counted is null or quantity_counted >= 0),
  add column if not exists prep_status text,
  add column if not exists prep_notes text,
  add column if not exists checked_by uuid,
  add column if not exists checked_at timestamptz,
  add column if not exists source_type text,
  add column if not exists source_template_id uuid,
  add column if not exists updated_by uuid;

update public.event_inventory_requirements
set quantity_counted = coalesce(quantity_counted, quantity_used),
    prep_status = coalesce(
      prep_status,
      case
        when coalesce(quantity_counted, quantity_used, 0) = 0 then 'pendiente'
        when coalesce(quantity_counted, quantity_used, 0) < quantity_required then 'faltante'
        when coalesce(quantity_counted, quantity_used, 0) = quantity_required then 'contado'
        when coalesce(quantity_counted, quantity_used, 0) > quantity_required then 'listo'
        else 'pendiente'
      end
    ),
    source_type = coalesce(source_type, 'manual')
where prep_status is null
   or source_type is null
   or quantity_counted is null;

alter table public.event_inventory_requirements
  alter column prep_status set default 'pendiente',
  alter column prep_status set not null,
  alter column source_type set default 'manual',
  alter column source_type set not null;

alter table public.event_inventory_requirements drop constraint if exists event_inventory_requirements_prep_status_check;
alter table public.event_inventory_requirements
  add constraint event_inventory_requirements_prep_status_check
  check (prep_status in ('pendiente', 'contado', 'faltante', 'listo'));

alter table public.event_inventory_requirements drop constraint if exists event_inventory_requirements_source_type_check;
alter table public.event_inventory_requirements
  add constraint event_inventory_requirements_source_type_check
  check (source_type in ('manual', 'template'));

alter table public.event_inventory_requirements drop constraint if exists event_inventory_requirements_checked_by_fk;
alter table public.event_inventory_requirements
  add constraint event_inventory_requirements_checked_by_fk
  foreign key (checked_by)
  references public.profiles (id)
  on delete set null;

alter table public.event_inventory_requirements drop constraint if exists event_inventory_requirements_updated_by_fk;
alter table public.event_inventory_requirements
  add constraint event_inventory_requirements_updated_by_fk
  foreign key (updated_by)
  references public.profiles (id)
  on delete set null;

alter table public.event_inventory_requirements drop constraint if exists event_inventory_requirements_source_template_fk;
alter table public.event_inventory_requirements
  add constraint event_inventory_requirements_source_template_fk
  foreign key (source_template_id)
  references public.operational_templates (id)
  on delete set null;

create index if not exists event_inventory_requirements_event_prep_status_idx
  on public.event_inventory_requirements (event_id, prep_status, updated_at desc);

comment on column public.event_inventory_requirements.quantity_counted is 'Cantidad que el líder/operación confirma como disponible para el evento.';
comment on column public.event_inventory_requirements.prep_status is 'Estado operativo de preparación del material para el evento.';
comment on column public.event_inventory_requirements.prep_notes is 'Notas de conteo/preparación del material para operación.';
comment on column public.event_inventory_requirements.checked_by is 'Perfil que registró o validó el último conteo operativo.';
comment on column public.event_inventory_requirements.checked_at is 'Momento del último conteo operativo registrado.';
comment on column public.event_inventory_requirements.source_type is 'Origen del requirement: manual o derivado de plantilla operativa.';
comment on column public.event_inventory_requirements.source_template_id is 'Plantilla operativa origen cuando el requirement fue sembrado por plantilla.';
comment on column public.event_inventory_requirements.updated_by is 'Último perfil que actualizó el requirement en operación.';

-- Hardening incremental de políticas hacia permisos específicos de inventario.
drop policy if exists "Authenticated users can read inventory items" on public.inventory_items;
create policy "Authenticated users can read inventory items"
on public.inventory_items
for select
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('inventory.view')
);

drop policy if exists "Authenticated users can create inventory items" on public.inventory_items;
create policy "Authenticated users can create inventory items"
on public.inventory_items
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('inventory.manage')
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists "Authenticated users can update inventory items" on public.inventory_items;
create policy "Authenticated users can update inventory items"
on public.inventory_items
for update
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('inventory.manage')
)
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('inventory.manage')
  and updated_by = auth.uid()
);

drop policy if exists "Authenticated users can delete inventory items" on public.inventory_items;
create policy "Authenticated users can delete inventory items"
on public.inventory_items
for delete
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('inventory.manage')
);

drop policy if exists "Authenticated users can read event inventory requirements" on public.event_inventory_requirements;
create policy "Authenticated users can read event inventory requirements"
on public.event_inventory_requirements
for select
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('inventory.view')
);

drop policy if exists "Authenticated users can create event inventory requirements" on public.event_inventory_requirements;
create policy "Authenticated users can create event inventory requirements"
on public.event_inventory_requirements
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and (
    public.current_user_has_permission('inventory.prepare')
    or public.current_user_has_permission('inventory.manage')
  )
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
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and (
    public.current_user_has_permission('inventory.prepare')
    or public.current_user_has_permission('inventory.manage')
  )
);
