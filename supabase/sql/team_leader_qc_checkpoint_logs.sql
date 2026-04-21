-- Team Leader QC checkpoint lifecycle logs (Phase C recapturas / re-submission workflow).

create table if not exists public.team_leader_qc_checkpoint_logs (
  id uuid primary key default gen_random_uuid(),
  checkpoint_id uuid not null references public.team_leader_qc_checkpoints (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  team_leader_assignment_id uuid not null references public.event_staff_assignments (id) on delete cascade,
  status_snapshot text not null check (status_snapshot in ('pending', 'submitted', 'approved', 'observed')),
  action_kind text not null check (action_kind in ('submitted', 'observed', 'resubmitted', 'approved', 'returned_to_submitted')),
  actor_profile_id uuid not null references public.profiles (id) on delete restrict,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists team_leader_qc_checkpoint_logs_checkpoint_idx
  on public.team_leader_qc_checkpoint_logs (checkpoint_id, created_at desc);
create index if not exists team_leader_qc_checkpoint_logs_event_idx
  on public.team_leader_qc_checkpoint_logs (event_id, created_at desc);

alter table public.team_leader_qc_checkpoint_logs enable row level security;

grant select, insert on public.team_leader_qc_checkpoint_logs to authenticated;

drop policy if exists "Authenticated users can read team leader qc checkpoint logs" on public.team_leader_qc_checkpoint_logs;
create policy "Authenticated users can read team leader qc checkpoint logs"
on public.team_leader_qc_checkpoint_logs
for select
to authenticated
using (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can create team leader qc checkpoint logs" on public.team_leader_qc_checkpoint_logs;
create policy "Authenticated users can create team leader qc checkpoint logs"
on public.team_leader_qc_checkpoint_logs
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_user_is_active()
  and actor_profile_id = auth.uid()
);

comment on table public.team_leader_qc_checkpoint_logs is 'Historial operativo simple del ciclo QC por checkpoint: envío, observación, recaptura y aprobación.';
comment on column public.team_leader_qc_checkpoint_logs.action_kind is 'Tipo de transición del ciclo QC (submitted, observed, resubmitted, approved, returned_to_submitted).';
