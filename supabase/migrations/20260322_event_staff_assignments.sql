-- Asignación básica de personal por evento.
-- Base mínima para responsables internos por evento sin construir payroll ni disponibilidad avanzada.

create table if not exists public.event_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete restrict,
  assignment_role text not null check (assignment_role in ('lider', 'apoyo', 'setup', 'general')),
  assignment_status text not null default 'pendiente' check (assignment_status in ('pendiente', 'confirmado')),
  note text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint event_staff_assignments_unique unique (event_id, profile_id)
);

comment on table public.event_staff_assignments is 'Asignaciones básicas de personal por evento para operación diaria.';
comment on column public.event_staff_assignments.assignment_role is 'Rol operativo simple: líder, apoyo, setup o general.';
comment on column public.event_staff_assignments.assignment_status is 'Estado básico de la asignación para crecer después a confirmaciones más complejas.';

create index if not exists event_staff_assignments_event_idx on public.event_staff_assignments (event_id, assignment_status);
create index if not exists event_staff_assignments_profile_idx on public.event_staff_assignments (profile_id, assignment_role);

create or replace function public.touch_event_staff_assignments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_event_staff_assignments_updated on public.event_staff_assignments;
create trigger on_event_staff_assignments_updated
before update on public.event_staff_assignments
for each row execute procedure public.touch_event_staff_assignments_updated_at();

alter table public.event_staff_assignments enable row level security;

grant select, insert, update, delete on public.event_staff_assignments to authenticated;

drop policy if exists "Authenticated users can read event staff assignments" on public.event_staff_assignments;
create policy "Authenticated users can read event staff assignments"
on public.event_staff_assignments
for select
to authenticated
using (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can create event staff assignments" on public.event_staff_assignments;
create policy "Authenticated users can create event staff assignments"
on public.event_staff_assignments
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
    where profile.id = profile_id
      and profile.is_active = true
  )
);

drop policy if exists "Authenticated users can update event staff assignments" on public.event_staff_assignments;
create policy "Authenticated users can update event staff assignments"
on public.event_staff_assignments
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
    where profile.id = profile_id
      and profile.is_active = true
  )
);

drop policy if exists "Authenticated users can delete event staff assignments" on public.event_staff_assignments;
create policy "Authenticated users can delete event staff assignments"
on public.event_staff_assignments
for delete
to authenticated
using (auth.uid() is not null and public.current_user_is_active());
