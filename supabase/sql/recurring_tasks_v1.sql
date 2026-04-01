-- Reglas recurrentes v1 para materializar tareas reales en event_tasks.

create table if not exists public.recurring_task_rules (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  internal_note text,
  assigned_profile_id uuid references public.profiles (id) on delete restrict,
  priority text not null default 'media' check (priority in ('baja', 'media', 'alta', 'urgente')),
  status_template text not null default 'pendiente' check (status_template in ('pendiente', 'en_progreso', 'completada', 'bloqueada')),
  cadence_type text not null check (cadence_type in ('daily', 'weekly', 'monthly')),
  interval_count integer not null default 1 check (interval_count > 0 and interval_count <= 30),
  day_of_week integer check (day_of_week between 0 and 6),
  day_of_month integer check (day_of_month between 1 and 31),
  start_date date not null,
  due_time time not null default '09:00:00',
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint recurring_task_rules_weekly_dow_check check (
    cadence_type <> 'weekly' or day_of_week is not null
  ),
  constraint recurring_task_rules_monthly_dom_check check (
    cadence_type <> 'monthly' or day_of_month is not null
  )
);

create index if not exists recurring_task_rules_event_idx
  on public.recurring_task_rules (event_id, is_active, next_run_at);
create index if not exists recurring_task_rules_assigned_profile_idx
  on public.recurring_task_rules (assigned_profile_id, is_active, next_run_at);

create table if not exists public.recurring_task_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.recurring_task_rules (id) on delete cascade,
  scheduled_for timestamptz not null,
  generated_task_id uuid references public.event_tasks (id) on delete set null,
  run_status text not null check (run_status in ('success', 'skipped', 'error')),
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint recurring_task_runs_rule_schedule_unique unique (rule_id, scheduled_for)
);

create index if not exists recurring_task_runs_rule_idx
  on public.recurring_task_runs (rule_id, created_at desc);

alter table public.event_tasks
  add column if not exists recurring_rule_id uuid,
  add column if not exists recurring_scheduled_for timestamptz;

alter table public.event_tasks drop constraint if exists event_tasks_recurring_rule_fk;
alter table public.event_tasks
  add constraint event_tasks_recurring_rule_fk
  foreign key (recurring_rule_id)
  references public.recurring_task_rules (id)
  on delete set null;

create unique index if not exists event_tasks_recurring_instance_unique
  on public.event_tasks (recurring_rule_id, recurring_scheduled_for)
  where recurring_rule_id is not null and recurring_scheduled_for is not null;

comment on table public.recurring_task_rules is 'Reglas recurrentes v1 para generar tareas operativas reales ligadas a eventos.';
comment on table public.recurring_task_runs is 'Trazabilidad de ejecuciones de reglas recurrentes para idempotencia y depuración.';
comment on column public.event_tasks.recurring_rule_id is 'Regla recurrente origen cuando la tarea fue materializada automáticamente.';
comment on column public.event_tasks.recurring_scheduled_for is 'Fecha/hora objetivo del ciclo que originó esta tarea recurrente.';

create or replace function public.touch_recurring_task_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_recurring_task_rules_updated on public.recurring_task_rules;
create trigger on_recurring_task_rules_updated
before update on public.recurring_task_rules
for each row execute procedure public.touch_recurring_task_rules_updated_at();

alter table public.recurring_task_rules enable row level security;
alter table public.recurring_task_runs enable row level security;

grant select, insert, update, delete on public.recurring_task_rules to authenticated;
grant select, insert on public.recurring_task_runs to authenticated;

drop policy if exists "Authenticated users can read recurring task rules" on public.recurring_task_rules;
create policy "Authenticated users can read recurring task rules"
on public.recurring_task_rules
for select
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('tasks.view')
);

drop policy if exists "Authenticated users can create recurring task rules" on public.recurring_task_rules;
create policy "Authenticated users can create recurring task rules"
on public.recurring_task_rules
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('tasks.manage')
  and created_by = auth.uid()
  and updated_by = auth.uid()
  and (
    assigned_profile_id is null
    or exists (
      select 1
      from public.profiles profile
      where profile.id = assigned_profile_id
        and profile.is_active = true
    )
  )
);

drop policy if exists "Authenticated users can update recurring task rules" on public.recurring_task_rules;
create policy "Authenticated users can update recurring task rules"
on public.recurring_task_rules
for update
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('tasks.manage')
)
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('tasks.manage')
  and updated_by = auth.uid()
  and (
    assigned_profile_id is null
    or exists (
      select 1
      from public.profiles profile
      where profile.id = assigned_profile_id
        and profile.is_active = true
    )
  )
);

drop policy if exists "Authenticated users can delete recurring task rules" on public.recurring_task_rules;
create policy "Authenticated users can delete recurring task rules"
on public.recurring_task_rules
for delete
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('tasks.manage')
);

drop policy if exists "Authenticated users can read recurring task runs" on public.recurring_task_runs;
create policy "Authenticated users can read recurring task runs"
on public.recurring_task_runs
for select
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('tasks.view')
  and exists (
    select 1
    from public.recurring_task_rules rule
    where rule.id = recurring_task_runs.rule_id
  )
);

drop policy if exists "Authenticated users can create recurring task runs" on public.recurring_task_runs;
create policy "Authenticated users can create recurring task runs"
on public.recurring_task_runs
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('tasks.manage')
);

create or replace view public.tasks_catalog as
select
  t.id,
  t.event_id,
  t.source_type,
  t.source_event_id,
  t.source_project_id,
  t.source_list_id,
  t.source_workspace_id,
  t.assigned_profile_id,
  t.title,
  t.description,
  t.priority,
  t.status,
  t.due_at,
  t.internal_note,
  t.recurring_rule_id,
  t.recurring_scheduled_for,
  t.created_by,
  t.updated_by,
  t.created_at,
  t.updated_at
from public.event_tasks t;

grant select on public.tasks_catalog to authenticated;
