-- Service / Bar Customization Phase 6
-- Reglas básicas de escalado por guest_count para ítems de barra/servicio.

alter table public.bar_master_template_items
  add column if not exists base_servings integer,
  add column if not exists scale_rounding_step numeric;

alter table public.bar_master_template_items
  drop constraint if exists bar_master_template_items_base_servings_check;

alter table public.bar_master_template_items
  add constraint bar_master_template_items_base_servings_check
  check (base_servings is null or base_servings > 0);

alter table public.bar_master_template_items
  drop constraint if exists bar_master_template_items_scale_rounding_step_check;

alter table public.bar_master_template_items
  add constraint bar_master_template_items_scale_rounding_step_check
  check (scale_rounding_step is null or scale_rounding_step > 0);

comment on column public.bar_master_template_items.base_servings is 'Base de personas para escalar quantity_required. Si es null, no escala por invitados.';
comment on column public.bar_master_template_items.scale_rounding_step is 'Paso opcional para redondear cantidad escalada (ej. 0.25, 0.5, 1).';
