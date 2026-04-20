-- Service / Bar Customization Phase 1
-- Consolidación de base manual sobre bar_master_templates sin romper capas operativas existentes.

alter table public.bar_master_templates
  add column if not exists prep_guide text,
  add column if not exists execution_guide text,
  add column if not exists checklist_guidance text,
  add column if not exists enforce_inventory_links boolean not null default true;

alter table public.bar_master_template_items
  add column if not exists item_type text not null default 'apoyo',
  add column if not exists is_optional boolean not null default false;

alter table public.bar_master_template_items
  drop constraint if exists bar_master_template_items_item_type_check;

alter table public.bar_master_template_items
  add constraint bar_master_template_items_item_type_check
  check (item_type in ('ingrediente', 'herramienta', 'apoyo'));

create index if not exists bar_master_template_items_item_type_idx
  on public.bar_master_template_items (template_id, item_type, sort_order, created_at);

comment on column public.bar_master_templates.prep_guide is 'Guía de preparación manual por barra/servicio.';
comment on column public.bar_master_templates.execution_guide is 'Guía de ejecución en evento por barra/servicio.';
comment on column public.bar_master_templates.checklist_guidance is 'Guía/checklist recomendada para validar que la barra está lista.';
comment on column public.bar_master_templates.enforce_inventory_links is 'Si está activo, los ítems de la barra deben vincularse al catálogo inventory_items.';
comment on column public.bar_master_template_items.item_type is 'Tipo de ítem de la barra: ingrediente, herramienta o apoyo.';
comment on column public.bar_master_template_items.is_optional is 'Permite marcar ítems opcionales dentro de la definición manual de la barra.';

-- Dejar seeds operativos como secundarios (opt-in) en esta fase de consolidación manual.
update public.operational_templates
set is_active = false
where slug in (
  'mini-pancake-bar',
  'tostiloco-bar',
  'maruchan-bar',
  'esquites-bar',
  'manna-snack-bar-la-clasica',
  'chocolate-fountain-addon',
  'servicio-con-2-barras'
);
