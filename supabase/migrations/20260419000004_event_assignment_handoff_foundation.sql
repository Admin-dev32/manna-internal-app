-- Event Assignment + Handoff Foundation

alter table public.event_staff_assignments
  add column if not exists is_supervisor_responsible boolean not null default false,
  add column if not exists is_team_leader_responsible boolean not null default false,
  add column if not exists responded_by uuid references public.profiles (id) on delete set null,
  add column if not exists responded_at timestamptz,
  add column if not exists response_note text;

alter table public.event_staff_assignments
  drop constraint if exists event_staff_assignments_assignment_role_check;

alter table public.event_staff_assignments
  add constraint event_staff_assignments_assignment_role_check
  check (assignment_role in ('supervisor', 'team_leader', 'assistant', 'lider', 'apoyo', 'setup', 'general'));

alter table public.event_staff_assignments
  drop constraint if exists event_staff_assignments_assignment_status_check;

alter table public.event_staff_assignments
  add constraint event_staff_assignments_assignment_status_check
  check (assignment_status in ('pendiente', 'pending_acceptance', 'confirmado', 'accepted', 'rejected'));

create unique index if not exists event_staff_assignments_one_supervisor_per_event_idx
  on public.event_staff_assignments (event_id)
  where is_supervisor_responsible = true;

create unique index if not exists event_staff_assignments_one_team_leader_per_event_idx
  on public.event_staff_assignments (event_id)
  where is_team_leader_responsible = true;

create index if not exists event_staff_assignments_status_idx
  on public.event_staff_assignments (assignment_status, updated_at desc);

create table if not exists public.event_operational_handoff_state (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete cascade,
  handoff_status text not null default 'draft',
  target_team_leader_assignment_id uuid references public.event_staff_assignments (id) on delete set null,
  ready_note text,
  ready_by uuid references public.profiles (id) on delete set null,
  ready_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.event_operational_handoff_state
  drop constraint if exists event_operational_handoff_state_status_check;

alter table public.event_operational_handoff_state
  add constraint event_operational_handoff_state_status_check
  check (handoff_status in ('draft', 'ready_for_handoff', 'handed_off'));

create index if not exists event_operational_handoff_state_status_idx
  on public.event_operational_handoff_state (handoff_status, updated_at desc);

create or replace function public.touch_event_operational_handoff_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_event_operational_handoff_state_updated on public.event_operational_handoff_state;
create trigger on_event_operational_handoff_state_updated
before update on public.event_operational_handoff_state
for each row execute procedure public.touch_event_operational_handoff_state_updated_at();

insert into public.event_operational_handoff_state (event_id)
select e.id
from public.events e
left join public.event_operational_handoff_state hs on hs.event_id = e.id
where hs.id is null;

alter table public.event_operational_handoff_state enable row level security;

grant select, insert, update on public.event_operational_handoff_state to authenticated;

drop policy if exists "Authenticated users can read event handoff state" on public.event_operational_handoff_state;
create policy "Authenticated users can read event handoff state"
on public.event_operational_handoff_state
for select
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
  and public.current_user_has_permission('events.view')
);

drop policy if exists "Authenticated users can create event handoff state" on public.event_operational_handoff_state;
create policy "Authenticated users can create event handoff state"
on public.event_operational_handoff_state
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and (
    public.current_user_has_permission('inventory.prepare')
    or public.current_user_has_permission('inventory.manage')
  )
);

drop policy if exists "Authenticated users can update event handoff state" on public.event_operational_handoff_state;
create policy "Authenticated users can update event handoff state"
on public.event_operational_handoff_state
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
);

comment on table public.event_operational_handoff_state is 'Estado operativo de handoff entre supervisor y team leader por evento.';
comment on column public.event_staff_assignments.is_supervisor_responsible is 'Marca al supervisor responsable operativo del evento.';
comment on column public.event_staff_assignments.is_team_leader_responsible is 'Marca al team leader principal del evento.';
comment on column public.event_staff_assignments.response_note is 'Nota opcional del empleado al aceptar/rechazar la asignación.';
