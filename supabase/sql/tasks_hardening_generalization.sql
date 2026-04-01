-- Endurece permisos de tareas y deja base incremental para generalización sin romper event_tasks.

alter table public.event_tasks
  add column if not exists source_type text,
  add column if not exists source_event_id uuid,
  add column if not exists source_project_id uuid,
  add column if not exists source_list_id uuid,
  add column if not exists source_workspace_id uuid;

update public.event_tasks
set source_type = coalesce(source_type, 'event'),
    source_event_id = coalesce(source_event_id, event_id)
where source_type is null
   or source_event_id is null;

alter table public.event_tasks
  alter column source_type set default 'event',
  alter column source_type set not null;

alter table public.event_tasks drop constraint if exists event_tasks_source_type_check;
alter table public.event_tasks
  add constraint event_tasks_source_type_check
  check (source_type in ('event', 'project', 'list', 'workspace'));

alter table public.event_tasks drop constraint if exists event_tasks_source_event_fk;
alter table public.event_tasks
  add constraint event_tasks_source_event_fk
  foreign key (source_event_id)
  references public.events (id)
  on delete cascade;

alter table public.event_tasks drop constraint if exists event_tasks_source_event_compat_check;
alter table public.event_tasks
  add constraint event_tasks_source_event_compat_check
  check (
    source_type <> 'event'
    or (source_event_id is not null and source_event_id = event_id)
  );

comment on column public.event_tasks.source_type is 'Scope incremental de tareas. Actualmente event; preparado para project/list/workspace.';
comment on column public.event_tasks.source_event_id is 'Referencia canónica al evento origen para mantener compatibilidad con event_tasks.';
comment on column public.event_tasks.source_project_id is 'Referencia futura opcional para proyecto (sin activar módulo todavía).';
comment on column public.event_tasks.source_list_id is 'Referencia futura opcional para lista (sin activar módulo todavía).';
comment on column public.event_tasks.source_workspace_id is 'Referencia futura opcional para workspace (sin activar módulo todavía).';

create index if not exists event_tasks_source_scope_idx on public.event_tasks (source_type, source_event_id, status, due_at);

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
  t.created_by,
  t.updated_by,
  t.created_at,
  t.updated_at
from public.event_tasks t;

comment on view public.tasks_catalog is 'Vista incremental para lectura transversal de tareas sin romper event_tasks.';

grant select on public.tasks_catalog to authenticated;

drop policy if exists "Authenticated users can read event tasks" on public.event_tasks;
create policy "Authenticated users can read event tasks"
on public.event_tasks
for select
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('tasks.view')
);

drop policy if exists "Authenticated users can create event tasks" on public.event_tasks;
create policy "Authenticated users can create event tasks"
on public.event_tasks
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('tasks.manage')
  and public.current_user_has_permission('tasks.assign')
  and created_by = auth.uid()
  and updated_by = auth.uid()
  and exists (
    select 1
    from public.profiles profile
    where profile.id = assigned_profile_id
      and profile.is_active = true
  )
);

drop policy if exists "Authenticated users can update event tasks" on public.event_tasks;
create policy "Authenticated users can update event tasks"
on public.event_tasks
for update
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and (
    public.current_user_has_permission('tasks.manage')
    or public.current_user_has_permission('tasks.assign')
    or public.current_user_has_permission('tasks.update_status')
  )
)
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and (
    public.current_user_has_permission('tasks.manage')
    or public.current_user_has_permission('tasks.assign')
    or public.current_user_has_permission('tasks.update_status')
  )
  and updated_by = auth.uid()
  and exists (
    select 1
    from public.profiles profile
    where profile.id = assigned_profile_id
      and profile.is_active = true
  )
);

drop policy if exists "Authenticated users can delete event tasks" on public.event_tasks;
create policy "Authenticated users can delete event tasks"
on public.event_tasks
for delete
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('tasks.manage')
);
