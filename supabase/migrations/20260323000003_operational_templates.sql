-- Plantillas operativas por tipo de evento para reducir preparación manual.
-- Base mínima para luego crecer a automatizaciones más fuertes y bibliotecas operativas.

create table if not exists public.operational_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_type text,
  note text,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.operational_templates is 'Plantillas operativas reutilizables para eventos por tipo o categoría.';

create index if not exists operational_templates_active_idx on public.operational_templates (is_active, event_type, name);

create table if not exists public.operational_template_checklist_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.operational_templates (id) on delete cascade,
  label text not null,
  description text,
  sort_order integer not null default 100 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint operational_template_checklist_items_unique unique (template_id, label)
);

create index if not exists operational_template_checklist_items_template_idx
on public.operational_template_checklist_items (template_id, sort_order);

create table if not exists public.operational_template_task_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.operational_templates (id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'media' check (priority in ('baja', 'media', 'alta', 'urgente')),
  default_status text not null default 'pendiente' check (default_status in ('pendiente', 'en_progreso', 'completada', 'bloqueada')),
  assignment_role_hint text check (assignment_role_hint is null or assignment_role_hint in ('lider', 'apoyo', 'setup', 'general')),
  due_hours_before_event integer check (due_hours_before_event is null or due_hours_before_event >= 0),
  internal_note text,
  sort_order integer not null default 100 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint operational_template_task_items_unique unique (template_id, title)
);

create index if not exists operational_template_task_items_template_idx
on public.operational_template_task_items (template_id, sort_order);

create table if not exists public.operational_template_material_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.operational_templates (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  quantity_required numeric(12, 2) not null check (quantity_required > 0),
  note text,
  sort_order integer not null default 100 check (sort_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint operational_template_material_items_unique unique (template_id, inventory_item_id)
);

create index if not exists operational_template_material_items_template_idx
on public.operational_template_material_items (template_id, sort_order);

create table if not exists public.event_operational_template_applications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  operational_template_id uuid not null references public.operational_templates (id) on delete restrict,
  applied_by uuid not null references public.profiles (id) on delete restrict,
  created_checklist_count integer not null default 0 check (created_checklist_count >= 0),
  created_task_count integer not null default 0 check (created_task_count >= 0),
  created_material_count integer not null default 0 check (created_material_count >= 0),
  skipped_task_count integer not null default 0 check (skipped_task_count >= 0),
  applied_at timestamptz not null default timezone('utc', now())
);

create index if not exists event_operational_template_applications_event_idx
on public.event_operational_template_applications (event_id, applied_at desc);

create or replace function public.touch_operational_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_operational_templates_updated on public.operational_templates;
create trigger on_operational_templates_updated
before update on public.operational_templates
for each row execute procedure public.touch_operational_templates_updated_at();

drop trigger if exists on_operational_template_checklist_items_updated on public.operational_template_checklist_items;
create trigger on_operational_template_checklist_items_updated
before update on public.operational_template_checklist_items
for each row execute procedure public.touch_operational_templates_updated_at();

drop trigger if exists on_operational_template_task_items_updated on public.operational_template_task_items;
create trigger on_operational_template_task_items_updated
before update on public.operational_template_task_items
for each row execute procedure public.touch_operational_templates_updated_at();

drop trigger if exists on_operational_template_material_items_updated on public.operational_template_material_items;
create trigger on_operational_template_material_items_updated
before update on public.operational_template_material_items
for each row execute procedure public.touch_operational_templates_updated_at();

alter table public.operational_templates enable row level security;
alter table public.operational_template_checklist_items enable row level security;
alter table public.operational_template_task_items enable row level security;
alter table public.operational_template_material_items enable row level security;
alter table public.event_operational_template_applications enable row level security;

grant select, insert, update, delete on public.operational_templates to authenticated;
grant select, insert, update, delete on public.operational_template_checklist_items to authenticated;
grant select, insert, update, delete on public.operational_template_task_items to authenticated;
grant select, insert, update, delete on public.operational_template_material_items to authenticated;
grant select, insert on public.event_operational_template_applications to authenticated;

drop policy if exists "Authenticated users can read operational templates" on public.operational_templates;
create policy "Authenticated users can read operational templates"
on public.operational_templates
for select
to authenticated
using (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can create operational templates" on public.operational_templates;
create policy "Authenticated users can create operational templates"
on public.operational_templates
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists "Authenticated users can update operational templates" on public.operational_templates;
create policy "Authenticated users can update operational templates"
on public.operational_templates
for update
to authenticated
using (auth.uid() is not null and public.current_user_is_active())
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and updated_by = auth.uid()
);

drop policy if exists "Authenticated users can delete operational templates" on public.operational_templates;
create policy "Authenticated users can delete operational templates"
on public.operational_templates
for delete
to authenticated
using (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can read operational template checklist items" on public.operational_template_checklist_items;
create policy "Authenticated users can read operational template checklist items"
on public.operational_template_checklist_items
for select
to authenticated
using (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can manage operational template checklist items" on public.operational_template_checklist_items;
create policy "Authenticated users can manage operational template checklist items"
on public.operational_template_checklist_items
for all
to authenticated
using (auth.uid() is not null and public.current_user_is_active())
with check (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can read operational template task items" on public.operational_template_task_items;
create policy "Authenticated users can read operational template task items"
on public.operational_template_task_items
for select
to authenticated
using (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can manage operational template task items" on public.operational_template_task_items;
create policy "Authenticated users can manage operational template task items"
on public.operational_template_task_items
for all
to authenticated
using (auth.uid() is not null and public.current_user_is_active())
with check (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can read operational template material items" on public.operational_template_material_items;
create policy "Authenticated users can read operational template material items"
on public.operational_template_material_items
for select
to authenticated
using (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can manage operational template material items" on public.operational_template_material_items;
create policy "Authenticated users can manage operational template material items"
on public.operational_template_material_items
for all
to authenticated
using (auth.uid() is not null and public.current_user_is_active())
with check (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can read template applications" on public.event_operational_template_applications;
create policy "Authenticated users can read template applications"
on public.event_operational_template_applications
for select
to authenticated
using (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can create template applications" on public.event_operational_template_applications;
create policy "Authenticated users can create template applications"
on public.event_operational_template_applications
for insert
to authenticated
with check (auth.uid() is not null and public.current_user_is_active() and applied_by = auth.uid());
