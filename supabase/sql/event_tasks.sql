-- Tareas operativas mínimas por evento y responsable.
-- Base preparada para crecer después a recordatorios, automatizaciones y operación más compleja.

create table if not exists public.event_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  assigned_profile_id uuid not null references public.profiles (id) on delete restrict,
  title text not null,
  description text,
  priority text not null default 'media' check (priority in ('baja', 'media', 'alta', 'urgente')),
  status text not null default 'pendiente' check (status in ('pendiente', 'en_progreso', 'completada', 'bloqueada')),
  due_at timestamptz,
  internal_note text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint event_tasks_event_staff_fk foreign key (event_id, assigned_profile_id)
    references public.event_staff_assignments (event_id, profile_id)
    on delete restrict
);

comment on table public.event_tasks is 'Tareas operativas mínimas por evento para responsables internos ya asignados.';
comment on column public.event_tasks.assigned_profile_id is 'Responsable de la tarea, restringido al staff ya asignado al evento.';
comment on column public.event_tasks.internal_note is 'Contexto interno breve para seguimiento operativo de la tarea.';

create index if not exists event_tasks_event_status_idx on public.event_tasks (event_id, status, priority);
create index if not exists event_tasks_assigned_profile_idx on public.event_tasks (assigned_profile_id, status, due_at);
create index if not exists event_tasks_due_at_idx on public.event_tasks (due_at, status);

create or replace function public.touch_event_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_event_tasks_updated on public.event_tasks;
create trigger on_event_tasks_updated
before update on public.event_tasks
for each row execute procedure public.touch_event_tasks_updated_at();

alter table public.event_tasks enable row level security;

grant select, insert, update, delete on public.event_tasks to authenticated;

drop policy if exists "Authenticated users can read event tasks" on public.event_tasks;
create policy "Authenticated users can read event tasks"
on public.event_tasks
for select
to authenticated
using (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can create event tasks" on public.event_tasks;
create policy "Authenticated users can create event tasks"
on public.event_tasks
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_user_is_active()
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
using (auth.uid() is not null and public.current_user_is_active())
with check (
  auth.uid() is not null
  and public.current_user_is_active()
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
using (auth.uid() is not null and public.current_user_is_active());
