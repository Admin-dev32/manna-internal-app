-- Team Leader QC checkpoints foundation.
-- Base persistente para checkpoints operativos con evidencia obligatoria por evento y Team Leader.

create table if not exists public.team_leader_qc_checkpoints (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  team_leader_assignment_id uuid not null references public.event_staff_assignments (id) on delete cascade,
  checkpoint_key text not null check (checkpoint_key in (
    'arrival_at_event',
    'setup_ready',
    'mid_service',
    'post_service_pre_clean',
    'post_cleaning',
    'final_closeout_inventory'
  )),
  order_index integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'approved', 'observed')),
  report_id uuid references public.employee_event_reports (id) on delete set null,
  comment text,
  recorded_at timestamptz,
  submitted_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz,
  review_notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint team_leader_qc_checkpoints_unique unique (event_id, team_leader_assignment_id, checkpoint_key)
);

create index if not exists team_leader_qc_checkpoints_event_idx
  on public.team_leader_qc_checkpoints (event_id, team_leader_assignment_id, order_index);
create index if not exists team_leader_qc_checkpoints_status_idx
  on public.team_leader_qc_checkpoints (status, updated_at desc);

create or replace function public.touch_team_leader_qc_checkpoints_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_team_leader_qc_checkpoints_updated on public.team_leader_qc_checkpoints;
create trigger on_team_leader_qc_checkpoints_updated
before update on public.team_leader_qc_checkpoints
for each row execute procedure public.touch_team_leader_qc_checkpoints_updated_at();

alter table public.team_leader_qc_checkpoints enable row level security;

grant select, insert, update on public.team_leader_qc_checkpoints to authenticated;

drop policy if exists "Authenticated users can read team leader qc checkpoints" on public.team_leader_qc_checkpoints;
create policy "Authenticated users can read team leader qc checkpoints"
on public.team_leader_qc_checkpoints
for select
to authenticated
using (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can create team leader qc checkpoints" on public.team_leader_qc_checkpoints;
create policy "Authenticated users can create team leader qc checkpoints"
on public.team_leader_qc_checkpoints
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_user_is_active()
);

drop policy if exists "Authenticated users can update team leader qc checkpoints" on public.team_leader_qc_checkpoints;
create policy "Authenticated users can update team leader qc checkpoints"
on public.team_leader_qc_checkpoints
for update
to authenticated
using (
  auth.uid() is not null
  and public.current_user_is_active()
)
with check (
  auth.uid() is not null
  and public.current_user_is_active()
);

comment on table public.team_leader_qc_checkpoints is 'Checkpoints de control de calidad para Team Leader por evento y asignación.';
comment on column public.team_leader_qc_checkpoints.report_id is 'Reporte existente de employee_event_reports que contiene evidencia del checkpoint.';
comment on column public.team_leader_qc_checkpoints.status is 'Estado operativo QC: pending, submitted, approved u observed.';
