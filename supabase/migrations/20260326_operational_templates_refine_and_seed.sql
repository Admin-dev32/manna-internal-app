-- Refinamiento de plantillas operativas: estructura por servicio/bar + bootstrap inicial.

alter table public.operational_templates
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists service_category text;

update public.operational_templates
set slug = coalesce(slug, regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
where slug is null;

alter table public.operational_templates
  alter column slug set not null;

create unique index if not exists operational_templates_slug_key on public.operational_templates (slug);
create index if not exists operational_templates_service_category_idx on public.operational_templates (service_category, is_active);

alter table public.operational_template_checklist_items
  add column if not exists is_required boolean not null default true;

alter table public.operational_template_task_items
  add column if not exists suggested_priority text,
  add column if not exists suggested_phase text,
  add column if not exists suggested_role text;

update public.operational_template_task_items
set suggested_priority = coalesce(suggested_priority, priority),
    suggested_role = coalesce(suggested_role, assignment_role_hint)
where suggested_priority is null or suggested_role is null;

alter table public.operational_template_task_items
  alter column suggested_priority set default 'media';

alter table public.operational_template_task_items
  add constraint operational_template_task_items_suggested_priority_check
  check (suggested_priority in ('baja', 'media', 'alta', 'urgente')) not valid;
alter table public.operational_template_task_items validate constraint operational_template_task_items_suggested_priority_check;

alter table public.operational_template_task_items
  add constraint operational_template_task_items_suggested_role_check
  check (suggested_role is null or suggested_role in ('lider', 'apoyo', 'setup', 'general')) not valid;
alter table public.operational_template_task_items validate constraint operational_template_task_items_suggested_role_check;

alter table public.operational_template_material_items
  add column if not exists name text,
  add column if not exists material_type text,
  add column if not exists unknowns text,
  add column if not exists pending_definition boolean not null default false;

alter table public.operational_template_material_items
  alter column inventory_item_id drop not null,
  alter column quantity_required drop not null;

update public.operational_template_material_items
set name = coalesce(name, concat('Material ', id::text))
where name is null;

alter table public.operational_template_material_items
  alter column name set not null;

create unique index if not exists operational_template_material_items_template_name_key
  on public.operational_template_material_items (template_id, name);

-- Bootstrap inicial (idempotente). Si no hay perfiles, se omite para no romper ambientes nuevos.
do $$
declare
  actor_id uuid;
  t_id uuid;
begin
  select id into actor_id from public.profiles order by created_at asc limit 1;
  if actor_id is null then
    return;
  end if;

  insert into public.operational_templates (name, slug, description, service_category, event_type, note, is_active, created_by, updated_by)
  values
    ('Mini Pancake Bar', 'mini-pancake-bar', 'Servicio de Mini Pancake Bar para eventos.', 'mini-pancake-bar', 'mini-pancake-bar', null, true, actor_id, actor_id),
    ('Tostiloco Bar', 'tostiloco-bar', 'Servicio de Tostiloco Bar para eventos.', 'tostiloco-bar', 'tostiloco-bar', null, true, actor_id, actor_id),
    ('Maruchan Bar', 'maruchan-bar', 'Servicio de Maruchan Bar para eventos.', 'maruchan-bar', 'maruchan-bar', null, true, actor_id, actor_id),
    ('Esquites Bar', 'esquites-bar', 'Servicio de Esquites Bar para eventos.', 'esquites-bar', 'esquites-bar', null, true, actor_id, actor_id),
    ('Manna Snack Bar — La Clásica', 'manna-snack-bar-la-clasica', 'Formato operativo clásico de Manna Snack Bar.', 'manna-snack-bar-la-clasica', 'manna-snack-bar-la-clasica', null, true, actor_id, actor_id),
    ('Chocolate Fountain', 'chocolate-fountain-addon', 'Add-on de Chocolate Fountain para complementar servicio principal.', 'chocolate-fountain-addon', 'chocolate-fountain-addon', 'Add-on operativo sobre servicio principal.', true, actor_id, actor_id),
    ('Servicio con 2 barras', 'servicio-con-2-barras', 'Plantilla contenedor especial para combinar dos barras.', 'servicio-con-2-barras', 'servicio-con-2-barras', 'Contenedor especial para futura combinación A+B.', true, actor_id, actor_id)
  on conflict (slug) do update
    set name = excluded.name,
        description = excluded.description,
        service_category = excluded.service_category,
        event_type = excluded.event_type,
        note = excluded.note,
        is_active = true,
        updated_by = actor_id;

  for t_id in select id from public.operational_templates where slug in (
    'mini-pancake-bar',
    'tostiloco-bar',
    'maruchan-bar',
    'esquites-bar',
    'manna-snack-bar-la-clasica',
    'chocolate-fountain-addon',
    'servicio-con-2-barras'
  ) loop
    insert into public.operational_template_checklist_items (template_id, label, description, is_required, sort_order)
    values
      (t_id, 'Ubicación confirmada', 'La dirección y acceso operativo ya fueron validados.', true, 10),
      (t_id, 'Servicio confirmado', 'Servicio contratado y alcance operativo confirmados.', true, 20),
      (t_id, 'Detalle operativo pendiente por definir', 'Pendiente de cargar definición operativa detallada de esta barra.', false, 90)
    on conflict (template_id, label) do update
      set description = excluded.description,
          is_required = excluded.is_required,
          sort_order = excluded.sort_order;

    insert into public.operational_template_task_items (template_id, title, description, priority, suggested_priority, suggested_phase, suggested_role, default_status, assignment_role_hint, sort_order)
    values
      (t_id, 'Revisar alcance final del servicio', 'Validación operativa final previa al evento.', 'alta', 'alta', 'preparacion', 'lider', 'pendiente', 'lider', 10),
      (t_id, 'Preparar set base del servicio', 'Montaje base operativo según estándar vigente.', 'media', 'media', 'setup', 'setup', 'pendiente', 'setup', 20),
      (t_id, 'Resolver pendientes operativos definidos en plantilla', 'Cerrar pendientes marcados como no definidos.', 'media', 'media', 'preparacion', 'general', 'pendiente', 'general', 90)
    on conflict (template_id, title) do update
      set description = excluded.description,
          priority = excluded.priority,
          suggested_priority = excluded.suggested_priority,
          suggested_phase = excluded.suggested_phase,
          suggested_role = excluded.suggested_role,
          assignment_role_hint = excluded.assignment_role_hint,
          sort_order = excluded.sort_order;

    insert into public.operational_template_material_items (template_id, name, material_type, note, pending_definition, unknowns, sort_order)
    values
      (t_id, 'Insumos base del servicio', 'pendiente_definir', 'Pendiente detallar cantidades y SKUs exactos.', true, 'Falta definición operativa completa de materiales por barra.', 90)
    on conflict (template_id, name) do update
      set material_type = excluded.material_type,
          note = excluded.note,
          pending_definition = excluded.pending_definition,
          unknowns = excluded.unknowns,
          sort_order = excluded.sort_order;
  end loop;
end $$;
