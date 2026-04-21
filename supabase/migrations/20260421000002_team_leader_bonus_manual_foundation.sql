-- Team Leader manual-first compliance / bonus recommendation foundation (Phase D).

create table if not exists public.team_leader_bonus_recommendations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  team_leader_assignment_id uuid not null references public.event_staff_assignments (id) on delete cascade,
  compliance_status text not null default 'con_observaciones' check (compliance_status in ('conforme', 'con_observaciones', 'no_conforme')),
  recommendation_status text not null default 'pending' check (recommendation_status in ('recommended', 'not_recommended', 'pending')),
  suggested_bonus_amount numeric(10, 2),
  supervisor_note text,
  recommended_by uuid references public.profiles (id) on delete set null,
  recommended_at timestamptz,
  final_decision_status text not null default 'pending' check (final_decision_status in ('pending', 'approved', 'rejected')),
  final_bonus_amount numeric(10, 2),
  final_note text,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint team_leader_bonus_recommendations_unique unique (event_id, team_leader_assignment_id)
);

create index if not exists team_leader_bonus_recommendations_event_idx
  on public.team_leader_bonus_recommendations (event_id, updated_at desc);
create index if not exists team_leader_bonus_recommendations_recommendation_idx
  on public.team_leader_bonus_recommendations (recommendation_status, final_decision_status, updated_at desc);

create or replace function public.touch_team_leader_bonus_recommendations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_team_leader_bonus_recommendations_updated on public.team_leader_bonus_recommendations;
create trigger on_team_leader_bonus_recommendations_updated
before update on public.team_leader_bonus_recommendations
for each row execute procedure public.touch_team_leader_bonus_recommendations_updated_at();

alter table public.team_leader_bonus_recommendations enable row level security;
grant select, insert, update on public.team_leader_bonus_recommendations to authenticated;

drop policy if exists "Authenticated users can read team leader bonus recommendations" on public.team_leader_bonus_recommendations;
create policy "Authenticated users can read team leader bonus recommendations"
on public.team_leader_bonus_recommendations
for select
to authenticated
using (auth.uid() is not null and public.current_user_is_active());

drop policy if exists "Authenticated users can create team leader bonus recommendations" on public.team_leader_bonus_recommendations;
create policy "Authenticated users can create team leader bonus recommendations"
on public.team_leader_bonus_recommendations
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.current_user_is_active()
);

drop policy if exists "Authenticated users can update team leader bonus recommendations" on public.team_leader_bonus_recommendations;
create policy "Authenticated users can update team leader bonus recommendations"
on public.team_leader_bonus_recommendations
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

comment on table public.team_leader_bonus_recommendations is 'Decisión manual-first de cumplimiento/bonus para Team Leader por evento.';
comment on column public.team_leader_bonus_recommendations.recommendation_status is 'Recomendación del supervisor: recomendado, no recomendado o pendiente.';
comment on column public.team_leader_bonus_recommendations.final_decision_status is 'Decisión de Owner/Main Office: pending, approved o rejected.';
