-- BAR MASTER TEMPLATES V1
-- Listas maestras reutilizables por barra para sembrar requirements reales en eventos.

create table if not exists public.bar_master_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  service_category text null,
  description text null,
  note text null,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists bar_master_templates_active_idx
  on public.bar_master_templates (is_active, name);

create table if not exists public.bar_master_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.bar_master_templates(id) on delete cascade,
  inventory_item_id uuid null references public.inventory_items(id) on delete set null,
  item_name text not null,
  unit text null,
  quantity_required numeric(12,2) not null default 0,
  note text null,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint bar_master_template_items_quantity_required_check check (quantity_required >= 0)
);

create index if not exists bar_master_template_items_template_idx
  on public.bar_master_template_items (template_id, sort_order, created_at);

create index if not exists bar_master_template_items_inventory_item_idx
  on public.bar_master_template_items (inventory_item_id)
  where inventory_item_id is not null;

create table if not exists public.event_bar_master_template_applications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  template_id uuid not null references public.bar_master_templates(id) on delete restrict,
  applied_by uuid not null references public.profiles(id) on delete restrict,
  applied_at timestamptz not null default timezone('utc', now()),
  note text null,
  result_summary jsonb not null default '{}'::jsonb
);

create index if not exists event_bar_master_template_applications_event_idx
  on public.event_bar_master_template_applications (event_id, applied_at desc);

create index if not exists event_bar_master_template_applications_template_idx
  on public.event_bar_master_template_applications (template_id, applied_at desc);

create or replace function public.touch_bar_master_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_bar_master_templates_updated on public.bar_master_templates;
create trigger on_bar_master_templates_updated
before update on public.bar_master_templates
for each row execute procedure public.touch_bar_master_templates_updated_at();

create or replace function public.touch_bar_master_template_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_bar_master_template_items_updated on public.bar_master_template_items;
create trigger on_bar_master_template_items_updated
before update on public.bar_master_template_items
for each row execute procedure public.touch_bar_master_template_items_updated_at();

alter table public.bar_master_templates enable row level security;
alter table public.bar_master_template_items enable row level security;
alter table public.event_bar_master_template_applications enable row level security;

grant select, insert, update, delete on public.bar_master_templates to authenticated;
grant select, insert, update, delete on public.bar_master_template_items to authenticated;
grant select, insert on public.event_bar_master_template_applications to authenticated;

drop policy if exists "Authenticated users can read bar master templates" on public.bar_master_templates;
create policy "Authenticated users can read bar master templates"
on public.bar_master_templates
for select
to authenticated
using (
  auth.uid() is not null
  and public.current_user_has_permission('inventory.templates.view')
);

drop policy if exists "Authenticated users can manage bar master templates" on public.bar_master_templates;
create policy "Authenticated users can manage bar master templates"
on public.bar_master_templates
for all
to authenticated
using (
  auth.uid() is not null
  and public.current_user_has_permission('inventory.templates.manage')
)
with check (
  auth.uid() is not null
  and public.current_user_has_permission('inventory.templates.manage')
);

drop policy if exists "Authenticated users can read bar master template items" on public.bar_master_template_items;
create policy "Authenticated users can read bar master template items"
on public.bar_master_template_items
for select
to authenticated
using (
  auth.uid() is not null
  and public.current_user_has_permission('inventory.templates.view')
);

drop policy if exists "Authenticated users can manage bar master template items" on public.bar_master_template_items;
create policy "Authenticated users can manage bar master template items"
on public.bar_master_template_items
for all
to authenticated
using (
  auth.uid() is not null
  and public.current_user_has_permission('inventory.templates.manage')
)
with check (
  auth.uid() is not null
  and public.current_user_has_permission('inventory.templates.manage')
);

drop policy if exists "Authenticated users can read bar template applications" on public.event_bar_master_template_applications;
create policy "Authenticated users can read bar template applications"
on public.event_bar_master_template_applications
for select
to authenticated
using (
  auth.uid() is not null
  and public.current_user_has_permission('inventory.view')
);

drop policy if exists "Authenticated users can create bar template applications" on public.event_bar_master_template_applications;
create policy "Authenticated users can create bar template applications"
on public.event_bar_master_template_applications
for insert
to authenticated
with check (
  auth.uid() is not null
  and (
    public.current_user_has_permission('inventory.templates.manage')
    or public.current_user_has_permission('inventory.prepare')
    or public.current_user_has_permission('inventory.manage')
  )
);

comment on table public.bar_master_templates is 'Listas maestras reutilizables por barra para sembrar materiales en eventos.';
comment on table public.bar_master_template_items is 'Items de una lista maestra de barra. Puede existir vínculo opcional a inventory_items.';
comment on column public.bar_master_template_items.inventory_item_id is 'Vínculo opcional al catálogo inventory_items. Si falta, el ítem se conserva como referencia textual.';
comment on table public.event_bar_master_template_applications is 'Bitácora de qué lista maestra se aplicó a qué evento y por quién.';

-- Mantener funciones de permisos conocidas al día para RLS basado en current_user_has_permission.
create or replace function public.get_known_permissions()
returns text[]
language sql
stable
as $$
  select array[
    'dashboard.view',
    'crm.view',
    'quotes.view',
    'events.view',
    'tasks.view',
    'tasks.manage',
    'tasks.assign',
    'tasks.update_status',
    'chat.view',
    'chat.send',
    'chat.manage',
    'notifications.view',
    'communication.view',
    'employees.view',
    'finance.view',
    'finance.manage_defaults',
    'finance.edit_quote_sheet',
    'finance.view_event_summary',
    'finance.invoices.view',
    'finance.invoices.manage',
    'finance.expenses.view',
    'finance.expenses.manage',
    'finance.expenses.approve',
    'inventory.view',
    'inventory.manage',
    'inventory.prepare',
    'inventory.templates.view',
    'inventory.templates.manage',
    'settings.view',
    'audit.view',
    'admin.users.manage'
  ]::text[];
$$;

create or replace function public.get_role_permissions(target_role text)
returns text[]
language sql
stable
as $$
  select case target_role
    when 'owner' then public.get_known_permissions()
    when 'manager' then array[
      'dashboard.view',
      'crm.view',
      'quotes.view',
      'events.view',
      'tasks.view',
      'tasks.update_status',
      'chat.view',
      'chat.send',
      'notifications.view',
      'communication.view',
      'employees.view',
      'finance.view',
      'finance.edit_quote_sheet',
      'finance.view_event_summary',
      'finance.invoices.view',
      'finance.expenses.view',
      'inventory.view',
      'inventory.manage',
      'inventory.prepare',
      'inventory.templates.view',
      'inventory.templates.manage'
    ]::text[]
    when 'empleado' then array[
      'dashboard.view',
      'tasks.view',
      'tasks.update_status',
      'chat.view',
      'chat.send',
      'notifications.view',
      'communication.view'
    ]::text[]
    else array[]::text[]
  end;
$$;
